import {
  distanciaMetros,
  redondearKm,
} from '../../utils/recorrido.utils';

export type OpcionesDistanciaHistorico = {
  /** Puntos ya ordenados DESC por fecha (como viene de la BD). */
  yaOrdenadoDesc?: boolean;
};

export type PuntoHistoricoDistancia = {
  id: number;
  lat: number;
  lng: number;
  fechaHora: Date | string;
};

export type ResultadoDistanciaHistorico = {
  totalDistanciaKm: number;
  acumuladoKmPorId: Map<number, number | null>;
};

function ordenarDescPorFecha(
  puntos: PuntoHistoricoDistancia[],
): PuntoHistoricoDistancia[] {
  return [...puntos].sort((a, b) => {
    const ta = new Date(a.fechaHora).getTime();
    const tb = new Date(b.fechaHora).getTime();
    if (ta !== tb) {
      return tb - ta;
    }
    return b.id - a.id;
  });
}

/**
 * Distancia total y acumulada por posición para histórico de monitoreo.
 * Suma Haversine entre **todos** los puntos consecutivos en el tiempo
 * (sin filtrar saltos, drift ni coordenadas). Reglas de validez se
 * implementarán más adelante (p. ej. en Gateway).
 *
 * Espera orden DESC (más reciente primero). Recorre de la posición más
 * antigua hacia la más reciente cuando `yaOrdenadoDesc` es true.
 */
export function calcularDistanciaHistoricoMonitoreo(
  puntos: PuntoHistoricoDistancia[],
  opciones: OpcionesDistanciaHistorico = {},
): ResultadoDistanciaHistorico {
  const acumuladoKmPorId = new Map<number, number | null>();
  const ordenados = opciones.yaOrdenadoDesc
    ? puntos
    : ordenarDescPorFecha(puntos);

  if (ordenados.length === 0) {
    return { totalDistanciaKm: 0, acumuladoKmPorId };
  }

  for (const p of ordenados) {
    acumuladoKmPorId.set(p.id, 0);
  }

  // ordenados[0] = más reciente, ordenados[n-1] = más antiguo
  acumuladoKmPorId.set(ordenados[ordenados.length - 1].id, 0);

  let acumuladoMetros = 0;
  for (let i = ordenados.length - 2; i >= 0; i--) {
    const older = ordenados[i + 1];
    const newer = ordenados[i];
    acumuladoMetros += distanciaMetros(
      { lat: older.lat, lng: older.lng },
      { lat: newer.lat, lng: newer.lng },
    );
    acumuladoKmPorId.set(newer.id, redondearKm(acumuladoMetros / 1000));
  }

  return {
    totalDistanciaKm: redondearKm(acumuladoMetros / 1000),
    acumuladoKmPorId,
  };
}
