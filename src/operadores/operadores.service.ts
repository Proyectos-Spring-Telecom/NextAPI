import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Operadores } from 'src/entities/Operadores';
import { Usuarios } from 'src/entities/Usuarios';
import { Licencias } from 'src/entities/Licencias';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { S3Service } from 'src/s3/s3.service';
import { CreateOperadoresDto } from './dto/create-operadores.dto';
import { UpdateOperadoresDto } from './dto/update-operadores.dto';
import { CreateLicenciaDto } from './dto/create-licencia.dto';
import { UpdateLicenciaDto } from './dto/update-licencia.dto';
import { mapOperadorPlano, type OperadorPlano } from './map-operadores.util';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import { EnumModulos } from 'src/common/estatus.enum';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';

const ID_MODULO_OPERADORES = EnumModulos.OPERADORES;
const ID_MODULO_LICENCIAS = EnumModulos.LICENCIAS;
const S3_FOLDER = 'operadores';

type OperadorDocFiles = {
  identificacion?: Express.Multer.File;
  foto?: Express.Multer.File;
  comprobanteDomicilio?: Express.Multer.File;
  certificadoMedico?: Express.Multer.File;
  antecedentesNoPenales?: Express.Multer.File;
  /** Solo create (documento de la primera licencia → tabla Licencias). */
  licencia?: Express.Multer.File;
};

@Injectable()
export class OperadoresService {
  constructor(
    @InjectRepository(Operadores)
    private readonly repository: Repository<Operadores>,
    @InjectRepository(Usuarios)
    private readonly usuariosRepo: Repository<Usuarios>,
    @InjectRepository(Licencias)
    private readonly licenciasRepo: Repository<Licencias>,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly tenantFilter: TenantFilterService,
    private readonly s3Service: S3Service,
  ) {}

  async create(
    dto: CreateOperadoresDto,
    idClienteToken: number,
    rol: number,
    idUser: number,
    files: OperadorDocFiles = {},
  ): Promise<ApiCrudResponse> {
    try {
      const usuario = await this.usuariosRepo.findOne({
        where: { id: dto.idUsuario },
      });
      if (!usuario) {
        throw new BadRequestException('IdUsuario no existe');
      }

      const idCliente = Number(usuario.idCliente);
      if (!Number.isFinite(idCliente) || idCliente < 1) {
        throw new BadRequestException(
          'El usuario no tiene un IdCliente válido',
        );
      }

      const scope = await this.tenantFilter.idsClientePermitidos(
        rol,
        idClienteToken,
      );
      if (!this.tenantFilter.clienteVisibleEnScope(scope, idCliente)) {
        throw new ForbiddenException(
          'No puedes crear operadores para el cliente de ese usuario',
        );
      }

      const operadorConUsuario = await this.repository.findOne({
        where: { idUsuario: dto.idUsuario },
      });
      if (operadorConUsuario) {
        throw new BadRequestException(
          'El usuario ya está vinculado a otro operador',
        );
      }

      const existeCURP = await this.repository.findOne({
        where: { idCliente, curp: dto.curp },
      });
      if (existeCURP) {
        throw new BadRequestException('El CURP ya existe para este cliente');
      }

      const existeNSS = await this.repository.findOne({
        where: { idCliente, nss: dto.nss },
      });
      if (existeNSS) {
        throw new BadRequestException('El NSS ya existe para este cliente');
      }

      const existeLicencia = await this.licenciasRepo.findOne({
        where: { numeroLicencia: dto.numeroLicencia },
      });
      if (existeLicencia) {
        throw new BadRequestException('El número de licencia ya está registrado');
      }

      const docs = await this.resolveDocsOnCreate(dto, files, idUser);

      const entity = this.repository.create({
        idCliente,
        idUsuario: dto.idUsuario,
        fechaNacimiento: new Date(dto.fechaNacimiento),
        curp: dto.curp,
        nss: dto.nss,
        contactoEmergenciaNombre: dto.contactoEmergenciaNombre,
        contactoEmergenciaTelefono: dto.contactoEmergenciaTelefono,
        identificacion: docs.identificacion,
        foto: docs.foto,
        comprobanteDomicilio: docs.comprobanteDomicilio,
        certificadoMedico: docs.certificadoMedico,
        antecedentesNoPenales: docs.antecedentesNoPenales,
        estatus: 1,
      });

      const saved = await this.repository.save(entity);

      const licenciaEntity = this.licenciasRepo.create({
        idOperador: saved.id,
        numeroLicencia: dto.numeroLicencia,
        licencia: docs.licencia,
        fechaExpedicion: new Date(dto.fechaExpedicion),
        fechaVencimiento: new Date(dto.fechaVencimiento),
        idTipoLicencia: dto.idTipoLicencia,
        idCategoriaLicencia: dto.idCategoriaLicencia,
        estatus: 1,
      });
      await this.licenciasRepo.save(licenciaEntity);

      await this.bitacoraLogger.logToBitacora(
        'Operadores',
        `Se creó el operador ID: ${saved.id} (Usuario: ${dto.idUsuario})`,
        'CREATE',
        { dto, idCliente },
        idUser,
        ID_MODULO_OPERADORES,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Operador creado correctamente',
        data: { id: Number(saved.id), nombre: `Operador ${saved.id}` },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Operadores',
        `Error al crear operador (Usuario: ${dto.idUsuario})`,
        'CREATE',
        { dto, idClienteToken },
        idUser,
        ID_MODULO_OPERADORES,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findAllList(
    idCliente: number,
    rol: number,
  ): Promise<ApiResponseCommon> {
    try {
      const tenant = await this.tenantFilter.forTypeOrmIdCliente(
        rol,
        idCliente,
      );
      if (tenant.sinAcceso) {
        return { data: [] };
      }

      const qb = this.repository
        .createQueryBuilder('o')
        .innerJoin(Usuarios, 'u', 'u.id = o.idUsuario')
        .select(this.selectOperadorUsuarioColumns())
        .where('o.estatus = :activo', { activo: 1 })
        .orderBy('o.id', 'ASC');

      if (tenant.idCliente !== undefined) {
        qb.andWhere('o.idCliente = :idCliente', {
          idCliente: tenant.idCliente,
        });
      }

      const rows = await qb.getRawMany<Record<string, unknown>>();
      const data = await this.hydrateOperadoresPlanos(rows);
      return { data };
    } catch (error) {
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findAll(
    idCliente: number,
    rol: number,
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    try {
      const tenant = await this.tenantFilter.forTypeOrmIdCliente(
        rol,
        idCliente,
      );
      if (tenant.sinAcceso) {
        return {
          data: [],
          paginated: {
            total: 0,
            page,
            limit,
            totalPages: 0,
          },
        };
      }

      const qb = this.repository
        .createQueryBuilder('o')
        .innerJoin(Usuarios, 'u', 'u.id = o.idUsuario')
        .select(this.selectOperadorUsuarioColumns())
        .orderBy('o.id', 'ASC')
        .skip((page - 1) * limit)
        .take(limit);

      if (tenant.idCliente !== undefined) {
        qb.andWhere('o.idCliente = :idCliente', {
          idCliente: tenant.idCliente,
        });
      }

      const countQb = this.repository
        .createQueryBuilder('o')
        .select('COUNT(o.id)', 'cnt');
      if (tenant.idCliente !== undefined) {
        countQb.where('o.idCliente = :idCliente', {
          idCliente: tenant.idCliente,
        });
      }
      const total = Number((await countQb.getRawOne())?.cnt ?? 0);

      const rows = await qb.getRawMany<Record<string, unknown>>();
      const data = await this.hydrateOperadoresPlanos(rows);

      return {
        data,
        paginated: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 0,
        },
      };
    } catch (error) {
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findOne(
    id: number,
    idClienteToken: number,
    rol: number,
  ): Promise<{ data: OperadorPlano }> {
    try {
      await this.resolveOperadorVisible(id, idClienteToken, rol);

      const row = await this.repository
        .createQueryBuilder('o')
        .innerJoin(Usuarios, 'u', 'u.id = o.idUsuario')
        .select(this.selectOperadorUsuarioColumns())
        .where('o.id = :id', { id })
        .getRawOne<Record<string, unknown>>();

      if (!row) {
        throw new NotFoundException('Operador no encontrado');
      }

      const [data] = await this.hydrateOperadoresPlanos([row]);
      return { data };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { message: 'Error al buscar el operador' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** Columnas operador + usuario público (sin PasswordHash / PinHash / tokens). */
  private selectOperadorUsuarioColumns(): string[] {
    return [
      'o.id AS id',
      'o.idCliente AS idCliente',
      'o.idUsuario AS idUsuario',
      'o.fechaNacimiento AS fechaNacimiento',
      'o.curp AS curp',
      'o.nss AS nss',
      'o.contactoEmergenciaNombre AS contactoEmergenciaNombre',
      'o.contactoEmergenciaTelefono AS contactoEmergenciaTelefono',
      'o.identificacion AS identificacion',
      'o.foto AS foto',
      'o.comprobanteDomicilio AS comprobanteDomicilio',
      'o.certificadoMedico AS certificadoMedico',
      'o.antecedentesNoPenales AS antecedentesNoPenales',
      'o.estatus AS estatus',
      'o.fechaCreacion AS fechaCreacion',
      'o.fechaActualizacion AS fechaActualizacion',
      'u.userName AS userName',
      'u.nombre AS nombre',
      'u.apellidoPaterno AS apellidoPaterno',
      'u.apellidoMaterno AS apellidoMaterno',
      'u.telefono AS telefono',
      'u.fotoPerfil AS fotoPerfil',
      'u.emailConfirmado AS emailConfirmado',
      'u.idRol AS idRol',
      'u.nivelAcceso AS nivelAcceso',
      'u.estatus AS estatusUsuario',
      'u.ultimoLogin AS ultimoLogin',
    ];
  }

  private async hydrateOperadoresPlanos(
    rows: Record<string, unknown>[],
  ): Promise<OperadorPlano[]> {
    if (!rows.length) return [];

    const ids = rows.map((r) => Number(r.id)).filter((id) => Number.isFinite(id));
    const licencias = ids.length
      ? await this.licenciasRepo.find({
          where: { idOperador: In(ids) },
          order: { id: 'ASC' },
        })
      : [];

    const byOperador = new Map<number, Licencias[]>();
    for (const lic of licencias) {
      const oid = Number(lic.idOperador);
      const list = byOperador.get(oid);
      if (list) list.push(lic);
      else byOperador.set(oid, [lic]);
    }

    return rows.map((row) =>
      mapOperadorPlano({
        operador: {
          id: row.id,
          idCliente: row.idCliente,
          idUsuario: row.idUsuario,
          fechaNacimiento: row.fechaNacimiento,
          curp: row.curp,
          nss: row.nss,
          contactoEmergenciaNombre: row.contactoEmergenciaNombre,
          contactoEmergenciaTelefono: row.contactoEmergenciaTelefono,
          identificacion: row.identificacion,
          foto: row.foto,
          comprobanteDomicilio: row.comprobanteDomicilio,
          certificadoMedico: row.certificadoMedico,
          antecedentesNoPenales: row.antecedentesNoPenales,
          estatus: row.estatus,
          fechaCreacion: row.fechaCreacion,
          fechaActualizacion: row.fechaActualizacion,
        },
        usuario: {
          userName: row.userName,
          nombre: row.nombre,
          apellidoPaterno: row.apellidoPaterno,
          apellidoMaterno: row.apellidoMaterno,
          telefono: row.telefono,
          fotoPerfil: row.fotoPerfil,
          emailConfirmado: row.emailConfirmado,
          idRol: row.idRol,
          nivelAcceso: row.nivelAcceso,
          estatus: row.estatusUsuario,
          ultimoLogin: row.ultimoLogin,
        },
        licencias: byOperador.get(Number(row.id)) ?? [],
      }),
    );
  }

  async update(
    id: number,
    dto: UpdateOperadoresDto,
    idCliente: number,
    idUser: number,
    files: OperadorDocFiles = {},
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({
        where: { id, idCliente },
      });
      if (!entity) {
        throw new NotFoundException('Operador no encontrado');
      }

      if (dto.idUsuario !== undefined && dto.idUsuario !== entity.idUsuario) {
        const usuario = await this.usuariosRepo.findOne({
          where: { id: dto.idUsuario },
        });
        if (!usuario) {
          throw new BadRequestException('IdUsuario no existe');
        }
        if (usuario.idCliente !== idCliente) {
          throw new BadRequestException(
            'El usuario debe pertenecer al mismo cliente',
          );
        }
        const operadorConUsuario = await this.repository.findOne({
          where: { idUsuario: dto.idUsuario },
        });
        if (operadorConUsuario && operadorConUsuario.id !== id) {
          throw new BadRequestException(
            'El usuario ya está vinculado a otro operador',
          );
        }
      }

      if (dto.curp && dto.curp !== entity.curp) {
        const existeCURP = await this.repository.findOne({
          where: { idCliente, curp: dto.curp },
        });
        if (existeCURP) {
          throw new BadRequestException('El CURP ya existe para este cliente');
        }
      }

      if (dto.nss && dto.nss !== entity.nss) {
        const existeNSS = await this.repository.findOne({
          where: { idCliente, nss: dto.nss },
        });
        if (existeNSS) {
          throw new BadRequestException('El NSS ya existe para este cliente');
        }
      }

      const updateData: Partial<Operadores> = {};
      if (dto.idUsuario !== undefined) updateData.idUsuario = dto.idUsuario;
      if (dto.fechaNacimiento !== undefined)
        updateData.fechaNacimiento = new Date(dto.fechaNacimiento);
      if (dto.curp !== undefined) updateData.curp = dto.curp;
      if (dto.nss !== undefined) updateData.nss = dto.nss;
      if (dto.contactoEmergenciaNombre !== undefined)
        updateData.contactoEmergenciaNombre = dto.contactoEmergenciaNombre;
      if (dto.contactoEmergenciaTelefono !== undefined)
        updateData.contactoEmergenciaTelefono = dto.contactoEmergenciaTelefono;

      Object.assign(
        updateData,
        await this.resolveDocsOnUpdate(entity, dto, files, idUser),
      );

      await this.repository.update(id, updateData);

      await this.bitacoraLogger.logToBitacora(
        'Operadores',
        `Se actualizó el operador ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        ID_MODULO_OPERADORES,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Operador actualizado correctamente',
        data: {
          id,
          nombre: `Operador ${id}`,
        },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Operadores',
        `Error al actualizar operador ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        ID_MODULO_OPERADORES,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async updateEstatus(
    id: number,
    idCliente: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({
        where: { id, idCliente },
      });
      if (!entity) {
        throw new NotFoundException('Operador no encontrado');
      }

      const estatusAnterior = Number(entity.estatus) === 1 ? 1 : 0;
      const estatus = estatusAnterior === 1 ? 0 : 1;
      await this.repository.update(id, { estatus });

      await this.bitacoraLogger.logToBitacora(
        'Operadores',
        `Se actualizó estatus de operador ID: ${id} a ${estatus}`,
        'UPDATE',
        { id, estatusAnterior, estatus, idCliente },
        idUser,
        ID_MODULO_OPERADORES,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Estatus actualizado correctamente',
        estatus: { estatus },
        data: { id, nombre: `Operador ${id}` },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Operadores',
        `Error al actualizar estatus de operador ID: ${id}`,
        'UPDATE',
        { id, idCliente },
        idUser,
        ID_MODULO_OPERADORES,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Error al cambiar estatus del operador',
      );
    }
  }

  private urlFromBody(v: string | null | undefined): string | null {
    return v && String(v).trim() ? String(v).trim() : null;
  }

  private async resolveDocsOnCreate(
    dto: CreateOperadoresDto,
    files: OperadorDocFiles,
    idUser: number,
  ): Promise<{
    identificacion: string;
    foto: string | null;
    comprobanteDomicilio: string | null;
    certificadoMedico: string | null;
    antecedentesNoPenales: string | null;
    licencia: string;
  }> {
    let identificacion = this.urlFromBody(dto.identificacion);
    let foto = this.urlFromBody(dto.foto);
    let comprobanteDomicilio = this.urlFromBody(dto.comprobanteDomicilio);
    let certificadoMedico = this.urlFromBody(dto.certificadoMedico);
    let antecedentesNoPenales = this.urlFromBody(dto.antecedentesNoPenales);
    let licencia = this.urlFromBody(dto.licencia);

    const upload = async (file: Express.Multer.File) => {
      const { url } = await this.s3Service.uploadFile(
        file,
        S3_FOLDER,
        idUser,
        ID_MODULO_OPERADORES,
      );
      return url;
    };

    if (files.identificacion) {
      identificacion = await upload(files.identificacion);
    }
    if (files.foto) {
      foto = await upload(files.foto);
    }
    if (files.comprobanteDomicilio) {
      comprobanteDomicilio = await upload(files.comprobanteDomicilio);
    }
    if (files.certificadoMedico) {
      certificadoMedico = await upload(files.certificadoMedico);
    }
    if (files.antecedentesNoPenales) {
      antecedentesNoPenales = await upload(files.antecedentesNoPenales);
    }
    if (files.licencia) {
      licencia = await upload(files.licencia);
    }

    if (!identificacion?.trim()) {
      throw new BadRequestException(
        'Debe proporcionar la identificación (URL o archivo PNG/JPEG/PDF).',
      );
    }
    if (!licencia?.trim()) {
      throw new BadRequestException(
        'Debe proporcionar el documento de la licencia (URL o archivo PNG/JPEG/PDF).',
      );
    }

    return {
      identificacion,
      foto,
      comprobanteDomicilio,
      certificadoMedico,
      antecedentesNoPenales,
      licencia,
    };
  }

  private async resolveDocsOnUpdate(
    entity: Operadores,
    dto: UpdateOperadoresDto,
    files: OperadorDocFiles,
    idUser: number,
  ): Promise<Partial<Operadores>> {
    const payload: Partial<Operadores> = {};

    const apply = async (
      field: keyof OperadorDocFiles,
      currentUrl: string | null,
      dtoValue: string | undefined,
    ) => {
      const file = files[field];
      if (file) {
        const { url } = await this.s3Service.updateFile(
          currentUrl,
          file,
          S3_FOLDER,
          idUser,
          ID_MODULO_OPERADORES,
        );
        (payload as Record<string, unknown>)[field] = url;
      } else if (dtoValue !== undefined) {
        (payload as Record<string, unknown>)[field] = dtoValue;
      }
    };

    await apply('identificacion', entity.identificacion, dto.identificacion);
    await apply('foto', entity.foto, dto.foto);
    await apply(
      'comprobanteDomicilio',
      entity.comprobanteDomicilio,
      dto.comprobanteDomicilio,
    );
    await apply(
      'certificadoMedico',
      entity.certificadoMedico,
      dto.certificadoMedico,
    );
    await apply(
      'antecedentesNoPenales',
      entity.antecedentesNoPenales,
      dto.antecedentesNoPenales,
    );

    return payload;
  }

  /**
   * Alta de licencia adicional para un operador existente.
   * Documento `licencia`: URL o archivo PNG/JPEG/PDF → S3.
   */
  async createLicencia(
    idOperador: number,
    dto: CreateLicenciaDto,
    idClienteToken: number,
    rol: number,
    idUser: number,
    fileLicencia?: Express.Multer.File,
  ): Promise<ApiCrudResponse> {
    try {
      const operador = await this.resolveOperadorVisible(
        idOperador,
        idClienteToken,
        rol,
      );

      const existeNumero = await this.licenciasRepo.findOne({
        where: { numeroLicencia: dto.numeroLicencia },
      });
      if (existeNumero) {
        throw new BadRequestException('El número de licencia ya está registrado');
      }

      const existeTipo = await this.licenciasRepo.findOne({
        where: {
          idOperador: operador.id,
          idTipoLicencia: dto.idTipoLicencia,
        },
      });
      if (existeTipo) {
        throw new BadRequestException(
          'El operador ya tiene una licencia de ese tipo',
        );
      }

      const urlLicencia = await this.resolveLicenciaUrlOnCreate(
        dto.licencia,
        fileLicencia,
        idUser,
      );

      const saved = await this.licenciasRepo.save(
        this.licenciasRepo.create({
          idOperador: operador.id,
          numeroLicencia: dto.numeroLicencia,
          idTipoLicencia: dto.idTipoLicencia,
          idCategoriaLicencia: dto.idCategoriaLicencia,
          fechaExpedicion: new Date(dto.fechaExpedicion),
          fechaVencimiento: new Date(dto.fechaVencimiento),
          licencia: urlLicencia,
          estatus: 1,
        }),
      );

      await this.bitacoraLogger.logToBitacora(
        'Licencias',
        `Se creó licencia ID: ${saved.id} para operador ${operador.id}`,
        'CREATE',
        { idOperador: operador.id, dto },
        idUser,
        ID_MODULO_LICENCIAS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Licencia creada correctamente',
        data: { id: Number(saved.id), nombre: dto.numeroLicencia },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Licencias',
        `Error al crear licencia para operador ${idOperador}`,
        'CREATE',
        { idOperador, dto },
        idUser,
        ID_MODULO_LICENCIAS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  /**
   * Actualización parcial de licencia (documento vía URL o archivo).
   */
  async updateLicencia(
    idLicencia: number,
    dto: UpdateLicenciaDto,
    idClienteToken: number,
    rol: number,
    idUser: number,
    fileLicencia?: Express.Multer.File,
  ): Promise<ApiCrudResponse> {
    try {
      const licencia = await this.licenciasRepo.findOne({
        where: { id: idLicencia },
      });
      if (!licencia) {
        throw new NotFoundException('Licencia no encontrada');
      }

      await this.resolveOperadorVisible(
        Number(licencia.idOperador),
        idClienteToken,
        rol,
      );

      if (
        dto.numeroLicencia !== undefined &&
        dto.numeroLicencia !== licencia.numeroLicencia
      ) {
        const existeNumero = await this.licenciasRepo.findOne({
          where: { numeroLicencia: dto.numeroLicencia },
        });
        if (existeNumero && Number(existeNumero.id) !== Number(idLicencia)) {
          throw new BadRequestException(
            'El número de licencia ya está registrado',
          );
        }
      }

      if (
        dto.idTipoLicencia !== undefined &&
        Number(dto.idTipoLicencia) !== Number(licencia.idTipoLicencia)
      ) {
        const existeTipo = await this.licenciasRepo.findOne({
          where: {
            idOperador: licencia.idOperador,
            idTipoLicencia: dto.idTipoLicencia,
          },
        });
        if (existeTipo && Number(existeTipo.id) !== Number(idLicencia)) {
          throw new BadRequestException(
            'El operador ya tiene una licencia de ese tipo',
          );
        }
      }

      const updateData: Partial<Licencias> = {};
      if (dto.numeroLicencia !== undefined)
        updateData.numeroLicencia = dto.numeroLicencia;
      if (dto.idTipoLicencia !== undefined)
        updateData.idTipoLicencia = dto.idTipoLicencia;
      if (dto.idCategoriaLicencia !== undefined)
        updateData.idCategoriaLicencia = dto.idCategoriaLicencia;
      if (dto.fechaExpedicion !== undefined)
        updateData.fechaExpedicion = new Date(dto.fechaExpedicion);
      if (dto.fechaVencimiento !== undefined)
        updateData.fechaVencimiento = new Date(dto.fechaVencimiento);
      if (dto.estatus !== undefined) updateData.estatus = dto.estatus;

      if (fileLicencia) {
        const { url } = await this.s3Service.updateFile(
          licencia.licencia,
          fileLicencia,
          S3_FOLDER,
          idUser,
          ID_MODULO_LICENCIAS,
        );
        updateData.licencia = url;
      } else if (dto.licencia !== undefined) {
        updateData.licencia = dto.licencia;
      }

      await this.licenciasRepo.update(idLicencia, updateData);

      await this.bitacoraLogger.logToBitacora(
        'Licencias',
        `Se actualizó licencia ID: ${idLicencia}`,
        'UPDATE',
        { idLicencia, dto },
        idUser,
        ID_MODULO_LICENCIAS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Licencia actualizada correctamente',
        data: {
          id: idLicencia,
          nombre: dto.numeroLicencia ?? licencia.numeroLicencia,
        },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Licencias',
        `Error al actualizar licencia ID: ${idLicencia}`,
        'UPDATE',
        { idLicencia, dto },
        idUser,
        ID_MODULO_LICENCIAS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async updateLicenciaEstatus(
    idLicencia: number,
    idClienteToken: number,
    rol: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const licencia = await this.licenciasRepo.findOne({
        where: { id: idLicencia },
      });
      if (!licencia) {
        throw new NotFoundException('Licencia no encontrada');
      }

      await this.resolveOperadorVisible(
        Number(licencia.idOperador),
        idClienteToken,
        rol,
      );

      const estatusAnterior = Number(licencia.estatus) === 1 ? 1 : 0;
      const estatus = estatusAnterior === 1 ? 0 : 1;
      await this.licenciasRepo.update(idLicencia, { estatus });

      await this.bitacoraLogger.logToBitacora(
        'Licencias',
        `Se actualizó estatus de licencia ID: ${idLicencia} a ${estatus}`,
        'UPDATE',
        { idLicencia, estatusAnterior, estatus },
        idUser,
        ID_MODULO_LICENCIAS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Estatus de licencia actualizado correctamente',
        estatus: { estatus },
        data: { id: idLicencia, nombre: licencia.numeroLicencia },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Licencias',
        `Error al actualizar estatus de licencia ID: ${idLicencia}`,
        'UPDATE',
        { idLicencia },
        idUser,
        ID_MODULO_LICENCIAS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Error al cambiar estatus de la licencia',
      );
    }
  }

  private async resolveOperadorVisible(
    idOperador: number,
    idClienteToken: number,
    rol: number,
  ): Promise<Operadores> {
    const operador = await this.repository.findOne({
      where: { id: idOperador },
    });
    if (!operador) {
      throw new NotFoundException('Operador no encontrado');
    }
    const scope = await this.tenantFilter.idsClientePermitidos(
      rol,
      idClienteToken,
    );
    if (
      !this.tenantFilter.clienteVisibleEnScope(scope, Number(operador.idCliente))
    ) {
      throw new ForbiddenException('No tienes acceso a ese operador');
    }
    return operador;
  }

  private async resolveLicenciaUrlOnCreate(
    dtoValue: string,
    file: Express.Multer.File | undefined,
    idUser: number,
  ): Promise<string> {
    let url = this.urlFromBody(dtoValue);
    if (file) {
      const uploaded = await this.s3Service.uploadFile(
        file,
        S3_FOLDER,
        idUser,
        ID_MODULO_LICENCIAS,
      );
      url = uploaded.url;
    }
    if (!url?.trim()) {
      throw new BadRequestException(
        'Debe proporcionar el documento de la licencia (URL o archivo PNG/JPEG/PDF).',
      );
    }
    return url;
  }
}
