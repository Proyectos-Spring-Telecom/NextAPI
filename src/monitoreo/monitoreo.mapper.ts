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

/**
 * Fila completa de `UltimaPosicion` (única fuente de telemetría en list/socket).
 * Si no hay fila, todos los campos van en null.
 */
export type UltimaPosicionPayload = {
  id: number | null;
  imei: number | null;
  lat: number | null;
  lng: number | null;
  estado: number | null;
  fechaHora: string | null;
  velocidad: number | null;
  direccion: number | null;
  odometro: number | null;
  ignicion: number | null;
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
  combustible: number | null;
  idFoto1: number | null;
  idFoto2: number | null;
  idFoto3: number | null;
  idVideo1: number | null;
  idVideo2: number | null;
  idVideo3: number | null;
};

const ULTIMA_POSICION_VACIA: UltimaPosicionPayload = {
  id: null,
  imei: null,
  lat: null,
  lng: null,
  estado: null,
  fechaHora: null,
  velocidad: null,
  direccion: null,
  odometro: null,
  ignicion: null,
  alarma1: null,
  alarma2: null,
  energia: null,
  idEvento: null,
  idFoto: null,
  fhRegistro: null,
  bateria: null,
  alimentacion: null,
  gps: null,
  gsm: null,
  movimiento: null,
  combustible: null,
  idFoto1: null,
  idFoto2: null,
  idFoto3: null,
  idVideo1: null,
  idVideo2: null,
  idVideo3: null,
};

export function mapUltimaPosicionPayload(
  row: Record<string, unknown>,
): UltimaPosicionPayload {
  if (row.upId == null) {
    return { ...ULTIMA_POSICION_VACIA };
  }

  return {
    id: num(row.upId),
    imei: num(row.upImei),
    lat: num(row.upLat),
    lng: num(row.upLng),
    estado: num(row.upEstado),
    fechaHora: toIso(row.upFechaHora as string | Date | null | undefined),
    velocidad: num(row.upVelocidad),
    direccion: num(row.upDireccion),
    odometro: num(row.upOdometro),
    ignicion: num(row.upIgnicion),
    alarma1: num(row.upAlarma1),
    alarma2: num(row.upAlarma2),
    energia: num(row.upEnergia),
    idEvento: num(row.upIdEvento),
    idFoto: num(row.upIdFoto),
    fhRegistro: toIso(row.upFhRegistro as string | Date | null | undefined),
    bateria: num(row.upBateria),
    alimentacion: num(row.upAlimentacion),
    gps: num(row.upGps),
    gsm: num(row.upGsm),
    movimiento: num(row.upMovimiento),
    combustible: num(row.upCombustible),
    idFoto1: num(row.upIdFoto1),
    idFoto2: num(row.upIdFoto2),
    idFoto3: num(row.upIdFoto3),
    idVideo1: num(row.upIdVideo1),
    idVideo2: num(row.upIdVideo2),
    idVideo3: num(row.upIdVideo3),
  };
}

type MonitoreoBase = {
  idInstalacion: number;
  idCliente: number;
  idTipoProducto: number;
};

/** Contexto de instalación + telemetría = campos de UltimaPosicion en raíz. */
type ConTelemetriaUltimaPosicion = UltimaPosicionPayload & {
  /** Alias de `combustible` (compat UI vehículos). */
  nivelCombustible: number | null;
  /** Copia anidada idéntica a los campos de telemetría en raíz. */
  ultimaPosicion: UltimaPosicionPayload;
};

export type MonitoreoVehiculoItem = MonitoreoBase &
  ConTelemetriaUltimaPosicion & {
    cliente: string | null;
    placa: string | null;
    economico: string | null;
    marca: string | null;
    modelo: string | null;
  };

export type MonitoreoDispositivoItem = MonitoreoBase &
  ConTelemetriaUltimaPosicion & {
    cliente: string | null;
    /** IMEI del dispositivo (catálogo); la telemetría usa `imei` de UltimaPosicion. */
    imeiDispositivo: number | null;
    economico: string | null;
    numeroSerie: string | null;
    estatus: number | null;
    modelo: string | null;
    marca: string | null;
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

/** Telemetría únicamente desde UltimaPosicion (aplanada + anidada). */
function mapTelemetriaDesdeUltimaPosicion(
  row: Record<string, unknown>,
): ConTelemetriaUltimaPosicion {
  const ultimaPosicion = mapUltimaPosicionPayload(row);
  return {
    ...ultimaPosicion,
    nivelCombustible: ultimaPosicion.combustible,
    ultimaPosicion,
  };
}

function mapDispositivoContexto(row: Record<string, unknown>) {
  return {
    cliente: str(row.nombreCompletoCliente),
    imeiDispositivo: num(row.imeiDispositivo),
    economico: str(row.ecoDispositivo),
    numeroSerie: str(row.numeroSerieDispositivo),
    estatus: num(row.estatusProducto),
    modelo: str(row.modeloDispositivo),
    marca: str(row.marcaDispositivo),
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
    ...mapTelemetriaDesdeUltimaPosicion(row),
  };
}

function mapMonitoreoActivo(row: Record<string, unknown>): MonitoreoActivoItem {
  return {
    ...mapBase(row),
    ...mapDispositivoContexto(row),
    descripcion: str(row.descripcionActivo),
    ...mapTelemetriaDesdeUltimaPosicion(row),
  };
}

function mapMonitoreoPersona(row: Record<string, unknown>): MonitoreoPersonaItem {
  return {
    ...mapBase(row),
    ...mapDispositivoContexto(row),
    persona: str(row.nombrePersona),
    ...mapTelemetriaDesdeUltimaPosicion(row),
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
    imei: num(row.imeiDispositivo),
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
        ...mapDispositivoContexto(row),
        descripcion: null,
        ...mapTelemetriaDesdeUltimaPosicion(row),
      } as MonitoreoActivoItem;
  }
}
