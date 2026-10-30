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
import { assertCambioEstatus } from 'src/common/assert-estatus-no-asignado.util';
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
  ) { }

  async create(
    dto: CreateRelojDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    const idCliente = dto.idCliente;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const tipo = await obtenerTipoReloj(queryRunner.manager);
      const dispositivo = await crearDispositivoBase(queryRunner.manager, {
        idCliente,
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
        idCliente,
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
          ? { idCliente: tenant.idCliente }
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

  async findOne(id: number, idCliente: number) {
    try {
      const entity = await this.repository.findOne({
        where: { idDispositivo: id },
        relations: RELACIONES_DETALLE_RELOJ,
      });
      if (!entity) {
        throw new NotFoundException('Reloj no encontrado');
      }
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
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({
        where: { idDispositivo: id, idCliente },
      });
      if (!entity) {
        throw new NotFoundException('Reloj no encontrado');
      }

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
          where: { id, idCliente },
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
        await this.dispositivosRepo.save(dispositivo);
      }

      await this.bitacoraLogger.logToBitacora(
        'RelojConfig',
        `Se actualizó el reloj ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
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

      // Solo recursos del alcance del usuario (404 si no); a mano no se pone "asignado".
      await this.tenantFilter.assertClienteVisible(alcance, Number(dispositivo.idCliente), 'Recurso');
      assertCambioEstatus(Number(dispositivo.estatus), Number(dto.estatus), 'dispositivo');

      const estatusAnterior = Number(dispositivo.estatus);
      const estatus = dto.estatus;
      await this.dispositivosRepo.update({ id }, { estatus });

      await this.bitacoraLogger.logToBitacora(
        'RelojConfig',
        `Se actualizó estatus de reloj ID: ${id} a ${estatus}`,
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
