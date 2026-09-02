import { num, str } from '../monitoreo.mapper';

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
  return {
    id: idPosicion,
    idInstalacion: ctx.idInstalacion,
    vehiculo: ctx.idProducto,
    fecha: formatFechaLocal(row.fechaHora as string | Date | null | undefined),
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
    combustible: num(row.combustible),
    idPosicion,
    totalDistancia: null,
  };
}

/** Fecha estilo legacy: `2026-09-02T13:30:12` (sin Z / sin ms). */
function formatFechaLocal(value: string | Date | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  if (typeof value === 'string') {
    const s = value.trim().replace(' ', 'T');
    // Si ya viene sin timezone, recortar a segundos
    const m = s.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/);
    if (m) {
      return m[1];
    }
  }
  const d = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(d.getTime())) {
    return null;
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function parseFechaHistorico(raw: string): Date {
  const normalized = raw.trim().replace(' ', 'T');
  // Sin zona → interpretar como fecha local del servidor (TZ app = America/Mexico_City)
  const d = new Date(normalized);
  if (!Number.isFinite(d.getTime())) {
    throw new Error(`Fecha inválida: ${raw}`);
  }
  return d;
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
