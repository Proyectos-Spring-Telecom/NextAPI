import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Not, Repository } from 'typeorm';
import { Sims } from 'src/entities/Sims';
import { CatTelefonia } from 'src/entities/CatTelefonia';
import { CatPlanesTelefonia } from 'src/entities/CatPlanesTelefonia';
import { Clientes } from 'src/entities/Clientes';
import { Instalaciones } from 'src/entities/Instalaciones';
import { HistoricoInstalaciones } from 'src/entities/HistoricoInstalaciones';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { CreateSimsDto } from './dto/create-sims.dto';
import { UpdateSimsDto } from './dto/update-sims.dto';
import { UpdateSimEstatusDto } from './dto/update-sim-estatus.dto';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import { TenantFilterService, type UsuarioAlcance } from 'src/common/tenant-filter/tenant-filter.service';
import {
  EnumEstatusRecurso,
  EnumModulos,
  EstatusEnum,
} from 'src/common/estatus.enum';
import { assertCambioEstatus } from 'src/common/assert-estatus-no-asignado.util';
import { nowMexicoCityMysql } from 'src/utils/datetime-mexico.util';
import { mapSimPlano, RELACIONES_SIM_LISTADO } from './map-sims.util';

/** trim(); cadena vacía → null; undefined se conserva (no modificar). */
function normalizarTexto(
  valor: string | null | undefined,
): string | null | undefined {
  if (valor === undefined) return undefined;
  const limpio = valor?.trim();
  return limpio ? limpio : null;
}

function mysqlErrno(error: unknown): number | undefined {
  const e = error as { errno?: number; driverError?: { errno?: number } };
  return e?.errno ?? e?.driverError?.errno;
}

@Injectable()
export class SimsService {
  constructor(
    @InjectRepository(Sims)
    private readonly repository: Repository<Sims>,
    @InjectRepository(Instalaciones)
    private readonly instalacionesRepo: Repository<Instalaciones>,
    @InjectRepository(HistoricoInstalaciones)
    private readonly historicoInstalacionesRepo: Repository<HistoricoInstalaciones>,
    @InjectRepository(CatTelefonia)
    private readonly catTelefoniaRepo: Repository<CatTelefonia>,
    @InjectRepository(CatPlanesTelefonia)
    private readonly catPlanesTelefoniaRepo: Repository<CatPlanesTelefonia>,
    @InjectRepository(Clientes)
    private readonly clientesRepo: Repository<Clientes>,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly tenantFilter: TenantFilterService,
  ) { }

  private async validarFks(dto: {
    idCliente?: number;
    idTelefonia?: number;
    idPlanTelefonia?: number;
  }): Promise<void> {
    if (dto.idCliente !== undefined) {
      const cliente = await this.clientesRepo.findOne({
        where: { id: dto.idCliente },
      });
      if (!cliente) {
        throw new BadRequestException('IdCliente no existe');
      }
    }
    if (dto.idTelefonia !== undefined) {
      const tel = await this.catTelefoniaRepo.findOne({
        where: { id: dto.idTelefonia },
      });
      if (!tel) {
        throw new BadRequestException('IdTelefonia no existe');
      }
    }
    if (dto.idPlanTelefonia !== undefined) {
      const plan = await this.catPlanesTelefoniaRepo.findOne({
        where: { id: dto.idPlanTelefonia },
      });
      if (!plan) {
        throw new BadRequestException('IdPlanTelefonia no existe');
      }
    }
  }

  private async assertImeiDisponible(
    imei: string | null | undefined,
    excludeId?: number,
  ): Promise<void> {
    const valor = imei?.trim();
    if (!valor) return;

    const where: FindOptionsWhere<Sims> = { imei: valor };
    if (excludeId !== undefined) {
      where.id = Not(excludeId);
    }

    const existente = await this.repository.findOne({ where });
    if (existente) {
      throw new ConflictException('El IMEI ya está registrado');
    }
  }

  async create(
    dto: CreateSimsDto,
    idUser: number,
    alcance: UsuarioAlcance,
  ): Promise<ApiCrudResponse> {
    try {
      // El cliente destino debe estar en el alcance de quien crea (403).
      await this.tenantFilter.assertClienteDestino(alcance, dto.idCliente);
      await this.validarFks({
        idCliente: dto.idCliente,
        idTelefonia: dto.idTelefonia,
        idPlanTelefonia: dto.idPlanTelefonia,
      });
      await this.assertImeiDisponible(dto.imei);

      const entity = this.repository.create({
        imei: dto.imei ?? null,
        numeroTelefono: dto.numeroTelefono ?? null,
        idTelefonia: dto.idTelefonia,
        idPlanTelefonia: dto.idPlanTelefonia,
        idCliente: dto.idCliente,
        notas: dto.notas ?? null,
        estatus: EnumEstatusRecurso.DISPONIBLE,
      });

      const saved = await this.repository.save(entity);
      const nombreSim =
        saved.numeroTelefono ?? saved.imei ?? `SIM ${saved.id}`;

      await this.bitacoraLogger.logToBitacora(
        'Sims',
        `Se creó el SIM ID: ${saved.id}`,
        'CREATE',
        { dto },
        idUser,
        EnumModulos.SIMS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'SIM creado correctamente',
        data: { id: Number(saved.id), nombre: nombreSim },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Sims',
        `Error al crear SIM`,
        'CREATE',
        { dto },
        idUser,
        EnumModulos.SIMS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findAllList(
    idClienteToken: number,
    rol: number,
    idClienteFiltro?: number,
  ): Promise<ApiResponseCommon> {
    try {
      const tenant = await this.tenantFilter.forTypeOrmIdCliente(
        rol,
        idClienteToken,
      );
      if (tenant.sinAcceso) {
        return { data: [] };
      }

      let idClienteWhere = tenant.idCliente;
      if (idClienteFiltro != null) {
        if (tenant.idCliente === undefined) {
          idClienteWhere = idClienteFiltro;
        } else if (typeof tenant.idCliente === 'number') {
          if (Number(tenant.idCliente) !== idClienteFiltro) {
            return { data: [] };
          }
          idClienteWhere = idClienteFiltro;
        } else {
          const ids = await this.tenantFilter.getClienteHijosIds(idClienteToken);
          if (!ids.includes(idClienteFiltro)) {
            return { data: [] };
          }
          idClienteWhere = idClienteFiltro;
        }
      }

      const where: FindOptionsWhere<Sims> = {
        estatus: EnumEstatusRecurso.DISPONIBLE,
        ...(idClienteWhere !== undefined ? { idCliente: idClienteWhere } : {}),
      };
      const data = await this.repository.find({
        where,
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
    obtenerTodos?: EstatusEnum,
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
      const incluirInservibles = obtenerTodos === EstatusEnum.ACTIVO;
      const where: FindOptionsWhere<Sims> = {
        ...(tenant.idCliente !== undefined
          ? { idCliente: tenant.idCliente }
          : {}),
        ...(incluirInservibles
          ? {}
          : { estatus: Not(EnumEstatusRecurso.INSERVIBLE) }),
      };
      const [data, total] = await this.repository.findAndCount({
        where,
        relations: [...RELACIONES_SIM_LISTADO],
        skip: (page - 1) * limit,
        take: limit,
        order: { id: 'ASC' },
      });
      return {
        data: data.map((item) => mapSimPlano(item)),
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
    alcance: UsuarioAlcance,
  ): Promise<{ data: ReturnType<typeof mapSimPlano> }> {
    try {
      // Mismas relaciones y mapeo que el paginado: cliente, telefonía y plan en campos planos.
      const entity = await this.repository.findOne({
        where: { id },
        relations: [...RELACIONES_SIM_LISTADO],
      });
      if (!entity) {
        throw new NotFoundException('SIM no encontrado');
      }
      // Fuera del alcance del usuario responde igual que si no existiera (404).
      await this.tenantFilter.assertClienteVisible(alcance, Number(entity.idCliente), 'SIM');
      return { data: mapSimPlano(entity) };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { message: 'Error al buscar el SIM' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * Cambiar Sims.IdCliente rompe las FK compuestas (IdCliente, IdSim) de Instalaciones/HistoricoInstalaciones.
   * 'libre' = sin referencias (update directo) · 'historial' = requiere traspaso.
   */
  private async evaluarCambioCliente(
    id: number,
    idClienteActual: number,
  ): Promise<'libre' | 'historial'> {
    const activa = await this.instalacionesRepo.findOne({
      select: { id: true },
      where: {
        idSim: id,
        idCliente: idClienteActual,
        estatus: EstatusEnum.ACTIVO,
      },
    });
    if (activa) {
      throw new ConflictException(
        `El SIM está asignado a la instalación ${Number(activa.id)}. Retíralo de la instalación antes de cambiar el cliente.`,
      );
    }

    const [enInstalaciones, enHistorico] = await Promise.all([
      this.instalacionesRepo.exists({
        where: { idSim: id, idCliente: idClienteActual },
      }),
      this.historicoInstalacionesRepo.exists({
        where: { idSim: id, idCliente: idClienteActual },
      }),
    ]);
    return enInstalaciones || enHistorico ? 'historial' : 'libre';
  }

  /**
   * El registro viejo conserva IdCliente/NumeroTelefono/IdTelefonia/IdPlanTelefonia para que el
   * historial siga mostrando el SIM como estaba; el IMEI se libera antes de insertar el nuevo (UQ_Sims_IMEI).
   */
  private async traspasar(
    entity: Sims,
    idClienteNuevo: number,
    valores: Pick<
      Sims,
      'imei' | 'numeroTelefono' | 'idTelefonia' | 'idPlanTelefonia' | 'notas'
    >,
  ): Promise<Sims> {
    return this.repository.manager.transaction(async (manager) => {
      const repo = manager.getRepository(Sims);
      const idAnterior = Number(entity.id);

      await repo.update(idAnterior, {
        imei: null,
        estatus: EnumEstatusRecurso.INACTIVO,
      });

      const nuevo = await repo.save(
        repo.create({
          idCliente: idClienteNuevo,
          imei: valores.imei,
          numeroTelefono: valores.numeroTelefono,
          idTelefonia: valores.idTelefonia,
          idPlanTelefonia: valores.idPlanTelefonia,
          notas: valores.notas,
          estatus: EnumEstatusRecurso.DISPONIBLE,
        }),
      );

      const marca =
        `[Traspasado al cliente ${idClienteNuevo} el ${nowMexicoCityMysql().slice(0, 16)}` +
        ` · nuevo SIM ${Number(nuevo.id)} · ICC ${entity.imei ?? '-'}] `;
      await repo.update(idAnterior, {
        notas: `${marca}${entity.notas ?? ''}`.slice(0, 500),
      });

      return nuevo;
    });
  }

  private async assertPlanDeTelefonia(
    idPlanTelefonia: number,
    idTelefonia: number,
  ): Promise<void> {
    const plan = await this.catPlanesTelefoniaRepo.findOne({
      select: { id: true, idTelefonia: true },
      where: { id: idPlanTelefonia },
    });
    if (!plan || Number(plan.idTelefonia) !== Number(idTelefonia)) {
      throw new BadRequestException(
        'El plan no pertenece a la compañía telefónica seleccionada',
      );
    }
  }

  async update(
    id: number,
    dto: UpdateSimsDto,
    idClienteToken: number,
    rol: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({
        where: { id },
      });
      if (!entity) {
        throw new NotFoundException('SIM no encontrado');
      }

      const scope = await this.tenantFilter.idsClientePermitidos(
        rol,
        idClienteToken,
      );
      if (!this.tenantFilter.clienteVisibleEnScope(scope, entity.idCliente)) {
        throw new NotFoundException('SIM no encontrado');
      }

      const cambiaCliente =
        dto.idCliente !== undefined &&
        Number(dto.idCliente) !== Number(entity.idCliente);
      if (cambiaCliente) {
        if (!this.tenantFilter.clienteVisibleEnScope(scope, dto.idCliente)) {
          throw new ForbiddenException('No tienes acceso a ese cliente');
        }
      }

      await this.validarFks({
        idCliente: cambiaCliente ? dto.idCliente : undefined,
        idTelefonia: dto.idTelefonia,
        idPlanTelefonia: dto.idPlanTelefonia,
      });

      if (dto.idTelefonia !== undefined || dto.idPlanTelefonia !== undefined) {
        await this.assertPlanDeTelefonia(
          dto.idPlanTelefonia ?? entity.idPlanTelefonia,
          dto.idTelefonia ?? entity.idTelefonia,
        );
      }

      const cambioCliente = cambiaCliente
        ? await this.evaluarCambioCliente(id, Number(entity.idCliente))
        : null;

      const imei = normalizarTexto(dto.imei);
      const numeroTelefono = normalizarTexto(dto.numeroTelefono);
      const notas = normalizarTexto(dto.notas);

      if (cambioCliente === 'historial') {
        const idClienteAnterior = Number(entity.idCliente);
        const idClienteNuevo = Number(dto.idCliente);
        const imeiFinal = imei !== undefined ? imei : entity.imei;
        if (imeiFinal) {
          await this.assertImeiDisponible(imeiFinal, id);
        }

        const nuevo = await this.traspasar(entity, idClienteNuevo, {
          imei: imeiFinal,
          numeroTelefono:
            numeroTelefono !== undefined ? numeroTelefono : entity.numeroTelefono,
          idTelefonia: dto.idTelefonia ?? entity.idTelefonia,
          idPlanTelefonia: dto.idPlanTelefonia ?? entity.idPlanTelefonia,
          notas: notas !== undefined ? notas : entity.notas,
        });
        const idNuevo = Number(nuevo.id);

        await this.bitacoraLogger.logToBitacora(
          'Sims',
          `Se traspasó el SIM ID: ${id} al cliente ${idClienteNuevo} (nuevo SIM ID: ${idNuevo})`,
          'UPDATE',
          { id, idNuevo, idClienteAnterior, idClienteNuevo, dto },
          idUser,
          EnumModulos.SIMS,
          EstatusEnumBitcora.SUCCESS,
        );

        const data = {
          id: idNuevo,
          nombre: nuevo.numeroTelefono ?? nuevo.imei ?? `SIM ${idNuevo}`,
          idAnterior: id,
          traspaso: true,
        };
        return {
          status: 'success',
          message: 'SIM traspasado al nuevo cliente correctamente',
          data,
        };
      }

      if (imei) {
        await this.assertImeiDisponible(imei, id);
      }

      const updateData: Partial<Sims> = {};
      if (imei !== undefined) updateData.imei = imei;
      if (numeroTelefono !== undefined)
        updateData.numeroTelefono = numeroTelefono;
      if (cambiaCliente) updateData.idCliente = dto.idCliente;
      if (dto.idTelefonia !== undefined) updateData.idTelefonia = dto.idTelefonia;
      if (dto.idPlanTelefonia !== undefined)
        updateData.idPlanTelefonia = dto.idPlanTelefonia;
      if (notas !== undefined) updateData.notas = notas;

      if (Object.keys(updateData).length === 0) {
        return {
          status: 'success',
          message: 'SIM actualizado correctamente',
          data: {
            id,
            nombre: entity.numeroTelefono ?? entity.imei ?? `SIM ${id}`,
          },
        };
      }

      await this.repository.update(id, updateData);

      await this.bitacoraLogger.logToBitacora(
        'Sims',
        `Se actualizó el SIM ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente: idClienteToken },
        idUser,
        EnumModulos.SIMS,
        EstatusEnumBitcora.SUCCESS,
      );

      const updated = await this.repository.findOne({ where: { id } });
      const nombreSim =
        updated?.numeroTelefono ??
        updated?.imei ??
        entity.numeroTelefono ??
        entity.imei ??
        `SIM ${id}`;
      return {
        status: 'success',
        message: 'SIM actualizado correctamente',
        data: {
          id,
          nombre: nombreSim,
        },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Sims',
        `Error al actualizar SIM ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente: idClienteToken },
        idUser,
        EnumModulos.SIMS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;

      const errno = mysqlErrno(error);
      if (errno === 1451 || errno === 1452) {
        throw new ConflictException(
          'No se puede guardar: el SIM está relacionado con instalaciones de otro cliente.',
        );
      }
      if (errno === 1062) {
        throw new ConflictException('El IMEI ya está registrado');
      }
      throw new BadRequestException('Error al actualizar el SIM');
    }
  }

  async updateEstatus(
    id: number,
    dto: UpdateSimEstatusDto,
    idCliente: number,
    idUser: number,
    alcance: UsuarioAlcance,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({
        where: { id },
      });
      if (!entity) {
        throw new NotFoundException('SIM no encontrado');
      }

      // Solo recursos del alcance del usuario (404 si no); a mano no se pone "asignado".
      await this.tenantFilter.assertClienteVisible(alcance, Number(entity.idCliente), 'Recurso');
      assertCambioEstatus(Number(entity.estatus), Number(dto.estatus), 'SIM');

      const estatusAnterior = Number(entity.estatus);
      const estatus = dto.estatus;
      await this.repository.update(id, { estatus });

      await this.bitacoraLogger.logToBitacora(
        'Sims',
        `Se actualizó estatus de SIM ID: ${id} a ${estatus}`,
        'UPDATE',
        { id, estatusAnterior, estatus, idCliente },
        idUser,
        EnumModulos.SIMS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Estatus actualizado correctamente',
        estatus: { estatus },
        data: {
          id,
          nombre:
            entity.numeroTelefono ?? entity.imei ?? `SIM ${id}`,
        },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Sims',
        `Error al actualizar estatus de SIM ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        EnumModulos.SIMS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Error al cambiar estatus del SIM',
      );
    }
  }
}
