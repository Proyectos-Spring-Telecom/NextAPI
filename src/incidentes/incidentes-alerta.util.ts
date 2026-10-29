import {
  EnumCatEventos,
  nombreCatEvento,
} from 'src/common/cat-eventos.enum';

/**
 * Estados de Posiciones que la Consola trata como alerta de vehículo
 * (mismos que el grid / botones del header en el front).
 * 2 primaria · 3 secundaria · 8 fuera de geocerca · 9 batería baja ·
 * 10 falta de energía · 11 alerta de movimiento.
 */
export const ESTADOS_ALERTA_CONSOLA: ReadonlySet<number> = new Set([
  2, 3, 8, 9, 10, 11,
]);

/** Catálogo de estados de Posiciones (mismo texto que Monitoreo). */
export const ETIQUETAS_ESTADO_POSICION: Readonly<Record<number, string>> = {
  0: 'Detenido',
  1: 'Movimiento',
  2: 'Alerta primaria',
  3: 'Alerta secundaria',
  4: 'Detenido más de 30 min',
  5: 'Detenido más de 60 min',
  6: 'Detenido más de 90 min',
  7: 'Exceso de velocidad',
  8: 'Fuera de geocerca',
  9: 'Batería baja',
  10: 'Falta de energía',
  11: 'Alerta de movimiento',
};

/**
 * Eventos con incidente propio: comparten el estado de alerta (2) pero el
 * monitorista debe distinguirlos, así que uno abierto no bloquea al otro.
 */
export const EVENTOS_INCIDENTE_PROPIO: ReadonlySet<number> = new Set([
  EnumCatEventos.HELP_ME,
  EnumCatEventos.RELOJ_CAIDA,
]);

/** IdEvento si abre incidente propio; null para el resto (cuenta solo el estado). */
export function eventoIncidente(idEvento: unknown): number | null {
  const n = estadoEntero(idEvento);
  return n != null && EVENTOS_INCIDENTE_PROPIO.has(n) ? n : null;
}

function estadoEntero(estado: unknown): number | null {
  if (estado == null || estado === '') return null;
  const n = Number(estado);
  return Number.isInteger(n) ? n : null;
}

export function esEstadoAlertaConsola(estado: unknown): boolean {
  const n = estadoEntero(estado);
  return n != null && ESTADOS_ALERTA_CONSOLA.has(n);
}

/**
 * Hay que abrir incidente solo cuando la alerta empieza: el estado actual es
 * de alerta y es distinto al que tenía la unidad (UltimaPosicion) antes de
 * esta posición. Mientras la unidad siga reportando la misma alerta no se
 * crea otro (evita uno nuevo por cada posición y tras finalizar).
 */
export function iniciaAlertaConsola(
  estadoActual: unknown,
  estadoPrevio: unknown,
  idEventoActual?: unknown,
  idEventoPrevio?: unknown,
): boolean {
  if (!esEstadoAlertaConsola(estadoActual)) return false;
  if (estadoEntero(estadoActual) !== estadoEntero(estadoPrevio)) return true;
  // Mismo estado: solo inicia si pasa de un evento propio a otro (caída → SOS).
  const actual = eventoIncidente(idEventoActual);
  const previo = eventoIncidente(idEventoPrevio);
  return actual != null && previo != null && actual !== previo;
}

export function etiquetaEstadoPosicion(estado: unknown): string | null {
  const n = estadoEntero(estado);
  return n != null ? (ETIQUETAS_ESTADO_POSICION[n] ?? null) : null;
}

/**
 * Seguimiento que se agrega al incidente abierto cuando la misma alerta vuelve
 * a empezar (p. ej. otra caída antes de finalizar el reporte).
 */
export function seguimientoAlertaRepetida(
  estado: unknown,
  idEvento: unknown,
  posicion: { id: number | string; lat: unknown; lng: unknown },
): string {
  const etiqueta = descripcionAlertaAutomatica(estado, idEvento).replace(
    'Alerta automática: ',
    '',
  );
  const lat = Number(posicion.lat);
  const lng = Number(posicion.lng);
  const ubicacion =
    Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)
      ? `ubicación ${lat.toFixed(6)}, ${lng.toFixed(6)}`
      : 'sin ubicación';
  return `Nueva alerta: ${etiqueta} · ${ubicacion} · posición ${posicion.id}`;
}

/** Descripción del incidente creado automáticamente por una alerta. */
export function descripcionAlertaAutomatica(
  estado: unknown,
  idEvento?: unknown,
): string {
  const evento = eventoIncidente(idEvento);
  const etiqueta =
    (evento != null ? nombreCatEvento(evento) : null) ??
    etiquetaEstadoPosicion(estado) ??
    'Alerta';
  return `Alerta automática: ${etiqueta}`;
}
