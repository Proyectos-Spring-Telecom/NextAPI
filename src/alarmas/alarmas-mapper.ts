import { etiquetaTipoEvento } from './sia/sia-codes.map';

export function calcularOnline(
  ultimoHeartbeat: Date | string | null | undefined,
  thresholdMs: number,
): boolean {
  if (!ultimoHeartbeat) {
    return false;
  }
  const t = new Date(ultimoHeartbeat).getTime();
  if (!Number.isFinite(t)) {
    return false;
  }
  return Date.now() - t < thresholdMs;
}

export function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

export function num(value: unknown): number | null {
  if (value == null || value === '') {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function nombreClientePartes(
  nombre?: string | null,
  apellidoPaterno?: string | null,
  apellidoMaterno?: string | null,
): string | null {
  const partes = [nombre, apellidoPaterno, apellidoMaterno].filter((p) =>
    p?.trim(),
  );
  return partes.length > 0 ? partes.join(' ') : null;
}

export function mapInmuebleCorto(row: {
  IdProducto?: unknown;
  Inmueble?: string | null;
  Lat?: number | null;
  Lng?: number | null;
} | null) {
  const id = num(row?.IdProducto);
  if (id == null) {
    return null;
  }
  return {
    id,
    inmueble: row?.Inmueble ?? null,
    lat: row?.Lat ?? null,
    lng: row?.Lng ?? null,
  };
}

export function mapInmuebleCompleto(row: {
  IdProducto?: unknown;
  Inmueble?: string | null;
  DireccionFiscal?: string | null;
  NombreRepresentante?: string | null;
  TelefonoRepresentante?: string | null;
  CorreoRepresentante?: string | null;
  Lat?: number | null;
  Lng?: number | null;
} | null) {
  const corto = mapInmuebleCorto(row);
  if (!corto) {
    return null;
  }
  return {
    ...corto,
    direccionFiscal: row?.DireccionFiscal ?? null,
    nombreRepresentante: row?.NombreRepresentante ?? null,
    telefonoRepresentante: row?.TelefonoRepresentante ?? null,
    correoRepresentante: row?.CorreoRepresentante ?? null,
  };
}

export function mapEventoItem(row: {
  Id: unknown;
  IdPanel: unknown;
  IdCliente: unknown;
  CodigoSia: string;
  TipoEvento: string;
  EsRestauracion: number;
  Zona: number | null;
  CodigoUsuario: number | null;
  NombreDispositivo: string | null;
  Severidad: number;
  RecibidoEn: Date | string;
  PanelId?: unknown;
  CuentaSia?: string | null;
  PanelNombre?: string | null;
  IdProducto?: unknown;
  Inmueble?: string | null;
  Lat?: number | null;
  Lng?: number | null;
}) {
  const idPanel = num(row.IdPanel);
  return {
    id: Number(row.Id),
    idPanel,
    idCliente: num(row.IdCliente),
    codigoSia: row.CodigoSia,
    tipoEvento: row.TipoEvento,
    tipoEventoEtiqueta: etiquetaTipoEvento(row.TipoEvento),
    zona: row.Zona ?? null,
    codigoUsuario: row.CodigoUsuario ?? null,
    nombreDispositivo: row.NombreDispositivo ?? null,
    severidad: Number(row.Severidad),
    recibidoEn: toIso(row.RecibidoEn),
    esRestauracion: Number(row.EsRestauracion) === 1,
    panel: idPanel
      ? {
          id: num(row.PanelId) ?? idPanel,
          cuentaSia: row.CuentaSia ?? null,
          nombre: row.PanelNombre ?? null,
          inmueble: mapInmuebleCorto(row),
        }
      : null,
  };
}

export function mapUltimoEvento(row: {
  Id?: unknown;
  IdEventoAlarma?: unknown;
  CodigoSia: string;
  TipoEvento: string;
  Zona: number | null;
  CodigoUsuario: number | null;
  NombreDispositivo: string | null;
  Severidad: number;
  RecibidoEn: Date | string;
  EsRestauracion: number;
} | null) {
  if (!row) {
    return null;
  }
  return {
    id: num(row.IdEventoAlarma) ?? Number(row.Id),
    codigoSia: row.CodigoSia,
    tipoEvento: row.TipoEvento,
    zona: row.Zona ?? null,
    codigoUsuario: row.CodigoUsuario ?? null,
    nombreDispositivo: row.NombreDispositivo ?? null,
    severidad: Number(row.Severidad),
    recibidoEn: toIso(row.RecibidoEn),
    esRestauracion: Number(row.EsRestauracion) === 1,
  };
}
