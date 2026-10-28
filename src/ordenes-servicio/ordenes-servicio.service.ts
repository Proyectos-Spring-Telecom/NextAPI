import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, QueryRunner, Repository } from 'typeorm';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { ApiCrudResponse, EstatusEnumBitcora } from 'src/common/ApiResponse';
import {
  EnumEstatusInstalacion,
  EnumModulos,
  EnumRoles,
  EstatusEnum,
} from 'src/common/estatus.enum';
import { CatOrdenServicioOpciones } from 'src/entities/CatOrdenServicioOpciones';
import { Clientes } from 'src/entities/Clientes';
import { Instalaciones } from 'src/entities/Instalaciones';
import { OrdenesServicio } from 'src/entities/OrdenesServicio';
import { OrdenServicioArchivos } from 'src/entities/OrdenServicioArchivos';
import { OrdenServicioRespuestas } from 'src/entities/OrdenServicioRespuestas';
import { Productos } from 'src/entities/Productos';
import { Usuarios } from 'src/entities/Usuarios';
import { InstalacionesService } from 'src/instalaciones/instalaciones.service';
import { isDuplicateKeyError } from 'src/messaging/core/db-errors.util';
import { S3Service } from 'src/s3/s3.service';
import {
  isoUtcToMexicoCityAsUtcDate,
  nowMexicoCityAsUtcDate,
} from 'src/utils/datetime-mexico.util';
import { CreateOrdenServicioDto } from './dto/create-orden-servicio.dto';
import { FilterOrdenesServicioDto } from './dto/filter-ordenes-servicio.dto';
import { UpdateOrdenServicioDto } from './dto/update-orden-servicio.dto';
import {
  ESTATUS_ORDEN,
  SECCIONES_ARCHIVO,
  SECCIONES_RESPUESTA,
  TipoServicio,
  faltantesParaCerrar,
  folioDe,
  requiereInstalacionExistente,
} from './ordenes-servicio.reglas';

export interface UsuarioToken {
  userId: number;
  idCliente: number;
  rol: number;
}

/** Ven y editan cualquier orden; el técnico solo las suyas. */
const ROLES_ADMIN_ORDENES = new Set<number>([
  EnumRoles.SA,
  EnumRoles.DEV,
  EnumRoles.ADMIN,
]);
const ROLES_MONITORISTA = [EnumRoles.JEFE_MONITOREO, EnumRoles.MONITOREO];

/** Campos de guardado parcial que solo aplican a ciertos tipos. */
const CAMPOS_POR_TIPO: Record<string, readonly TipoServicio[]> = {
  idProducto: ['instalacion'],
  idDispositivoNuevo: ['instalacion', 'c_equipo'],
  idSimNuevo: ['instalacion', 'c_sim'],
  estatusSalienteAnterior: ['c_equipo', 'c_sim'],
  estatusInstalacionBaja: ['desinstalacion'],
};

const MIME_ARCHIVO = ['image/png', 'image/jpeg', 'image/jpg'];
const CARPETA_S3 = 'ordenes-servicio';

@Injectable()
export class OrdenesServicioService {
  private readonly logger = new Logger(OrdenesServicioService.name);

  constructor(
    @InjectRepository(OrdenesServicio)
    private readonly ordenesRepo: Repository<OrdenesServicio>,
    @InjectRepository(OrdenServicioRespuestas)
    private readonly respuestasRepo: Repository<OrdenServicioRespuestas>,
    @InjectRepository(OrdenServicioArchivos)
    private readonly archivosRepo: Repository<OrdenServicioArchivos>,
    @InjectRepository(CatOrdenServicioOpciones)
    private readonly catalogoRepo: Repository<CatOrdenServicioOpciones>,
    @InjectRepository(Clientes)
    private readonly clientesRepo: Repository<Clientes>,
    @InjectRepository(Instalaciones)
    private readonly instalacionesRepo: Repository<Instalaciones>,
    @InjectRepository(Productos)
    private readonly productosRepo: Repository<Productos>,
    @InjectRepository(Usuarios)
    private readonly usuariosRepo: Repository<Usuarios>,
    private readonly instalacionesService: InstalacionesService,
    private readonly s3Service: S3Service,
    private readonly dataSource: DataSource,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  /** Catálogo de opciones por sección + monitoristas activos. */
  async catalogo() {
    const opciones = await this.catalogoRepo.find({
      where: { estatus: EstatusEnum.ACTIVO },
      order: { seccion: 'ASC', orden: 'ASC' },
    });
    const secciones: Record<string, Array<{ clave: string; nombre: string; obligatorio: boolean }>> = {};
    for (const o of opciones) {
      (secciones[o.seccion] ??= []).push({
        clave: o.clave,
        nombre: o.nombre,
        obligatorio: Number(o.obligatorio) === 1,
      });
    }
    const monitoristas = await this.usuariosRepo.find({
      select: ['id', 'nombre', 'apellidoPaterno', 'apellidoMaterno'],
      where: { idRol: In(ROLES_MONITORISTA), estatus: EstatusEnum.ACTIVO },
      order: { nombre: 'ASC' },
    });
    return {
      data: [
        {
          secciones,
          monitoristas: monitoristas.map((u) => ({
            id: Number(u.id),
            nombre: [u.nombre, u.apellidoPaterno, u.apellidoMaterno]
              .filter(Boolean)
              .join(' '),
          })),
        },
      ],
    };
  }

  async create(dto: CreateOrdenServicioDto, user: UsuarioToken): Promise<ApiCrudResponse> {
    const existente = await this.ordenesRepo.findOne({ where: { claveApp: dto.claveApp } });
    if (existente) {
      return this.respuestaExistente(existente, user);
    }

    const cliente = await this.clientesRepo.findOne({ where: { id: dto.idCliente } });
    if (!cliente || Number(cliente.estatus) !== EstatusEnum.ACTIVO) {
      throw new BadRequestException(
        'El cliente no existe o no está activo. Debe darse de alta antes de salir a campo.',
      );
    }

    let idInstalacion: number | null = null;
    let idProducto: number | null = dto.idProducto ?? null;
    if (requiereInstalacionExistente(dto.tipoServicio)) {
      if (dto.idInstalacion == null) {
        throw new BadRequestException('idInstalacion es obligatorio para este tipo de servicio');
      }
      const instalacion = await this.instalacionVigente(dto.idInstalacion, dto.idCliente);
      idInstalacion = Number(instalacion.id);
      idProducto = Number(instalacion.idProducto);
    } else {
      if (dto.idInstalacion != null) {
        throw new BadRequestException('Un alta (instalacion) no lleva idInstalacion: la instalación nace al cerrar');
      }
      if (idProducto != null) {
        await this.validarProducto(idProducto, dto.idCliente);
      }
    }

    try {
      const saved = await this.ordenesRepo.save(
        this.ordenesRepo.create({
          claveApp: dto.claveApp,
          tipoServicio: dto.tipoServicio,
          estatus: ESTATUS_ORDEN.BORRADOR,
          idCliente: dto.idCliente,
          idInstalacion,
          idProducto,
          idTecnico: user.userId,
          fechaCreacion: nowMexicoCityAsUtcDate(),
        }),
      );
      const folio = folioDe(Number(saved.id));
      await this.ordenesRepo.update({ id: saved.id }, { folio });
      await this.bitacora(`Se creó la orden de servicio ${folio} (${dto.tipoServicio})`, 'CREATE', { dto }, user);
      return {
        status: 'success',
        message: 'Orden de servicio creada',
        data: { id: Number(saved.id), nombre: folio },
      };
    } catch (error) {
      // Dos altas simultáneas con la misma claveApp (reintento de la app).
      if (isDuplicateKeyError(error)) {
        const ganadora = await this.ordenesRepo.findOne({ where: { claveApp: dto.claveApp } });
        if (ganadora) return this.respuestaExistente(ganadora, user);
      }
      throw error;
    }
  }

  async update(id: number, dto: UpdateOrdenServicioDto, user: UsuarioToken): Promise<ApiCrudResponse> {
    const orden = await this.ordenEditable(id, user);
    const tipo = orden.tipoServicio as TipoServicio;

    for (const [campo, tipos] of Object.entries(CAMPOS_POR_TIPO)) {
      if ((dto as Record<string, unknown>)[campo] !== undefined && !tipos.includes(tipo)) {
        throw new BadRequestException(`${campo} no aplica a una orden de tipo ${tipo}`);
      }
    }

    const cambios: Partial<OrdenesServicio> = {};
    if (dto.idProducto !== undefined) {
      if (dto.idProducto != null) await this.validarProducto(dto.idProducto, Number(orden.idCliente));
      cambios.idProducto = dto.idProducto;
    }
    if (dto.idDispositivoNuevo !== undefined) cambios.idDispositivoNuevo = dto.idDispositivoNuevo;
    if (dto.idSimNuevo !== undefined) cambios.idSimNuevo = dto.idSimNuevo;
    if (dto.estatusSalienteAnterior !== undefined) cambios.estatusSalienteAnterior = dto.estatusSalienteAnterior;
    if (dto.estatusInstalacionBaja !== undefined) cambios.estatusInstalacionBaja = dto.estatusInstalacionBaja;
    if (dto.idMonitorista !== undefined) {
      if (dto.idMonitorista != null) await this.validarMonitorista(dto.idMonitorista);
      cambios.idMonitorista = dto.idMonitorista;
    }
    if (dto.fechaCaptura !== undefined) {
      cambios.fechaCaptura = dto.fechaCaptura == null ? null : isoUtcToMexicoCityAsUtcDate(dto.fechaCaptura);
    }
    if (dto.lat !== undefined) cambios.lat = dto.lat;
    if (dto.lng !== undefined) cambios.lng = dto.lng;
    if (dto.observaciones !== undefined) cambios.observaciones = dto.observaciones;

    if (dto.respuestas?.length) {
      const claves = await this.clavesPorSeccion(SECCIONES_RESPUESTA);
      const invalidas = dto.respuestas.filter((r) => !claves.get(r.seccion)?.has(r.clave));
      if (invalidas.length) {
        throw new BadRequestException(
          `Opciones inexistentes en el catálogo: ${invalidas.map((r) => `${r.seccion}.${r.clave}`).join(', ')}`,
        );
      }
    }

    await this.dataSource.transaction(async (manager) => {
      if (Object.keys(cambios).length) {
        await manager.update(OrdenesServicio, { id: orden.id }, cambios);
      }
      if (dto.respuestas?.length) {
        await manager.upsert(
          OrdenServicioRespuestas,
          dto.respuestas.map((r) => ({
            idOrdenServicio: Number(orden.id),
            seccion: r.seccion,
            clave: r.clave,
            valor: r.valor ? 1 : 0,
          })),
          ['idOrdenServicio', 'seccion', 'clave'],
        );
      }
    });

    return {
      status: 'success',
      message: 'Orden de servicio guardada',
      data: { id: Number(orden.id), nombre: orden.folio ?? folioDe(Number(orden.id)) },
    };
  }

  async subirArchivo(
    id: number,
    clave: string,
    file: Express.Multer.File | undefined,
    user: UsuarioToken,
  ): Promise<ApiCrudResponse> {
    const orden = await this.ordenEditable(id, user);
    const claves = await this.clavesPorSeccion(SECCIONES_ARCHIVO);
    const valida = SECCIONES_ARCHIVO.some((s) => claves.get(s)?.has(clave));
    if (!valida) {
      throw new BadRequestException(`La clave de archivo "${clave}" no existe en el catálogo (fotos/firmas)`);
    }
    if (!file) {
      throw new BadRequestException('Archivo requerido (campo "file")');
    }
    if (!MIME_ARCHIVO.includes(file.mimetype)) {
      throw new BadRequestException('Solo se aceptan PNG o JPG (convertir WEBP/HEIC a JPG en la app)');
    }

    const previo = await this.archivosRepo.findOne({
      where: { idOrdenServicio: Number(orden.id), clave },
    });
    const { url } = await this.s3Service.updateFile(
      previo?.ruta ?? null,
      file,
      CARPETA_S3,
      user.userId,
      EnumModulos.INSTALACIONES,
    );
    if (previo) {
      await this.archivosRepo.update({ id: previo.id }, { ruta: url, fechaCreacion: nowMexicoCityAsUtcDate() });
    } else {
      await this.archivosRepo.save(
        this.archivosRepo.create({
          idOrdenServicio: Number(orden.id),
          clave,
          ruta: url,
          fechaCreacion: nowMexicoCityAsUtcDate(),
        }),
      );
    }
    return {
      status: 'success',
      message: `Archivo ${clave} guardado`,
      data: { id: Number(orden.id), nombre: clave },
    };
  }

  async findOne(id: number, user: UsuarioToken) {
    const orden = await this.ordenesRepo.findOne({ where: { id } });
    if (!orden || !this.puedeVer(orden, user)) {
      throw new NotFoundException('Orden de servicio no encontrada');
    }
    const [respuestas, archivos, catalogo] = await Promise.all([
      this.respuestasRepo.find({ where: { idOrdenServicio: Number(orden.id) } }),
      this.archivosRepo.find({ where: { idOrdenServicio: Number(orden.id) } }),
      this.catalogoRepo.find({ where: { estatus: EstatusEnum.ACTIVO } }),
    ]);
    const archivosConUrl = await Promise.all(
      archivos.map(async (a) => ({
        clave: a.clave,
        fechaCreacion: a.fechaCreacion,
        url: await this.urlFirmada(a.ruta),
      })),
    );
    const faltantes =
      orden.estatus === ESTATUS_ORDEN.BORRADOR
        ? faltantesParaCerrar(this.paraCierre(orden), respuestas, archivos, catalogo)
        : [];
    return {
      data: [
        {
          ...this.mapOrden(orden),
          respuestas: respuestas.map((r) => ({
            seccion: r.seccion,
            clave: r.clave,
            valor: Number(r.valor) === 1,
          })),
          archivos: archivosConUrl,
          faltantesParaCerrar: faltantes,
        },
      ],
    };
  }

  async findPaginado(page: number, limit: number, filtros: FilterOrdenesServicioDto, user: UsuarioToken) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;
    const qb = this.ordenesRepo.createQueryBuilder('o');
    if (filtros.idCliente != null) qb.andWhere('o.idCliente = :idCliente', { idCliente: filtros.idCliente });
    if (filtros.idProducto != null) qb.andWhere('o.idProducto = :idProducto', { idProducto: filtros.idProducto });
    if (filtros.idInstalacion != null) {
      qb.andWhere('(o.idInstalacion = :idInst OR o.idInstalacionResultado = :idInst)', {
        idInst: filtros.idInstalacion,
      });
    }
    if (filtros.tipoServicio) qb.andWhere('o.tipoServicio = :tipo', { tipo: filtros.tipoServicio });
    if (filtros.estatus) qb.andWhere('o.estatus = :estatus', { estatus: filtros.estatus });
    // El técnico solo ve sus órdenes; admin y monitoreo ven todas.
    const idTecnico = this.esTecnico(user) ? user.userId : filtros.idTecnico;
    if (idTecnico != null) qb.andWhere('o.idTecnico = :idTecnico', { idTecnico });
    const [rows, total] = await qb
      .orderBy('o.fechaCreacion', 'DESC')
      .skip(skip)
      .take(take)
      .getManyAndCount();
    return {
      data: rows.map((o) => this.mapOrden(o)),
      paginated: { total, page: Math.max(page, 1), limit: take },
    };
  }

  /**
   * Cierra la orden y aplica el movimiento en Instalaciones en la misma
   * transacción: si algo falla no queda orden sin movimiento ni al revés.
   * Repetir el cierre de una orden ya cerrada devuelve el mismo resultado.
   */
  async cerrar(id: number, user: UsuarioToken): Promise<ApiCrudResponse> {
    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      const orden = await qr.manager.findOne(OrdenesServicio, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!orden || !this.puedeEditar(orden, user)) {
        throw new NotFoundException('Orden de servicio no encontrada');
      }
      const folio = orden.folio ?? folioDe(Number(orden.id));
      if (orden.estatus === ESTATUS_ORDEN.CERRADA) {
        await qr.rollbackTransaction();
        return this.respuestaCierre(orden, 'La orden ya estaba cerrada');
      }
      if (orden.estatus !== ESTATUS_ORDEN.BORRADOR) {
        throw new BadRequestException(`La orden está ${orden.estatus}; no se puede cerrar`);
      }

      const [respuestas, archivos, catalogo] = await Promise.all([
        qr.manager.find(OrdenServicioRespuestas, { where: { idOrdenServicio: Number(orden.id) } }),
        qr.manager.find(OrdenServicioArchivos, { where: { idOrdenServicio: Number(orden.id) } }),
        qr.manager.find(CatOrdenServicioOpciones, { where: { estatus: EstatusEnum.ACTIVO } }),
      ]);
      const faltantes = faltantesParaCerrar(this.paraCierre(orden), respuestas, archivos, catalogo);
      if (faltantes.length) {
        throw new BadRequestException({ message: 'La orden está incompleta', faltantes });
      }
      await this.validarMonitorista(Number(orden.idMonitorista));

      const resultado = await this.aplicarMovimiento(orden, folio, user, qr);
      await qr.manager.update(
        OrdenesServicio,
        { id: orden.id },
        {
          estatus: ESTATUS_ORDEN.CERRADA,
          idInstalacion: resultado.idInstalacion,
          idInstalacionResultado: resultado.idInstalacionResultado,
          idHistoricoInstalacion: resultado.idHistoricoInstalacion,
          fechaCierre: nowMexicoCityAsUtcDate(),
          idUsuarioCierre: user.userId,
        },
      );
      await qr.commitTransaction();

      await this.bitacora(
        `Se cerró la orden de servicio ${folio} (${orden.tipoServicio}) → instalación ${resultado.idInstalacionResultado}`,
        'UPDATE',
        { id, ...resultado },
        user,
      );
      return this.respuestaCierre({ ...orden, ...resultado } as OrdenesServicio, 'Orden de servicio cerrada');
    } catch (error) {
      if (qr.isTransactionActive) {
        await qr.rollbackTransaction();
      }
      if (error instanceof HttpException) throw error;
      this.logger.error(`Error al cerrar orden ${id}: ${(error as Error)?.message}`);
      throw new BadRequestException((error as Error)?.message ?? 'No se pudo cerrar la orden');
    } finally {
      await qr.release();
    }
  }

  async cancelar(id: number, user: UsuarioToken): Promise<ApiCrudResponse> {
    const orden = await this.ordenEditable(id, user);
    await this.ordenesRepo.update({ id: orden.id }, { estatus: ESTATUS_ORDEN.CANCELADA });
    await this.bitacora(`Se canceló la orden de servicio ${orden.folio}`, 'UPDATE', { id }, user);
    return {
      status: 'success',
      message: 'Orden de servicio cancelada',
      data: { id: Number(orden.id), nombre: orden.folio ?? folioDe(Number(orden.id)) },
    };
  }

  private async aplicarMovimiento(
    orden: OrdenesServicio,
    folio: string,
    user: UsuarioToken,
    qr: QueryRunner,
  ): Promise<{ idInstalacion: number; idInstalacionResultado: number; idHistoricoInstalacion: number | null }> {
    const comentario = [`Orden de servicio ${folio} (${orden.tipoServicio})`, orden.observaciones]
      .filter(Boolean)
      .join(': ')
      .slice(0, 2000);
    const tipo = orden.tipoServicio as TipoServicio;
    const idCliente = Number(orden.idCliente);

    if (tipo === 'instalacion') {
      const alta = await this.instalacionesService.create(
        {
          idCliente,
          idProducto: Number(orden.idProducto),
          idDispositivo: orden.idDispositivoNuevo,
          idSim: orden.idSimNuevo,
          comentario,
        },
        user.userId,
        qr,
      );
      const nueva = Number(alta.data!.id);
      return { idInstalacion: nueva, idInstalacionResultado: nueva, idHistoricoInstalacion: null };
    }

    const idInstalacion = Number(orden.idInstalacion);
    const vigente = await qr.manager.findOne(Instalaciones, {
      where: { id: idInstalacion, idCliente, estatus: EstatusEnum.ACTIVO },
    });
    if (!vigente) {
      throw new BadRequestException(
        `La instalación ${idInstalacion} ya no está vigente (pudo cambiar por otra orden); actualice la orden`,
      );
    }

    if (tipo === 'c_equipo' || tipo === 'c_sim') {
      const cambio = await this.instalacionesService.update(
        idInstalacion,
        {
          estatusInstalacionAnterior: EnumEstatusInstalacion.BAJA_REMPLAZO,
          ...(tipo === 'c_equipo'
            ? {
                idDispositivo: orden.idDispositivoNuevo,
                estatusDispositivoAnterior: Number(orden.estatusSalienteAnterior),
              }
            : {
                idSim: orden.idSimNuevo,
                estatusSimAnterior: Number(orden.estatusSalienteAnterior),
              }),
          comentario,
        },
        user.idCliente,
        user.rol,
        user.userId,
        qr,
      );
      const nueva = Number(cambio.data!.id);
      const fila = await qr.manager.findOne(Instalaciones, { where: { id: nueva } });
      return {
        idInstalacion,
        idInstalacionResultado: nueva,
        idHistoricoInstalacion: fila?.idHistoricoInstalacion != null ? Number(fila.idHistoricoInstalacion) : null,
      };
    }

    if (tipo === 'desinstalacion') {
      await this.instalacionesService.baja(
        idInstalacion,
        { estatusInstalacion: Number(orden.estatusInstalacionBaja), comentario },
        user.idCliente,
        user.rol,
        user.userId,
        qr,
      );
    }
    // revision: sin movimiento; desinstalacion conserva el mismo Id.
    return { idInstalacion, idInstalacionResultado: idInstalacion, idHistoricoInstalacion: null };
  }

  private async ordenEditable(id: number, user: UsuarioToken): Promise<OrdenesServicio> {
    const orden = await this.ordenesRepo.findOne({ where: { id } });
    if (!orden || !this.puedeEditar(orden, user)) {
      throw new NotFoundException('Orden de servicio no encontrada');
    }
    if (orden.estatus !== ESTATUS_ORDEN.BORRADOR) {
      throw new BadRequestException(`La orden está ${orden.estatus}; ya no se puede modificar`);
    }
    return orden;
  }

  private esTecnico(user: UsuarioToken): boolean {
    return !ROLES_ADMIN_ORDENES.has(Number(user.rol)) && !ROLES_MONITORISTA.includes(Number(user.rol));
  }

  private puedeEditar(orden: OrdenesServicio, user: UsuarioToken): boolean {
    return ROLES_ADMIN_ORDENES.has(Number(user.rol)) || Number(orden.idTecnico) === Number(user.userId);
  }

  private puedeVer(orden: OrdenesServicio, user: UsuarioToken): boolean {
    return !this.esTecnico(user) || Number(orden.idTecnico) === Number(user.userId);
  }

  private respuestaExistente(orden: OrdenesServicio, user: UsuarioToken): ApiCrudResponse {
    if (!this.puedeEditar(orden, user)) {
      throw new ConflictException('La claveApp ya pertenece a otra orden');
    }
    return {
      status: 'success',
      message: 'La orden ya existía (misma claveApp)',
      data: { id: Number(orden.id), nombre: orden.folio ?? folioDe(Number(orden.id)) },
    };
  }

  private respuestaCierre(orden: OrdenesServicio, message: string): ApiCrudResponse {
    return {
      status: 'success',
      message,
      data: {
        id: Number(orden.id),
        nombre: orden.folio ?? folioDe(Number(orden.id)),
        idInstalacionResultado: orden.idInstalacionResultado != null ? Number(orden.idInstalacionResultado) : null,
      } as ApiCrudResponse['data'],
    };
  }

  private async instalacionVigente(idInstalacion: number, idCliente: number): Promise<Instalaciones> {
    const instalacion = await this.instalacionesRepo.findOne({
      where: { id: idInstalacion, idCliente, estatus: EstatusEnum.ACTIVO },
    });
    if (!instalacion) {
      throw new BadRequestException('La instalación no existe, no es del cliente o no está vigente');
    }
    return instalacion;
  }

  private async validarProducto(idProducto: number, idCliente: number): Promise<void> {
    const producto = await this.productosRepo.findOne({ where: { id: idProducto, idCliente } });
    if (!producto) {
      throw new BadRequestException('El vehículo/activo (idProducto) no existe o no es del cliente');
    }
  }

  private async validarMonitorista(idUsuario: number): Promise<void> {
    const u = await this.usuariosRepo.findOne({
      where: { id: idUsuario, idRol: In(ROLES_MONITORISTA), estatus: EstatusEnum.ACTIVO },
    });
    if (!u) {
      throw new BadRequestException('El monitorista no existe, no está activo o no tiene rol de monitoreo (4/5)');
    }
  }

  private async clavesPorSeccion(secciones: readonly string[]): Promise<Map<string, Set<string>>> {
    const opciones = await this.catalogoRepo.find({
      where: { seccion: In([...secciones]), estatus: EstatusEnum.ACTIVO },
    });
    const mapa = new Map<string, Set<string>>();
    for (const o of opciones) {
      if (!mapa.has(o.seccion)) mapa.set(o.seccion, new Set());
      mapa.get(o.seccion)!.add(o.clave);
    }
    return mapa;
  }

  private paraCierre(o: OrdenesServicio) {
    const n = (v: number | null) => (v == null ? null : Number(v));
    return {
      tipoServicio: o.tipoServicio,
      idInstalacion: n(o.idInstalacion),
      idProducto: n(o.idProducto),
      idDispositivoNuevo: n(o.idDispositivoNuevo),
      idSimNuevo: n(o.idSimNuevo),
      estatusSalienteAnterior: n(o.estatusSalienteAnterior),
      estatusInstalacionBaja: n(o.estatusInstalacionBaja),
      idMonitorista: n(o.idMonitorista),
      observaciones: o.observaciones,
    };
  }

  private mapOrden(o: OrdenesServicio) {
    const n = (v: number | null) => (v == null ? null : Number(v));
    return {
      id: Number(o.id),
      folio: o.folio,
      tipoServicio: o.tipoServicio,
      estatus: o.estatus,
      idCliente: Number(o.idCliente),
      idInstalacion: n(o.idInstalacion),
      idInstalacionResultado: n(o.idInstalacionResultado),
      idHistoricoInstalacion: n(o.idHistoricoInstalacion),
      idProducto: n(o.idProducto),
      idDispositivoNuevo: n(o.idDispositivoNuevo),
      idSimNuevo: n(o.idSimNuevo),
      estatusSalienteAnterior: n(o.estatusSalienteAnterior),
      estatusInstalacionBaja: n(o.estatusInstalacionBaja),
      idTecnico: Number(o.idTecnico),
      idMonitorista: n(o.idMonitorista),
      fechaCaptura: o.fechaCaptura,
      lat: o.lat,
      lng: o.lng,
      observaciones: o.observaciones,
      fechaCreacion: o.fechaCreacion,
      fechaCierre: o.fechaCierre,
    };
  }

  /** La ruta guardada es la URL privada; se entrega una URL firmada de 5 min. */
  private async urlFirmada(ruta: string): Promise<string | null> {
    try {
      const key = new URL(ruta).pathname.replace(/^\//, '');
      return key ? await this.s3Service.getPresignedUrl(key) : null;
    } catch {
      return null;
    }
  }

  private async bitacora(
    mensaje: string,
    accion: string,
    datos: Record<string, unknown>,
    user: UsuarioToken,
  ): Promise<void> {
    await this.bitacoraLogger.logToBitacora(
      'OrdenesServicio',
      mensaje,
      accion,
      datos,
      user.userId,
      EnumModulos.INSTALACIONES,
      EstatusEnumBitcora.SUCCESS,
    );
  }
}
