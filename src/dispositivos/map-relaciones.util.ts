import { Dispositivos } from 'src/entities/Dispositivos';
import { PanelAlarma } from 'src/entities/PanelAlarma';
import { RelojConfig } from 'src/entities/RelojConfig';
import { TrackcamConfig } from 'src/entities/TrackcamConfig';
import { imeiToString } from 'src/common/imei.util';
import { nombreCliente } from 'src/productos/map-relaciones.util';
import {
  TRACKCAM_CONFIG_KEYS,
  TrackcamConfigKey,
} from './trackcam/trackcam-config.keys';
import { RELOJ_CONFIG_KEYS, RelojConfigKey } from './relojes/reloj-config.keys';

export { nombreCliente };

/** Cliente del equipo de una configuración: la configuración no tiene cliente propio (fase B). NULL = almacén. */
function clienteDelEquipo(item: { idDispositivo2?: Dispositivos | null }): number | null {
  const id = item.idDispositivo2?.idCliente;
  return id != null ? Number(id) : null;
}

export const RELACIONES_DISPOSITIVO_BASE = [
  'idCliente2',
  'idTipoDispositivo2',
  'idMarca2',
  'idModelo2',
] as const;

export const RELACIONES_DETALLE_PANEL = {
  idDispositivo2: {
    idCliente2: true,
    idTipoDispositivo2: true,
    idMarca2: true,
    idModelo2: true,
  },
} as const;

export const RELACIONES_DETALLE_TRACKCAM = RELACIONES_DETALLE_PANEL;
export const RELACIONES_DETALLE_RELOJ = RELACIONES_DETALLE_PANEL;

export function pickRelojConfig(
  source: Partial<Record<RelojConfigKey, unknown>>,
): Partial<Record<RelojConfigKey, number | null>> {
  const out: Partial<Record<RelojConfigKey, number | null>> = {};
  for (const key of RELOJ_CONFIG_KEYS) {
    if (source[key] !== undefined) {
      const value = source[key];
      out[key] = value == null ? null : Number(value);
    }
  }
  return out;
}

export function pickTrackcamConfig(
  source: Partial<Record<TrackcamConfigKey, unknown>>,
): Partial<Record<TrackcamConfigKey, number | null>> {
  const out: Partial<Record<TrackcamConfigKey, number | null>> = {};
  for (const key of TRACKCAM_CONFIG_KEYS) {
    if (source[key] !== undefined) {
      const value = source[key];
      out[key] = value == null ? null : Number(value);
    }
  }
  return out;
}

export function mapDispositivoPlano(item: Dispositivos) {
  const cliente = item.idCliente2;
  const tipo = item.idTipoDispositivo2;
  const marca = item.idMarca2;
  const modelo = item.idModelo2;

  return {
    id: Number(item.id),
    numeroSerie: item.numeroSerie,
    imei: imeiToString(item.imei),
    eco: item.eco,
    camara: item.camara != null ? Number(item.camara) : 0,
    estatus: item.estatus != null ? Number(item.estatus) : null,
    idCliente: item.idCliente != null ? Number(item.idCliente) : null,
    nombreCliente: nombreCliente(cliente),
    idTipoDispositivo:
      item.idTipoDispositivo != null ? Number(item.idTipoDispositivo) : null,
    nombreTipoDispositivo: tipo?.nombre ?? null,
    codigoTipoDispositivo: tipo?.codigo ?? null,
    idMarca: item.idMarca != null ? Number(item.idMarca) : null,
    nombreMarca: marca?.nombre ?? null,
    idModelo: item.idModelo != null ? Number(item.idModelo) : null,
    nombreModelo: modelo?.nombre ?? null,
    fechaCreacion: item.fechaCreacion ?? null,
    fechaActualizacion: item.fechaActualizacion ?? null,
  };
}

export function mapPanelAlarmaPlano(item: PanelAlarma) {
  const dispositivo = item.idDispositivo2;
  const plano = dispositivo
    ? mapDispositivoPlano(dispositivo)
    : {
      id: Number(item.idDispositivo),
      numeroSerie: null,
      imei: null,
      eco: null,
      camara: 0,
      estatus: item.estatus != null ? Number(item.estatus) : null,
      idCliente: clienteDelEquipo(item),
      nombreCliente: null,
      idTipoDispositivo: null,
      nombreTipoDispositivo: null,
      codigoTipoDispositivo: null,
      idMarca: null,
      nombreMarca: null,
      idModelo: null,
      nombreModelo: null,
      fechaCreacion: item.fechaCreacion ?? null,
      fechaActualizacion: item.fechaActualizacion ?? null,
    };

  return {
    id: Number(item.idDispositivo),
    nombrePanel: item.nombre,
    cuentaSia: item.cuentaSia,
    ip: item.ip,
    cifradoActivo: Number(item.cifradoActivo),
    aesBits: Number(item.aesBits),
    ultimoHeartbeat: item.ultimoHeartbeat,
    numeroSerie: plano.numeroSerie,
    imei: plano.imei,
    eco: plano.eco,
    camara: plano.camara,
    estatus: plano.estatus,
    idCliente: plano.idCliente,
    nombreCliente: plano.nombreCliente,
    idTipoDispositivo: plano.idTipoDispositivo,
    nombreTipoDispositivo: plano.nombreTipoDispositivo,
    codigoTipoDispositivo: plano.codigoTipoDispositivo,
    idMarca: plano.idMarca,
    nombreMarca: plano.nombreMarca,
    idModelo: plano.idModelo,
    nombreModelo: plano.nombreModelo,
    fechaCreacion: plano.fechaCreacion,
    fechaActualizacion: plano.fechaActualizacion,
  };
}

export function mapTrackcamPlano(item: TrackcamConfig) {
  const dispositivo = item.idDispositivo2;
  const plano = dispositivo
    ? mapDispositivoPlano(dispositivo)
    : {
        id: Number(item.idDispositivo),
        numeroSerie: null,
        imei: null,
        eco: null,
        camara: 0,
        estatus: null,
        idCliente: clienteDelEquipo(item),
        nombreCliente: null,
        idTipoDispositivo: null,
        nombreTipoDispositivo: null,
        codigoTipoDispositivo: null,
        idMarca: null,
        nombreMarca: null,
        idModelo: null,
        nombreModelo: null,
        fechaCreacion: item.fechaCreacion ?? null,
        fechaActualizacion: item.fechaActualizacion ?? null,
      };

  return {
    ...plano,
    ...pickTrackcamConfig(item),
    id: Number(item.idDispositivo),
    idCliente: clienteDelEquipo(item),
    fechaCreacion: item.fechaCreacion ?? plano.fechaCreacion,
    fechaActualizacion: item.fechaActualizacion ?? plano.fechaActualizacion,
  };
}

/** Reloj: datos comunes del dispositivo + RelojConfig, plano. */
export function mapRelojPlano(item: RelojConfig) {
  const dispositivo = item.idDispositivo2;
  const plano = dispositivo
    ? mapDispositivoPlano(dispositivo)
    : {
        id: Number(item.idDispositivo),
        numeroSerie: null,
        imei: null,
        eco: null,
        camara: 0,
        estatus: null,
        idCliente: clienteDelEquipo(item),
        nombreCliente: null,
        idTipoDispositivo: null,
        nombreTipoDispositivo: null,
        codigoTipoDispositivo: null,
        idMarca: null,
        nombreMarca: null,
        idModelo: null,
        nombreModelo: null,
        fechaCreacion: item.fechaCreacion ?? null,
        fechaActualizacion: item.fechaActualizacion ?? null,
      };

  return {
    ...plano,
    ...pickRelojConfig(item),
    id: Number(item.idDispositivo),
    idCliente: clienteDelEquipo(item),
    fechaCreacion: item.fechaCreacion ?? plano.fechaCreacion,
    fechaActualizacion: item.fechaActualizacion ?? plano.fechaActualizacion,
  };
}

/** Payload webhook: tablas `Dispositivos` + `TrackcamConfig` separadas. */
export function buildTrackcamWebhookData(item: TrackcamConfig): {
  dispositivo: Record<string, unknown>;
  config: Record<string, number | string | Date | null>;
  terminalId: string | null;
} {
  const dispositivo: Record<string, unknown> = item.idDispositivo2
    ? mapDispositivoPlano(item.idDispositivo2)
    : {
        id: Number(item.idDispositivo),
        numeroSerie: null,
        imei: null,
        eco: null,
        camara: 0,
        estatus: null,
        idCliente: clienteDelEquipo(item),
        nombreCliente: null,
        idTipoDispositivo: null,
        nombreTipoDispositivo: null,
        codigoTipoDispositivo: null,
        idMarca: null,
        nombreMarca: null,
        idModelo: null,
        nombreModelo: null,
        fechaCreacion: null,
        fechaActualizacion: null,
      };

  const config: Record<string, number | string | Date | null> = {
    idDispositivo: Number(item.idDispositivo),
    idCliente: clienteDelEquipo(item),
  };
  for (const key of TRACKCAM_CONFIG_KEYS) {
    const value = item[key];
    config[key] = value == null ? null : Number(value);
  }
  config.fechaCreacion = item.fechaCreacion ?? null;
  config.fechaActualizacion = item.fechaActualizacion ?? null;

  const imei = imeiToString(dispositivo.imei);

  return {
    dispositivo,
    config,
    terminalId: imeiToTerminalId(imei),
  };
}

export function imeiToTerminalId(imei: string | null): string | null {
  if (imei == null) {
    return null;
  }
  const digits = String(imei).replace(/\D/g, '');
  if (!digits) {
    return null;
  }
  return digits.slice(-12).padStart(12, '0');
}
