import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';
import { PanelAlarma } from 'src/entities/PanelAlarma';
import { Dispositivos } from 'src/entities/Dispositivos';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { CreatePanelAlarmaDto } from './dto/create-panel-alarma.dto';
import { UpdatePanelAlarmaDto } from './dto/update-panel-alarma.dto';
import { UpdateDispositivoEstatusDto } from '../dto/update-dispositivo-estatus.dto';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';
import { EnumModulos, EstatusEnum } from 'src/common/estatus.enum';
import {
  crearDispositivoBase,
  obtenerTipoPanelAlarma,
  validarFksDispositivo,
} from '../crear-dispositivo.util';
import {
  mapPanelAlarmaPlano,
  RELACIONES_DETALLE_PANEL,
} from '../map-relaciones.util';

@Injectable()
export class PanelesService {
  constructor(
    @InjectRepository(PanelAlarma)
    private readonly repository: Repository<PanelAlarma>,
    @InjectRepository(Dispositivos)
    private readonly dispositivosRepo: Repository<Dispositivos>,
    private readonly dataSource: DataSource,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly tenantFilter: TenantFilterService,
  ) {}

  private dtoSinSecreto(dto: object) {
    const { aesKey: _aesKey, ...resto } = dto as { aesKey?: string };
    return resto;
  }

  async create(
    dto: CreatePanelAlarmaDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    const idCliente = dto.idCliente;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const existeCuenta = await queryRunner.manager.findOne(PanelAlarma, {
        where: { cuentaSia: dto.cuentaSia },
      });
      if (existeCuenta) {
        throw new BadRequestException('La cuenta SIA ya existe');
      }

      const tipo = await obtenerTipoPanelAlarma(queryRunner.manager);
      const dispositivo = await crearDispositivoBase(queryRunner.manager, {
        idCliente,
        idTipoDispositivo: Number(tipo.id),
        numeroSerie: dto.numeroSerie,
        imei: dto.imei ?? null,
        eco: dto.eco ?? null,
        idMarca: dto.idMarca ?? null,
        idModelo: dto.idModelo ?? null,
      });

      const panel = queryRunner.manager.create(PanelAlarma, {
        idDispositivo: dispositivo.id,
        idCliente,
        cuentaSia: dto.cuentaSia,
        nombre: dto.nombre,
        ip: dto.ip ?? null,
        cifradoActivo: dto.cifradoActivo ?? 0,
        aesKey: dto.aesKey ?? null,
        aesBits: dto.aesBits ?? 128,
        estatus: EstatusEnum.ACTIVO,
      });
      const saved = await queryRunner.manager.save(panel);
      await queryRunner.commitTransaction();

      await this.bitacoraLogger.logToBitacora(
        'PanelAlarma',
        `Se creó el panel: ${saved.nombre}`,
        'CREATE',
        { dto: this.dtoSinSecreto(dto), idCliente },
        idUser,
        EnumModulos.PANELES,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Panel de alarma creado correctamente',
        data: { id: Number(saved.idDispositivo), nombre: saved.nombre },
      };
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      await this.bitacoraLogger.logToBitacora(
        'PanelAlarma',
        'Error al crear panel de alarma',
        'CREATE',
        { dto: this.dtoSinSecreto(dto), idCliente },
        idUser,
        EnumModulos.PANELES,
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
      const where: FindOptionsWhere<PanelAlarma> = {
        ...(tenant.idCliente !== undefined
          ? { idCliente: tenant.idCliente }
          : {}),
      };
      const data = await this.repository.find({
        where,
        relations: RELACIONES_DETALLE_PANEL,
        order: { idDispositivo: 'DESC' },
      });
      return { data: data.map((item) => mapPanelAlarmaPlano(item)) };
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
          paginated: { total: 0, page, limit, totalPages: 0 },
        };
      }
      const where: FindOptionsWhere<PanelAlarma> = {
        ...(tenant.idCliente !== undefined
          ? { idCliente: tenant.idCliente }
          : {}),
      };
      const [data, total] = await this.repository.findAndCount({
        where,
        relations: RELACIONES_DETALLE_PANEL,
        skip: (page - 1) * limit,
        take: limit,
        order: { idDispositivo: 'DESC' },
      });
      return {
        data: data.map((item) => mapPanelAlarmaPlano(item)),
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
        relations: RELACIONES_DETALLE_PANEL,
      });
      if (!entity) {
        throw new NotFoundException('Panel de alarma no encontrado');
      }
      return { data: mapPanelAlarmaPlano(entity) };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async update(
    id: number,
    dto: UpdatePanelAlarmaDto,
    idCliente: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({
        where: { idDispositivo: id, idCliente },
      });
      if (!entity) {
        throw new NotFoundException('Panel de alarma no encontrado');
      }

      if (dto.cuentaSia && dto.cuentaSia !== entity.cuentaSia) {
        const existeCuenta = await this.repository.findOne({
          where: { cuentaSia: dto.cuentaSia },
        });
        if (existeCuenta) {
          throw new BadRequestException('La cuenta SIA ya existe');
        }
      }

      if (dto.nombre !== undefined) entity.nombre = dto.nombre;
      if (dto.cuentaSia !== undefined) entity.cuentaSia = dto.cuentaSia;
      if (dto.ip !== undefined) entity.ip = dto.ip;
      if (dto.cifradoActivo !== undefined)
        entity.cifradoActivo = dto.cifradoActivo;
      if (dto.aesKey !== undefined) entity.aesKey = dto.aesKey;
      if (dto.aesBits !== undefined) entity.aesBits = dto.aesBits;
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
          throw new NotFoundException('Dispositivo del panel no encontrado');
        }
        if (dto.numeroSerie && dto.numeroSerie !== dispositivo.numeroSerie) {
          const existeNumeroSerie = await this.dispositivosRepo.findOne({
            where: { numeroSerie: dto.numeroSerie },
          });
          if (existeNumeroSerie) {
            throw new BadRequestException('El número de serie ya existe');
          }
        }
        await validarFksDispositivo(this.dispositivosRepo.manager, {
          idMarca:
            dto.idMarca !== undefined
              ? dto.idMarca
              : dispositivo.idMarca,
          idModelo:
            dto.idModelo !== undefined
              ? dto.idModelo
              : dispositivo.idModelo,
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
        'PanelAlarma',
        `Se actualizó el panel ID: ${id}`,
        'UPDATE',
        { id, dto: this.dtoSinSecreto(dto), idCliente },
        idUser,
        EnumModulos.PANELES,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Panel de alarma actualizado correctamente',
        data: { id, nombre: entity.nombre },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'PanelAlarma',
        `Error al actualizar panel ID: ${id}`,
        'UPDATE',
        { id, dto: this.dtoSinSecreto(dto), idCliente },
        idUser,
        EnumModulos.PANELES,
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
        where: { idDispositivo: id, idCliente },
      });
      if (!entity) {
        throw new NotFoundException('Panel de alarma no encontrado');
      }
      const dispositivo = await this.dispositivosRepo.findOne({
        where: { id, idCliente },
      });
      if (!dispositivo) {
        throw new NotFoundException('Dispositivo del panel no encontrado');
      }

      const estatusAnterior = Number(dispositivo.estatus);
      const estatus = dto.estatus;
      await this.dispositivosRepo.update({ id, idCliente }, { estatus });
      await this.repository.update(
        { idDispositivo: id, idCliente },
        { estatus },
      );

      await this.bitacoraLogger.logToBitacora(
        'PanelAlarma',
        `Se actualizó estatus de panel ID: ${id} a ${estatus}`,
        'UPDATE',
        { id, estatusAnterior, estatus, idCliente },
        idUser,
        EnumModulos.PANELES,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Estatus actualizado correctamente',
        estatus: { estatus },
        data: { id, nombre: entity.nombre },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'PanelAlarma',
        `Error al actualizar estatus de panel ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        EnumModulos.PANELES,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Error al cambiar estatus del panel',
      );
    }
  }
}
