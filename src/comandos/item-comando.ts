import { ComandosDispositivo } from 'src/entities/ComandosDispositivo';
import { fechaPared } from 'src/utils/datetime-mexico.util';

const f = (d: Date | null) => (d ? fechaPared(new Date(d)) : null);

/** Un comando como lo ve el front (`GET …/comandos` y `comando:actualizacion` en `/monitoreo`). */
export function itemComando(c: ComandosDispositivo) {
  return {
        id: Number(c.id),
        tipo: c.tipo,
        contenido: c.contenido,
        estatus: c.estatus,
        detalle: c.detalle,
        resultado: c.resultado ?? null,
        intentos: Number(c.intentos),
        idUsuario: c.idUsuario != null ? Number(c.idUsuario) : null,
        origen: c.origen,
        fechaCreacion: f(c.fechaCreacion),
        fechaPublicado: f(c.fechaPublicado),
        fechaRecibido: f(c.fechaRecibido),
        fechaEnviado: f(c.fechaEnviado),
        fechaConfirmado: f(c.fechaConfirmado),
        venceAt: f(c.venceAt),
  };
}
