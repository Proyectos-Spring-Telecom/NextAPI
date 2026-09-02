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
    combustible: num(row.combustible),
    idPosicion,
    totalDistancia: null,
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
