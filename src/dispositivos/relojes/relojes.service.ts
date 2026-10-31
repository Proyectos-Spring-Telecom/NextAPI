import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Not, Repository } from 'typeorm';
import { RelojConfig } from 'src/entities/RelojConfig';
import { Dispositivos } from 'src/entities/Dispositivos';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { CreateRelojDto } from './dto/create-reloj.dto';
import { UpdateRelojDto } from './dto/update-reloj.dto';
import { UpdateDispositivoEstatusDto } from '../dto/update-dispositivo-estatus.dto';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import { TenantFilterService, type UsuarioAlcance } from 'src/common/tenant-filter/tenant-filter.service';
import { imeiToString } from 'src/common/imei.util';
import {
  EnumEstatusProductoDispositivo,
  EnumModulos,
  EstatusEnum,
} from 'src/common/estatus.enum';
import { MotorActivosService, sinEstatus, sinEstatusNiCliente } from 'src/motor-activos/motor-activos.service';
import {
  crearDispositivoBase,
  obtenerTipoReloj,
  validarFksDispositivo,
} from '../crear-dispositivo.util';
import {
  mapRelojPlano,
  pickRelojConfig,
  RELACIONES_DETALLE_RELOJ,
} from '../map-relaciones.util';

/** Cliente del equipo (la configuración no tiene cliente propio; NULL = almacén). */
function clienteEquipo(entity: RelojConfig): number | null {
  const id = entity.idDispositivo2?.idCliente;
  return id != null ? Number(id) : null;
}

@Injectable()
export class RelojesService {
  constructor(
    @InjectRepository(RelojConfig)
    private readonly repository: Repository<RelojConfig>,
    @InjectRepository(Dispositivos)
    private readonly dispositivosRepo: Repository<Dispositivos>,
    private readonly dataSource: DataSource,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly tenantFilter: TenantFilterService,
    private readonly motor: MotorActivosService,
  ) { }

  async create(
    dto: CreateRelojDto,
    idUser: number,
    alcance: UsuarioAlcance,
  ): Promise<ApiCrudResponse> {
    const idCliente = dto.idCliente ?? null;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // El cliente destino debe estar en el alcance de quien crea (403).
      await this.tenantFilter.assertClienteDestinoOAlmacen(alcance, idCliente);
      const tipo = await obtenerTipoReloj(queryRunner.manager);
      const dispositivo = await crearDispositivoBase(queryRunner.manager, {
        idCliente,
        idUsuario: idUser,
        idTipoDispositivo: Number(tipo.id),
        numeroSerie: dto.numeroSerie,
        imei: dto.imei ?? null,
        eco: dto.eco ?? null,
        camara: 0,
        idMarca: dto.idMarca ?? null,
        idModelo: dto.idModelo ?? null,
      });

      const config = queryRunner.manager.create(RelojConfig, {
        idDispositivo: dispositivo.id,
        ...pickRelojConfig(dto),
      } as Partial<RelojConfig>);
      const saved = await queryRunner.manager.save(config);
      await queryRunner.commitTransaction();

      await this.bitacoraLogger.logToBitacora(
        'RelojConfig',
        `Se creó el reloj Nº serie: ${dto.numeroSerie}`,
        'CREATE',
        { dto, idCliente },
        idUser,
        EnumModulos.DISPOSITIVOS,
        EstatusEnumBitcora.SUCCESS,
      );


      return {
        status: 'success',
        message: 'Reloj creado correctamente',
        data: { id: Number(saved.idDispositivo), nombre: dto.numeroSerie },
      };
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      await this.bitacoraLogger.logToBitacora(
        'RelojConfig',
        'Error al crear reloj',
        'CREATE',
        { dto, idCliente },
        idUser,
        EnumModulos.DISPOSITIVOS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    } finally {
      await queryRunner.release();
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
      const where: FindOptionsWhere<RelojConfig> = {
        ...(tenant.idCliente !== undefined
          ? { idDispositivo2: { idCliente: tenant.idCliente } }
          : {}),
      };
      const data = await this.repository.find({
        where,
        relations: RELACIONES_DETALLE_RELOJ,
        order: { idDispositivo: 'DESC' },
      });
      return { data: data.map((item) => mapRelojPlano(item)) };
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
          paginated: { total: 0, page, limit, totalPages: 0 },
        };
      }
      const incluirInservibles = obtenerTodos === EstatusEnum.ACTIVO;
      const where: FindOptionsWhere<RelojConfig> = {
        // Un solo filtro sobre el equipo: cliente (alcance) y estatus.
        idDispositivo2: {
          ...(tenant.idCliente !== undefined ? { idCliente: tenant.idCliente } : {}),
          ...(incluirInservibles
            ? {}
            : { estatus: Not(EnumEstatusProductoDispositivo.INSERVIBLE) }),
        },
      };
      const [data, total] = await this.repository.findAndCount({
        where,
        relations: RELACIONES_DETALLE_RELOJ,
        skip: (page - 1) * limit,
        take: limit,
        order: { idDispositivo: 'DESC' },
      });
      return {
        data: data.map((item) => mapRelojPlano(item)),
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

  async findOne(id: number, alcance: UsuarioAlcance) {
    try {
      const entity = await this.repository.findOne({
        where: { idDispositivo: id },
        relations: RELACIONES_DETALLE_RELOJ,
      });
      if (!entity) {
        throw new NotFoundException('Reloj no encontrado');
      }
      // Fuera del alcance del usuario responde igual que si no existiera (404).
      await this.tenantFilter.assertClienteVisible(alcance, clienteEquipo(entity), 'Reloj');
      return { data: mapRelojPlano(entity) };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async update(
    id: number,
    dto: UpdateRelojDto,
    idCliente: number,
    idUser: number,
    alcance: UsuarioAlcance,
  ): Promise<ApiCrudResponse> {
    try {
      // Se busca por id (no por el cliente del token) y se valida el cliente del
      // registro: administración y clientes padre editan lo de sus clientes hijos.
      const entity = await this.repository.findOne({
        where: { idDispositivo: id },
        relations: { idDispositivo2: true },
      });
      if (!entity) {
        throw new NotFoundException('Reloj no encontrado');
      }
      await this.tenantFilter.assertClienteVisible(alcance, clienteEquipo(entity), 'Reloj');
      const idClienteRecurso = clienteEquipo(entity);

      Object.assign(entity, pickRelojConfig(dto));
      await this.repository.save(entity);

      const hayCamposDispositivo =
        dto.numeroSerie !== undefined ||
        dto.imei !== undefined ||
        dto.eco !== undefined ||
        dto.idMarca !== undefined ||
        dto.idModelo !== undefined;

      if (hayCamposDispositivo) {
        const dispositivo = await this.dispositivosRepo.findOne({
          where: { id },
        });
        if (!dispositivo) {
          throw new NotFoundException('Dispositivo del reloj no encontrado');
        }
        if (dto.numeroSerie && dto.numeroSerie !== dispositivo.numeroSerie) {
          const existeNumeroSerie = await this.dispositivosRepo.findOne({
            where: { numeroSerie: dto.numeroSerie },
          });
          if (existeNumeroSerie) {
            throw new BadRequestException('El número de serie ya existe');
          }
        }
        if (
          dto.imei != null &&
          imeiToString(dto.imei) !== imeiToString(dispositivo.imei)
        ) {
          const existeImei = await this.dispositivosRepo.findOne({
            where: { imei: dto.imei },
          });
          if (existeImei) {
            throw new BadRequestException('El IMEI ya está registrado');
          }
        }
        await validarFksDispositivo(this.dispositivosRepo.manager, {
          idMarca:
            dto.idMarca !== undefined ? dto.idMarca : dispositivo.idMarca,
          idModelo:
            dto.idModelo !== undefined ? dto.idModelo : dispositivo.idModelo,
        });
        if (dto.numeroSerie !== undefined)
          dispositivo.numeroSerie = dto.numeroSerie;
        if (dto.imei !== undefined) dispositivo.imei = dto.imei;
        if (dto.eco !== undefined) dispositivo.eco = dto.eco;
        if (dto.idMarca !== undefined) dispositivo.idMarca = dto.idMarca;
        if (dto.idModelo !== undefined) dispositivo.idModelo = dto.idModelo;
        await this.dispositivosRepo.save(sinEstatusNiCliente(dispositivo));
      }

      await this.bitacoraLogger.logToBitacora(
        'RelojConfig',
        `Se actualizó el reloj ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente, idClienteRecurso },
        idUser,
        EnumModulos.DISPOSITIVOS,
        EstatusEnumBitcora.SUCCESS,
      );


      return {
        status: 'success',
        message: 'Reloj actualizado correctamente',
        data: { id, nombre: dto.numeroSerie ?? String(id) },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'RelojConfig',
        `Error al actualizar reloj ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        EnumModulos.DISPOSITIVOS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async updateEstatus(
    id: number,
    dto: UpdateDispositivoEstatusDto,
    idCliente: number,
    idUser: number,
    alcance: UsuarioAlcance,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({
        where: { idDispositivo: id },
        relations: { idDispositivo2: true },
      });
      if (!entity) {
        throw new NotFoundException('Reloj no encontrado');
      }
      const dispositivo = await this.dispositivosRepo.findOne({
        where: { id },
      });
      if (!dispositivo) {
        throw new NotFoundException('Dispositivo del reloj no encontrado');
      }

      // Solo recursos del alcance del usuario (404 si no); la transición la valida el motor (§1).
      await this.tenantFilter.assertClienteVisible(alcance, dispositivo.idCliente, 'Recurso');

      const estatusAnterior = Number(dispositivo.estatus);
      const estatus = dto.estatus;
      await this.motor.cambiarEstatusManual('dispositivo', dispositivo, estatus, {
        idUsuario: idUser,
        rol: alcance.rol,
        motivo: dto.motivo,
      });

      await this.bitacoraLogger.logToBitacora(
        'RelojConfig',
        `Se actualizó estatus de reloj ID: ${id} a ${estatus}`,
        'UPDATE',
        {
          id,
          estatusAnterior,
          estatus,
          idCliente,
          idClienteRecurso: clienteEquipo(entity),
        },
        idUser,
        EnumModulos.DISPOSITIVOS,
        EstatusEnumBitcora.SUCCESS,
      );


      return {
        status: 'success',
        message: 'Estatus actualizado correctamente',
        estatus: { estatus },
        data: { id, nombre: dispositivo.numeroSerie },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'RelojConfig',
        `Error al actualizar estatus de reloj ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        EnumModulos.DISPOSITIVOS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Error al cambiar estatus del reloj',
      );
    }
  }
}
