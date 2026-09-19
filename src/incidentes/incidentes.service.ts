import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import {
  EnumModulos,
  EstatusIncidente,
  TipoOrigenIncidente,
} from 'src/common/estatus.enum';
import { imeiToString } from 'src/common/imei.util';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';
import { Clientes } from 'src/entities/Clientes';
import { Dispositivos } from 'src/entities/Dispositivos';
import { EventoAlarma } from 'src/entities/EventoAlarma';
import { Incidentes } from 'src/entities/Incidentes';
import { Posiciones } from 'src/entities/Posiciones';
import { SeguimientoIncidentes } from 'src/entities/SeguimientoIncidentes';
import {
  isoUtcToMexicoCityMysql,
  nowMexicoCityMysql,
} from 'src/utils/datetime-mexico.util';
import { CreateIncidenteDto } from './dto/create-incidente.dto';
import { CreateSeguimientoIncidenteDto } from './dto/create-seguimiento-incidente.dto';
import { UpdateIncidenteDto } from './dto/update-incidente.dto';
import {
  snapshotEventoAlarma,
  snapshotPosicion,
} from './map-datos-origen.util';
import {
  mapIncidentePlano,
  mapSeguimientoPlano,
  nombreIncidente,
  RELACIONES_INCIDENTE_DETALLE,
  RELACIONES_INCIDENTE_LISTA,
} from './map-incidentes.util';

@Injectable()
export class IncidentesService {
  constructor(
    @InjectRepository(Incidentes)
    private readonly repository: Repository<Incidentes>,
    @InjectRepository(SeguimientoIncidentes)
    private readonly seguimientoRepo: Repository<SeguimientoIncidentes>,
    @InjectRepository(Posiciones)
    private readonly posicionesRepo: Repository<Posiciones>,
    @InjectRepository(EventoAlarma)
    private readonly eventosRepo: Repository<EventoAlarma>,
    @InjectRepository(Dispositivos)
    private readonly dispositivosRepo: Repository<Dispositivos>,
    @InjectRepository(Clientes)
    private readonly clientesRepo: Repository<Clientes>,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly tenantFilter: TenantFilterService,
  ) {}

  private async assertClienteExiste(idCliente: number): Promise<void> {
    const cliente = await this.clientesRepo.findOne({
      where: { id: idCliente },
    });
    if (!cliente) {
      throw new BadRequestException('IdCliente no existe');
    }
  }

  private async assertClienteEnAlcance(
    idCliente: number,
    idClienteToken: number,
    rol: number,
  ): Promise<void> {
    const scope = await this.tenantFilter.idsClientePermitidos(
      rol,
      idClienteToken,
    );
    if (!this.tenantFilter.clienteVisibleEnScope(scope, idCliente)) {
      throw new ForbiddenException('Cliente fuera de alcance');
    }
  }

  private async findVisibleOrFail(
    id: number,
    idClienteToken: number,
    rol: number,
    detalle = false,
  ): Promise<Incidentes> {
    const tenant = await this.tenantFilter.forTypeOrmIdCliente(
      rol,
      idClienteToken,
    );
    if (tenant.sinAcceso) {
      throw new NotFoundException('Incidente no encontrado');
    }

    const where: FindOptionsWhere<Incidentes> = {
      id,
      ...(tenant.idCliente !== undefined ? { idCliente: tenant.idCliente } : {}),
    };

    const entity = await this.repository.findOne({
      where,
      relations: [
        ...(detalle
          ? RELACIONES_INCIDENTE_DETALLE
          : RELACIONES_INCIDENTE_LISTA),
      ],
    });
    if (!entity) {
      throw new NotFoundException('Incidente no encontrado');
    }
    return entity;
  }

  private async idClienteDesdeImei(imeiRaw: string): Promise<number> {
    const imei = imeiToString(imeiRaw);
    if (!imei) {
      throw new BadRequestException(
        'La posición no tiene IMEI válido para resolver el cliente',
      );
    }

    const row = await this.dispositivosRepo
      .createQueryBuilder('d')
      .select('d.idCliente', 'idCliente')
      .where('CAST(d.imei AS CHAR) = :imei', { imei })
      .getRawOne<{ idCliente: string | number }>();

    const idCliente = Number(row?.idCliente);
    if (!Number.isFinite(idCliente) || idCliente < 1) {
      throw new BadRequestException(
        'La posición no tiene un dispositivo asociado',
      );
    }
    return idCliente;
  }

  private async resolverOrigen(dto: CreateIncidenteDto): Promise<{
    tipoOrigen: TipoOrigenIncidente;
    idCliente: number;
    idPosicion: number | null;
    idPosicionOrigen: number | null;
    idEventoAlarma: number | null;
    idEventoAlarmaOrigen: number | null;
    datosOrigen: Record<string, unknown>;
  }> {
    const tipoOrigen = Number(dto.tipoOrigen) as TipoOrigenIncidente;

    if (tipoOrigen === TipoOrigenIncidente.POSICION) {
      if (dto.idEventoAlarma != null) {
        throw new BadRequestException(
          'idEventoAlarma no aplica cuando tipoOrigen es POSICION',
        );
      }
      if (dto.idPosicion == null) {
        throw new BadRequestException(
          'idPosicion es obligatorio cuando tipoOrigen es POSICION',
        );
      }

      const posicion = await this.posicionesRepo.findOne({
        where: { id: dto.idPosicion },
      });
      if (!posicion) {
        throw new NotFoundException('Posición no encontrada');
      }

      const idPosicion = Number(posicion.id);
      return {
        tipoOrigen,
        idCliente: await this.idClienteDesdeImei(posicion.imei),
        idPosicion,
        idPosicionOrigen: idPosicion,
        idEventoAlarma: null,
        idEventoAlarmaOrigen: null,
        datosOrigen: snapshotPosicion(posicion),
      };
    }

    if (tipoOrigen === TipoOrigenIncidente.EVENTO_ALARMA) {
      if (dto.idPosicion != null) {
        throw new BadRequestException(
          'idPosicion no aplica cuando tipoOrigen es EVENTO_ALARMA',
        );
      }
      if (dto.idEventoAlarma == null) {
        throw new BadRequestException(
          'idEventoAlarma es obligatorio cuando tipoOrigen es EVENTO_ALARMA',
        );
      }

      const evento = await this.eventosRepo.findOne({
        where: { id: dto.idEventoAlarma },
      });
      if (!evento) {
        throw new NotFoundException('Evento de alarma no encontrado');
      }

      const idCliente = Number(evento.idCliente);
      if (!Number.isFinite(idCliente) || idCliente < 1) {
        throw new BadRequestException(
          'El evento de alarma no tiene cliente asignado',
        );
      }

      const idEventoAlarma = Number(evento.id);
      return {
        tipoOrigen,
        idCliente,
        idPosicion: null,
        idPosicionOrigen: null,
        idEventoAlarma,
        idEventoAlarmaOrigen: idEventoAlarma,
        datosOrigen: snapshotEventoAlarma(evento),
      };
    }

    throw new BadRequestException('tipoOrigen inválido');
  }

  private parseFechaHora(raw?: string): string | undefined {
    if (raw == null || raw.trim() === '') {
      return undefined;
    }
    const s = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?$/.test(s)) {
      const normalizada = s.includes('T') ? s.replace('T', ' ') : s;
      return normalizada.length === 16 ? `${normalizada}:00` : normalizada;
    }
    try {
      return isoUtcToMexicoCityMysql(s);
    } catch {
      throw new BadRequestException('fechaHora tiene un formato inválido');
    }
  }

  private async whereListado(
    idClienteToken: number,
    rol: number,
    idClienteFiltro?: number,
    tipoOrigen?: number,
    soloAbiertos = false,
  ): Promise<FindOptionsWhere<Incidentes> | null> {
    const tenant = await this.tenantFilter.forTypeOrmIdCliente(
      rol,
      idClienteToken,
    );
    if (tenant.sinAcceso) {
      return null;
    }

    let idClienteWhere = tenant.idCliente;
    if (idClienteFiltro != null) {
      const scope = await this.tenantFilter.idsClientePermitidos(
        rol,
        idClienteToken,
      );
      if (!this.tenantFilter.clienteVisibleEnScope(scope, idClienteFiltro)) {
        return null;
      }
      idClienteWhere = idClienteFiltro;
    }

    return {
      ...(soloAbiertos ? { estatus: EstatusIncidente.ABIERTO } : {}),
      ...(tipoOrigen != null ? { tipoOrigen } : {}),
      ...(idClienteWhere !== undefined ? { idCliente: idClienteWhere } : {}),
    };
  }

  async create(
    dto: CreateIncidenteDto,
    idClienteToken: number,
    rol: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const origen = await this.resolverOrigen(dto);
      await this.assertClienteEnAlcance(
        origen.idCliente,
        idClienteToken,
        rol,
      );

      const entity = this.repository.create({
        idCliente: origen.idCliente,
        tipoOrigen: origen.tipoOrigen,
        idPosicion: origen.idPosicion,
        idPosicionOrigen: origen.idPosicionOrigen,
        idEventoAlarma: origen.idEventoAlarma,
        idEventoAlarmaOrigen: origen.idEventoAlarmaOrigen,
        datosOrigen: origen.datosOrigen,
        idUsuario: Number.isFinite(idUser) && idUser > 0 ? idUser : null,
        descripcion: dto.descripcion?.trim() || null,
        estatus: EstatusIncidente.ABIERTO,
        fechaCierre: null,
      });

      const saved = await this.repository.save(entity);

      await this.bitacoraLogger.logToBitacora(
        'Incidentes',
        `Se creó el incidente ID: ${saved.id}`,
        'CREATE',
        { dto, idCliente: origen.idCliente, tipoOrigen: origen.tipoOrigen },
        idUser,
        EnumModulos.REPORTES,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Incidente creado correctamente',
        data: { id: Number(saved.id), nombre: nombreIncidente(saved) },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Incidentes',
        'Error al crear incidente',
        'CREATE',
        { dto },
        idUser,
        EnumModulos.REPORTES,
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
    tipoOrigen?: number,
  ): Promise<ApiResponseCommon> {
    try {
      const where = await this.whereListado(
        idClienteToken,
        rol,
        idClienteFiltro,
        tipoOrigen,
        true,
      );
      if (!where) {
        return { data: [] };
      }

      const data = await this.repository.find({
        where,
        relations: [...RELACIONES_INCIDENTE_LISTA],
        order: { fechaInicio: 'DESC', id: 'DESC' },
      });

      return { data: data.map((item) => mapIncidentePlano(item)) };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findByIdCliente(
    idCliente: number,
    idClienteToken: number,
    rol: number,
    tipoOrigen?: number,
  ): Promise<ApiResponseCommon> {
    try {
      await this.assertClienteExiste(idCliente);
      await this.assertClienteEnAlcance(idCliente, idClienteToken, rol);

      const data = await this.repository.find({
        where: {
          idCliente,
          estatus: EstatusIncidente.ABIERTO,
          ...(tipoOrigen != null ? { tipoOrigen } : {}),
        },
        relations: [...RELACIONES_INCIDENTE_LISTA],
        order: { fechaInicio: 'DESC', id: 'DESC' },
      });

      return { data: data.map((item) => mapIncidentePlano(item)) };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findAll(
    idClienteToken: number,
    rol: number,
    page: number,
    limit: number,
    tipoOrigen?: number,
  ): Promise<ApiResponseCommon> {
    try {
      const where = await this.whereListado(
        idClienteToken,
        rol,
        undefined,
        tipoOrigen,
        false,
      );
      if (!where) {
        return {
          data: [],
          paginated: { total: 0, page, limit, totalPages: 0 },
        };
      }

      const [data, total] = await this.repository.findAndCount({
        where,
        relations: [...RELACIONES_INCIDENTE_LISTA],
        skip: (page - 1) * limit,
        take: limit,
        order: { fechaInicio: 'DESC', id: 'DESC' },
      });

      return {
        data: data.map((item) => mapIncidentePlano(item)),
        paginated: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 0,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findOne(
    id: number,
    idClienteToken: number,
    rol: number,
  ): Promise<{ data: ReturnType<typeof mapIncidentePlano> }> {
    const entity = await this.findVisibleOrFail(id, idClienteToken, rol, true);
    return { data: mapIncidentePlano(entity, true) };
  }

  async update(
    id: number,
    dto: UpdateIncidenteDto,
    idClienteToken: number,
    rol: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.findVisibleOrFail(id, idClienteToken, rol);
      if (dto.descripcion !== undefined) {
        entity.descripcion = dto.descripcion?.trim() || null;
      }
      const saved = await this.repository.save(entity);

      await this.bitacoraLogger.logToBitacora(
        'Incidentes',
        `Se actualizó el incidente ID: ${saved.id}`,
        'UPDATE',
        { dto },
        idUser,
        EnumModulos.REPORTES,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Incidente actualizado correctamente',
        data: { id: Number(saved.id), nombre: nombreIncidente(saved) },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Incidentes',
        `Error al actualizar incidente ID: ${id}`,
        'UPDATE',
        { dto },
        idUser,
        EnumModulos.REPORTES,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async updateEstatus(
    id: number,
    idClienteToken: number,
    rol: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.findVisibleOrFail(id, idClienteToken, rol);
      const estatusAnterior =
        Number(entity.estatus) === EstatusIncidente.ABIERTO
          ? EstatusIncidente.ABIERTO
          : EstatusIncidente.CERRADO;
      const estatus =
        estatusAnterior === EstatusIncidente.ABIERTO
          ? EstatusIncidente.CERRADO
          : EstatusIncidente.ABIERTO;

      entity.estatus = estatus;
      entity.fechaCierre =
        estatus === EstatusIncidente.CERRADO
          ? (nowMexicoCityMysql() as unknown as Date)
          : null;

      const saved = await this.repository.save(entity);

      await this.bitacoraLogger.logToBitacora(
        'Incidentes',
        `Se cambió estatus del incidente ID: ${saved.id} → ${estatus}`,
        'UPDATE',
        { estatusAnterior, estatus },
        idUser,
        EnumModulos.REPORTES,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Estatus actualizado correctamente',
        estatus: { estatus },
        data: { id: Number(saved.id), nombre: nombreIncidente(saved) },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Incidentes',
        `Error al cambiar estatus del incidente ID: ${id}`,
        'UPDATE',
        {},
        idUser,
        EnumModulos.REPORTES,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async createSeguimiento(
    idIncidente: number,
    dto: CreateSeguimientoIncidenteDto,
    idClienteToken: number,
    rol: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const incidente = await this.findVisibleOrFail(
        idIncidente,
        idClienteToken,
        rol,
      );

      const fechaHora = this.parseFechaHora(dto.fechaHora);
      const entity = this.seguimientoRepo.create({
        idIncidente: Number(incidente.id),
        idUsuario: Number.isFinite(idUser) && idUser > 0 ? idUser : null,
        actividad: dto.actividad.trim(),
        medio: dto.medio?.trim() || null,
        estatus: EstatusIncidente.ABIERTO,
        ...(fechaHora != null ? { fechaHora: fechaHora as unknown as Date } : {}),
      });

      const saved = await this.seguimientoRepo.save(entity);

      await this.bitacoraLogger.logToBitacora(
        'Incidentes',
        `Se registró seguimiento ID: ${saved.id} en incidente ${incidente.id}`,
        'CREATE',
        { dto, idIncidente },
        idUser,
        EnumModulos.REPORTES,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Seguimiento registrado correctamente',
        data: { id: Number(saved.id), nombre: saved.actividad },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Incidentes',
        `Error al registrar seguimiento en incidente ID: ${idIncidente}`,
        'CREATE',
        { dto, idIncidente },
        idUser,
        EnumModulos.REPORTES,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findSeguimientos(
    idIncidente: number,
    idClienteToken: number,
    rol: number,
  ): Promise<ApiResponseCommon> {
    await this.findVisibleOrFail(idIncidente, idClienteToken, rol);
    const data = await this.seguimientoRepo.find({
      where: { idIncidente },
      relations: ['idUsuario2'],
      order: { fechaHora: 'ASC', id: 'ASC' },
    });
    return { data: data.map((item) => mapSeguimientoPlano(item)) };
  }
}
