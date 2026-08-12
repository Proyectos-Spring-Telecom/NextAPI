import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Operadores } from 'src/entities/Operadores';
import { Usuarios } from 'src/entities/Usuarios';
import { CatEstatusOperador } from 'src/entities/CatEstatusOperador';
import { Licencias } from 'src/entities/Licencias';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { CreateOperadoresDto } from './dto/create-operadores.dto';
import { UpdateOperadoresDto } from './dto/update-operadores.dto';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';

const ID_MODULO_OPERADORES = 18;

@Injectable()
export class OperadoresService {
  constructor(
    @InjectRepository(Operadores)
    private readonly repository: Repository<Operadores>,
    @InjectRepository(Usuarios)
    private readonly usuariosRepo: Repository<Usuarios>,
    @InjectRepository(CatEstatusOperador)
    private readonly catEstatusOperadorRepo: Repository<CatEstatusOperador>,
    @InjectRepository(Licencias)
    private readonly licenciasRepo: Repository<Licencias>,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly tenantFilter: TenantFilterService,
  ) {}

  private async validarFks(dto: {
    idEstatusOperador?: number;
  }): Promise<void> {
    if (dto.idEstatusOperador !== undefined) {
      const est = await this.catEstatusOperadorRepo.findOne({
        where: { id: dto.idEstatusOperador },
      });
      if (!est) {
        throw new BadRequestException('IdEstatusOperador no existe');
      }
    }
  }

  async create(
    dto: CreateOperadoresDto,
    idCliente: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
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

      await this.validarFks({ idEstatusOperador: dto.idEstatusOperador ?? 1 });

      const entity = this.repository.create({
        idCliente,
        idUsuario: dto.idUsuario,
        fechaNacimiento: new Date(dto.fechaNacimiento),
        curp: dto.curp,
        nss: dto.nss,
        contactoEmergenciaNombre: dto.contactoEmergenciaNombre,
        contactoEmergenciaTelefono: dto.contactoEmergenciaTelefono,
        identificacion: dto.identificacion,
        foto: dto.foto ?? null,
        comprobanteDomicilio: dto.comprobanteDomicilio ?? null,
        certificadoMedico: dto.certificadoMedico ?? null,
        antecedentesNoPenales: dto.antecedentesNoPenales ?? null,
        idEstatusOperador: dto.idEstatusOperador ?? 1,
        estatus: dto.estatus ?? 1,
      });

      const saved = await this.repository.save(entity);

      const licenciaEntity = this.licenciasRepo.create({
        idOperador: saved.id,
        numeroLicencia: dto.numeroLicencia,
        licencia: dto.licencia,
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
        { dto, idCliente },
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
      const where: FindOptionsWhere<Operadores> = {
        estatus: 1,
        ...(tenant.idCliente !== undefined
          ? { idCliente: tenant.idCliente }
          : {}),
      };
      const data = await this.repository.find({
        where,
        relations: [
          'idUsuario2',
          'idEstatusOperador2',
          'licencias',
        ],
        order: { id: 'ASC' },
      });
      const dataNormalizada = data.map((item) => ({
        ...item,
        id: Number(item.id),
      }));
      return { data: dataNormalizada };
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
      const where: FindOptionsWhere<Operadores> = {
        ...(tenant.idCliente !== undefined
          ? { idCliente: tenant.idCliente }
          : {}),
      };
      const [data, total] = await this.repository.findAndCount({
        where,
        relations: [
          'idUsuario2',
          'idEstatusOperador2',
          'licencias',
        ],
        skip: (page - 1) * limit,
        take: limit,
        order: { id: 'ASC' },
      });
      const dataNormalizada = data.map((item) => ({
        ...item,
        id: Number(item.id),
      }));
      return {
        data: dataNormalizada,
        paginated: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findOne(
    id: number,
    idCliente: number,
  ): Promise<{ data: Operadores }> {
    try {
      const entity = await this.repository.findOne({
        where: { id, idCliente },
        relations: [
          'idUsuario2',
          'idEstatusOperador2',
          'licencias',
        ],
      });
      if (!entity) {
        throw new NotFoundException('Operador no encontrado');
      }
      return {
        data: { ...entity, id: Number(entity.id) } as Operadores,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { message: 'Error al buscar el operador' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(
    id: number,
    dto: UpdateOperadoresDto,
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

      await this.validarFks({ idEstatusOperador: dto.idEstatusOperador });

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
      if (dto.identificacion !== undefined)
        updateData.identificacion = dto.identificacion;
      if (dto.foto !== undefined) updateData.foto = dto.foto;
      if (dto.comprobanteDomicilio !== undefined)
        updateData.comprobanteDomicilio = dto.comprobanteDomicilio;
      if (dto.certificadoMedico !== undefined)
        updateData.certificadoMedico = dto.certificadoMedico;
      if (dto.antecedentesNoPenales !== undefined)
        updateData.antecedentesNoPenales = dto.antecedentesNoPenales;
      if (dto.idEstatusOperador !== undefined)
        updateData.idEstatusOperador = dto.idEstatusOperador;
      if (dto.estatus !== undefined) updateData.estatus = dto.estatus;

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

      const updated = await this.repository.findOne({ where: { id } });
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
}
