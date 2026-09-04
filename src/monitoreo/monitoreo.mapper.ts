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
 * Telemetría plana desde UltimaPosicion.
 * Sin fila UP → todos null. No aplica a inmueble/panel.
 */
export type TelemetriaUltimaPosicion = {
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
  nivelCombustible: number | null;
};

export function mapTelemetriaUltimaPosicion(
  row: Record<string, unknown>,
): TelemetriaUltimaPosicion {
  const combustible = num(row.upCombustible);
  return {
    id: num(row.upId),
    imei: num(row.upImei) ?? num(row.imeiDispositivo),
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
    combustible,
    nivelCombustible: combustible,
  };
}

type MonitoreoBase = {
  idInstalacion: number;
  idCliente: number;
  idTipoProducto: number;
};

export type MonitoreoVehiculoItem = MonitoreoBase &
  TelemetriaUltimaPosicion & {
    cliente: string | null;
    placa: string | null;
    economico: string | null;
    marca: string | null;
    modelo: string | null;
  };

export type MonitoreoDispositivoItem = MonitoreoBase &
  TelemetriaUltimaPosicion & {
    cliente: string | null;
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

function mapMonitoreoVehiculo(row: Record<string, unknown>): MonitoreoVehiculoItem {
  return {
    ...mapBase(row),
    cliente: str(row.nombreCompletoCliente),
    placa: str(row.placaVehiculo),
    economico: str(row.ecoVehiculo),
    marca: str(row.marcaVehiculo),
    modelo: str(row.modeloVehiculo),
    ...mapTelemetriaUltimaPosicion(row),
  };
}

function mapMonitoreoActivo(row: Record<string, unknown>): MonitoreoActivoItem {
  return {
    ...mapBase(row),
    cliente: str(row.nombreCompletoCliente),
    economico: str(row.ecoDispositivo),
    numeroSerie: str(row.numeroSerieDispositivo),
    estatus: num(row.estatusProducto),
    modelo: str(row.modeloDispositivo),
    marca: str(row.marcaDispositivo),
    descripcion: str(row.descripcionActivo),
    ...mapTelemetriaUltimaPosicion(row),
  };
}

function mapMonitoreoPersona(row: Record<string, unknown>): MonitoreoPersonaItem {
  return {
    ...mapBase(row),
    cliente: str(row.nombreCompletoCliente),
    economico: str(row.ecoDispositivo),
    numeroSerie: str(row.numeroSerieDispositivo),
    estatus: num(row.estatusProducto),
    modelo: str(row.modeloDispositivo),
    marca: str(row.marcaDispositivo),
    persona: str(row.nombrePersona),
    ...mapTelemetriaUltimaPosicion(row),
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
        cliente: str(row.nombreCompletoCliente),
        economico: str(row.ecoDispositivo),
        numeroSerie: str(row.numeroSerieDispositivo),
        estatus: num(row.estatusProducto),
        modelo: str(row.modeloDispositivo),
        marca: str(row.marcaDispositivo),
        descripcion: null,
        ...mapTelemetriaUltimaPosicion(row),
      } as MonitoreoActivoItem;
  }
}
