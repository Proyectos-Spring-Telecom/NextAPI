import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Not, Repository } from 'typeorm';
import { Dispositivos } from 'src/entities/Dispositivos';
import { PanelAlarma } from 'src/entities/PanelAlarma';
import { Instalaciones } from 'src/entities/Instalaciones';
import { HistoricoInstalaciones } from 'src/entities/HistoricoInstalaciones';
import { RelojConfig } from 'src/entities/RelojConfig';
import { TrackcamConfig } from 'src/entities/TrackcamConfig';
import { Clientes } from 'src/entities/Clientes';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { CreateDispositivosDto } from './dto/create-dispositivos.dto';
import { UpdateDispositivosDto } from './dto/update-dispositivos.dto';
import { UpdateDispositivoEstatusDto } from './dto/update-dispositivo-estatus.dto';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import { TenantFilterService, type UsuarioAlcance } from 'src/common/tenant-filter/tenant-filter.service';
import { imeiToString } from 'src/common/imei.util';
import {
  EnumModulos,
  EnumEstatusProductoDispositivo,
  EstatusEnum,
} from 'src/common/estatus.enum';
import { assertCambioEstatus } from 'src/common/assert-estatus-no-asignado.util';
import {
  crearDispositivoBase,
  obtenerTipoPanelAlarma,
  obtenerTipoReloj,
  obtenerTipoTrackcam,
  validarFksDispositivo,
} from './crear-dispositivo.util';
import {
  mapDispositivoPlano,
  RELACIONES_DISPOSITIVO_BASE,
} from './map-relaciones.util';

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
export class DispositivosService {
  constructor(
    @InjectRepository(Dispositivos)
    private readonly repository: Repository<Dispositivos>,
    @InjectRepository(PanelAlarma)
    private readonly panelRepo: Repository<PanelAlarma>,
    @InjectRepository(Instalaciones)
    private readonly instalacionesRepo: Repository<Instalaciones>,
    @InjectRepository(HistoricoInstalaciones)
    private readonly historicoInstalacionesRepo: Repository<HistoricoInstalaciones>,
    @InjectRepository(Clientes)
    private readonly clientesRepo: Repository<Clientes>,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly tenantFilter: TenantFilterService,
  ) { }

  private async whereTenant(
    rol: number,
    idClienteToken: number,
    idTipoDispositivo?: number,
    idClienteFiltro?: number,
  ): Promise<{ sinAcceso: boolean; where: FindOptionsWhere<Dispositivos> }> {
    const tenant = await this.tenantFilter.forTypeOrmIdCliente(
      rol,
      idClienteToken,
    );
    if (tenant.sinAcceso) {
      return { sinAcceso: true, where: {} };
    }

    let idClienteWhere = tenant.idCliente;
    if (idClienteFiltro != null) {
      if (tenant.idCliente === undefined) {
        idClienteWhere = idClienteFiltro;
      } else if (typeof tenant.idCliente === 'number') {
        if (Number(tenant.idCliente) !== idClienteFiltro) {
          return { sinAcceso: true, where: {} };
        }
        idClienteWhere = idClienteFiltro;
      } else {
        const ids = await this.tenantFilter.getClienteHijosIds(idClienteToken);
        if (!ids.includes(idClienteFiltro)) {
          return { sinAcceso: true, where: {} };
        }
        idClienteWhere = idClienteFiltro;
      }
    }

    return {
      sinAcceso: false,
      where: {
        ...(idClienteWhere !== undefined ? { idCliente: idClienteWhere } : {}),
        ...(idTipoDispositivo != null ? { idTipoDispositivo } : {}),
      },
    };
  }

  async create(
    dto: CreateDispositivosDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    const idCliente = dto.idCliente;
    try {
      const tipoPanel = await obtenerTipoPanelAlarma(
        this.repository.manager,
      ).catch(() => null);
      if (
        tipoPanel &&
        Number(dto.idTipoDispositivo) === Number(tipoPanel.id)
      ) {
        throw new BadRequestException(
          'El tipo panel requiere datos extra. Use POST /dispositivos/paneles',
        );
      }

      const tipoTrackcam = await obtenerTipoTrackcam(
        this.repository.manager,
      ).catch(() => null);
      if (
        tipoTrackcam &&
        Number(dto.idTipoDispositivo) === Number(tipoTrackcam.id)
      ) {
        throw new BadRequestException(
          'El tipo Trackcam requiere configuración operativa. Use POST /dispositivos/trackcam',
        );
      }

      const tipoReloj = await obtenerTipoReloj(this.repository.manager).catch(
        () => null,
      );
      if (tipoReloj && Number(dto.idTipoDispositivo) === Number(tipoReloj.id)) {
        throw new BadRequestException(
          'El tipo Reloj requiere configuración propia. Use POST /dispositivos/relojes',
        );
      }

      const saved = await crearDispositivoBase(this.repository.manager, {
        idCliente,
        idTipoDispositivo: dto.idTipoDispositivo,
        numeroSerie: dto.numeroSerie,
        imei: dto.imei ?? null,
        eco: dto.eco ?? null,
        camara: dto.camara ?? 0,
        idMarca: dto.idMarca ?? null,
        idModelo: dto.idModelo ?? null,
      });

      await this.bitacoraLogger.logToBitacora(
        'Dispositivos',
        `Se creó el dispositivo Nº serie: ${dto.numeroSerie}`,
        'CREATE',
        { dto, idCliente },
        idUser,
        EnumModulos.DISPOSITIVOS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Dispositivo creado correctamente',
        data: { id: Number(saved.id), nombre: saved.numeroSerie },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Dispositivos',
        `Error al crear dispositivo Nº serie: ${dto.numeroSerie}`,
        'CREATE',
        { dto, idCliente },
        idUser,
        EnumModulos.DISPOSITIVOS,
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
    idTipoDispositivo?: number,
    idClienteFiltro?: number,
  ): Promise<ApiResponseCommon> {
    try {
      const { sinAcceso, where } = await this.whereTenant(
        rol,
        idCliente,
        idTipoDispositivo,
        idClienteFiltro,
      );
      if (sinAcceso) {
        return { data: [] };
      }
      const data = await this.repository.find({
        where: {
          ...where,
          estatus: EnumEstatusProductoDispositivo.ACTIVO,
        },
        relations: [...RELACIONES_DISPOSITIVO_BASE],
        order: { id: 'DESC' },
      });
      return { data: data.map((item) => mapDispositivoPlano(item)) };
    } catch (error) {
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findByIdCliente(
    idCliente: number,
    idClienteToken: number,
    rol: number,
  ): Promise<ApiResponseCommon> {
    try {
      const { sinAcceso, where } = await this.whereTenant(
        rol,
        idClienteToken,
        undefined,
        idCliente,
      );
      if (sinAcceso) {
        throw new ForbiddenException('Cliente fuera de alcance');
      }

      const data = await this.repository.find({
        where: {
          ...where,
          estatus: EnumEstatusProductoDispositivo.ASIGNADO,
        },
        relations: [...RELACIONES_DISPOSITIVO_BASE],
        order: { id: 'DESC' },
      });
      return { data: data.map((item) => mapDispositivoPlano(item)) };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findAll(
    idCliente: number,
    rol: number,
    page: number,
    limit: number,
    idTipoDispositivo?: number,
    obtenerTodos?: EstatusEnum,
  ): Promise<ApiResponseCommon> {
    try {
      const { sinAcceso, where } = await this.whereTenant(
        rol,
        idCliente,
        idTipoDispositivo,
      );
      if (sinAcceso) {
        return {
          data: [],
          paginated: { total: 0, page, limit, totalPages: 0 },
        };
      }
      const incluirInservibles = obtenerTodos === EstatusEnum.ACTIVO;
      const [data, total] = await this.repository.findAndCount({
        where: {
          ...where,
          ...(incluirInservibles
            ? {}
            : { estatus: Not(EnumEstatusProductoDispositivo.INSERVIBLE) }),
        },
        relations: [...RELACIONES_DISPOSITIVO_BASE],
        skip: (page - 1) * limit,
        take: limit,
        order: { id: 'DESC' },
      });
      return {
        data: data.map((item) => mapDispositivoPlano(item)),
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
        where: { id },
        relations: [...RELACIONES_DISPOSITIVO_BASE],
      });
      if (!entity) {
        throw new NotFoundException('Dispositivo no encontrado');
      }
      await this.tenantFilter.assertClienteVisible(alcance, Number(entity.idCliente), 'Dispositivo');
      return { data: mapDispositivoPlano(entity) };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  /** Las FK (IdCliente, IdDispositivo) de Instalaciones/HistoricoInstalaciones impiden mover el equipo con historial. */
  private async assertSinInstalaciones(
    id: number,
    idCliente: number,
  ): Promise<void> {
    const activa = await this.instalacionesRepo.findOne({
      select: { id: true },
      where: { idDispositivo: id, idCliente, estatus: EstatusEnum.ACTIVO },
    });
    if (activa) {
      throw new ConflictException(
        `El dispositivo está en la instalación ${Number(activa.id)}. Retíralo de la instalación antes de cambiar cliente, IMEI o número de serie.`,
      );
    }

    const [enInstalaciones, enHistorico] = await Promise.all([
      this.instalacionesRepo.exists({ where: { idDispositivo: id, idCliente } }),
      this.historicoInstalacionesRepo.exists({
        where: { idDispositivo: id, idCliente },
      }),
    ]);
    if (enInstalaciones || enHistorico) {
      throw new ConflictException(
        'El dispositivo ya tiene historial de instalaciones; no se puede cambiar cliente, IMEI ni número de serie. Los demás datos sí se pueden actualizar.',
      );
    }
  }

  /**
   * PanelAlarma, TrackcamConfig y RelojConfig apuntan a (IdCliente, IdDispositivo) con NO ACTION, por eso se
   * desactivan las FK solo en esta conexión. Los demás campos se guardan antes, con FK activas,
   * para que el ON UPDATE CASCADE de UltimaPosicion siga al IMEI.
   */
  private async cambiarCliente(
    entity: Dispositivos,
    idClienteAnterior: number,
    idClienteNuevo: number,
  ): Promise<void> {
    const id = Number(entity.id);
    const qr = this.repository.manager.connection.createQueryRunner();
    await qr.connect();
    try {
      await qr.startTransaction();

      const resultado = await qr.manager.update(
        Dispositivos,
        { id, idCliente: idClienteAnterior },
        {
          idTipoDispositivo: entity.idTipoDispositivo,
          numeroSerie: entity.numeroSerie,
          imei: entity.imei,
          eco: entity.eco,
          camara: entity.camara,
          idMarca: entity.idMarca,
          idModelo: entity.idModelo,
        },
      );
      if (!resultado.affected) {
        throw new NotFoundException('Dispositivo no encontrado');
      }

      await qr.query('SET FOREIGN_KEY_CHECKS = 0');
      await qr.manager.update(
        Dispositivos,
        { id, idCliente: idClienteAnterior },
        { idCliente: idClienteNuevo },
      );
      await qr.manager.update(
        PanelAlarma,
        { idDispositivo: id, idCliente: idClienteAnterior },
        { idCliente: idClienteNuevo },
      );
      await qr.manager.update(
        TrackcamConfig,
        { idDispositivo: id, idCliente: idClienteAnterior },
        { idCliente: idClienteNuevo },
      );
      await qr.manager.update(
        RelojConfig,
        { idDispositivo: id, idCliente: idClienteAnterior },
        { idCliente: idClienteNuevo },
      );
      await qr.query('SET FOREIGN_KEY_CHECKS = 1');

      await qr.commitTransaction();
    } catch (error) {
      if (qr.isTransactionActive) {
        await qr.rollbackTransaction();
      }
      throw error;
    } finally {
      await qr.query('SET FOREIGN_KEY_CHECKS = 1').catch(() => undefined);
      await qr.release();
    }
  }

  async update(
    id: number,
    dto: UpdateDispositivosDto,
    idClienteToken: number,
    rol: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    let idClienteAnterior: number | null = null;
    let idClienteNuevo: number | null = null;
    try {
      const entity = await this.repository.findOne({
        where: { id },
      });
      if (!entity) {
        throw new NotFoundException('Dispositivo no encontrado');
      }

      const scope = await this.tenantFilter.idsClientePermitidos(
        rol,
        idClienteToken,
      );
      if (!this.tenantFilter.clienteVisibleEnScope(scope, entity.idCliente)) {
        throw new NotFoundException('Dispositivo no encontrado');
      }

      idClienteAnterior = Number(entity.idCliente);
      const cambiaCliente =
        dto.idCliente !== undefined &&
        Number(dto.idCliente) !== idClienteAnterior;
      if (cambiaCliente) {
        idClienteNuevo = Number(dto.idCliente);
        if (!this.tenantFilter.clienteVisibleEnScope(scope, idClienteNuevo)) {
          throw new ForbiddenException('No tienes acceso a ese cliente');
        }
        const existeCliente = await this.clientesRepo.exists({
          where: { id: idClienteNuevo },
        });
        if (!existeCliente) {
          throw new BadRequestException('IdCliente no existe');
        }
      }

      const numeroSerie =
        dto.numeroSerie !== undefined ? dto.numeroSerie.trim() : undefined;
      if (numeroSerie === '') {
        throw new BadRequestException('El número de serie no puede ir vacío');
      }
      const imei = normalizarTexto(dto.imei);
      const eco = normalizarTexto(dto.eco);

      const cambiaImei =
        imei !== undefined && imeiToString(imei) !== imeiToString(entity.imei);
      const cambiaSerie =
        numeroSerie !== undefined && numeroSerie !== entity.numeroSerie;

      if (cambiaCliente || cambiaImei || cambiaSerie) {
        await this.assertSinInstalaciones(id, idClienteAnterior);
      }

      if (cambiaSerie) {
        const existeNumeroSerie = await this.repository.findOne({
          where: { numeroSerie },
        });
        if (existeNumeroSerie) {
          throw new BadRequestException('El número de serie ya existe');
        }
      }

      if (cambiaImei && imei != null) {
        const existeImei = await this.repository.findOne({
          where: { imei },
        });
        if (existeImei) {
          throw new BadRequestException('El IMEI ya está registrado');
        }
      }

      await validarFksDispositivo(this.repository.manager, {
        idTipoDispositivo: dto.idTipoDispositivo,
        idMarca:
          dto.idMarca !== undefined || dto.idModelo !== undefined
            ? dto.idMarca !== undefined
              ? dto.idMarca
              : entity.idMarca
            : undefined,
        idModelo:
          dto.idMarca !== undefined || dto.idModelo !== undefined
            ? dto.idModelo !== undefined
              ? dto.idModelo
              : entity.idModelo
            : dto.idModelo,
      });

      if (dto.idTipoDispositivo !== undefined)
        entity.idTipoDispositivo = dto.idTipoDispositivo;
      if (numeroSerie !== undefined) entity.numeroSerie = numeroSerie;
      if (imei !== undefined) entity.imei = imei;
      if (eco !== undefined) entity.eco = eco;
      if (dto.camara !== undefined) entity.camara = dto.camara;
      if (dto.idMarca !== undefined) entity.idMarca = dto.idMarca;
      if (dto.idModelo !== undefined) entity.idModelo = dto.idModelo;

      if (cambiaCliente && idClienteNuevo != null) {
        await this.cambiarCliente(entity, idClienteAnterior, idClienteNuevo);

        await this.bitacoraLogger.logToBitacora(
          'Dispositivos',
          `Se cambió el dispositivo ID: ${id} del cliente ${idClienteAnterior} al cliente ${idClienteNuevo}`,
          'UPDATE',
          { id, idClienteAnterior, idClienteNuevo, dto },
          idUser,
          EnumModulos.DISPOSITIVOS,
          EstatusEnumBitcora.SUCCESS,
        );
      } else {
        await this.repository.save(entity);

        await this.bitacoraLogger.logToBitacora(
          'Dispositivos',
          `Se actualizó el dispositivo ID: ${id}`,
          'UPDATE',
          { id, dto, idCliente: idClienteToken },
          idUser,
          EnumModulos.DISPOSITIVOS,
          EstatusEnumBitcora.SUCCESS,
        );
      }

      return {
        status: 'success',
        message: 'Dispositivo actualizado correctamente',
        data: { id, nombre: entity.numeroSerie },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Dispositivos',
        `Error al actualizar dispositivo ID: ${id}`,
        'UPDATE',
        idClienteNuevo != null
          ? { id, idClienteAnterior, idClienteNuevo, dto }
          : { id, dto, idCliente: idClienteToken },
        idUser,
        EnumModulos.DISPOSITIVOS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;

      const errno = mysqlErrno(error);
      if (errno === 1451 || errno === 1452) {
        throw new ConflictException(
          'No se puede guardar: el dispositivo está relacionado con instalaciones o configuraciones de otro cliente.',
        );
      }
      if (errno === 1062) {
        throw new ConflictException(
          'El IMEI o número de serie ya está registrado',
        );
      }
      throw new BadRequestException('Error al actualizar el dispositivo');
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
        where: { id },
      });
      if (!entity) {
        throw new NotFoundException('Dispositivo no encontrado');
      }

      // Solo recursos del alcance del usuario (404 si no); a mano no se pone "asignado".
      await this.tenantFilter.assertClienteVisible(alcance, Number(entity.idCliente), 'Recurso');
      assertCambioEstatus(Number(entity.estatus), Number(dto.estatus), 'dispositivo');

      const estatusAnterior = Number(entity.estatus);
      const estatus = dto.estatus;
      await this.repository.update({ id }, { estatus });
      await this.panelRepo.update({ idDispositivo: id }, { estatus });

      await this.bitacoraLogger.logToBitacora(
        'Dispositivos',
        `Se actualizó estatus de dispositivo ID: ${id} a ${estatus}`,
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
        data: { id, nombre: entity.numeroSerie },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Dispositivos',
        `Error al actualizar estatus de dispositivo ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        EnumModulos.DISPOSITIVOS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Error al cambiar estatus del dispositivo',
      );
    }
  }
}
