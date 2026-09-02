import { EnumTipoProducto } from 'src/common/estatus.enum';
import { mapUltimoEvento } from 'src/alarmas/alarmas-mapper';

export function num(value: unknown): number | null {
  if (value == null || value === '') {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function str(value: unknown): string | null {
  if (value == null || value === '') {
    return null;
  }
  const s = String(value).trim();
  return s === '' ? null : s;
}

export function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

type MonitoreoBase = {
  idInstalacion: number;
  idCliente: number;
  idTipoProducto: number;
};

export type MonitoreoVehiculoItem = MonitoreoBase & {
  cliente: string | null;
  placa: string | null;
  economico: string | null;
  marca: string | null;
  modelo: string | null;
  ignicion: number | null;
  velocidad: number | null;
  fechaHora: string | null;
  nivelCombustible: number | null;
  odometro: number | null;
  gps: number | null;
  gsm: number | null;
  lat: number | null;
  lng: number | null;
};

export type MonitoreoDispositivoItem = MonitoreoBase & {
  cliente: string | null;
  imei: number | null;
  economico: string | null;
  numeroSerie: string | null;
  estatus: number | null;
  odometro: number | null;
  gps: number | null;
  gsm: number | null;
  modelo: string | null;
  marca: string | null;
  fechaHora: string | null;
  ultimaPosicion: number | null;
  lat: number | null;
  lng: number | null;
};

export type MonitoreoActivoItem = MonitoreoDispositivoItem & {
  descripcion: string | null;
};

export type MonitoreoPersonaItem = MonitoreoDispositivoItem & {
  persona: string | null;
};

export type MonitoreoUltimoEventoAlarma = NonNullable<
  ReturnType<typeof mapUltimoEvento>
>;

export type MonitoreoInmuebleItem = MonitoreoBase & {
  cliente: string | null;
  imei: number | null;
  inmueble: string | null;
  economico: string | null;
  numeroSerie: string | null;
  estatus: number | null;
  modelo: string | null;
  marca: string | null;
  lat: number | null;
  lng: number | null;
  ultimoHeartbeat: string | null;
  fechaHora: string | null;
  ultimoEventoAlarma: MonitoreoUltimoEventoAlarma | null;
};

export type MonitoreoPosicionItem =
  | MonitoreoVehiculoItem
  | MonitoreoActivoItem
  | MonitoreoPersonaItem
  | MonitoreoInmuebleItem;

function mapBase(row: Record<string, unknown>): MonitoreoBase {
  return {
    idInstalacion: Number(row.idInstalacion),
    idCliente: Number(row.idCliente),
    idTipoProducto: Number(row.idTipoProducto),
  };
}

function mapTelemetria(row: Record<string, unknown>) {
  return {
    fechaHora: toIso(row.fechaHora as string | Date | null | undefined),
    ultimaPosicion: num(row.ultimaPosicion),
    odometro: num(row.odometro),
    gps: num(row.gps),
    gsm: num(row.gsm),
    lat: num(row.latitud),
    lng: num(row.longitud),
  };
}

function mapDispositivoComun(row: Record<string, unknown>) {
  return {
    cliente: str(row.nombreCompletoCliente),
    imei: num(row.imei),
    economico: str(row.ecoDispositivo),
    numeroSerie: str(row.numeroSerieDispositivo),
    estatus: num(row.estatusProducto),
    modelo: str(row.modeloDispositivo),
    marca: str(row.marcaDispositivo),
    ...mapTelemetria(row),
  };
}

function mapMonitoreoVehiculo(row: Record<string, unknown>): MonitoreoVehiculoItem {
  return {
    ...mapBase(row),
    cliente: str(row.nombreCompletoCliente),
    placa: str(row.placaVehiculo),
    economico: str(row.ecoVehiculo),
    marca: str(row.marcaVehiculo),
    modelo: str(row.modeloVehiculo),
    ignicion: num(row.ignicion),
    velocidad: num(row.velocidad),
    fechaHora: toIso(row.fechaHora as string | Date | null | undefined),
    nivelCombustible: num(row.nivelCombustible),
    odometro: num(row.odometro),
    gps: num(row.gps),
    gsm: num(row.gsm),
    lat: num(row.latitud),
    lng: num(row.longitud),
  };
}

function mapMonitoreoActivo(row: Record<string, unknown>): MonitoreoActivoItem {
  return {
    ...mapBase(row),
    ...mapDispositivoComun(row),
    descripcion: str(row.descripcionActivo),
  };
}

function mapMonitoreoPersona(row: Record<string, unknown>): MonitoreoPersonaItem {
  return {
    ...mapBase(row),
    ...mapDispositivoComun(row),
    persona: str(row.nombrePersona),
  };
}

function mapUltimoEventoAlarmaRow(
  row: Record<string, unknown>,
): MonitoreoUltimoEventoAlarma | null {
  if (row.ueaId == null) {
    return null;
  }

  return mapUltimoEvento({
    Id: row.ueaId,
    IdEventoAlarma: row.ueaIdEventoAlarma,
    CodigoSia: String(row.ueaCodigoSia ?? ''),
    TipoEvento: String(row.ueaTipoEvento ?? ''),
    Zona: num(row.ueaZona),
    CodigoUsuario: num(row.ueaCodigoUsuario),
    NombreDispositivo: str(row.ueaNombreDispositivo),
    Severidad: Number(row.ueaSeveridad ?? 1),
    RecibidoEn: row.ueaRecibidoEn as Date | string,
    EsRestauracion: Number(row.ueaEsRestauracion ?? 0),
  });
}

function mapMonitoreoInmueble(row: Record<string, unknown>): MonitoreoInmuebleItem {
  const ultimoEventoAlarma = mapUltimoEventoAlarmaRow(row);

  return {
    ...mapBase(row),
    cliente: str(row.nombreCompletoCliente),
    imei: num(row.imei),
    inmueble: str(row.inmueble),
    economico: str(row.ecoDispositivo),
    numeroSerie: str(row.numeroSerieDispositivo),
    estatus: num(row.estatusPanel) ?? num(row.estatusProducto),
    modelo: str(row.modeloDispositivo),
    marca: str(row.marcaDispositivo),
    lat: num(row.latInmueble),
    lng: num(row.lngInmueble),
    ultimoHeartbeat: toIso(
      row.ultimoHeartbeatPanel as string | Date | null | undefined,
    ),
    fechaHora: ultimoEventoAlarma?.recibidoEn ?? null,
    ultimoEventoAlarma,
  };
}

export function mapMonitoreoPosicionItem(
  row: Record<string, unknown>,
): MonitoreoPosicionItem {
  const idTipoProducto = Number(row.idTipoProducto);

  switch (idTipoProducto) {
    case EnumTipoProducto.VEHICULO:
      return mapMonitoreoVehiculo(row);
    case EnumTipoProducto.ACTIVO:
      return mapMonitoreoActivo(row);
    case EnumTipoProducto.INMUEBLE:
      return mapMonitoreoInmueble(row);
    case EnumTipoProducto.PERSONA:
      return mapMonitoreoPersona(row);
    default:
      return {
        ...mapBase(row),
        ...mapDispositivoComun(row),
        descripcion: null,
      } as MonitoreoActivoItem;
  }
}
