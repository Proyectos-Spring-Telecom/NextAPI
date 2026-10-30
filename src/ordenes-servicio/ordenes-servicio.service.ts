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
import { OrdenServicioPruebas } from 'src/entities/OrdenServicioPruebas';
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
import { ROLES_MONITOREO, esMonitoreo, puedeEditar, puedeVer } from './ordenes-servicio.acceso';
import { mapOrden } from './ordenes-servicio.map';
import {
  AUTORIZACION,
  ESTATUS_ORDEN,
  ESTATUS_PRUEBA,
  SECCIONES_ARCHIVO,
  SECCIONES_RESPUESTA,
  TipoServicio,
  faltantesParaCerrar,
  folioDe,
  pruebasLasValidaElOperador,
  requiereInstalacionExistente,
} from './ordenes-servicio.reglas';

export interface UsuarioToken {
  userId: number;
  idCliente: number;
  rol: number;
}

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
      where: { idRol: In([...ROLES_MONITOREO]), estatus: EstatusEnum.ACTIVO },
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
      // La autorización de desinstalar es por un vehículo: no se cambia por otro.
      if (
        (orden.autorizacion === AUTORIZACION.PENDIENTE || orden.autorizacion === AUTORIZACION.AUTORIZADA) &&
        Number(dto.idProducto) !== Number(orden.idProductoAutorizacion)
      ) {
        throw new BadRequestException(
          'La autorización de desinstalar es para otro vehículo: no se puede cambiar el vehículo de esta orden',
        );
      }
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

    if (dto.respuestas?.some((r) => r.seccion === 'pruebas') && pruebasLasValidaElOperador(orden)) {
      throw new BadRequestException(
        'En una orden programada las pruebas las valida el operador: use POST /:id/pruebas/:clave/solicitar',
      );
    }
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
    if (!orden || !puedeVer(orden, user)) {
      throw new NotFoundException('Orden de servicio no encontrada');
    }
    const [respuestas, archivos, catalogo, pruebas] = await Promise.all([
      this.respuestasRepo.find({ where: { idOrdenServicio: Number(orden.id) } }),
      this.archivosRepo.find({ where: { idOrdenServicio: Number(orden.id) } }),
      this.catalogoRepo.find({ where: { estatus: EstatusEnum.ACTIVO } }),
      this.dataSource.getRepository(OrdenServicioPruebas).find({ where: { idOrdenServicio: Number(orden.id) } }),
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
        ? faltantesParaCerrar(
            this.paraCierre(orden, pruebas, await this.vehiculoConEquipo(orden)),
            respuestas,
            archivos,
            catalogo,
          )
        : [];
    const [contexto] = await this.contexto([orden]);
    return {
      data: [
        {
          ...mapOrden(orden),
          ...contexto,
          respuestas: respuestas.map((r) => ({
            seccion: r.seccion,
            clave: r.clave,
            valor: Number(r.valor) === 1,
          })),
          archivos: archivosConUrl,
          // Solo administración y monitoreo ven las notas internas.
          ...(this.esTecnico(user) ? {} : { notasInternas: orden.notasInternas }),
          pruebas: pruebas.map((p) => ({
            clave: p.clave,
            estatus: p.estatus,
            fechaSolicitud: p.fechaSolicitud,
            notaTecnico: p.notaTecnico,
            fechaValidacion: p.fechaValidacion,
            nombreValido: p.nombreValido,
            notaOperador: p.notaOperador,
          })),
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
    if (filtros.origen) qb.andWhere('o.origen = :origen', { origen: filtros.origen });
    if (filtros.referenciaCrm) qb.andWhere('o.referenciaCrm = :ref', { ref: filtros.referenciaCrm });
    // El técnico solo ve sus órdenes; admin y monitoreo ven todas.
    const idTecnico = this.esTecnico(user) ? user.userId : filtros.idTecnico;
    if (idTecnico != null) qb.andWhere('o.idTecnico = :idTecnico', { idTecnico });
    const [rows, total] = await qb
      // Programadas: la agenda del técnico, por cita; lo demás, lo más reciente primero.
      .orderBy(
        filtros.estatus === ESTATUS_ORDEN.PROGRAMADA ? 'o.cita' : 'o.fechaCreacion',
        filtros.estatus === ESTATUS_ORDEN.PROGRAMADA ? 'ASC' : 'DESC',
      )
      .skip(skip)
      .take(take)
      .getManyAndCount();
    const contextos = await this.contexto(rows);
    return {
      data: rows.map((o, i) => ({ ...mapOrden(o), ...contextos[i] })),
      paginated: { total, page: Math.max(page, 1), limit: take },
    };
  }

  /**
   * Lo que la App y el front muestran de cada orden sin otra llamada: nombre del
   * cliente y el vehículo (placa y económico) o, si no es vehículo, el nombre del
   * producto. El producto es el de la orden o, si aún no se captura, el de la
   * instalación (real o programada). En lote: 3–4 consultas por página.
   */
  private async contexto(ordenes: OrdenesServicio[]) {
    const vacio = { nombreCliente: null, placa: null, numeroEconomico: null, nombreProducto: null };
    if (!ordenes.length) return [];
    const idsInstalacion = [
      ...new Set(
        ordenes
          .filter((o) => o.idProducto == null)
          .map((o) => Number(o.idInstalacion ?? o.idInstalacionProgramada))
          .filter((x) => x > 0),
      ),
    ];
    const productoDeInstalacion = new Map<number, number>();
    if (idsInstalacion.length) {
      const vivas: { id: string; idProducto: string }[] = await this.dataSource.query(
        'SELECT Id AS id, IdProducto AS idProducto FROM Instalaciones WHERE Id IN (?)',
        [idsInstalacion],
      );
      for (const f of vivas) productoDeInstalacion.set(Number(f.id), Number(f.idProducto));
      const faltan = idsInstalacion.filter((x) => !productoDeInstalacion.has(x));
      if (faltan.length) {
        // Instalación ya archivada por un cambio posterior: su versión en el histórico.
        const archivadas: { id: string; idProducto: string }[] = await this.dataSource.query(
          'SELECT IdInstalacionOriginal AS id, IdProducto AS idProducto FROM HistoricoInstalaciones WHERE IdInstalacionOriginal IN (?) ORDER BY Id',
          [faltan],
        );
        for (const f of archivadas) productoDeInstalacion.set(Number(f.id), Number(f.idProducto));
      }
    }
    const productoDe = (o: OrdenesServicio) =>
      o.idProducto != null ? Number(o.idProducto) : (productoDeInstalacion.get(Number(o.idInstalacion ?? o.idInstalacionProgramada)) ?? null);
    const idsProducto = [...new Set(ordenes.map(productoDe).filter((x): x is number => x != null))];
    const idsCliente = [...new Set(ordenes.map((o) => Number(o.idCliente)))];
    const [clientes, productos]: [
      { id: string; nombre: string | null }[],
      { id: string; nombre: string | null; placa: string | null; economico: string | null }[],
    ] = await Promise.all([
      this.dataSource.query(
        "SELECT Id AS id, NULLIF(TRIM(CONCAT_WS(' ', Nombre, ApellidoPaterno, ApellidoMaterno)), '') AS nombre FROM Clientes WHERE Id IN (?)",
        [idsCliente],
      ),
      idsProducto.length
        ? this.dataSource.query(
            `SELECT p.Id AS id, p.Nombre AS nombre, v.Placa AS placa, v.NumeroEconomico AS economico
               FROM Productos p LEFT JOIN Vehiculos v ON v.IdProducto = p.Id WHERE p.Id IN (?)`,
            [idsProducto],
          )
        : Promise.resolve([]),
    ]);
    const cliente = new Map(clientes.map((c) => [Number(c.id), c.nombre]));
    const producto = new Map(productos.map((p) => [Number(p.id), p]));
    return ordenes.map((o) => {
      const p = producto.get(productoDe(o) ?? -1);
      return {
        ...vacio,
        nombreCliente: cliente.get(Number(o.idCliente)) ?? null,
        placa: p?.placa ?? null,
        numeroEconomico: p?.economico ?? null,
        nombreProducto: p?.nombre ?? null,
      };
    });
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
      if (!orden || !puedeEditar(orden, user)) {
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

      const [respuestas, archivos, catalogo, pruebas] = await Promise.all([
        qr.manager.find(OrdenServicioRespuestas, { where: { idOrdenServicio: Number(orden.id) } }),
        qr.manager.find(OrdenServicioArchivos, { where: { idOrdenServicio: Number(orden.id) } }),
        qr.manager.find(CatOrdenServicioOpciones, { where: { estatus: EstatusEnum.ACTIVO } }),
        qr.manager.find(OrdenServicioPruebas, { where: { idOrdenServicio: Number(orden.id) } }),
      ]);
      const faltantes = faltantesParaCerrar(
        this.paraCierre(orden, pruebas, await this.vehiculoConEquipo(orden, qr.manager)),
        respuestas,
        archivos,
        catalogo,
      );
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
          idInstalacionRetirada: resultado.idInstalacionRetirada ?? null,
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

  private async aplicarMovimiento(
    orden: OrdenesServicio,
    folio: string,
    user: UsuarioToken,
    qr: QueryRunner,
  ): Promise<{
    idInstalacion: number;
    idInstalacionResultado: number;
    idHistoricoInstalacion: number | null;
    idInstalacionRetirada?: number | null;
  }> {
    const comentario = [`Orden de servicio ${folio} (${orden.tipoServicio})`, orden.observaciones]
      .filter(Boolean)
      .join(': ')
      .slice(0, 2000);
    const tipo = orden.tipoServicio as TipoServicio;
    const idCliente = Number(orden.idCliente);
    // Historial de los recursos: el movimiento sale de esta orden.
    const origen = { origen: 'orden' as const, idOrdenServicio: Number(orden.id) };

    if (tipo === 'instalacion') {
      // Alta autorizada sobre un vehículo con equipo de Next: primero la baja
      // de la instalación existente, en la misma transacción (§12.6).
      let idInstalacionRetirada: number | null = null;
      if (orden.autorizacion === AUTORIZACION.AUTORIZADA) {
        if (Number(orden.idProducto) !== Number(orden.idProductoAutorizacion)) {
          throw new BadRequestException('La desinstalación se autorizó para otro vehículo');
        }
        const existente = await qr.manager.findOne(Instalaciones, {
          where: { idProducto: Number(orden.idProductoAutorizacion), estatus: EstatusEnum.ACTIVO },
        });
        if (existente) {
          await this.instalacionesService.baja(
            Number(existente.id),
            { estatusInstalacion: EnumEstatusInstalacion.INACTIVO, comentario: `${comentario} (desinstalación autorizada)` },
            user.idCliente,
            user.rol,
            user.userId,
            qr,
            origen,
          );
          idInstalacionRetirada = Number(existente.id);
        }
      }
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
        undefined,
        origen,
      );
      const nueva = Number(alta.data!.id);
      return { idInstalacion: nueva, idInstalacionResultado: nueva, idHistoricoInstalacion: null, idInstalacionRetirada };
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
        origen,
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
        origen,
      );
    }
    // revision: sin movimiento; desinstalacion conserva el mismo Id.
    return { idInstalacion, idInstalacionResultado: idInstalacion, idHistoricoInstalacion: null };
  }

  private async ordenEditable(id: number, user: UsuarioToken): Promise<OrdenesServicio> {
    const orden = await this.ordenesRepo.findOne({ where: { id } });
    if (!orden || !puedeEditar(orden, user)) {
      throw new NotFoundException('Orden de servicio no encontrada');
    }
    if (orden.estatus !== ESTATUS_ORDEN.BORRADOR) {
      throw new BadRequestException(`La orden está ${orden.estatus}; ya no se puede modificar`);
    }
    return orden;
  }

  /** Técnico (ni administración ni monitoreo): solo ve sus órdenes en el listado. */
  private esTecnico(user: UsuarioToken): boolean {
    return !puedeEditar({ idTecnico: -1 }, user) && !esMonitoreo(user);
  }

  private respuestaExistente(orden: OrdenesServicio, user: UsuarioToken): ApiCrudResponse {
    if (!puedeEditar(orden, user)) {
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
      where: { id: idUsuario, idRol: In([...ROLES_MONITOREO]), estatus: EstatusEnum.ACTIVO },
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

  /** Alta: ¿el vehículo elegido ya tiene una instalación vigente? (pide autorización para quitarla). */
  private async vehiculoConEquipo(o: OrdenesServicio, manager = this.instalacionesRepo.manager): Promise<boolean> {
    if (o.tipoServicio !== 'instalacion' || o.idProducto == null) return false;
    const inst = await manager.findOne(Instalaciones, {
      where: { idProducto: Number(o.idProducto), estatus: EstatusEnum.ACTIVO },
    });
    return !!inst;
  }

  private paraCierre(o: OrdenesServicio, pruebas: Array<{ clave: string; estatus: string }> = [], vehiculoConEquipo = false) {
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
      origen: o.origen,
      codigoValidado: o.fechaCodigoValidado != null,
      autorizacion: o.autorizacion,
      pruebasSinValidar: pruebas.filter((p) => p.estatus === ESTATUS_PRUEBA.SOLICITADA).map((p) => p.clave),
      vehiculoConEquipo,
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

  /** Bitácora después de confirmar: un fallo se anota en el log y no tumba la respuesta. */
  private async bitacora(
    mensaje: string,
    accion: string,
    datos: Record<string, unknown>,
    user: UsuarioToken,
  ): Promise<void> {
    try {
      await this.bitacoraLogger.logToBitacora(
        'OrdenesServicio',
        mensaje.slice(0, 250),
        accion,
        datos,
        user.userId,
        EnumModulos.INSTALACIONES,
        EstatusEnumBitcora.SUCCESS,
      );
    } catch (e) {
      this.logger.error(`Bitácora no registrada (${mensaje.slice(0, 80)}): ${(e as Error).message}`);
    }
  }
}
