/** Recorrido de un comando (ComandosDispositivo.Estatus), docs/motor-activos.md §8. */
export type EstatusComando = 'pendiente' | 'publicado' | 'recibido' | 'enviado' | 'confirmado' | 'vencido' | 'fallido';

/** Lo que reporta el socket en `<protocolo>.cmd.ack`. */
export const ESTADOS_ACK = ['recibido', 'enviado', 'confirmado', 'vencido', 'fallido'] as const;
export type EstadoAck = (typeof ESTADOS_ACK)[number];

const ORDEN: Record<EstatusComando, number> = {
  pendiente: 0,
  publicado: 1,
  recibido: 2,
  enviado: 3,
  confirmado: 4,
  vencido: 4,
  fallido: 4,
};

/**
 * ¿El ack cambia el estatus? Nunca retrocede (los acks pueden llegar
 * desordenados o repetidos). Confirmado gana incluso a vencido: el reloj
 * respondió tarde pero sí aplicó el comando.
 */
export function aplicaAck(actual: EstatusComando, nuevo: EstadoAck): boolean {
  if (actual === 'confirmado') return false;
  if (nuevo === 'confirmado') return true;
  if (actual === 'vencido' || actual === 'fallido') return false;
  return ORDEN[nuevo] > ORDEN[actual];
}

const TODOS: readonly EstatusComando[] = ['pendiente', 'publicado', 'recibido', 'enviado', 'confirmado', 'vencido', 'fallido'];

/** Estatus desde los que el ack aplica: la escritura es condicional a ellos (sin carreras). */
export function estatusQueAceptan(nuevo: EstadoAck): EstatusComando[] {
  return TODOS.filter((actual) => aplicaAck(actual, nuevo));
}
