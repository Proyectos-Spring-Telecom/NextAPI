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
import {
  DataSource,
  EntityManager,
  FindOptionsWhere,
  In,
  QueryRunner,
  Repository,
} from 'typeorm';
import { Instalaciones } from 'src/entities/Instalaciones';
import { HistoricoInstalaciones } from 'src/entities/HistoricoInstalaciones';
import { Dispositivos } from 'src/entities/Dispositivos';
import { CatTipoDispositivo } from 'src/entities/CatTipoDispositivo';
import { Sims } from 'src/entities/Sims';
import { Productos } from 'src/entities/Productos';
import { CatEstatusInstalacion } from 'src/entities/CatEstatusInstalacion';
import { Usuarios } from 'src/entities/Usuarios';
import { UsuariosInstalaciones } from 'src/entities/UsuariosInstalaciones';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { CreateInstalacionesDto } from './dto/create-instalaciones.dto';
import { UpdateInstalacionesDto } from './dto/update-instalaciones.dto';
import { BajaInstalacionDto } from './dto/baja-instalacion.dto';
import { CorregirVigenteDesdeDto } from './dto/corregir-vigente-desde.dto';
import { CorregirClienteInstalacionDto } from './dto/corregir-cliente.dto';
import { Clientes } from 'src/entities/Clientes';
import { OrdenesServicio } from 'src/entities/OrdenesServicio';
import { CorreccionesInstalacion } from 'src/entities/CorreccionesInstalacion';
import { RegistroTrackcamService } from 'src/motor-activos/registro-trackcam.service';
import { WebhookEvent } from 'src/webhook-emitter/interfaces/webhook-event.interface';
import { FilterInstalacionesPaginadoDto } from './dto/filter-instalaciones-paginado.dto';
import {
  ApiCrudResponse,
  ApiData,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import { TenantFilterService, type UsuarioAlcance } from 'src/common/tenant-filter/tenant-filter.service';
import {
  EnumAccionHistoricoInstalacion,
  EnumEstatusInstalacion,
  EnumEstatusProductoDispositivo,
  EnumModulos,
  EnumRoles,
  EnumTipoProducto,
  EstatusEnum,
  ESTATUS_INSTALACION_PATCH,
  ESTATUS_INSTALACION_UPDATE_HISTORICO,
  ESTATUS_PRODUCTO_DISPOSITIVO_PATCH,
} from 'src/common/estatus.enum';
import {
  mapHistoricoDetallePlano,
  mapInstalacionHistoricoVigente,
  mapInstalacionPlana,
  RELACIONES_INSTALACION_HISTORICO_DETALLE,
} from './map-instalaciones.util';
import {
  applyPaginadoBaseJoins,
  applyPaginadoPorTipoProducto,
  applyPaginadoSelectBase,
  applyPaginadoTodosTiposProducto,
  mapInstalacionPaginadaPlana,
} from './helpers/instalaciones-paginado.helpers';
import {
  applyDetalleJoins,
  applyDetallePorTipoProducto,
  applyDetalleSelectBase,
  mapInstalacionDetallePlana,
} from './helpers/instalaciones-detalle.helpers';
import {
  fechaPared,
  fechaParedComoDate,
  nowMexicoCityAsUtcDate,
} from 'src/utils/datetime-mexico.util';
import {
  type ContextoMovimiento,
  MotorActivosService,
} from 'src/motor-activos/motor-activos.service';
import {
  type OrigenMovimiento,
  type TipoRecurso,
  assertEstatusSalida,
  EstatusRecurso,
  estatusSalidaPorBaja,
} from 'src/motor-activos/estatus-recurso';

/** Clase de una instalación sin equipo o de un tipo sin clase (fase C). */
const CLASE_POR_OMISION = 'AVL';

/**
 * Dos altas simultáneas de la misma clase en un vehículo: la segunda choca con
 * UQ_Inst_ProductoClaseActiva. Se responde 409 en lugar del error de la base.
 */
function choqueDeClase(error: unknown): ConflictException | null {
  const e = error as { message?: string; driverError?: { message?: string } };
  const texto = `${e?.message ?? ''} ${e?.driverError?.message ?? ''}`;
  return texto.includes('UQ_Inst_ProductoClaseActiva')
    ? new ConflictException('El vehículo ya tiene una instalación activa de esa clase de equipo (se dio de alta al mismo tiempo).')
    : null;
}

/** De dónde viene la operación (para el historial de los recursos). Sin él = REST. */
export interface OrigenOperacion {
  origen: OrigenMovimiento;
  idOrdenServicio?: number | null;
  /**
   * TrackCams que cambiaron de cliente dentro de la transacción del llamador:
   * su registro en el gateway lo emite el llamador después de su commit.
   */
  trackcamPendientes?: number[];
}

@Injectable()
export class InstalacionesService {
  constructor(
    @InjectRepository(Instalaciones)
    private readonly repository: Repository<Instalaciones>,
    @InjectRepository(HistoricoInstalaciones)
    private readonly historicoRepo: Repository<HistoricoInstalaciones>,
    @InjectRepository(Dispositivos)
    private readonly dispositivosRepo: Repository<Dispositivos>,
    @InjectRepository(Sims)
    private readonly simsRepo: Repository<Sims>,
    @InjectRepository(Productos)
    private readonly productosRepo: Repository<Productos>,
    @InjectRepository(CatEstatusInstalacion)
    private readonly estatusInstalacionRepo: Repository<CatEstatusInstalacion>,
    private readonly dataSource: DataSource,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly tenantFilter: TenantFilterService,
    private readonly motor: MotorActivosService,
    private readonly registroTrackcam: RegistroTrackcamService,
  ) {}

  private contexto(
    idUser: number,
    idInstalacion: number,
    origen: OrigenOperacion | undefined,
    motivo?: string | null,
  ): ContextoMovimiento {
    return {
      idUsuario: idUser,
      origen: origen?.origen ?? 'api',
      idOrdenServicio: origen?.idOrdenServicio ?? null,
      idInstalacion,
      motivo: motivo ?? null,
    };
  }

  /**
   * Dispositivo y SIM que entran a una instalación toman su cliente (del almacén
   * o reservados a él) antes de escribir la versión activa. Devuelve el cliente
   * que tenía cada uno, para el movimiento.
   */
  private async tomarComponentes(
    manager: EntityManager,
    c: { idDispositivo: number | null; idSim: number | null },
    idCliente: number,
  ): Promise<Map<'dispositivo' | 'sim', number | null>> {
    const antes = new Map<'dispositivo' | 'sim', number | null>();
    if (c.idDispositivo != null) {
      antes.set('dispositivo', await this.motor.tomarParaInstalar(manager, 'dispositivo', Number(c.idDispositivo), idCliente));
    }
    if (c.idSim != null) {
      antes.set('sim', await this.motor.tomarParaInstalar(manager, 'sim', Number(c.idSim), idCliente));
    }
    return antes;
  }

  /**
   * Instalar o desinstalar le cambia el cliente al equipo: el registro de una
   * TrackCam en el gateway se actualiza (tenant). Con transacción propia, al
   * terminar; dentro de la del llamador, lo emite él después de su commit.
   */
  private async avisarRegistroTrackcam(
    propia: boolean,
    origen: OrigenOperacion | undefined,
    ids: Array<number | null | undefined>,
  ): Promise<void> {
    const lista = ids.filter((x): x is number => x != null).map(Number);
    if (!lista.length) return;
    if (propia) await this.registroTrackcam.emitir(WebhookEvent.TRACKCAM_UPDATED, lista);
    else origen?.trackcamPendientes?.push(...lista);
  }

  /** Componentes de una versión de instalación, para moverlos con el motor. */
  private componentes(i: {
    idProducto: number;
    idDispositivo: number | null;
    idSim: number | null;
  }): Array<{ tipo: TipoRecurso; id: number }> {
    return [
      { tipo: 'producto' as const, id: Number(i.idProducto) },
      ...(i.idDispositivo != null ? [{ tipo: 'dispositivo' as const, id: Number(i.idDispositivo) }] : []),
      ...(i.idSim != null ? [{ tipo: 'sim' as const, id: Number(i.idSim) }] : []),
    ];
  }

  /**
   * `manager`: el de la transacción del llamador, para ver lo que ya cambió en
   * ella (p. ej. el cierre de un alta autorizada da de baja la instalación
   * anterior y libera el producto antes del alta).
   */
  private async validarProducto(
    idProducto: number,
    idCliente: number,
    manager?: EntityManager,
  ): Promise<Productos> {
    const producto = await (manager ?? this.productosRepo.manager).findOne(Productos, {
      where: { id: idProducto, idCliente },
    });
    if (!producto) {
      throw new BadRequestException(
        'IdProducto no existe o no pertenece al cliente',
      );
    }
    return producto;
  }

  /**
   * El vehículo puede recibir una instalación de esta clase (fase C): está
   * disponible (1), o ya instalado (2) con equipos de otra clase. Un GPS, una
   * TrackCam, un panel… por vehículo (UQ_Inst_ProductoClaseActiva).
   */
  private async validarProductoDisponibleParaAsignar(
    idProducto: number,
    idCliente: number,
    manager?: EntityManager,
    clase = CLASE_POR_OMISION,
    excludeInstalacionId?: number,
  ): Promise<Productos> {
    const producto = await this.validarProducto(idProducto, idCliente, manager);
    const estatus = Number(producto.estatus);
    if (estatus === EnumEstatusProductoDispositivo.ACTIVO) return producto;
    if (estatus === EstatusRecurso.INSTALADO) {
      const misma = await (manager ?? this.repository.manager).findOne(Instalaciones, {
        where: { idProducto, estatus: EstatusEnum.ACTIVO, clase },
        select: { id: true },
      });
      if (!misma || Number(misma.id) === excludeInstalacionId) return producto;
      throw new BadRequestException(
        `El vehículo ya tiene una instalación ${clase} activa (${Number(misma.id)}): un equipo por clase.`,
      );
    }
    throw new BadRequestException(
      'El producto debe estar disponible (1), o instalado con equipos de otra clase',
    );
  }

  /** Clase del equipo (CatTipoDispositivo.Clase); sin equipo, la clase por omisión. */
  async claseDe(manager: EntityManager, idDispositivo: number | null | undefined): Promise<string> {
    if (idDispositivo == null) return CLASE_POR_OMISION;
    const fila = await manager
      .createQueryBuilder(Dispositivos, 'd')
      .innerJoin(CatTipoDispositivo, 't', 't.id = d.idTipoDispositivo')
      .select('t.clase', 'clase')
      .where('d.id = :id', { id: idDispositivo })
      .getRawOne<{ clase: string | null }>();
    return fila?.clase || CLASE_POR_OMISION;
  }

  /**
   * Bloquea los vehículos de la operación (orden fijo, sin interbloqueos): con
   * varias instalaciones por vehículo (fase C), dos bajas o altas simultáneas
   * deciden su estatus (1 o 2) una después de la otra.
   */
  private async bloquearProductos(manager: EntityManager, ...ids: Array<number | null | undefined>): Promise<void> {
    for (const id of [...new Set(ids.filter((x): x is number => x != null).map(Number))].sort((a, b) => a - b)) {
      await manager.createQueryBuilder(Productos, 'p').setLock('pessimistic_write').where('p.id = :id', { id }).getOne();
    }
  }

  /** ¿El vehículo tiene otras instalaciones activas? Si sí, sigue instalado (2) aunque esta salga. */
  private async otrasActivasDelProducto(manager: EntityManager, idProducto: number, excludeId: number): Promise<boolean> {
    const otra = await manager
      .createQueryBuilder(Instalaciones, 'i')
      .select('i.id', 'id')
      .where('i.idProducto = :idProducto AND i.estatus = :activa AND i.id <> :excludeId', {
        idProducto,
        activa: EstatusEnum.ACTIVO,
        excludeId,
      })
      .getRawOne<{ id: string | number }>();
    return otra != null;
  }

  private async validarDispositivoPerteneceCliente(
    idDispositivo: number,
    idCliente: number,
  ): Promise<Dispositivos> {
    const dispositivo = await this.dispositivosRepo.findOne({
      where: { id: idDispositivo, idCliente },
    });
    if (!dispositivo) {
      throw new BadRequestException(
        'IdDispositivo no existe o no pertenece al cliente',
      );
    }
    return dispositivo;
  }

  /** Del almacén (sin cliente) o reservado a este cliente (fase B); instalado en otro → 400. */
  private async validarDispositivoDisponibleParaAsignar(
    idDispositivo: number,
    idCliente: number,
    excludeInstalacionId: number | undefined,
    almacenPermitido: boolean,
  ): Promise<Dispositivos> {
    const dispositivo = await this.dispositivosRepo.findOne({ where: { id: idDispositivo } });
    if (!dispositivo) {
      throw new BadRequestException('IdDispositivo no existe');
    }
    if (dispositivo.idCliente != null && Number(dispositivo.idCliente) !== Number(idCliente)) {
      throw new BadRequestException('El dispositivo está reservado o instalado en otro cliente');
    }
    // El almacén es de la operación: un usuario de cliente solo instala lo reservado a él.
    if (dispositivo.idCliente == null && !almacenPermitido) {
      throw new BadRequestException('IdDispositivo no existe o no pertenece al cliente');
    }
    if (Number(dispositivo.estatus) !== EnumEstatusProductoDispositivo.ACTIVO) {
      throw new BadRequestException(
        'El dispositivo debe estar en estatus activo (disponible)',
      );
    }
    await this.validarDispositivoSinInstalacionActiva(
      idDispositivo,
      excludeInstalacionId,
    );
    return dispositivo;
  }

  private async validarSimPerteneceCliente(
    idSim: number,
    idCliente: number,
  ): Promise<Sims> {
    const sim = await this.simsRepo.findOne({
      where: { id: idSim, idCliente },
    });
    if (!sim) {
      throw new BadRequestException(
        'IdSim no existe o no pertenece al cliente',
      );
    }
    return sim;
  }

  /** Del almacén (sin cliente) o reservada a este cliente (fase B); instalada en otro → 400. */
  private async validarSimDisponibleParaAsignar(
    idSim: number,
    idCliente: number,
    excludeInstalacionId: number | undefined,
    almacenPermitido: boolean,
  ): Promise<Sims> {
    const sim = await this.simsRepo.findOne({ where: { id: idSim } });
    if (!sim) {
      throw new BadRequestException('IdSim no existe');
    }
    if (sim.idCliente != null && Number(sim.idCliente) !== Number(idCliente)) {
      throw new BadRequestException('La SIM está reservada o instalada en otro cliente');
    }
    if (sim.idCliente == null && !almacenPermitido) {
      throw new BadRequestException('IdSim no existe o no pertenece al cliente');
    }
    if (Number(sim.estatus) !== EnumEstatusProductoDispositivo.ACTIVO) {
      throw new BadRequestException(
        'El SIM debe estar en estatus activo (disponible)',
      );
    }
    await this.validarSimSinInstalacionActiva(
      idSim,
      excludeInstalacionId,
    );
    return sim;
  }

  private async validarDispositivoSinInstalacionActiva(
    idDispositivo: number,
    excludeId?: number,
  ): Promise<void> {
    // En cualquier cliente: el equipo solo puede estar en una instalación activa.
    const qb = this.repository
      .createQueryBuilder('i')
      .where('i.idDispositivo = :idDispositivo', { idDispositivo })
      .andWhere('i.estatus = :estatus', { estatus: EstatusEnum.ACTIVO });
    if (excludeId !== undefined) {
      qb.andWhere('i.id != :excludeId', { excludeId });
    }
    if (await qb.getOne()) {
      throw new BadRequestException(
        'El dispositivo ya tiene una instalación activa',
      );
    }
  }

  private async validarSimSinInstalacionActiva(
    idSim: number,
    excludeId?: number,
  ): Promise<void> {
    // En cualquier cliente: la SIM solo puede estar en una instalación activa.
    const qb = this.repository
      .createQueryBuilder('i')
      .where('i.idSim = :idSim', { idSim })
      .andWhere('i.estatus = :estatus', { estatus: EstatusEnum.ACTIVO });
    if (excludeId !== undefined) {
      qb.andWhere('i.id != :excludeId', { excludeId });
    }
    if (await qb.getOne()) {
      throw new BadRequestException('El SIM ya tiene una instalación activa');
    }
  }

  private async validarEstatusEnCatalogo(id: number): Promise<void> {
    const estatus = await this.estatusInstalacionRepo.findOne({
      where: { id },
    });
    if (!estatus) {
      throw new BadRequestException('EstatusInstalacion no existe en catálogo');
    }
  }

  /**
   * Asigna la instalación a usuarios activos:
   * - rol SA (1), sin filtro de cliente
   * - rol cliente (6) del mismo idCliente de la instalación
   * Evita duplicados si ya existe la relación usuario-instalación.
   */
  private async asignarInstalacionUsuariosPorDefecto(
    manager: EntityManager,
    idInstalacion: number,
    idCliente: number,
  ): Promise<void> {
    try {
      const usuarios = await manager.find(Usuarios, {
        where: [
          { idRol: EnumRoles.SA, estatus: EstatusEnum.ACTIVO },
          {
            idRol: EnumRoles.CLIENTE,
            idCliente,
            estatus: EstatusEnum.ACTIVO,
          },
        ],
        select: { id: true },
      });

      if (usuarios.length === 0) {
        return;
      }

      const idsUsuario = [
        ...new Set(usuarios.map((u) => Number(u.id)).filter((id) => Number.isFinite(id))),
      ];

      const existentes = await manager.find(UsuariosInstalaciones, {
        where: {
          idInstalacion,
          idUsuario: In(idsUsuario),
        },
        select: { idUsuario: true },
      });
      const yaAsignados = new Set(
        existentes.map((r) => Number(r.idUsuario)),
      );

      const pendientes = idsUsuario.filter((idUsuario) => !yaAsignados.has(idUsuario));
      if (pendientes.length === 0) {
        return;
      }

      await manager.save(
        UsuariosInstalaciones,
        pendientes.map((idUsuario) =>
          manager.create(UsuariosInstalaciones, {
            idUsuario,
            idInstalacion,
            estatus: EstatusEnum.ACTIVO,
          }),
        ),
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException(
        'No fue posible asignar la instalación a los usuarios correspondientes. La operación no se completó.',
      );
    }
  }

  /**
   * Migra todas las filas de UsuariosInstalaciones del id anterior al nuevo.
   * Si el usuario ya tiene relación con la instalación nueva, elimina la del id anterior.
   */
  private async migrarUsuariosInstalaciones(
    manager: EntityManager,
    idInstalacionAnterior: number,
    idInstalacionNueva: number,
  ): Promise<void> {
    try {
      const relaciones = await manager.find(UsuariosInstalaciones, {
        where: { idInstalacion: idInstalacionAnterior },
      });

      if (relaciones.length === 0) {
        return;
      }

      const idsUsuario = [
        ...new Set(relaciones.map((r) => Number(r.idUsuario))),
      ];
      const existentesNueva = await manager.find(UsuariosInstalaciones, {
        where: {
          idInstalacion: idInstalacionNueva,
          idUsuario: In(idsUsuario),
        },
        select: { idUsuario: true },
      });
      const yaEnNueva = new Set(
        existentesNueva.map((r) => Number(r.idUsuario)),
      );

      for (const rel of relaciones) {
        const idUsuario = Number(rel.idUsuario);
        if (yaEnNueva.has(idUsuario)) {
          await manager.delete(UsuariosInstalaciones, { id: rel.id });
        } else {
          await manager.update(
            UsuariosInstalaciones,
            { id: rel.id },
            { idInstalacion: idInstalacionNueva },
          );
          yaEnNueva.add(idUsuario);
        }
      }
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException(
        'No fue posible actualizar las asignaciones de usuarios de la instalación. La operación no se completó.',
      );
    }
  }

  private resolverAccionCambio(
    actual: Instalaciones,
    dto: UpdateInstalacionesDto,
  ): EnumAccionHistoricoInstalacion {
    const cambiaProducto =
      dto.idProducto !== undefined &&
      Number(dto.idProducto) !== Number(actual.idProducto);
    const cambiaDispositivo =
      dto.idDispositivo !== undefined &&
      (dto.idDispositivo == null
        ? actual.idDispositivo != null
        : Number(dto.idDispositivo) !== Number(actual.idDispositivo));
    const cambiaSim =
      dto.idSim !== undefined &&
      (dto.idSim == null
        ? actual.idSim != null
        : Number(dto.idSim) !== Number(actual.idSim));

    if (cambiaProducto) return EnumAccionHistoricoInstalacion.CAMBIO_PRODUCTO;
    if (cambiaDispositivo)
      return EnumAccionHistoricoInstalacion.CAMBIO_DISPOSITIVO;
    if (cambiaSim) return EnumAccionHistoricoInstalacion.CAMBIO_SIM;
    return EnumAccionHistoricoInstalacion.CAMBIO_PRODUCTO;
  }

  async create(
    dto: CreateInstalacionesDto,
    idUser: number,
    trx?: QueryRunner,
    alcance?: UsuarioAlcance,
    origen?: OrigenOperacion,
  ): Promise<ApiCrudResponse> {
    const idCliente = dto.idCliente;
    // trx: transacción del llamador (p. ej. cierre de orden de servicio); sin ella, propia.
    const qr = trx ?? this.dataSource.createQueryRunner();
    const propia = !trx;
    if (propia) {
      await qr.connect();
      await qr.startTransaction();
    }
    try {
      // Alta desde REST: el cliente destino debe estar en el alcance de quien crea (403).
      // Sin alcance = llamada interna (cierre de orden de servicio, que ya validó la orden).
      if (alcance) {
        await this.tenantFilter.assertClienteDestino(alcance, idCliente);
      }
      // Una instalación activa por clase de equipo y vehículo (fase C).
      await this.bloquearProductos(qr.manager, dto.idProducto);
      const clase = await this.claseDe(qr.manager, dto.idDispositivo ?? null);
      const producto = await this.validarProductoDisponibleParaAsignar(
        dto.idProducto,
        idCliente,
        qr.manager,
        clase,
      );
      // Sin alcance (llamada interna) o rol de operación: puede tomar del almacén.
      const almacen = !alcance || this.tenantFilter.esRolSinFiltro(alcance.rol);
      if (dto.idDispositivo != null) {
        await this.validarDispositivoDisponibleParaAsignar(
          dto.idDispositivo,
          idCliente,
          undefined,
          almacen,
        );
      }
      if (dto.idSim != null) {
        await this.validarSimDisponibleParaAsignar(dto.idSim, idCliente, undefined, almacen);
      }
      await this.validarEstatusEnCatalogo(EnumEstatusInstalacion.ACTIVA);

      const ahora = nowMexicoCityAsUtcDate();
      const idDispositivo = dto.idDispositivo ?? null;
      const idSim = dto.idSim ?? null;

      // Equipo y SIM toman el cliente de la instalación antes del INSERT (FK sobre DispositivoActivo / SimActivo).
      const clienteAntes = await this.tomarComponentes(qr.manager, { idDispositivo, idSim }, idCliente);

      const saved = await qr.manager.save(
        qr.manager.create(Instalaciones, {
          idCliente,
          idProducto: dto.idProducto,
          idDispositivo,
          idSim,
          clase,
          estatusInstalacion: EnumEstatusInstalacion.ACTIVA,
          idHistoricoInstalacion: null,
          vigenteDesde: ahora,
          idUsuario: idUser,
          estatus: EstatusEnum.ACTIVO,
        }),
      );

      // Producto, dispositivo y SIM: disponible (1) → instalado (2), con su movimiento.
      const ctx = this.contexto(idUser, Number(saved.id), origen, dto.comentario);
      for (const c of this.componentes({ idProducto: dto.idProducto, idDispositivo, idSim })) {
        await this.motor.mover(
          qr.manager,
          {
            ...c,
            idCliente,
            idClienteAnterior: c.tipo === 'producto' ? idCliente : (clienteAntes.get(c.tipo) ?? null),
            // El vehículo puede estar ya instalado con equipos de otra clase (2 → 2).
            esperado: c.tipo === 'producto' ? Number(producto.estatus) : EstatusRecurso.DISPONIBLE,
            nuevo: EstatusRecurso.INSTALADO,
            accion: 'instalacion',
          },
          ctx,
        );
      }

      await this.asignarInstalacionUsuariosPorDefecto(
        qr.manager,
        Number(saved.id),
        idCliente,
      );

      if (propia) {
        await qr.commitTransaction();
      }
      await this.avisarRegistroTrackcam(propia, origen, [idDispositivo]);

      await this.bitacoraLogger.logToBitacora(
        'Instalaciones',
        `Se creó la instalación ID: ${saved.id}`,
        'CREATE',
        { dto, idCliente },
        idUser,
        EnumModulos.INSTALACIONES,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Instalación creada correctamente',
        data: {
          id: Number(saved.id),
          nombre: `Instalación ${saved.id}`,
        },
      };
    } catch (error) {
      if (propia && qr.isTransactionActive) {
        await qr.rollbackTransaction();
      }
      await this.bitacoraLogger.logToBitacora(
        'Instalaciones',
        `Error al crear instalación (Producto ${dto.idProducto})`,
        'CREATE',
        { dto, idCliente },
        idUser,
        EnumModulos.INSTALACIONES,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      const choque = choqueDeClase(error);
      if (choque) throw choque;
      throw new BadRequestException(
        'No fue posible crear la instalación. Verifique los datos e intente nuevamente.',
      );
    } finally {
      if (propia) {
        await qr.release();
      }
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
      const where: FindOptionsWhere<Instalaciones> = {
        estatus: EstatusEnum.ACTIVO,
        ...(tenant.idCliente !== undefined
          ? { idCliente: tenant.idCliente }
          : {}),
      };
      const data = await this.repository.find({
        where,
        order: { id: 'ASC' },
      });
      return { data: data.map((item) => mapInstalacionPlana(item)) };
    } catch (error) {
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findAllListByTipoProducto(
    idClienteToken: number,
    rol: number,
    idUsuarioToken: number,
    idTipoProducto: number,
  ): Promise<ApiResponseCommon> {
    const tipoProducto = Number(idTipoProducto) as EnumTipoProducto;
    if (
      ![
        EnumTipoProducto.VEHICULO,
        EnumTipoProducto.ACTIVO,
        EnumTipoProducto.INMUEBLE,
        EnumTipoProducto.PERSONA,
      ].includes(tipoProducto)
    ) {
      throw new BadRequestException(
        'idTipoProducto debe ser 1 (vehículo), 2 (activo), 3 (inmueble) o 4 (persona)',
      );
    }

    try {
      const tenant = await this.tenantFilter.forTypeOrmIdCliente(
        rol,
        idClienteToken,
      );
      if (tenant.sinAcceso) {
        return { data: [] };
      }

      const qb = this.repository.createQueryBuilder('i');
      applyPaginadoBaseJoins(qb);
      applyPaginadoSelectBase(qb);
      applyPaginadoPorTipoProducto(qb, tipoProducto);

      qb.andWhere('p.idTipoProducto = :idTipoProducto', {
        idTipoProducto: tipoProducto,
      })
        .andWhere('i.estatus = :estatusInstalacion', {
          estatusInstalacion: EstatusEnum.ACTIVO,
        })
        .orderBy('i.id', 'ASC');

      if (Number(rol) === EnumRoles.USUARIO) {
        qb.innerJoin(
          UsuariosInstalaciones,
          'ui',
          'ui.idInstalacion = i.id AND ui.idUsuario = :idUsuario AND ui.estatus = :uiEstatus',
          {
            idUsuario: Number(idUsuarioToken),
            uiEstatus: EstatusEnum.ACTIVO,
          },
        );
      }

      if (tenant.idCliente !== undefined) {
        if (typeof tenant.idCliente === 'number') {
          qb.andWhere('i.idCliente = :tenantIdCliente', {
            tenantIdCliente: tenant.idCliente,
          });
        } else {
          const ids = this.extractInValues(tenant.idCliente);
          qb.andWhere('i.idCliente IN (:...tenantIds)', { tenantIds: ids });
        }
      }

      const rows = await qb.getRawMany();

      return {
        data: rows.map((row) =>
          mapInstalacionPaginadaPlana(row, tipoProducto),
        ),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findAllByIdCliente(
    idClienteParam: number,
    idClienteToken: number,
    rol: number,
  ): Promise<ApiResponseCommon> {
    const idCliente = Number(idClienteParam);
    if (!Number.isFinite(idCliente) || idCliente < 1) {
      throw new BadRequestException('idCliente inválido');
    }

    try {
      const scope = await this.tenantFilter.idsClientePermitidos(
        rol,
        idClienteToken,
      );
      if (!this.tenantFilter.clienteVisibleEnScope(scope, idCliente)) {
        throw new ForbiddenException(
          'No tienes acceso a las instalaciones de ese cliente',
        );
      }

      const qb = this.repository.createQueryBuilder('i');
      applyPaginadoBaseJoins(qb);
      applyPaginadoSelectBase(qb);
      applyPaginadoTodosTiposProducto(qb);

      qb.andWhere('i.idCliente = :idCliente', { idCliente })
        .andWhere('i.estatus = :estatusInstalacion', {
          estatusInstalacion: EstatusEnum.ACTIVO,
        })
        .orderBy('i.id', 'ASC');

      const rows = await qb.getRawMany();

      return {
        data: rows.map((row) => mapInstalacionPaginadaPlana(row)),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findAllPaginado(
    idClienteToken: number,
    rol: number,
    dto: FilterInstalacionesPaginadoDto,
  ): Promise<ApiResponseCommon> {
    const { page, limit, idTipoProducto } = dto;
    try {
      const tenant = await this.tenantFilter.forTypeOrmIdCliente(
        rol,
        idClienteToken,
      );
      if (tenant.sinAcceso) {
        return {
          data: [],
          paginated: { total: 0, page, limit, totalPages: 0 },
        };
      }

      const qb = this.repository.createQueryBuilder('i');

      applyPaginadoBaseJoins(qb);
      applyPaginadoSelectBase(qb);

      if (idTipoProducto != null) {
        applyPaginadoPorTipoProducto(qb, idTipoProducto);
        qb.andWhere('p.idTipoProducto = :idTipoProducto', { idTipoProducto });
      } else {
        applyPaginadoTodosTiposProducto(qb);
      }

      qb.orderBy('i.id', 'ASC');

      if (tenant.idCliente !== undefined) {
        if (typeof tenant.idCliente === 'number') {
          qb.andWhere('i.idCliente = :tenantIdCliente', {
            tenantIdCliente: tenant.idCliente,
          });
        } else {
          const ids = this.extractInValues(tenant.idCliente);
          qb.andWhere('i.idCliente IN (:...tenantIds)', { tenantIds: ids });
        }
      }

      const total = await qb
        .clone()
        .select('COUNT(DISTINCT i.id)', 'cnt')
        .orderBy()
        .getRawOne()
        .then((r) => Number(r?.cnt ?? 0));

      const rows = await qb
        .offset((page - 1) * limit)
        .limit(limit)
        .getRawMany();

      return {
        data: rows.map((row) =>
          mapInstalacionPaginadaPlana(row, idTipoProducto),
        ),
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

  private extractInValues(op: ReturnType<typeof In>): number[] {
    const anyOp = op as unknown as { value?: unknown };
    const raw = anyOp.value;
    if (Array.isArray(raw)) {
      return raw.map(Number);
    }
    return [];
  }

  async findOne(id: number, idClienteToken: number, rol: number) {
    try {
      const tenant = await this.tenantFilter.forTypeOrmIdCliente(
        rol,
        idClienteToken,
      );
      if (tenant.sinAcceso) {
        throw new NotFoundException('Instalación no encontrada');
      }

      const metaQb = this.repository
        .createQueryBuilder('i')
        .innerJoin(
          Productos,
          'p',
          'p.id = i.idProducto AND p.idCliente = i.idCliente',
        )
        .select([
          'i.id AS id',
          'p.idTipoProducto AS idTipoProducto',
        ])
        .where('i.id = :id', { id });

      if (tenant.idCliente !== undefined) {
        if (typeof tenant.idCliente === 'number') {
          metaQb.andWhere('i.idCliente = :tenantIdCliente', {
            tenantIdCliente: tenant.idCliente,
          });
        } else {
          const ids = this.extractInValues(tenant.idCliente);
          metaQb.andWhere('i.idCliente IN (:...tenantIds)', { tenantIds: ids });
        }
      }

      const meta = await metaQb.getRawOne<{
        id: string | number;
        idTipoProducto: string | number;
      }>();
      if (!meta) {
        throw new NotFoundException('Instalación no encontrada');
      }

      const idTipoProducto = Number(meta.idTipoProducto) as EnumTipoProducto;

      const qb = this.repository.createQueryBuilder('i');
      applyDetalleJoins(qb);
      applyDetalleSelectBase(qb);
      applyDetallePorTipoProducto(qb, idTipoProducto);
      qb.where('i.id = :id', { id });

      if (tenant.idCliente !== undefined) {
        if (typeof tenant.idCliente === 'number') {
          qb.andWhere('i.idCliente = :tenantIdCliente', {
            tenantIdCliente: tenant.idCliente,
          });
        } else {
          const ids = this.extractInValues(tenant.idCliente);
          qb.andWhere('i.idCliente IN (:...tenantIds)', { tenantIds: ids });
        }
      }

      const row = await qb.getRawOne();
      if (!row) {
        throw new NotFoundException('Instalación no encontrada');
      }

      return {
        data: mapInstalacionDetallePlana(row, idTipoProducto),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Error al buscar la instalación',
      );
    }
  }

  /**
   * Cadena de histórico de lo más reciente a lo más antiguo.
   * Si la instalación aún existe, parte de su IdHistoricoInstalacion.
   * También incluye filas con IdInstalacionOriginal = id (bajas / eslabones).
   */
  async findHistorico(id: number, idClienteToken: number, rol: number) {
    try {
      const tenant = await this.tenantFilter.forTypeOrmIdCliente(
        rol,
        idClienteToken,
      );
      if (tenant.sinAcceso) {
        throw new NotFoundException('Instalación o histórico no encontrado');
      }

      const whereInst: FindOptionsWhere<Instalaciones> = {
        id,
        ...(tenant.idCliente !== undefined
          ? { idCliente: tenant.idCliente }
          : {}),
      };
      const vigente = await this.repository.findOne({
        where: whereInst,
        relations: [...RELACIONES_INSTALACION_HISTORICO_DETALLE],
      });

      const cadena: HistoricoInstalaciones[] = [];
      const visitados = new Set<number>();

      let cursorId: number | null =
        vigente?.idHistoricoInstalacion != null
          ? Number(vigente.idHistoricoInstalacion)
          : null;

      // La baja archiva el periodo sin mover el eslabón de la fila (se enlaza al
      // reactivar): si hay un archivo más nuevo de esta instalación, empieza ahí.
      {
        const ultimoPorOriginal = await this.historicoRepo.findOne({
          where: {
            idInstalacionOriginal: id,
            ...(tenant.idCliente !== undefined
              ? { idCliente: tenant.idCliente as number }
              : {}),
          },
          order: { id: 'DESC' },
        });
        if (ultimoPorOriginal && Number(ultimoPorOriginal.id) > (cursorId ?? 0)) {
          cursorId = Number(ultimoPorOriginal.id);
        }
      }

      while (cursorId != null && !visitados.has(cursorId)) {
        visitados.add(cursorId);
        const hist = await this.historicoRepo.findOne({
          where: {
            id: cursorId,
            ...(tenant.idCliente !== undefined
              ? { idCliente: tenant.idCliente as number }
              : {}),
          },
          relations: [...RELACIONES_INSTALACION_HISTORICO_DETALLE],
        });
        if (!hist) break;
        cadena.push(hist);
        cursorId =
          hist.idHistoricoInstalacion != null
            ? Number(hist.idHistoricoInstalacion)
            : null;
      }

      if (!vigente && cadena.length === 0) {
        throw new NotFoundException('Instalación o histórico no encontrado');
      }

      return {
        data: {
          vigente: vigente ? mapInstalacionHistoricoVigente(vigente) : null,
          historico: cadena.map((h) => mapHistoricoDetallePlano(h)),
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Error al consultar el histórico de la instalación',
      );
    }
  }

  async update(
    id: number,
    dto: UpdateInstalacionesDto,
    idClienteToken: number,
    rol: number,
    idUser: number,
    trx?: QueryRunner,
    origen?: OrigenOperacion,
  ): Promise<ApiCrudResponse> {
    // trx: transacción del llamador (p. ej. cierre de orden de servicio); sin ella, propia.
    const qr = trx ?? this.dataSource.createQueryRunner();
    const propia = !trx;
    if (propia) {
      await qr.connect();
      await qr.startTransaction();
    }
    try {
      const tenant = await this.tenantFilter.forTypeOrmIdCliente(
        rol,
        idClienteToken,
      );
      if (tenant.sinAcceso) {
        throw new NotFoundException('Instalación no encontrada');
      }
      const where: FindOptionsWhere<Instalaciones> = {
        id,
        ...(tenant.idCliente !== undefined
          ? { idCliente: tenant.idCliente }
          : {}),
      };
      // Bloqueada: una corrección de fecha o un cambio simultáneo espera a esta transacción.
      const actual = await qr.manager.findOne(Instalaciones, { where, lock: { mode: 'pessimistic_write' } });
      if (!actual) {
        throw new NotFoundException('Instalación no encontrada');
      }
      if (Number(actual.estatus) !== EstatusEnum.ACTIVO) {
        throw new BadRequestException(
          'Solo se puede actualizar una instalación activa',
        );
      }

      if (
        !ESTATUS_INSTALACION_UPDATE_HISTORICO.includes(
          dto.estatusInstalacionAnterior as (typeof ESTATUS_INSTALACION_UPDATE_HISTORICO)[number],
        )
      ) {
        throw new BadRequestException(
          'estatusInstalacionAnterior debe ser 0, 1, 3, 4 o 5',
        );
      }
      await this.validarEstatusEnCatalogo(dto.estatusInstalacionAnterior);

      const idCliente = Number(actual.idCliente);
      const idProducto =
        dto.idProducto !== undefined ? dto.idProducto : Number(actual.idProducto);
      await this.bloquearProductos(qr.manager, Number(actual.idProducto), idProducto);
      const idDispositivo =
        dto.idDispositivo !== undefined
          ? dto.idDispositivo
          : actual.idDispositivo != null
            ? Number(actual.idDispositivo)
            : null;
      const idSim =
        dto.idSim !== undefined
          ? dto.idSim
          : actual.idSim != null
            ? Number(actual.idSim)
            : null;

      const sinCambios =
        idProducto === Number(actual.idProducto) &&
        idDispositivo ===
          (actual.idDispositivo != null
            ? Number(actual.idDispositivo)
            : null) &&
        idSim === (actual.idSim != null ? Number(actual.idSim) : null);
      if (sinCambios) {
        throw new BadRequestException(
          'No hay cambios en producto, dispositivo o SIM',
        );
      }

      const idProductoAnterior = Number(actual.idProducto);
      const idDispositivoAnterior =
        actual.idDispositivo != null ? Number(actual.idDispositivo) : null;
      const idSimAnterior =
        actual.idSim != null ? Number(actual.idSim) : null;

      const cambiaProducto = idProducto !== idProductoAnterior;
      const cambiaDispositivo = idDispositivo !== idDispositivoAnterior;
      const cambiaSim = idSim !== idSimAnterior;

      let estatusProductoSaliente: number | null = null;
      let estatusDispositivoSaliente: number | null = null;
      let estatusSimSaliente: number | null = null;

      // La clase es de la instalación: un cambio de equipo es de la misma clase
      // (un GPS por otro GPS); para agregar otra clase se da de alta otra instalación.
      const claseActual = actual.clase || CLASE_POR_OMISION;
      const clase = idDispositivo != null ? await this.claseDe(qr.manager, idDispositivo) : claseActual;
      if (cambiaDispositivo && idDispositivoAnterior != null && idDispositivo != null && clase !== claseActual) {
        throw new BadRequestException(
          `El equipo nuevo es de clase ${clase} y la instalación es ${claseActual}: da de alta otra instalación para esa clase.`,
        );
      }

      // Estatus del vehículo que entra (1, o 2 con equipos de otra clase) y si el que sale queda con otras.
      let estatusProductoEntrante = EstatusRecurso.DISPONIBLE as number;
      let productoAnteriorSigue = false;
      if (cambiaProducto) {
        productoAnteriorSigue = await this.otrasActivasDelProducto(qr.manager, idProductoAnterior, Number(actual.id));
        // Si el vehículo que sale conserva otras instalaciones sigue instalado: no se pide su estatus de salida.
        if (!productoAnteriorSigue) {
          estatusProductoSaliente = assertEstatusSalida(
            'producto',
            dto.estatusProductoAnterior,
            'estatusProductoAnterior',
          );
        }
        const entrante = await this.validarProductoDisponibleParaAsignar(
          idProducto,
          idCliente,
          qr.manager,
          clase,
        );
        estatusProductoEntrante = Number(entrante.estatus);
      } else if (clase !== claseActual) {
        // Una instalación sin equipo que recibe uno: la clase nueva debe estar libre en el vehículo.
        await this.validarProductoDisponibleParaAsignar(idProducto, idCliente, qr.manager, clase, Number(actual.id));
      } else {
        await this.validarProducto(idProducto, idCliente);
      }

      if (cambiaDispositivo) {
        if (idDispositivoAnterior != null) {
          estatusDispositivoSaliente = assertEstatusSalida(
            'dispositivo',
            dto.estatusDispositivoAnterior,
            'estatusDispositivoAnterior',
          );
        }
        if (idDispositivo != null) {
          await this.validarDispositivoDisponibleParaAsignar(
            idDispositivo,
            idCliente,
            id,
            this.tenantFilter.esRolSinFiltro(rol),
          );
        }
      } else if (idDispositivo != null) {
        await this.validarDispositivoPerteneceCliente(
          idDispositivo,
          idCliente,
        );
      }

      if (cambiaSim) {
        if (idSimAnterior != null) {
          estatusSimSaliente = assertEstatusSalida(
            'sim',
            dto.estatusSimAnterior,
            'estatusSimAnterior',
          );
        }
        if (idSim != null) {
          await this.validarSimDisponibleParaAsignar(idSim, idCliente, id, this.tenantFilter.esRolSinFiltro(rol));
        }
      } else if (idSim != null) {
        await this.validarSimPerteneceCliente(idSim, idCliente);
      }

      const ahora = nowMexicoCityAsUtcDate();
      const accion = this.resolverAccionCambio(actual, dto);

      const hist = await qr.manager.save(
        qr.manager.create(HistoricoInstalaciones, {
          idCliente,
          idProducto: idProductoAnterior,
          idDispositivo: idDispositivoAnterior,
          idSim: idSimAnterior,
          estatusInstalacion: dto.estatusInstalacionAnterior,
          idInstalacionOriginal: Number(actual.id),
          vigenteDesde: actual.vigenteDesde,
          vigenteHasta: ahora,
          idHistoricoInstalacion:
            actual.idHistoricoInstalacion != null
              ? Number(actual.idHistoricoInstalacion)
              : null,
          idUsuario:
            actual.idUsuario != null ? Number(actual.idUsuario) : null,
          accion,
          comentario: dto.comentario ?? null,
          fhArchivado: ahora,
        }),
      );

      // Libera UQ_Inst_SimActivo / UQ_Inst_DispositivoActivo antes del INSERT
      // (columnas generadas = NULL cuando Estatus != 1).
      await qr.manager.update(
        Instalaciones,
        { id: actual.id, idCliente },
        { estatus: EstatusEnum.INACTIVO },
      );

      // Lo que entra toma el cliente de la instalación antes del INSERT.
      const clienteAntes = await this.tomarComponentes(
        qr.manager,
        { idDispositivo: cambiaDispositivo ? idDispositivo : null, idSim: cambiaSim ? idSim : null },
        idCliente,
      );

      const nueva = await qr.manager.save(
        qr.manager.create(Instalaciones, {
          idCliente,
          idProducto,
          idDispositivo,
          idSim,
          clase,
          estatusInstalacion: EnumEstatusInstalacion.ACTIVA,
          idHistoricoInstalacion: Number(hist.id),
          vigenteDesde: ahora,
          idUsuario: idUser,
          estatus: EstatusEnum.ACTIVO,
        }),
      );

      await this.migrarUsuariosInstalaciones(
        qr.manager,
        Number(actual.id),
        Number(nueva.id),
      );

      await qr.manager.delete(Instalaciones, { id: actual.id, idCliente });

      // El componente que sale: instalado (2) → el estatus indicado; el que entra: disponible (1) → instalado.
      const ctx = this.contexto(idUser, Number(nueva.id), origen, dto.comentario);
      const movimientos: Array<{
        tipo: TipoRecurso;
        id: number;
        esperado: number;
        nuevo: number;
        idClienteAnterior?: number | null;
        idClienteNuevo?: number | null;
      }> = [];
      if (cambiaProducto && (estatusProductoSaliente != null || productoAnteriorSigue)) {
        movimientos.push(
          // Con otras instalaciones activas el vehículo sigue instalado (2 → 2).
          {
            tipo: 'producto',
            id: idProductoAnterior,
            esperado: EstatusRecurso.INSTALADO,
            nuevo: productoAnteriorSigue ? EstatusRecurso.INSTALADO : (estatusProductoSaliente as number),
          },
          { tipo: 'producto', id: idProducto, esperado: estatusProductoEntrante, nuevo: EstatusRecurso.INSTALADO },
        );
      }
      if (cambiaDispositivo) {
        if (idDispositivoAnterior != null && estatusDispositivoSaliente != null) {
          // El que sale regresa al almacén.
          movimientos.push({ tipo: 'dispositivo', id: idDispositivoAnterior, esperado: EstatusRecurso.INSTALADO, nuevo: estatusDispositivoSaliente, idClienteNuevo: null });
        }
        if (idDispositivo != null) {
          movimientos.push({ tipo: 'dispositivo', id: idDispositivo, esperado: EstatusRecurso.DISPONIBLE, nuevo: EstatusRecurso.INSTALADO, idClienteAnterior: clienteAntes.get('dispositivo') ?? null });
        }
      }
      if (cambiaSim) {
        if (idSimAnterior != null && estatusSimSaliente != null) {
          movimientos.push({ tipo: 'sim', id: idSimAnterior, esperado: EstatusRecurso.INSTALADO, nuevo: estatusSimSaliente, idClienteNuevo: null });
        }
        if (idSim != null) {
          movimientos.push({ tipo: 'sim', id: idSim, esperado: EstatusRecurso.DISPONIBLE, nuevo: EstatusRecurso.INSTALADO, idClienteAnterior: clienteAntes.get('sim') ?? null });
        }
      }
      for (const m of movimientos) {
        await this.motor.mover(qr.manager, { ...m, idCliente, accion: 'cambio' }, ctx);
      }

      if (propia) {
        await qr.commitTransaction();
      }
      await this.avisarRegistroTrackcam(propia, origen, [cambiaDispositivo ? idDispositivoAnterior : null, cambiaDispositivo ? idDispositivo : null]);

      await this.bitacoraLogger.logToBitacora(
        'Instalaciones',
        `Se actualizó la instalación ID: ${id} → nueva ID: ${nueva.id} (${accion})`,
        'UPDATE',
        {
          idAnterior: id,
          idNuevo: Number(nueva.id),
          dto,
          idCliente,
        },
        idUser,
        EnumModulos.INSTALACIONES,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Instalación actualizada correctamente',
        data: {
          id: Number(nueva.id),
          nombre: `Instalación ${nueva.id}`,
        },
      };
    } catch (error) {
      if (propia && qr.isTransactionActive) {
        await qr.rollbackTransaction();
      }
      await this.bitacoraLogger.logToBitacora(
        'Instalaciones',
        `Error al actualizar instalación ID: ${id}`,
        'UPDATE',
        { id, dto },
        idUser,
        EnumModulos.INSTALACIONES,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      const choque = choqueDeClase(error);
      if (choque) throw choque;
      throw new BadRequestException((error as Error)?.message);
    } finally {
      if (propia) {
        await qr.release();
      }
    }
  }

  /**
   * Corregir instalación capturada en el cliente equivocado (fase B,
   * docs/motor-activos.md §2). Roles 1–4, con motivo. En una transacción:
   * - archiva el periodo en el cliente actual (baja con el motivo) y desactiva
   *   la fila: lo transmitido hasta ahora se queda con ese cliente;
   * - su producto regresa a activo (1);
   * - dispositivo y SIM siguen instalados y pasan al cliente correcto;
   * - abre una instalación nueva en el cliente correcto, con su producto.
   * Queda en CorreccionesInstalacion y en el historial de cada recurso.
   */
  async corregirCliente(
    id: number,
    dto: CorregirClienteInstalacionDto,
    idUser: number,
  ): Promise<ApiCrudResponse & { data: ApiData & { idInstalacionAnterior: number } }> {
    const motivo = dto.motivo.trim();
    if (!motivo) throw new BadRequestException('El motivo es obligatorio.');
    const destino = Number(dto.idCliente);
    const trackcam: number[] = [];

    const resultado = await this.dataSource.transaction(async (manager) => {
      const actual = await manager.findOne(Instalaciones, { where: { id }, lock: { mode: 'pessimistic_write' } });
      if (!actual) throw new NotFoundException('No se encontró la instalación solicitada.');
      await this.bloquearProductos(manager, Number(actual.idProducto), Number(dto.idProducto));
      if (Number(actual.estatus) !== EstatusEnum.ACTIVO) {
        throw new BadRequestException('Solo se corrige el cliente de una instalación activa.');
      }
      const origenCliente = Number(actual.idCliente);
      if (origenCliente === destino) {
        throw new BadRequestException('La instalación ya está en ese cliente.');
      }
      if (!(await manager.exists(Clientes, { where: { id: destino } }))) {
        throw new BadRequestException('IdCliente no existe');
      }
      const clase = actual.clase || CLASE_POR_OMISION;
      const productoDestino = await this.validarProductoDisponibleParaAsignar(dto.idProducto, destino, manager, clase);
      // Una orden de servicio abierta sobre esta instalación ya no podría cerrarse.
      const abierta = await manager.findOne(OrdenesServicio, {
        where: { idInstalacion: Number(actual.id), estatus: In(['programada', 'borrador']) },
        select: { id: true },
      });
      if (abierta) {
        throw new BadRequestException(
          `La instalación tiene la orden de servicio ${Number(abierta.id)} abierta: ciérrela o cancélela antes de corregir el cliente.`,
        );
      }

      const ahora = nowMexicoCityAsUtcDate();
      const idDispositivo = actual.idDispositivo != null ? Number(actual.idDispositivo) : null;
      const idSim = actual.idSim != null ? Number(actual.idSim) : null;
      const nota = `Corrección de cliente (error de captura) al cliente ${destino}: ${motivo}`;

      // 1. Cierra el periodo en el cliente actual.
      await manager.save(
        manager.create(HistoricoInstalaciones, {
          idCliente: origenCliente,
          idProducto: Number(actual.idProducto),
          idDispositivo,
          idSim,
          estatusInstalacion: EnumEstatusInstalacion.INACTIVO,
          idInstalacionOriginal: Number(actual.id),
          vigenteDesde: actual.vigenteDesde,
          vigenteHasta: ahora,
          idHistoricoInstalacion: actual.idHistoricoInstalacion != null ? Number(actual.idHistoricoInstalacion) : null,
          idUsuario: idUser,
          accion: EnumAccionHistoricoInstalacion.BAJA,
          comentario: nota.slice(0, 2000),
          fhArchivado: ahora,
        }),
      );
      await manager.update(
        Instalaciones,
        { id: actual.id, idCliente: origenCliente },
        { estatusInstalacion: EnumEstatusInstalacion.INACTIVO, estatus: EstatusEnum.INACTIVO, idUsuario: idUser },
      );

      const ctxAnterior = this.contexto(idUser, Number(actual.id), undefined, nota);
      // Con otras instalaciones activas (otra clase) el vehículo sigue instalado.
      const productoSigue = await this.otrasActivasDelProducto(manager, Number(actual.idProducto), Number(actual.id));
      await this.motor.mover(
        manager,
        {
          tipo: 'producto',
          id: Number(actual.idProducto),
          idCliente: origenCliente,
          esperado: EstatusRecurso.INSTALADO,
          nuevo: productoSigue ? EstatusRecurso.INSTALADO : EstatusRecurso.DISPONIBLE,
          accion: 'baja',
        },
        ctxAnterior,
      );

      // 2. Equipo y SIM pasan al cliente correcto sin dejar de estar instalados.
      for (const c of [
        ...(idDispositivo != null ? [{ tipo: 'dispositivo' as const, id: idDispositivo }] : []),
        ...(idSim != null ? [{ tipo: 'sim' as const, id: idSim }] : []),
      ]) {
        await this.motor.mover(
          manager,
          {
            ...c,
            idCliente: origenCliente,
            idClienteNuevo: destino,
            esperado: EstatusRecurso.INSTALADO,
            nuevo: EstatusRecurso.INSTALADO,
            accion: 'traspaso',
          },
          ctxAnterior,
        );
      }

      // 3. La instalación en el cliente correcto (cadena nueva: lo anterior es del otro cliente).
      const nueva = await manager.save(
        manager.create(Instalaciones, {
          idCliente: destino,
          idProducto: dto.idProducto,
          idDispositivo,
          idSim,
          clase,
          estatusInstalacion: EnumEstatusInstalacion.ACTIVA,
          idHistoricoInstalacion: null,
          vigenteDesde: ahora,
          idUsuario: idUser,
          estatus: EstatusEnum.ACTIVO,
        }),
      );
      await this.motor.mover(
        manager,
        { tipo: 'producto', id: Number(dto.idProducto), idCliente: destino, esperado: Number(productoDestino.estatus), nuevo: EstatusRecurso.INSTALADO, accion: 'instalacion' },
        this.contexto(idUser, Number(nueva.id), undefined, nota),
      );
      await this.asignarInstalacionUsuariosPorDefecto(manager, Number(nueva.id), destino);
      await manager.insert(CorreccionesInstalacion, {
        idInstalacion: Number(nueva.id),
        fecha: ahora,
        campo: 'IdCliente',
        valorAnterior: `${origenCliente} (instalación ${actual.id})`,
        valorNuevo: String(destino),
        motivo: motivo.slice(0, 500),
        idUsuario: idUser,
        origen: 'api',
      });
      if (idDispositivo != null) trackcam.push(idDispositivo);
      return { anterior: Number(actual.id), nueva: Number(nueva.id), origenCliente };
    });

    await this.registroTrackcam.emitir(WebhookEvent.TRACKCAM_UPDATED, trackcam);
    await this.bitacoraLogger.logToBitacora(
      'Instalaciones',
      `Se corrigió el cliente de la instalación ID: ${id} (cliente ${resultado.origenCliente} → ${destino}); nueva ID: ${resultado.nueva}`,
      'UPDATE',
      { id, dto, ...resultado },
      idUser,
      EnumModulos.INSTALACIONES,
      EstatusEnumBitcora.SUCCESS,
    );
    return {
      status: 'success',
      message: 'Se corrigió el cliente de la instalación.',
      data: { id: resultado.nueva, nombre: `Instalación ${resultado.nueva}`, idInstalacionAnterior: resultado.anterior },
    };
  }

  /**
   * Fecha real de instalación (docs/motor-activos.md §3): mueve `VigenteDesde`
   * de la versión vigente hacia atrás, para las instalaciones dadas de alta en
   * Next después de que el equipo ya transmitía. Roles 1–4, con motivo. No se
   * puede traslapar con la versión anterior de la misma instalación ni con otro
   * periodo del mismo dispositivo o SIM. Queda en CorreccionesInstalacion.
   */
  async corregirVigenteDesde(
    id: number,
    dto: CorregirVigenteDesdeDto,
    idUser: number,
  ): Promise<ApiCrudResponse & { data: ApiData & { vigenteDesde: string; vigenteDesdeAnterior: string } }> {
    const nuevo = fechaParedComoDate(dto.vigenteDesde);
    const motivo = dto.motivo.trim();
    if (!motivo) {
      throw new BadRequestException('El motivo es obligatorio.');
    }
    if (nuevo.getTime() > nowMexicoCityAsUtcDate().getTime()) {
      throw new BadRequestException('La fecha de instalación no puede ser futura.');
    }

    const anterior = await this.dataSource.transaction(async (manager) => {
      const actual = await manager.findOne(Instalaciones, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!actual) {
        throw new NotFoundException('No se encontró la instalación solicitada.');
      }
      if (Number(actual.estatus) !== EstatusEnum.ACTIVO) {
        throw new BadRequestException(
          'Solo se corrige la fecha de una instalación activa.',
        );
      }
      const desde = new Date(actual.vigenteDesde);
      if (nuevo.getTime() >= desde.getTime()) {
        throw new BadRequestException(
          `La fecha de instalación solo se corrige hacia atrás: hoy es ${fechaPared(desde)}.`,
        );
      }

      if (actual.idHistoricoInstalacion != null) {
        const previa = await manager.findOne(HistoricoInstalaciones, {
          where: { id: Number(actual.idHistoricoInstalacion) },
        });
        const finPrevia = previa?.vigenteHasta ?? previa?.fhArchivado ?? null;
        if (finPrevia && nuevo.getTime() < new Date(finPrevia).getTime()) {
          throw new BadRequestException(
            `Se traslapa con la versión anterior de la instalación, vigente hasta ${fechaPared(new Date(finPrevia))}.`,
          );
        }
      }

      for (const [columna, valor, etiqueta] of [
        ['IdDispositivo', actual.idDispositivo, 'del dispositivo'],
        ['IdSim', actual.idSim, 'de la SIM'],
      ] as const) {
        if (valor == null) continue;
        const choque = await this.periodoQueSeTraslapa(manager, columna, Number(valor), Number(actual.id), nuevo, desde);
        if (choque) {
          throw new BadRequestException(
            `Se traslapa con otro periodo ${etiqueta} (instalación ${choque.idInstalacion}, ` +
              `${choque.desde} a ${choque.hasta}).`,
          );
        }
      }

      const resultado = await manager
        .createQueryBuilder()
        .update(Instalaciones)
        .set({ vigenteDesde: nuevo })
        .where('id = :id AND vigenteDesde = :desde', { id, desde })
        .execute();
      if (!resultado.affected) {
        throw new ConflictException(
          'La instalación cambió mientras se procesaba la corrección. Vuelva a cargar e intente de nuevo.',
        );
      }
      await manager.insert(CorreccionesInstalacion, {
        idInstalacion: id,
        fecha: nowMexicoCityAsUtcDate(),
        campo: 'VigenteDesde',
        valorAnterior: fechaPared(desde),
        valorNuevo: fechaPared(nuevo),
        motivo: motivo.slice(0, 500),
        idUsuario: idUser,
        origen: 'api',
      });
      return fechaPared(desde);
    });

    await this.bitacoraLogger.logToBitacora(
      'Instalaciones',
      `Se corrigió la fecha de instalación ID: ${id} de ${anterior} a ${fechaPared(nuevo)}`,
      'UPDATE',
      { id, dto },
      idUser,
      EnumModulos.INSTALACIONES,
      EstatusEnumBitcora.SUCCESS,
    );

    return {
      status: 'success',
      message: 'La fecha de instalación se corrigió correctamente.',
      data: { id, nombre: `Instalación ${id}`, vigenteDesde: fechaPared(nuevo), vigenteDesdeAnterior: anterior },
    };
  }

  /**
   * Otro periodo del mismo dispositivo o SIM que se cruce con
   * [nuevo, desdeActual): versiones archivadas y otras instalaciones (una baja
   * anterior al motor no tiene archivo: su periodo termina en FechaActualizacion).
   */
  private async periodoQueSeTraslapa(
    manager: EntityManager,
    columna: 'IdDispositivo' | 'IdSim',
    idRecurso: number,
    idInstalacion: number,
    nuevo: Date,
    desdeActual: Date,
  ): Promise<{ idInstalacion: number; desde: string; hasta: string } | null> {
    const filas: Array<{ idInstalacion: string; desde: Date; hasta: Date }> = await manager.query(
      `SELECT * FROM (
         SELECT h.IdInstalacionOriginal AS idInstalacion, h.VigenteDesde AS desde,
                COALESCE(h.VigenteHasta, h.FHArchivado) AS hasta
           FROM HistoricoInstalaciones h
          WHERE h.${columna} = ? AND NOT (h.IdInstalacionOriginal <=> ?)
         UNION ALL
         SELECT i.Id, i.VigenteDesde,
                IF(i.Estatus = 1, ?, COALESCE(i.FechaActualizacion, i.VigenteDesde))
           FROM Instalaciones i
          WHERE i.${columna} = ? AND i.Id <> ?
       ) t
       WHERE t.desde < ? AND t.hasta > ?
       ORDER BY t.hasta DESC
       LIMIT 1`,
      [idRecurso, idInstalacion, desdeActual, idRecurso, idInstalacion, desdeActual, nuevo],
    );
    const f = filas[0];
    return f
      ? { idInstalacion: Number(f.idInstalacion), desde: fechaPared(new Date(f.desde)), hasta: fechaPared(new Date(f.hasta)) }
      : null;
  }

  /**
   * PATCH estatus (solo 0, 1, 5), por el motor de activos:
   * - 0 / 5 (baja): archiva el periodo en HistoricoInstalaciones (Accion "Baja",
   *   VigenteHasta = ahora) y deja la fila con Estatus = 0. Los componentes salen
   *   según el motivo: dispositivo a por revisar (3), o inservible (5) si la baja
   *   es 5; SIM a por revisar; producto a activo (1).
   * - 1 (reactivar): exige componentes disponibles (1), los pasa a instalado (2)
   *   y abre una versión nueva (VigenteDesde = ahora, eslabón a la baja).
   */
  async baja(
    id: number,
    dto: BajaInstalacionDto,
    idClienteToken: number,
    rol: number,
    idUser: number,
    trx?: QueryRunner,
    origen?: OrigenOperacion,
  ): Promise<ApiCrudResponse> {
    if (
      !ESTATUS_INSTALACION_PATCH.includes(
        dto.estatusInstalacion as (typeof ESTATUS_INSTALACION_PATCH)[number],
      )
    ) {
      throw new BadRequestException(
        'El estatus indicado no es válido. Solo se permiten 0 (inactivo), 1 (activa) o 5 (inservible).',
      );
    }
    await this.validarEstatusEnCatalogo(dto.estatusInstalacion);

    const tenant = await this.tenantFilter.forTypeOrmIdCliente(
      rol,
      idClienteToken,
    );
    if (tenant.sinAcceso) {
      throw new NotFoundException('No se encontró la instalación solicitada.');
    }
    const where: FindOptionsWhere<Instalaciones> = {
      id,
      ...(tenant.idCliente !== undefined
        ? { idCliente: tenant.idCliente }
        : {}),
    };

    // trx: transacción del llamador (p. ej. cierre de orden de servicio); sin ella, propia.
    const qr = trx ?? this.dataSource.createQueryRunner();
    const propia = !trx;
    if (propia) {
      await qr.connect();
      await qr.startTransaction();
    }
    try {
      // Bloqueada: una corrección de fecha o un cambio simultáneo espera a esta transacción.
      const actual = await qr.manager.findOne(Instalaciones, { where, lock: { mode: 'pessimistic_write' } });
      if (!actual) {
        throw new NotFoundException('No se encontró la instalación solicitada.');
      }
      await this.bloquearProductos(qr.manager, Number(actual.idProducto));

      const idCliente = Number(actual.idCliente);
      const componentes = {
        idCliente,
        idProducto: Number(actual.idProducto),
        idDispositivo:
          actual.idDispositivo != null ? Number(actual.idDispositivo) : null,
        idSim: actual.idSim != null ? Number(actual.idSim) : null,
      };

      const activa = Number(actual.estatus) === EstatusEnum.ACTIVO;
      const ahora = nowMexicoCityAsUtcDate();
      const ctx = this.contexto(idUser, Number(actual.id), origen, dto.comentario);

      if (dto.estatusInstalacion === EnumEstatusInstalacion.ACTIVA) {
        if (activa) {
          throw new BadRequestException('La instalación ya está activa.');
        }
        await this.assertComponentesDisponiblesParaActivar(
          qr.manager,
          componentes,
          this.tenantFilter.esRolSinFiltro(rol),
        );
        // El vehículo: disponible, o instalado con equipos de otra clase (fase C).
        const producto = await this.validarProductoDisponibleParaAsignar(
          componentes.idProducto,
          idCliente,
          qr.manager,
          actual.clase || CLASE_POR_OMISION,
        );

        // Versión nueva enlazada a la baja archivada (una baja anterior al
        // motor se archiva aquí): el periodo dado de baja no queda abierto.
        const baja = await this.archivarBajaAnterior(qr.manager, actual, idUser);
        // Equipo y SIM toman el cliente antes de activar la fila (FK sobre DispositivoActivo / SimActivo).
        const clienteAntes = await this.tomarComponentes(qr.manager, componentes, idCliente);
        await qr.manager.update(
          Instalaciones,
          { id: actual.id, idCliente },
          {
            estatusInstalacion: EnumEstatusInstalacion.ACTIVA,
            estatus: EstatusEnum.ACTIVO,
            idUsuario: idUser,
            vigenteDesde: ahora,
            idHistoricoInstalacion: Number(baja.id),
          },
        );
        for (const c of this.componentes(componentes)) {
          await this.motor.mover(
            qr.manager,
            {
              ...c,
              idCliente,
              idClienteAnterior: c.tipo === 'producto' ? idCliente : (clienteAntes.get(c.tipo) ?? null),
              esperado: c.tipo === 'producto' ? Number(producto.estatus) : EstatusRecurso.DISPONIBLE,
              nuevo: EstatusRecurso.INSTALADO,
              accion: 'reactivacion',
            },
            ctx,
          );
        }

        if (propia) {
          await qr.commitTransaction();
        }
        await this.avisarRegistroTrackcam(propia, origen, [componentes.idDispositivo]);

        await this.bitacoraLogger.logToBitacora(
          'Instalaciones',
          `Se activó la instalación ID: ${id}`,
          'UPDATE',
          { id, dto, idCliente },
          idUser,
          EnumModulos.INSTALACIONES,
          EstatusEnumBitcora.SUCCESS,
        );

        return {
          status: 'success',
          message: 'La instalación se activó correctamente.',
          estatus: { estatus: EnumEstatusInstalacion.ACTIVA },
          data: { id, nombre: `Instalación ${id}` },
        };
      }

      if (!activa) {
        // Una baja como inactiva (0) se puede corregir a inservible (5): el
        // equipo, si sigue por revisar, pasa a inservible.
        if (
          dto.estatusInstalacion === EnumEstatusInstalacion.INSERVIBLE &&
          Number(actual.estatusInstalacion) === EnumEstatusInstalacion.INACTIVO
        ) {
          return await this.corregirBajaAInservible(qr, propia, actual, componentes, dto, idUser, ctx);
        }
        throw new BadRequestException('La instalación ya está dada de baja.');
      }

      // 0 o 5: archivar el periodo, desactivar la fila y sacar los componentes.
      await qr.manager.save(
        qr.manager.create(HistoricoInstalaciones, {
          idCliente,
          idProducto: componentes.idProducto,
          idDispositivo: componentes.idDispositivo,
          idSim: componentes.idSim,
          estatusInstalacion: dto.estatusInstalacion,
          idInstalacionOriginal: Number(actual.id),
          vigenteDesde: actual.vigenteDesde,
          vigenteHasta: ahora,
          idHistoricoInstalacion:
            actual.idHistoricoInstalacion != null
              ? Number(actual.idHistoricoInstalacion)
              : null,
          idUsuario: idUser,
          accion: EnumAccionHistoricoInstalacion.BAJA,
          comentario: dto.comentario ?? null,
          fhArchivado: ahora,
        }),
      );
      await qr.manager.update(
        Instalaciones,
        { id: actual.id, idCliente },
        {
          estatusInstalacion: dto.estatusInstalacion,
          estatus: EstatusEnum.INACTIVO,
          idUsuario: idUser,
        },
      );
      // Con otras instalaciones activas (otra clase de equipo) el vehículo sigue instalado.
      const productoSigue = await this.otrasActivasDelProducto(qr.manager, componentes.idProducto, Number(actual.id));
      for (const c of this.componentes(componentes)) {
        await this.motor.mover(
          qr.manager,
          {
            ...c,
            idCliente,
            esperado: EstatusRecurso.INSTALADO,
            nuevo:
              c.tipo === 'producto' && productoSigue
                ? EstatusRecurso.INSTALADO
                : estatusSalidaPorBaja(c.tipo, dto.estatusInstalacion),
            accion: 'baja',
            // Equipo y SIM regresan al almacén; el producto se queda con su cliente.
            ...(c.tipo === 'producto' ? {} : { idClienteNuevo: null }),
          },
          ctx,
        );
      }

      if (propia) {
        await qr.commitTransaction();
      }
      await this.avisarRegistroTrackcam(propia, origen, [componentes.idDispositivo]);

      const etiqueta =
        dto.estatusInstalacion === EnumEstatusInstalacion.INACTIVO
          ? 'inactivo'
          : 'inservible';

      await this.bitacoraLogger.logToBitacora(
        'Instalaciones',
        `Se cambió la instalación ID: ${id} a estatus ${etiqueta} (${dto.estatusInstalacion})`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        EnumModulos.INSTALACIONES,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message:
          dto.estatusInstalacion === EnumEstatusInstalacion.INACTIVO
            ? 'La instalación se marcó como inactiva correctamente.'
            : 'La instalación se marcó como inservible correctamente.',
        estatus: { estatus: dto.estatusInstalacion },
        data: { id, nombre: `Instalación ${id}` },
      };
    } catch (error) {
      if (propia && qr.isTransactionActive) {
        await qr.rollbackTransaction();
      }
      await this.bitacoraLogger.logToBitacora(
        'Instalaciones',
        `Error al actualizar estatus de instalación ID: ${id}`,
        'UPDATE',
        { id, dto },
        idUser,
        EnumModulos.INSTALACIONES,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      const choque = choqueDeClase(error);
      if (choque) throw choque;
      throw new BadRequestException(
        'No se pudo actualizar el estatus de la instalación. Intente de nuevo o contacte a soporte.',
      );
    } finally {
      if (propia) {
        await qr.release();
      }
    }
  }

  /** Archivo de la última baja de la instalación, si es posterior a su eslabón actual. */
  private async bajaArchivada(
    manager: EntityManager,
    inst: Instalaciones,
  ): Promise<HistoricoInstalaciones | null> {
    const ultima = await manager.findOne(HistoricoInstalaciones, {
      where: { idInstalacionOriginal: Number(inst.id), idCliente: Number(inst.idCliente) },
      order: { id: 'DESC' },
    });
    const eslabon = inst.idHistoricoInstalacion != null ? Number(inst.idHistoricoInstalacion) : 0;
    return ultima &&
      ultima.accion === EnumAccionHistoricoInstalacion.BAJA &&
      Number(ultima.id) > eslabon
      ? ultima
      : null;
  }

  /**
   * Baja archivada de una instalación inactiva. Una baja anterior al motor no
   * tiene archivo: se archiva su periodo, que termina en la última escritura de
   * la fila (`FechaActualizacion`), antes de volver a escribirla.
   */
  private async archivarBajaAnterior(
    manager: EntityManager,
    inst: Instalaciones,
    idUser: number,
  ): Promise<HistoricoInstalaciones> {
    const baja = await this.bajaArchivada(manager, inst);
    if (baja) return baja;
    const fin = inst.fechaActualizacion ?? inst.vigenteDesde;
    return manager.save(
      manager.create(HistoricoInstalaciones, {
        idCliente: Number(inst.idCliente),
        idProducto: Number(inst.idProducto),
        idDispositivo: inst.idDispositivo != null ? Number(inst.idDispositivo) : null,
        idSim: inst.idSim != null ? Number(inst.idSim) : null,
        estatusInstalacion: Number(inst.estatusInstalacion),
        idInstalacionOriginal: Number(inst.id),
        vigenteDesde: inst.vigenteDesde,
        vigenteHasta: fin,
        idHistoricoInstalacion: inst.idHistoricoInstalacion != null ? Number(inst.idHistoricoInstalacion) : null,
        idUsuario: idUser,
        accion: EnumAccionHistoricoInstalacion.BAJA,
        comentario: 'Baja anterior al motor de activos: periodo archivado al volver a escribir la instalación',
        fhArchivado: fin,
      }),
    );
  }

  private async corregirBajaAInservible(
    qr: QueryRunner,
    propia: boolean,
    actual: Instalaciones,
    componentes: { idCliente: number; idProducto: number; idDispositivo: number | null; idSim: number | null },
    dto: BajaInstalacionDto,
    idUser: number,
    ctx: ContextoMovimiento,
  ): Promise<ApiCrudResponse> {
    const idCliente = componentes.idCliente;
    const id = Number(actual.id);
    // Antes de escribir la fila: una baja anterior al motor toma su fin de FechaActualizacion.
    const baja = await this.archivarBajaAnterior(qr.manager, actual, idUser);
    await qr.manager.update(
      Instalaciones,
      { id, idCliente },
      { estatusInstalacion: EnumEstatusInstalacion.INSERVIBLE, idUsuario: idUser },
    );
    await qr.manager.update(
      HistoricoInstalaciones,
      { id: baja.id, idCliente },
      { estatusInstalacion: EnumEstatusInstalacion.INSERVIBLE },
    );
    if (componentes.idDispositivo != null) {
      const disp = await qr.manager.findOne(Dispositivos, { where: { id: componentes.idDispositivo } });
      if (Number(disp?.estatus) === EstatusRecurso.POR_REVISAR) {
        await this.motor.mover(
          qr.manager,
          {
            tipo: 'dispositivo',
            id: componentes.idDispositivo,
            idCliente,
            // Ya salió de la instalación: está en el almacén.
            idClienteAnterior: null,
            idClienteNuevo: null,
            esperado: EstatusRecurso.POR_REVISAR,
            nuevo: EstatusRecurso.INSERVIBLE,
            accion: 'baja',
          },
          ctx,
        );
      }
    }
    if (propia) {
      await qr.commitTransaction();
    }
    await this.bitacoraLogger.logToBitacora(
      'Instalaciones',
      `Se corrigió la baja de la instalación ID: ${id} a inservible (5)`,
      'UPDATE',
      { id, dto, idCliente },
      idUser,
      EnumModulos.INSTALACIONES,
      EstatusEnumBitcora.SUCCESS,
    );
    return {
      status: 'success',
      message: 'La instalación se marcó como inservible correctamente.',
      estatus: { estatus: EnumEstatusInstalacion.INSERVIBLE },
      data: { id, nombre: `Instalación ${id}` },
    };
  }

  private async assertComponentesDisponiblesParaActivar(
    manager: EntityManager,
    instalacion: {
      idCliente: number;
      idProducto: number;
      idDispositivo: number | null;
      idSim: number | null;
    },
    /** Rol de operación: puede reactivar con equipo o SIM del almacén. */
    almacenPermitido: boolean,
  ): Promise<void> {
    const producto = await manager.findOne(Productos, {
      where: {
        id: instalacion.idProducto,
        idCliente: instalacion.idCliente,
      },
    });
    if (!producto) {
      throw new BadRequestException(
        'No se puede activar la instalación: el producto vinculado no existe o no pertenece al cliente.',
      );
    }
    // Su estatus (disponible, o instalado con otra clase) lo valida validarProductoDisponibleParaAsignar.

    if (instalacion.idDispositivo != null) {
      // Del almacén o reservado al cliente (fase B).
      const dispositivo = await manager.findOne(Dispositivos, {
        where: { id: instalacion.idDispositivo },
      });
      if (
        !dispositivo ||
        (dispositivo.idCliente != null && Number(dispositivo.idCliente) !== Number(instalacion.idCliente)) ||
        (dispositivo.idCliente == null && !almacenPermitido)
      ) {
        throw new BadRequestException(
          'No se puede activar la instalación: el dispositivo vinculado no existe o está reservado o instalado en otro cliente.',
        );
      }
      if (
        Number(dispositivo.estatus) !== EnumEstatusProductoDispositivo.ACTIVO
      ) {
        throw new BadRequestException(
          'No se puede activar la instalación: el dispositivo no está disponible (debe estar en estatus activo).',
        );
      }
    }

    if (instalacion.idSim != null) {
      // Del almacén o reservado al cliente (fase B).
      const sim = await manager.findOne(Sims, {
        where: { id: instalacion.idSim },
      });
      if (
        !sim ||
        (sim.idCliente != null && Number(sim.idCliente) !== Number(instalacion.idCliente)) ||
        (sim.idCliente == null && !almacenPermitido)
      ) {
        throw new BadRequestException(
          'No se puede activar la instalación: la SIM vinculada no existe o está reservada o instalada en otro cliente.',
        );
      }
      if (Number(sim.estatus) !== EnumEstatusProductoDispositivo.ACTIVO) {
        throw new BadRequestException(
          'No se puede activar la instalación: el SIM no está disponible (debe estar en estatus activo).',
        );
      }
    }
  }
}
