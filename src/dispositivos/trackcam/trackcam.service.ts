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
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';
import { imeiToString } from 'src/common/imei.util';
import {
  EnumEstatusProductoDispositivo,
  EnumModulos,
  EstatusEnum,
} from 'src/common/estatus.enum';
import { assertEstatusNoAsignado } from 'src/common/assert-estatus-no-asignado.util';
import {
  crearDispositivoBase,
  obtenerTipoTrackcam,
  validarFksDispositivo,
} from '../crear-dispositivo.util';
import {
  buildTrackcamWebhookData,
  mapTrackcamPlano,
  pickTrackcamConfig,
  RELACIONES_DETALLE_TRACKCAM,
} from '../map-relaciones.util';
import { WebhookEmitterService } from 'src/webhook-emitter/webhook-emitter.service';
import { WebhookEvent } from 'src/webhook-emitter/interfaces/webhook-event.interface';

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
    private readonly webhookEmitter: WebhookEmitterService,
  ) {}

  async create(
    dto: CreateTrackcamDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    const idCliente = dto.idCliente;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const tipo = await obtenerTipoTrackcam(queryRunner.manager);
      const dispositivo = await crearDispositivoBase(queryRunner.manager, {
        idCliente,
        idTipoDispositivo: Number(tipo.id),
        numeroSerie: dto.numeroSerie,
        imei: dto.imei ?? null,
        eco: dto.eco ?? null,
        idMarca: dto.idMarca ?? null,
        idModelo: dto.idModelo ?? null,
      });

      const config = queryRunner.manager.create(TrackcamConfig, {
        idDispositivo: dispositivo.id,
        idCliente,
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
        idCliente,
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
          ? { idCliente: tenant.idCliente }
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
        ...(tenant.idCliente !== undefined
          ? { idCliente: tenant.idCliente }
          : {}),
        ...(incluirInservibles
          ? {}
          : {
              idDispositivo2: {
                estatus: Not(EnumEstatusProductoDispositivo.INSERVIBLE),
              },
            }),
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

  async findOne(id: number, idCliente: number) {
    try {
      const entity = await this.repository.findOne({
        where: { idDispositivo: id, idCliente },
        relations: RELACIONES_DETALLE_TRACKCAM,
      });
      if (!entity) {
        throw new NotFoundException('Trackcam no encontrado');
      }
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
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({
        where: { idDispositivo: id, idCliente },
      });
      if (!entity) {
        throw new NotFoundException('Trackcam no encontrado');
      }

      Object.assign(entity, pickTrackcamConfig(dto));
      await this.repository.save(entity);

      const hayCamposDispositivo =
        dto.numeroSerie !== undefined ||
        dto.imei !== undefined ||
        dto.eco !== undefined ||
        dto.idMarca !== undefined ||
        dto.idModelo !== undefined;

      if (hayCamposDispositivo) {
        const dispositivo = await this.dispositivosRepo.findOne({
          where: { id, idCliente },
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
        if (dto.idMarca !== undefined) dispositivo.idMarca = dto.idMarca;
        if (dto.idModelo !== undefined) dispositivo.idModelo = dto.idModelo;
        await this.dispositivosRepo.save(dispositivo);
      }

      await this.bitacoraLogger.logToBitacora(
        'TrackcamConfig',
        `Se actualizó el Trackcam ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        EnumModulos.DISPOSITIVOS,
        EstatusEnumBitcora.SUCCESS,
      );

      await this.emitTrackcamWebhook(
        WebhookEvent.TRACKCAM_UPDATED,
        idCliente,
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
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({
        where: { idDispositivo: id },
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

      assertEstatusNoAsignado(Number(dispositivo.estatus), 'dispositivo');

      const estatusAnterior = Number(dispositivo.estatus);
      const estatus = dto.estatus;
      await this.dispositivosRepo.update({ id }, { estatus });

      await this.bitacoraLogger.logToBitacora(
        'TrackcamConfig',
        `Se actualizó estatus de Trackcam ID: ${id} a ${estatus}`,
        'UPDATE',
        {
          id,
          estatusAnterior,
          estatus,
          idCliente,
          idClienteRecurso: entity.idCliente,
        },
        idUser,
        EnumModulos.DISPOSITIVOS,
        EstatusEnumBitcora.SUCCESS,
      );

      await this.emitTrackcamWebhook(
        WebhookEvent.TRACKCAM_UPDATED,
        Number(entity.idCliente),
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

  private async emitTrackcamWebhook(
    event: WebhookEvent,
    idCliente: number,
    idDispositivo: number,
  ): Promise<void> {
    const entity = await this.repository.findOne({
      where: { idDispositivo, idCliente },
      relations: RELACIONES_DETALLE_TRACKCAM,
    });
    if (!entity) {
      return;
    }
    this.webhookEmitter.emit(
      event,
      idCliente,
      idDispositivo,
      buildTrackcamWebhookData(entity),
    );
  }
}
