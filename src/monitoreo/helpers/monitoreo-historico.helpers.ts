import { num, str, toIso } from '../monitoreo.mapper';

export type HistoricoPosicionItem = {
  id: number;
  idInstalacion: number;
  vehiculo: number;
  fecha: string | null;
  cliente: string | null;
  anio: number | null;
  placas: string | null;
  economico: string | null;
  numeroSerie: string | null;
  color: string | null;
  descripcion: string | null;
  imagen: string | null;
  marca: string | null;
  modelo: string | null;
  estatus: number | null;
  imei: number | null;
  lat: number;
  lng: number;
  estado: number | null;
  ignicion: number | null;
  velocidad: number | null;
  direccion: number | null;
  odometro: number | null;
  estaEnMovimiento: boolean;
  combustible: number | null;
  idPosicion: number | null;
  totalDistancia: number | null;
  /** Campos adicionales de Posiciones (plano, mismo criterio que listado/socket) */
  fechaHora: string | null;
  alarma1: number | null;
  alarma2: number | null;
  energia: number | null;
  idEvento: number | null;
  idFoto: number | null;
  fhRegistro: string | null;
  bateria: number | null;
  alimentacion: number | null;
  gps: number | null;
  gsm: number | null;
  movimiento: number | null;
  nivelCombustible: number | null;
  idFoto1: number | null;
  idFoto2: number | null;
  idFoto3: number | null;
  idVideo1: number | null;
  idVideo2: number | null;
  idVideo3: number | null;
  rutaFoto: string | null;
  rutaFoto1: string | null;
  rutaFoto2: string | null;
  rutaFoto3: string | null;
  rutaVideo1: string | null;
  rutaVideo2: string | null;
  rutaVideo3: string | null;
};

export type HistoricoMonitoreoResponse = {
  totalDistancia: number;
  posiciones: HistoricoPosicionItem[];
};

type ContextoProducto = {
  idInstalacion: number;
  idProducto: number;
  idCliente: number;
  anio: number | null;
  placas: string | null;
  economico: string | null;
  numeroSerie: string | null;
  color: string | null;
  descripcion: string | null;
  imagen: string | null;
  marca: string | null;
  modelo: string | null;
  estatus: number | null;
  cliente: string | null;
};

export function mapHistoricoPosicionItem(
  row: Record<string, unknown>,
  ctx: ContextoProducto,
): HistoricoPosicionItem {
  const idPosicion = Number(row.id);
  const combustible = num(row.combustible);
  return {
    id: idPosicion,
    idInstalacion: ctx.idInstalacion,
    vehiculo: ctx.idProducto,
    fecha: formatFechaPosicion(
      (row.fecha ?? row.fechaHora) as string | Date | null | undefined,
    ),
    cliente: ctx.cliente,
    anio: ctx.anio,
    placas: ctx.placas,
    economico: ctx.economico,
    numeroSerie: ctx.numeroSerie,
    color: ctx.color,
    descripcion: ctx.descripcion,
    imagen: ctx.imagen,
    marca: ctx.marca,
    modelo: ctx.modelo,
    estatus: ctx.estatus,
    imei: num(row.imei),
    lat: Number(row.lat),
    lng: Number(row.lng),
    estado: num(row.estado),
    ignicion: num(row.ignicion),
    velocidad: num(row.velocidad),
    direccion: num(row.direccion),
    odometro: num(row.odometro),
    estaEnMovimiento: num(row.movimiento) === 1,
    combustible,
    idPosicion,
    totalDistancia: null,
    fechaHora: toIso(row.fechaHora as string | Date | null | undefined),
    alarma1: num(row.alarma1),
    alarma2: num(row.alarma2),
    energia: num(row.energia),
    idEvento: num(row.idEvento),
    idFoto: num(row.idFoto),
    fhRegistro: toIso(row.fhRegistro as string | Date | null | undefined),
    bateria: num(row.bateria),
    alimentacion: num(row.alimentacion),
    gps: num(row.gps),
    gsm: num(row.gsm),
    movimiento: num(row.movimiento),
    nivelCombustible: combustible,
    idFoto1: num(row.idFoto1),
    idFoto2: num(row.idFoto2),
    idFoto3: num(row.idFoto3),
    idVideo1: num(row.idVideo1),
    idVideo2: num(row.idVideo2),
    idVideo3: num(row.idVideo3),
    rutaFoto: str(row.rutaFoto),
    rutaFoto1: str(row.rutaFoto1),
    rutaFoto2: str(row.rutaFoto2),
    rutaFoto3: str(row.rutaFoto3),
    rutaVideo1: str(row.rutaVideo1),
    rutaVideo2: str(row.rutaVideo2),
    rutaVideo3: str(row.rutaVideo3),
  };
}

/** `Posiciones.FechaHora` → `2026-09-02T13:30:12` (hora de pared MySQL, sin desfase TZ). */
export function formatFechaPosicion(
  value: string | Date | null | undefined,
): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value === 'string') {
    const s = value.trim();
    const m = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
    if (m) {
      return `${m[1]}T${m[2]}`;
    }
  }

  if (value instanceof Date && Number.isFinite(value.getTime())) {
    // mysql2 serializa DATETIME con la hora de pared en componentes UTC del Date
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())}T${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:${pad(value.getUTCSeconds())}`;
  }

  const s = String(value).trim();
  const m = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}:\d{2})/);
  return m ? `${m[1]}T${m[2]}` : null;
}

/**
 * Normaliza `fechaInicio` / `fechaFinal` a `YYYY-MM-DD HH:mm:ss` (hora de pared,
 * misma convención que columnas MySQL DATETIME / `Posiciones.FechaHora`).
 * Sin zona horaria en el query param → no se convierte a UTC al consultar.
 */
export function parseFechaHistorico(raw: string): string {
  const normalized = raw.trim().replace(' ', 'T');
  const withSeconds = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)
    ? `${normalized}:00`
    : normalized;
  const m = withSeconds.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})/);
  if (!m) {
    throw new Error(`Fecha inválida: ${raw}`);
  }
  return `${m[1]} ${m[2]}`;
}

export function mapContextoDesdeRow(row: Record<string, unknown>): ContextoProducto {
  return {
    idInstalacion: Number(row.idInstalacion),
    idProducto: Number(row.idProducto),
    idCliente: Number(row.idCliente),
    anio: num(row.anio),
    placas: str(row.placas),
    economico: str(row.economico) ?? str(row.ecoDispositivo),
    numeroSerie: str(row.numeroSerieProducto) ?? str(row.numeroSerieDispositivo),
    color: str(row.color),
    descripcion: str(row.descripcion) ?? str(row.nombreProducto),
    imagen: str(row.imagen),
    marca: str(row.marca) ?? str(row.marcaDispositivo),
    modelo: str(row.modelo) ?? str(row.modeloDispositivo),
    estatus: num(row.estatusProducto),
    cliente: str(row.nombreCompletoCliente),
  };
}
