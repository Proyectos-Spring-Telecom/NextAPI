import { imeiToString } from 'src/common/imei.util';
import { EventoAlarma } from 'src/entities/EventoAlarma';
import { Posiciones } from 'src/entities/Posiciones';

function num(value: unknown): number | null {
  if (value == null || value === '') {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function snapshotPosicion(posicion: Posiciones): Record<string, unknown> {
  return {
    id: Number(posicion.id),
    imei: imeiToString(posicion.imei),
    lat: posicion.lat,
    lng: posicion.lng,
    estado: num(posicion.estado),
    fechaHora: posicion.fechaHora,
    velocidad: Number(posicion.velocidad),
    direccion: Number(posicion.direccion),
    odometro: num(posicion.odometro),
    ignicion: num(posicion.ignicion),
    alarma1: num(posicion.alarma1),
    alarma2: num(posicion.alarma2),
    energia: num(posicion.energia),
    idEvento: num(posicion.idEvento),
    idFoto: num(posicion.idFoto),
    fhRegistro: posicion.fhRegistro,
    bateria: posicion.bateria,
    alimentacion: posicion.alimentacion,
    gps: num(posicion.gps),
    gsm: num(posicion.gsm),
    movimiento: num(posicion.movimiento),
    combustible: posicion.combustible,
    idFoto1: num(posicion.idFoto1),
    idFoto2: num(posicion.idFoto2),
    idFoto3: num(posicion.idFoto3),
    idVideo1: num(posicion.idVideo1),
    idVideo2: num(posicion.idVideo2),
    idVideo3: num(posicion.idVideo3),
  };
}

export function snapshotEventoAlarma(
  evento: EventoAlarma,
): Record<string, unknown> {
  return {
    id: Number(evento.id),
    idPanel: num(evento.idPanel),
    idCliente: num(evento.idCliente),
    codigoSia: evento.codigoSia,
    tipoEvento: evento.tipoEvento,
    esRestauracion: Number(evento.esRestauracion),
    zona: num(evento.zona),
    particion: num(evento.particion),
    codigoUsuario: num(evento.codigoUsuario),
    nombreDispositivo: evento.nombreDispositivo,
    severidad: Number(evento.severidad),
    secuencia: evento.secuencia,
    frameCrudo: evento.frameCrudo,
    dataDescifrada: evento.dataDescifrada,
    ipOrigen: evento.ipOrigen,
    recibidoEn: evento.recibidoEn,
    timestampPanel: evento.timestampPanel,
    fechaCreacion: evento.fechaCreacion,
    estatus: Number(evento.estatus),
  };
}
