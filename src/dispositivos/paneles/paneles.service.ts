import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Not, Repository } from 'typeorm';
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
import { TenantFilterService, type UsuarioAlcance } from 'src/common/tenant-filter/tenant-filter.service';
import { imeiToString } from 'src/common/imei.util';
import {
  EnumEstatusProductoDispositivo,
  EnumModulos,
  EstatusEnum,
} from 'src/common/estatus.enum';
import { MotorActivosService, sinEstatus } from 'src/motor-activos/motor-activos.service';
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
    private readonly motor: MotorActivosService,
  ) { }

  private dtoSinSecreto(dto: object) {
    const { aesKey: _aesKey, ...resto } = dto as { aesKey?: string };
    return resto;
  }

  async create(
    dto: CreatePanelAlarmaDto,
    idUser: number,
    alcance: UsuarioAlcance,
  ): Promise<ApiCrudResponse> {
    const idCliente = dto.idCliente;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // El cliente destino debe estar en el alcance de quien crea (403).
      await this.tenantFilter.assertClienteDestino(alcance, idCliente);
      const existeCuenta = await queryRunner.manager.findOne(PanelAlarma, {
        where: { cuentaSia: dto.cuentaSia },
      });
      if (existeCuenta) {
        throw new BadRequestException('La cuenta SIA ya existe');
      }

      const tipo = await obtenerTipoPanelAlarma(queryRunner.manager);
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
      const where: FindOptionsWhere<PanelAlarma> = {
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

  async findOne(id: number, alcance: UsuarioAlcance) {
    try {
      const entity = await this.repository.findOne({
        where: { idDispositivo: id },
        relations: RELACIONES_DETALLE_PANEL,
      });
      if (!entity) {
        throw new NotFoundException('Panel de alarma no encontrado');
      }
      // Fuera del alcance del usuario responde igual que si no existiera (404).
      await this.tenantFilter.assertClienteVisible(alcance, Number(entity.idCliente), 'Panel de alarma');
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
    alcance: UsuarioAlcance,
  ): Promise<ApiCrudResponse> {
    try {
      // Se busca por id (no por el cliente del token) y se valida el cliente del
      // registro: administración y clientes padre editan lo de sus clientes hijos.
      const entity = await this.repository.findOne({
        where: { idDispositivo: id },
      });
      if (!entity) {
        throw new NotFoundException('Panel de alarma no encontrado');
      }
      await this.tenantFilter.assertClienteVisible(alcance, Number(entity.idCliente), 'Panel de alarma');
      const idClienteRecurso = Number(entity.idCliente);

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
        dto.camara !== undefined ||
        dto.idMarca !== undefined ||
        dto.idModelo !== undefined;

      if (hayCamposDispositivo) {
        const dispositivo = await this.dispositivosRepo.findOne({
          where: { id, idCliente: idClienteRecurso },
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
        if (dto.camara !== undefined) dispositivo.camara = dto.camara;
        if (dto.idMarca !== undefined) dispositivo.idMarca = dto.idMarca;
        if (dto.idModelo !== undefined) dispositivo.idModelo = dto.idModelo;
        await this.dispositivosRepo.save(sinEstatus(dispositivo));
      }

      await this.bitacoraLogger.logToBitacora(
        'PanelAlarma',
        `Se actualizó el panel ID: ${id}`,
        'UPDATE',
        { id, dto: this.dtoSinSecreto(dto), idCliente, idClienteRecurso },
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
    alcance: UsuarioAlcance,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({
        where: { idDispositivo: id },
      });
      if (!entity) {
        throw new NotFoundException('Panel de alarma no encontrado');
      }
      const dispositivo = await this.dispositivosRepo.findOne({
        where: { id },
      });
      if (!dispositivo) {
        throw new NotFoundException('Dispositivo del panel no encontrado');
      }

      // Solo recursos del alcance del usuario (404 si no); la transición la valida el motor (§1).
      await this.tenantFilter.assertClienteVisible(alcance, Number(dispositivo.idCliente), 'Recurso');

      const estatusAnterior = Number(dispositivo.estatus);
      const estatus = dto.estatus;
      await this.motor.cambiarEstatusManual('dispositivo', dispositivo, estatus, {
        idUsuario: idUser,
        rol: alcance.rol,
        motivo: dto.motivo,
      });

      await this.bitacoraLogger.logToBitacora(
        'PanelAlarma',
        `Se actualizó estatus de panel ID: ${id} a ${estatus}`,
        'UPDATE',
        {
          id,
          estatusAnterior,
          estatus,
          idCliente,
          idClienteRecurso: entity.idCliente,
        },
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
