import { Dispositivos } from 'src/entities/Dispositivos';
import { PanelAlarma } from 'src/entities/PanelAlarma';
import { nombreCliente } from 'src/productos/map-relaciones.util';

export { nombreCliente };

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

export function mapDispositivoPlano(item: Dispositivos) {
  const cliente = item.idCliente2;
  const tipo = item.idTipoDispositivo2;
  const marca = item.idMarca2;
  const modelo = item.idModelo2;

  return {
    id: Number(item.id),
    numeroSerie: item.numeroSerie,
    imei: item.imei,
    eco: item.eco,
    estatus: item.estatus != null ? Number(item.estatus) : null,
    idCliente: Number(item.idCliente),
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
        estatus: item.estatus != null ? Number(item.estatus) : null,
        idCliente: Number(item.idCliente),
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
