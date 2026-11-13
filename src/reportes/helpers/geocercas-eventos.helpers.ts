import { msDeFecha } from './jornada.helpers';

/** Evento de `EventosGeocerca` (hora de pared `YYYY-MM-DDTHH:mm:ss`). */
export type EventoGeocerca = {
  idGeocerca: number;
  nombreGeocerca: string;
  idPosicion: number;
  tipo: 'entrada' | 'salida';
  fechaHora: string;
};

/**
 * Una visita a la geocerca. `entrada` null: ya estaba dentro al empezar el
 * periodo; `salida` null: seguía dentro al terminarlo.
 */
export type VisitaGeocerca = {
  idGeocerca: number;
  nombreGeocerca: string;
  entrada: string | null;
  salida: string | null;
  /** Minutos dentro; null si falta la entrada o la salida. */
  minDentro: number | null;
  /** Minutos fuera desde la salida anterior de esta geocerca; null en la primera. */
  minFueraAntes: number | null;
};

/** Visitas por geocerca a partir de los eventos del periodo, en orden. */
export function armarVisitas(eventos: readonly EventoGeocerca[]): VisitaGeocerca[] {
  const ordenados = [...eventos].sort(
    (a, b) => a.fechaHora.localeCompare(b.fechaHora) || a.idPosicion - b.idPosicion,
  );
  const abiertas = new Map<number, VisitaGeocerca>();
  const ultimaSalida = new Map<number, string>();
  const visitas: VisitaGeocerca[] = [];
  const minutos = (desde: string, hasta: string) =>
    Math.round(((msDeFecha(hasta) - msDeFecha(desde)) / 60_000) * 10) / 10;

  for (const e of ordenados) {
    if (e.tipo === 'entrada') {
      if (abiertas.has(e.idGeocerca)) continue;
      const previa = ultimaSalida.get(e.idGeocerca);
      const v: VisitaGeocerca = {
        idGeocerca: e.idGeocerca,
        nombreGeocerca: e.nombreGeocerca,
        entrada: e.fechaHora,
        salida: null,
        minDentro: null,
        minFueraAntes: previa ? minutos(previa, e.fechaHora) : null,
      };
      abiertas.set(e.idGeocerca, v);
      visitas.push(v);
    } else {
      const v = abiertas.get(e.idGeocerca);
      if (v) {
        v.salida = e.fechaHora;
        v.minDentro = minutos(v.entrada as string, e.fechaHora);
        abiertas.delete(e.idGeocerca);
      } else {
        // Ya estaba dentro al empezar el periodo.
        visitas.push({
          idGeocerca: e.idGeocerca,
          nombreGeocerca: e.nombreGeocerca,
          entrada: null,
          salida: e.fechaHora,
          minDentro: null,
          minFueraAntes: null,
        });
      }
      ultimaSalida.set(e.idGeocerca, e.fechaHora);
    }
  }
  return visitas;
}
