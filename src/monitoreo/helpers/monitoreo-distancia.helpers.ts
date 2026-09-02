import {
  distanciaMetros,
  redondearKm,
} from '../../utils/recorrido.utils';
import {
  MONITOREO_DISTANCIA_DEFAULTS,
  UmbralesDistanciaHistorico,
} from './monitoreo-distancia.config';

export type OpcionesDistanciaHistorico = {
  /** Puntos ya ordenados DESC por fecha (como viene de la BD). */
  yaOrdenadoDesc?: boolean;
  umbrales?: UmbralesDistanciaHistorico;
};

export type PuntoHistoricoDistancia = {
  id: number;
  lat: number;
  lng: number;
  fechaHora: Date | string;
  movimiento: number | null;
  velocidad: number | null;
};

export type ResultadoDistanciaHistorico = {
  totalDistanciaKm: number;
  acumuladoKmPorId: Map<number, number | null>;
};

export function esCoordenadaValida(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return false;
  }
  if (lat === 0 && lng === 0) {
    return false;
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return false;
  }
  return true;
}

function estaEnMovimiento(
  movimiento: number | null,
  velocidad: number | null,
): boolean {
  return movimiento === 1 || (velocidad != null && velocidad > 0);
}

function debeContarSegmento(
  prev: PuntoHistoricoDistancia,
  curr: PuntoHistoricoDistancia,
  distanciaSegmentoMetros: number,
  umbrales: UmbralesDistanciaHistorico,
): boolean {
  if (distanciaSegmentoMetros > umbrales.saltoMaxMetros) {
    return false;
  }

  const prevMoviendo = estaEnMovimiento(prev.movimiento, prev.velocidad);
  const currMoviendo = estaEnMovimiento(curr.movimiento, curr.velocidad);

  if (
    distanciaSegmentoMetros < umbrales.minSegmentoDetenidoMetros &&
    !prevMoviendo &&
    !currMoviendo
  ) {
    return false;
  }

  return prevMoviendo || currMoviendo;
}

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
 * Espera orden DESC (más reciente primero). Recorre de la posición más antigua
 * hacia la más reciente sin reordenar en memoria cuando `yaOrdenadoDesc` es true.
 */
export function calcularDistanciaHistoricoMonitoreo(
  puntos: PuntoHistoricoDistancia[],
  opciones: OpcionesDistanciaHistorico = {},
): ResultadoDistanciaHistorico {
  const umbrales = opciones.umbrales ?? {
    saltoMaxMetros: MONITOREO_DISTANCIA_DEFAULTS.saltoGpsMetros,
    minSegmentoDetenidoMetros: MONITOREO_DISTANCIA_DEFAULTS.driftDetenidoMetros,
  };
  const acumuladoKmPorId = new Map<number, number | null>();
  const ordenados = opciones.yaOrdenadoDesc
    ? puntos
    : ordenarDescPorFecha(puntos);

  const validos: PuntoHistoricoDistancia[] = [];
  for (const p of ordenados) {
    if (esCoordenadaValida(p.lat, p.lng)) {
      validos.push(p);
      acumuladoKmPorId.set(p.id, 0);
    } else {
      acumuladoKmPorId.set(p.id, null);
    }
  }

  if (validos.length === 0) {
    return { totalDistanciaKm: 0, acumuladoKmPorId };
  }

  // validos[0] = más reciente, validos[n-1] = más antiguo
  acumuladoKmPorId.set(validos[validos.length - 1].id, 0);

  let acumuladoMetros = 0;
  for (let i = validos.length - 2; i >= 0; i--) {
    const older = validos[i + 1];
    const newer = validos[i];
    const segmentoMetros = distanciaMetros(
      { lat: older.lat, lng: older.lng },
      { lat: newer.lat, lng: newer.lng },
    );

    if (debeContarSegmento(older, newer, segmentoMetros, umbrales)) {
      acumuladoMetros += segmentoMetros;
    }

    acumuladoKmPorId.set(newer.id, redondearKm(acumuladoMetros / 1000));
  }

  return {
    totalDistanciaKm: redondearKm(acumuladoMetros / 1000),
    acumuladoKmPorId,
  };
}
