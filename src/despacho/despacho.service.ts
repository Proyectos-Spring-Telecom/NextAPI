import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import {
  TenantFilterService,
  type UsuarioAlcance,
} from 'src/common/tenant-filter/tenant-filter.service';
import { ReportesService } from 'src/reportes/reportes.service';
import {
  diasDelPeriodo,
  type PuntoOperacion,
} from 'src/reportes/helpers/jornada.helpers';
import {
  nowMexicoCityAsUtcDate,
  nowMexicoCityMysql,
} from 'src/utils/datetime-mexico.util';
import {
  evaluarParada,
  resumir,
  type ParadaCumplimiento,
  type ParadaPlan,
  type ResumenCumplimiento,
} from './cumplimiento.util';

const MAX_PARADAS = 50;
const MAX_DIAS_LISTADO = 31;

export type ParadaRutaInput = {
  idPuntoInteres: number;
  horaDesde?: string;
  horaHasta?: string;
};
export type ParadaTrabajoInput = {
  idPuntoInteres: number;
  ventanaDesde?: string;
  ventanaHasta?: string;
};

type Poi = { id: number; nombre: string; lat: number; lng: number; radioMetros: number };
type TrabajoFila = {
  id: number;
  idCliente: number;
  idInstalacion: number;
  idRuta: number | null;
  titulo: string;
  notas: string | null;
  fecha: string;
  inicio: string;
  fin: string;
  cancelado: boolean;
  motivoCancelacion: string | null;
  placa: string | null;
  economico: string | null;
};

/**
 * Despacho de rutas y trabajos (docs/fis-fiber, ruta del back §3.9). Las rutas
 * son plantillas; un trabajo copia sus paradas al crearse. El cumplimiento se
 * calcula al consultar con las posiciones de la unidad (no toca la ingesta ni
 * necesita ligar los puntos al vehículo). El chofer es de ShiftControl.
 */
@Injectable()
export class DespachoService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantFilter: TenantFilterService,
    private readonly reportes: ReportesService,
  ) {}

  // ---------------- Rutas ----------------

  async crearRuta(
    u: UsuarioAlcance,
    dto: {
      idCliente: number;
      nombre: string;
      descripcion?: string;
      paradas: ParadaRutaInput[];
    },
  ) {
    await this.assertCliente(u, dto.idCliente);
    validarHorasRuta(dto.paradas);
    await this.puntosDelCliente(
      dto.idCliente,
      dto.paradas.map((p) => p.idPuntoInteres),
    );
    const ahora = nowMexicoCityMysql();
    const id = await this.dataSource.transaction(async (m) => {
      const r = await m.query(
        `INSERT INTO RutasDespacho (IdCliente, Nombre, Descripcion, IdUsuario, FechaCreacion, FechaActualizacion)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          dto.idCliente,
          dto.nombre.trim(),
          dto.descripcion?.trim() || null,
          u.userId,
          ahora,
          ahora,
        ],
      );
      const idRuta = Number(r.insertId);
      await this.guardarParadasRuta(m, idRuta, dto.paradas);
      return idRuta;
    });
    return this.obtenerRuta(u, id);
  }

  async listarRutas(u: UsuarioAlcance, idCliente?: number) {
    const clientes = await this.clientesVisibles(u, idCliente);
    const filas: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT r.Id AS id, r.IdCliente AS idCliente, r.Nombre AS nombre, r.Descripcion AS descripcion, r.Estatus AS estatus,
              (SELECT COUNT(*) FROM RutasDespachoParadas p WHERE p.IdRuta = r.Id) AS paradas
         FROM RutasDespacho r
        WHERE ${clientes === 'all' ? '1 = 1' : 'r.IdCliente IN (?)'}
        ORDER BY r.Nombre`,
      clientes === 'all' ? [] : [clientes.length ? clientes : [0]],
    );
    return {
      data: filas.map((f) => ({
        ...f,
        id: Number(f.id),
        idCliente: Number(f.idCliente),
        estatus: Number(f.estatus),
        paradas: Number(f.paradas),
      })),
    };
  }

  async obtenerRuta(u: UsuarioAlcance, id: number) {
    const ruta = await this.ruta(u, id);
    const paradas: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT p.Orden AS orden, p.IdPuntoInteres AS idPuntoInteres, poi.Nombre AS nombre, poi.Lat AS lat, poi.Lng AS lng,
              poi.RadioMetros AS radioMetros, TIME_FORMAT(p.HoraDesde, '%H:%i') AS horaDesde, TIME_FORMAT(p.HoraHasta, '%H:%i') AS horaHasta
         FROM RutasDespachoParadas p
         LEFT JOIN PuntosInteres poi ON poi.Id = p.IdPuntoInteres
        WHERE p.IdRuta = ?
        ORDER BY p.Orden`,
      [id],
    );
    return {
      data: {
        ...ruta,
        paradas: paradas.map((p) => ({
          orden: Number(p.orden),
          idPuntoInteres: Number(p.idPuntoInteres),
          nombre: p.nombre == null ? null : String(p.nombre),
          lat: p.lat == null ? null : Number(p.lat),
          lng: p.lng == null ? null : Number(p.lng),
          radioMetros: Number(p.radioMetros) > 0 ? Number(p.radioMetros) : 25,
          horaDesde: p.horaDesde == null ? null : String(p.horaDesde),
          horaHasta: p.horaHasta == null ? null : String(p.horaHasta),
        })),
      },
    };
  }

  async actualizarRuta(
    u: UsuarioAlcance,
    id: number,
    dto: {
      nombre?: string;
      descripcion?: string;
      estatus?: number;
      paradas?: ParadaRutaInput[];
    },
  ) {
    const ruta = await this.ruta(u, id);
    if (dto.paradas) {
      validarHorasRuta(dto.paradas);
      await this.puntosDelCliente(
        ruta.idCliente,
        dto.paradas.map((p) => p.idPuntoInteres),
      );
    }
    await this.dataSource.transaction(async (m) => {
      await m.query(
        `UPDATE RutasDespacho
            SET Nombre = COALESCE(?, Nombre), Descripcion = COALESCE(?, Descripcion), Estatus = COALESCE(?, Estatus),
                FechaActualizacion = ?
          WHERE Id = ?`,
        [
          dto.nombre?.trim() || null,
          dto.descripcion?.trim() ?? null,
          dto.estatus ?? null,
          nowMexicoCityMysql(),
          id,
        ],
      );
      if (dto.paradas) {
        await m.query('DELETE FROM RutasDespachoParadas WHERE IdRuta = ?', [id]);
        await this.guardarParadasRuta(m, id, dto.paradas);
      }
    });
    return this.obtenerRuta(u, id);
  }

  // ---------------- Trabajos ----------------

  async crearTrabajo(
    u: UsuarioAlcance,
    dto: {
      idInstalacion: number;
      idRuta?: number;
      paradas?: ParadaTrabajoInput[];
      titulo: string;
      notas?: string;
      fecha: string;
      inicio?: string;
      fin?: string;
    },
  ) {
    const inst = await this.tenantFilter.assertInstalacionVisible(u, dto.idInstalacion);
    const inicio = dto.inicio ?? `${dto.fecha} 00:00:00`;
    const fin = dto.fin ?? `${dto.fecha} 23:59:59`;
    if (fin <= inicio) throw new BadRequestException('fin debe ser posterior a inicio');

    let paradas: ParadaTrabajoInput[];
    if (dto.idRuta != null) {
      const ruta = (await this.obtenerRuta(u, dto.idRuta)).data;
      if (ruta.estatus !== 1) throw new BadRequestException('La ruta está inactiva');
      paradas = ruta.paradas.map((p) => ({
        idPuntoInteres: p.idPuntoInteres,
        ventanaDesde: p.horaDesde ? `${dto.fecha} ${p.horaDesde}:00` : undefined,
        ventanaHasta: p.horaHasta ? `${dto.fecha} ${p.horaHasta}:00` : undefined,
      }));
    } else {
      paradas = dto.paradas ?? [];
    }
    if (!paradas.length)
      throw new BadRequestException('Indica idRuta o al menos una parada');
    if (paradas.length > MAX_PARADAS)
      throw new BadRequestException(`Máximo ${MAX_PARADAS} paradas`);
    for (const p of paradas) {
      if (p.ventanaDesde && p.ventanaHasta && p.ventanaHasta <= p.ventanaDesde) {
        throw new BadRequestException(
          'Cada ventanaHasta debe ser posterior a su ventanaDesde',
        );
      }
    }
    await this.puntosDelCliente(
      Number(inst.idCliente),
      paradas.map((p) => p.idPuntoInteres),
    );

    const ahora = nowMexicoCityMysql();
    const id = await this.dataSource.transaction(async (m) => {
      const r = await m.query(
        `INSERT INTO TrabajosDespacho (IdCliente, IdInstalacion, IdRuta, Titulo, Notas, Fecha, Inicio, Fin, IdUsuario, FechaCreacion, FechaActualizacion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          inst.idCliente,
          dto.idInstalacion,
          dto.idRuta ?? null,
          dto.titulo.trim(),
          dto.notas?.trim() || null,
          dto.fecha,
          inicio,
          fin,
          u.userId,
          ahora,
          ahora,
        ],
      );
      const idTrabajo = Number(r.insertId);
      for (const [i, p] of paradas.entries()) {
        await m.query(
          `INSERT INTO TrabajosDespachoParadas (IdTrabajo, Orden, IdPuntoInteres, VentanaDesde, VentanaHasta) VALUES (?, ?, ?, ?, ?)`,
          [
            idTrabajo,
            i + 1,
            p.idPuntoInteres,
            p.ventanaDesde ?? null,
            p.ventanaHasta ?? null,
          ],
        );
      }
      return idTrabajo;
    });
    return this.obtenerTrabajo(u, id);
  }

  async listarTrabajos(
    u: UsuarioAlcance,
    q: {
      fechaInicio: string;
      fechaFinal?: string;
      idCliente?: number;
      idInstalacion?: number;
    },
  ) {
    const fechaFinal = q.fechaFinal ?? q.fechaInicio;
    const dias = diasDelPeriodo(q.fechaInicio, fechaFinal);
    if (!dias.length || dias.length > MAX_DIAS_LISTADO) {
      throw new BadRequestException(`Periodo inválido (1 a ${MAX_DIAS_LISTADO} días)`);
    }
    const clientes = await this.clientesVisibles(u, q.idCliente);
    const asignadas = await this.tenantFilter.idsInstalacionAsignadas(u);
    const condiciones = ['t.Fecha BETWEEN ? AND ?'];
    const params: unknown[] = [q.fechaInicio, fechaFinal];
    if (clientes !== 'all') {
      condiciones.push('t.IdCliente IN (?)');
      params.push(clientes.length ? clientes : [0]);
    }
    if (asignadas !== 'all') {
      condiciones.push('t.IdInstalacion IN (?)');
      params.push(asignadas.length ? asignadas : [0]);
    }
    if (q.idInstalacion != null) {
      condiciones.push('t.IdInstalacion = ?');
      params.push(q.idInstalacion);
    }
    const trabajos = await this.trabajos(condiciones.join(' AND '), params);
    const detalle = await this.conCumplimiento(trabajos);
    return {
      data: {
        fechaInicio: q.fechaInicio,
        fechaFinal,
        total: detalle.length,
        trabajos: detalle.map(({ paradas: _p, ...t }) => t),
      },
    };
  }

  async obtenerTrabajo(u: UsuarioAlcance, id: number) {
    const t = await this.trabajoVisible(u, id);
    const [detalle] = await this.conCumplimiento([t]);
    return { data: detalle };
  }

  async actualizarTrabajo(
    u: UsuarioAlcance,
    id: number,
    dto: { titulo?: string; notas?: string; inicio?: string; fin?: string },
  ) {
    const t = await this.trabajoVisible(u, id);
    const inicio = dto.inicio ?? t.inicio;
    const fin = dto.fin ?? t.fin;
    if (fin <= inicio) throw new BadRequestException('fin debe ser posterior a inicio');
    await this.dataSource.query(
      `UPDATE TrabajosDespacho
          SET Titulo = COALESCE(?, Titulo), Notas = COALESCE(?, Notas), Inicio = ?, Fin = ?, FechaActualizacion = ?
        WHERE Id = ?`,
      [
        dto.titulo?.trim() || null,
        dto.notas?.trim() ?? null,
        inicio,
        fin,
        nowMexicoCityMysql(),
        id,
      ],
    );
    return this.obtenerTrabajo(u, id);
  }

  async cancelarTrabajo(u: UsuarioAlcance, id: number, motivo: string) {
    await this.trabajoVisible(u, id);
    await this.dataSource.query(
      'UPDATE TrabajosDespacho SET Cancelado = 1, MotivoCancelacion = ?, FechaActualizacion = ? WHERE Id = ?',
      [motivo.trim(), nowMexicoCityMysql(), id],
    );
    return this.obtenerTrabajo(u, id);
  }

  // ---------------- Internos ----------------

  /** Agrega el cumplimiento: una consulta de posiciones por lote de unidades. */
  private async conCumplimiento(trabajos: TrabajoFila[]) {
    if (!trabajos.length) return [];
    const paradasPorTrabajo = await this.paradasDeTrabajos(trabajos.map((t) => t.id));
    const desde = trabajos.map((t) => t.inicio).sort()[0];
    const hasta = trabajos
      .map((t) => t.fin)
      .sort()
      .reverse()[0];
    const unidades = await this.reportes.posicionesOperacionSistema(
      [...new Set(trabajos.map((t) => t.idInstalacion))],
      desde,
      hasta,
    );
    const puntosDe = new Map<number, PuntoOperacion[]>(
      unidades.map((x) => [x.idInstalacion, x.puntos]),
    );
    const ahoraMs = nowMexicoCityAsUtcDate().getTime();
    return trabajos.map((t) => {
      const plan = paradasPorTrabajo.get(t.id) ?? [];
      const puntos = puntosDe.get(t.idInstalacion) ?? [];
      const paradas: ParadaCumplimiento[] = plan.map((p) =>
        evaluarParada(p, puntos, t.inicio, t.fin, ahoraMs),
      );
      const resumen: ResumenCumplimiento = resumir(
        paradas,
        t.inicio,
        t.fin,
        ahoraMs,
        t.cancelado,
      );
      return { ...t, ...resumen, paradas };
    });
  }

  private async paradasDeTrabajos(ids: number[]): Promise<Map<number, ParadaPlan[]>> {
    const filas: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT p.IdTrabajo AS idTrabajo, p.Orden AS orden, p.IdPuntoInteres AS idPuntoInteres, poi.Nombre AS nombre,
              poi.Lat AS lat, poi.Lng AS lng, poi.RadioMetros AS radio,
              DATE_FORMAT(p.VentanaDesde, '%Y-%m-%d %H:%i:%s') AS ventanaDesde,
              DATE_FORMAT(p.VentanaHasta, '%Y-%m-%d %H:%i:%s') AS ventanaHasta
         FROM TrabajosDespachoParadas p
         JOIN PuntosInteres poi ON poi.Id = p.IdPuntoInteres
        WHERE p.IdTrabajo IN (?)
        ORDER BY p.IdTrabajo, p.Orden`,
      [ids],
    );
    const mapa = new Map<number, ParadaPlan[]>();
    for (const f of filas) {
      const lista = mapa.get(Number(f.idTrabajo)) ?? [];
      lista.push({
        orden: Number(f.orden),
        idPuntoInteres: Number(f.idPuntoInteres),
        nombre: String(f.nombre ?? ''),
        lat: Number(f.lat),
        lng: Number(f.lng),
        radioMetros: Number(f.radio) > 0 ? Number(f.radio) : 25,
        ventanaDesde: f.ventanaDesde ? String(f.ventanaDesde) : null,
        ventanaHasta: f.ventanaHasta ? String(f.ventanaHasta) : null,
      });
      mapa.set(Number(f.idTrabajo), lista);
    }
    return mapa;
  }

  private async trabajos(where: string, params: unknown[]): Promise<TrabajoFila[]> {
    const filas: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT t.Id AS id, t.IdCliente AS idCliente, t.IdInstalacion AS idInstalacion, t.IdRuta AS idRuta, t.Titulo AS titulo,
              t.Notas AS notas, DATE_FORMAT(t.Fecha, '%Y-%m-%d') AS fecha,
              DATE_FORMAT(t.Inicio, '%Y-%m-%d %H:%i:%s') AS inicio, DATE_FORMAT(t.Fin, '%Y-%m-%d %H:%i:%s') AS fin,
              t.Cancelado AS cancelado, t.MotivoCancelacion AS motivoCancelacion, v.Placa AS placa, v.NumeroEconomico AS economico
         FROM TrabajosDespacho t
         LEFT JOIN Instalaciones i ON i.Id = t.IdInstalacion
         LEFT JOIN Vehiculos v ON v.IdProducto = i.IdProducto AND v.IdCliente = i.IdCliente
        WHERE ${where}
        ORDER BY t.Inicio, t.Id`,
      params,
    );
    return filas.map((f) => ({
      id: Number(f.id),
      idCliente: Number(f.idCliente),
      idInstalacion: Number(f.idInstalacion),
      idRuta: f.idRuta == null ? null : Number(f.idRuta),
      titulo: String(f.titulo),
      notas: f.notas == null ? null : String(f.notas),
      fecha: String(f.fecha),
      inicio: String(f.inicio),
      fin: String(f.fin),
      cancelado: Number(f.cancelado) === 1,
      motivoCancelacion: f.motivoCancelacion == null ? null : String(f.motivoCancelacion),
      placa: f.placa == null ? null : String(f.placa),
      economico: f.economico == null ? null : String(f.economico),
    }));
  }

  private async trabajoVisible(u: UsuarioAlcance, id: number): Promise<TrabajoFila> {
    const [t] = await this.trabajos('t.Id = ?', [id]);
    if (!t) throw new NotFoundException('Trabajo no encontrado');
    await this.tenantFilter.assertInstalacionVisible(u, t.idInstalacion).catch(() => {
      throw new NotFoundException('Trabajo no encontrado');
    });
    return t;
  }

  private async ruta(u: UsuarioAlcance, id: number) {
    const [r]: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT Id AS id, IdCliente AS idCliente, Nombre AS nombre, Descripcion AS descripcion, Estatus AS estatus,
              DATE_FORMAT(FechaActualizacion, '%Y-%m-%d %H:%i:%s') AS fechaActualizacion
         FROM RutasDespacho WHERE Id = ?`,
      [id],
    );
    if (!r) throw new NotFoundException('Ruta no encontrada');
    const scope = await this.tenantFilter.idsClientePermitidos(u.rol, u.idCliente);
    if (!this.tenantFilter.clienteVisibleEnScope(scope, Number(r.idCliente)))
      throw new NotFoundException('Ruta no encontrada');
    return {
      id: Number(r.id),
      idCliente: Number(r.idCliente),
      nombre: String(r.nombre),
      descripcion: r.descripcion == null ? null : String(r.descripcion),
      estatus: Number(r.estatus),
      fechaActualizacion: String(r.fechaActualizacion),
    };
  }

  private async guardarParadasRuta(
    m: EntityManager,
    idRuta: number,
    paradas: ParadaRutaInput[],
  ) {
    for (const [i, p] of paradas.entries()) {
      await m.query(
        'INSERT INTO RutasDespachoParadas (IdRuta, Orden, IdPuntoInteres, HoraDesde, HoraHasta) VALUES (?, ?, ?, ?, ?)',
        [idRuta, i + 1, p.idPuntoInteres, p.horaDesde ?? null, p.horaHasta ?? null],
      );
    }
  }

  /** Los puntos deben existir, estar activos y ser del cliente, de sus hijos o de sus padres. */
  private async puntosDelCliente(idCliente: number, ids: number[]): Promise<Poi[]> {
    if (!ids.length) throw new BadRequestException('Indica al menos una parada');
    if (ids.length > MAX_PARADAS)
      throw new BadRequestException(`Máximo ${MAX_PARADAS} paradas`);
    const familia = [
      ...new Set([
        ...(await this.tenantFilter.getClienteHijosIds(idCliente)),
        ...(await this.tenantFilter.getClienteAncestrosIds(idCliente)),
      ]),
    ];
    const unicos = [...new Set(ids)];
    const filas: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT Id AS id, Nombre AS nombre, Lat AS lat, Lng AS lng, RadioMetros AS radio
         FROM PuntosInteres WHERE Id IN (?) AND Estatus = 1 AND IdCliente IN (?)`,
      [unicos, familia.length ? familia : [0]],
    );
    const encontrados = new Set(filas.map((f) => Number(f.id)));
    const faltan = unicos.filter((id) => !encontrados.has(id));
    if (faltan.length) {
      throw new BadRequestException(
        `Puntos de interés no encontrados, inactivos o que no son del cliente: ${faltan.join(', ')}`,
      );
    }
    return filas.map((f) => ({
      id: Number(f.id),
      nombre: String(f.nombre),
      lat: Number(f.lat),
      lng: Number(f.lng),
      radioMetros: Number(f.radio) > 0 ? Number(f.radio) : 25,
    }));
  }

  private async assertCliente(u: UsuarioAlcance, idCliente: number) {
    const scope = await this.tenantFilter.idsClientePermitidos(u.rol, u.idCliente);
    if (!this.tenantFilter.clienteVisibleEnScope(scope, idCliente)) {
      throw new ForbiddenException('El cliente no es de tu alcance');
    }
  }

  /** Clientes del alcance; con `idCliente`, él y sus hijos (validado). */
  private async clientesVisibles(
    u: UsuarioAlcance,
    idCliente?: number,
  ): Promise<'all' | number[]> {
    const scope = await this.tenantFilter.idsClientePermitidos(u.rol, u.idCliente);
    if (idCliente == null) return scope;
    if (!this.tenantFilter.clienteVisibleEnScope(scope, idCliente)) {
      throw new ForbiddenException('El cliente no es de tu alcance');
    }
    return this.tenantFilter.getClienteHijosIds(idCliente);
  }
}

function validarHorasRuta(paradas: ParadaRutaInput[]) {
  if (!paradas.length) throw new BadRequestException('Indica al menos una parada');
  if (paradas.length > MAX_PARADAS)
    throw new BadRequestException(`Máximo ${MAX_PARADAS} paradas`);
  for (const p of paradas) {
    if (p.horaDesde && p.horaHasta && p.horaHasta <= p.horaDesde) {
      throw new BadRequestException('Cada horaHasta debe ser posterior a su horaDesde');
    }
  }
}
