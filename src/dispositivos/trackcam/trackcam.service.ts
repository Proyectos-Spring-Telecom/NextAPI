import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Not, Repository } from 'typeorm';
import { TrackcamConfig } from 'src/entities/TrackcamConfig';
import { Dispositivos } from 'src/entities/Dispositivos';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { CreateTrackcamDto } from './dto/create-trackcam.dto';
import { UpdateTrackcamDto } from './dto/update-trackcam.dto';
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
  obtenerTipoTrackcam,
  validarFksDispositivo,
} from '../crear-dispositivo.util';
import {
  mapTrackcamPlano,
  pickTrackcamConfig,
  RELACIONES_DETALLE_TRACKCAM,
} from '../map-relaciones.util';
import { RegistroTrackcamService } from 'src/motor-activos/registro-trackcam.service';
import { WebhookEvent } from 'src/webhook-emitter/interfaces/webhook-event.interface';

/** Cliente del equipo (la configuración no tiene cliente propio; NULL = almacén). */
function clienteEquipo(entity: TrackcamConfig): number | null {
  const id = entity.idDispositivo2?.idCliente;
  return id != null ? Number(id) : null;
}

@Injectable()
export class TrackcamService {
  constructor(
    @InjectRepository(TrackcamConfig)
    private readonly repository: Repository<TrackcamConfig>,
    @InjectRepository(Dispositivos)
    private readonly dispositivosRepo: Repository<Dispositivos>,
    private readonly dataSource: DataSource,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly tenantFilter: TenantFilterService,
    private readonly registroTrackcam: RegistroTrackcamService,
    private readonly motor: MotorActivosService,
  ) { }

  async create(
    dto: CreateTrackcamDto,
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
      const tipo = await obtenerTipoTrackcam(queryRunner.manager);
      const dispositivo = await crearDispositivoBase(queryRunner.manager, {
        idCliente,
        idUsuario: idUser,
        idTipoDispositivo: Number(tipo.id),
        numeroSerie: dto.numeroSerie,
        imei: dto.imei ?? null,
        eco: dto.eco ?? null,
        camara: dto.camara ?? 0,
        idMarca: dto.idMarca ?? null,
        idModelo: dto.idModelo ?? null,
      });

      const config = queryRunner.manager.create(TrackcamConfig, {
        idDispositivo: dispositivo.id,
        ...pickTrackcamConfig(dto),
      } as Partial<TrackcamConfig>);
      const saved = await queryRunner.manager.save(config);
      await queryRunner.commitTransaction();

      await this.bitacoraLogger.logToBitacora(
        'TrackcamConfig',
        `Se creó el Trackcam Nº serie: ${dto.numeroSerie}`,
        'CREATE',
        { dto, idCliente },
        idUser,
        EnumModulos.DISPOSITIVOS,
        EstatusEnumBitcora.SUCCESS,
      );

      await this.emitTrackcamWebhook(
        WebhookEvent.TRACKCAM_CREATED,
        Number(saved.idDispositivo),
      );

      return {
        status: 'success',
        message: 'Trackcam creado correctamente',
        data: { id: Number(saved.idDispositivo), nombre: dto.numeroSerie },
      };
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      await this.bitacoraLogger.logToBitacora(
        'TrackcamConfig',
        'Error al crear Trackcam',
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
      const where: FindOptionsWhere<TrackcamConfig> = {
        ...(tenant.idCliente !== undefined
          ? { idDispositivo2: { idCliente: tenant.idCliente } }
          : {}),
      };
      const data = await this.repository.find({
        where,
        relations: RELACIONES_DETALLE_TRACKCAM,
        order: { idDispositivo: 'DESC' },
      });
      return { data: data.map((item) => mapTrackcamPlano(item)) };
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
      const where: FindOptionsWhere<TrackcamConfig> = {
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
        relations: RELACIONES_DETALLE_TRACKCAM,
        skip: (page - 1) * limit,
        take: limit,
        order: { idDispositivo: 'DESC' },
      });
      return {
        data: data.map((item) => mapTrackcamPlano(item)),
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
        relations: RELACIONES_DETALLE_TRACKCAM,
      });
      if (!entity) {
        throw new NotFoundException('Trackcam no encontrado');
      }
      // Fuera del alcance del usuario responde igual que si no existiera (404).
      await this.tenantFilter.assertClienteVisible(alcance, clienteEquipo(entity), 'Trackcam');
      return { data: mapTrackcamPlano(entity) };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async update(
    id: number,
    dto: UpdateTrackcamDto,
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
        throw new NotFoundException('Trackcam no encontrado');
      }
      await this.tenantFilter.assertClienteVisible(alcance, clienteEquipo(entity), 'Trackcam');
      const idClienteRecurso = clienteEquipo(entity);

      Object.assign(entity, pickTrackcamConfig(dto));
      await this.repository.save(entity);

      const hayCamposDispositivo =
        dto.numeroSerie !== undefined ||
        dto.imei !== undefined ||
        dto.eco !== undefined ||
        dto.camara !== undefined ||
        dto.idMarca !== undefined ||
        dto.idModelo !== undefined;

      if (hayCamposDispositivo) {
        const dispositivo = await this.dispositivosRepo.findOne({
          where: { id },
        });
        if (!dispositivo) {
          throw new NotFoundException('Dispositivo del Trackcam no encontrado');
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
        if (dto.camara !== undefined) dispositivo.camara = dto.camara;
        if (dto.idMarca !== undefined) dispositivo.idMarca = dto.idMarca;
        if (dto.idModelo !== undefined) dispositivo.idModelo = dto.idModelo;
        await this.dispositivosRepo.save(sinEstatusNiCliente(dispositivo));
      }

      await this.bitacoraLogger.logToBitacora(
        'TrackcamConfig',
        `Se actualizó el Trackcam ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente, idClienteRecurso },
        idUser,
        EnumModulos.DISPOSITIVOS,
        EstatusEnumBitcora.SUCCESS,
      );

      await this.emitTrackcamWebhook(
        WebhookEvent.TRACKCAM_UPDATED,
        id,
      );

      return {
        status: 'success',
        message: 'Trackcam actualizado correctamente',
        data: { id, nombre: dto.numeroSerie ?? String(id) },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'TrackcamConfig',
        `Error al actualizar Trackcam ID: ${id}`,
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
        throw new NotFoundException('Trackcam no encontrado');
      }
      const dispositivo = await this.dispositivosRepo.findOne({
        where: { id },
      });
      if (!dispositivo) {
        throw new NotFoundException('Dispositivo del Trackcam no encontrado');
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
        'TrackcamConfig',
        `Se actualizó estatus de Trackcam ID: ${id} a ${estatus}`,
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

      await this.emitTrackcamWebhook(
        WebhookEvent.TRACKCAM_UPDATED,
        id,
      );

      return {
        status: 'success',
        message: 'Estatus actualizado correctamente',
        estatus: { estatus },
        data: { id, nombre: dispositivo.numeroSerie },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'TrackcamConfig',
        `Error al actualizar estatus de Trackcam ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        EnumModulos.DISPOSITIVOS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Error al cambiar estatus del Trackcam',
      );
    }
  }

  /** Reenvía el registro de todas las TrackCam (después del saneamiento de la fase B o de un corte). */
  async sincronizarRegistro(): Promise<{ data: { emitidas: number } }> {
    const ids = (await this.repository.find({ select: { idDispositivo: true } })).map((t) => Number(t.idDispositivo));
    await this.registroTrackcam.emitir(WebhookEvent.TRACKCAM_UPDATED, ids);
    return { data: { emitidas: ids.length } };
  }

  /** Registro de la cámara en el gateway (springTrackCam); ver RegistroTrackcamService. */
  private async emitTrackcamWebhook(event: WebhookEvent, idDispositivo: number): Promise<void> {
    await this.registroTrackcam.emitir(event, [idDispositivo]);
  }


}
