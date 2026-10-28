import { pointInPolygonRing } from 'src/messaging/shared/estado-geocerca.util';
import type { EstadoSalidaGeocerca } from '../dto/salidas-geocerca.dto';

/** Posición cronológica mínima para evaluar transiciones de geocerca. */
export type PosicionCronologicaGeocerca = {
  id: number;
  lat: number;
  lng: number;
  /** `YYYY-MM-DDTHH:mm:ss` (hora de pared, como `Posiciones.FechaHora`). */
  fechaHora: string | null;
};

export type PuntoGeocerca = {
  idPosicion: number;
  fechaHora: string | null;
  lat: number;
  lng: number;
};

export type SalidaGeocercaDetectada = {
  /** Primera posición detectada fuera (fecha de salida). */
  fechaSalida: string | null;
  latSalida: number;
  lngSalida: number;
  ultimaPosicionDentro: PuntoGeocerca | null;
  primeraPosicionFuera: PuntoGeocerca;
  fechaReingreso: string | null;
  /** Primera posición de vuelta dentro de la geocerca (para detalle en mapa). */
  posicionReingreso: PuntoGeocerca | null;
  duracionFueraSegundos: number | null;
  estadoEvento: EstadoSalidaGeocerca;
};

/**
 * Fusiona tramos consecutivos del mismo IMEI (p. ej. cambio de producto/SIM
 * con el mismo dispositivo en `HistoricoInstalaciones`): la serie de
 * posiciones es continua y no debe partirse. No fusiona dispositivos
 * distintos ni tramos del mismo IMEI separados en el tiempo (el dispositivo
 * estuvo fuera de esta instalación entre ambos).
 * Fechas en `YYYY-MM-DD HH:mm:ss` (comparables lexicográficamente).
 */
export function fusionarSegmentosConsecutivos<
  T extends { imei: string; desde: string; hasta: string },
>(segmentos: T[]): T[] {
  const ordenados = [...segmentos].sort(
    (a, b) => a.desde.localeCompare(b.desde) || a.imei.localeCompare(b.imei),
  );
  const resultado: T[] = [];
  for (const seg of ordenados) {
    const ultimo = resultado[resultado.length - 1];
    if (ultimo && ultimo.imei === seg.imei && seg.desde <= ultimo.hasta) {
      if (seg.hasta > ultimo.hasta) {
        ultimo.hasta = seg.hasta;
      }
      // Si el tramo trae vigencia, el tramo fusionado termina en la del último.
      if ('vigenteHasta' in ultimo) {
        (ultimo as Record<string, unknown>).vigenteHasta = (
          seg as Record<string, unknown>
        ).vigenteHasta;
      }
      continue;
    }
    resultado.push({ ...seg });
  }
  return resultado;
}

/** Estado de un punto respecto a UNA geocerca específica (no el Estado global). */
export function estadoRespectoGeocerca(
  lat: unknown,
  lng: unknown,
  ring: Array<[number, number]>,
): 'DENTRO' | 'FUERA' | null {
  if (!esCoordenadaValidaGeocerca(lat, lng)) return null;
  return pointInPolygonRing(Number(lng), Number(lat), ring)
    ? 'DENTRO'
    : 'FUERA';
}

/** Cursor de paginación del recorrido: `fechaHora|idPosicion` en base64url. */
export function codificarCursorRecorrido(
  fechaHora: string,
  idPosicion: number,
): string {
  return Buffer.from(`${fechaHora}|${idPosicion}`, 'utf8').toString(
    'base64url',
  );
}

export function decodificarCursorRecorrido(
  cursor: string,
): { fechaHora: string; idPosicion: number } {
  let texto: string;
  try {
    texto = Buffer.from(cursor, 'base64url').toString('utf8');
  } catch {
    throw new Error('Cursor de paginación inválido');
  }
  const m = texto.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\|(\d+)$/);
  if (!m) {
    throw new Error('Cursor de paginación inválido');
  }
  return { fechaHora: m[1], idPosicion: Number(m[2]) };
}

/** Hueco de transmisión entre posiciones consecutivas (umbral en segundos). */
export type HuecoTransmision = {
  desde: string;
  hasta: string;
  duracionSegundos: number;
};

export function detectarHuecosTransmision(
  posiciones: Array<{ fechaHora: string | null }>,
  umbralSegundos: number,
): HuecoTransmision[] {
  const huecos: HuecoTransmision[] = [];
  for (let i = 1; i < posiciones.length; i++) {
    const desde = posiciones[i - 1].fechaHora;
    const hasta = posiciones[i].fechaHora;
    const dur = duracionSegundosEntre(desde, hasta);
    if (desde && hasta && dur != null && dur > umbralSegundos) {
      huecos.push({ desde, hasta, duracionSegundos: dur });
    }
  }
  return huecos;
}

/** Coordenada evaluable (misma regla que `debeEvaluarGeocerca`). */
export function esCoordenadaValidaGeocerca(
  lat: unknown,
  lng: unknown,
): boolean {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return false;
  if (la === 0 && ln === 0) return false;
  if (Math.abs(la) > 90 || Math.abs(ln) > 180) return false;
  return true;
}

/**
 * Segundos entre dos `fechaHora` de pared (`YYYY-MM-DDTHH:mm:ss`).
 * Se parsean los componentes como UTC solo para la resta: el desfase
 * se cancela porque ambas comparten la misma convención.
 */
export function duracionSegundosEntre(
  desde: string | null,
  hasta: string | null,
): number | null {
  if (!desde || !hasta) return null;
  const a = parseFechaParedMs(desde);
  const b = parseFechaParedMs(hasta);
  if (a == null || b == null) return null;
  const seg = Math.round((b - a) / 1000);
  return seg >= 0 ? seg : null;
}

function parseFechaParedMs(value: string): number | null {
  const m = value.match(
    /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/,
  );
  if (!m) return null;
  return Date.UTC(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6]),
  );
}

function aPunto(p: PosicionCronologicaGeocerca): PuntoGeocerca {
  return {
    idPosicion: p.id,
    fechaHora: p.fechaHora,
    lat: Number(p.lat),
    lng: Number(p.lng),
  };
}

/**
 * Detecta salidas (transiciones DENTRO → FUERA) de una geocerca.
 *
 * - `posiciones` debe venir ordenado ASC por `fechaHora` e `id`
 *   (desempate determinista ante posiciones con la misma fecha/hora).
 * - No genera una salida por cada posición fuera: solo en la transición.
 * - Posiciones duplicadas (misma fecha/hora y coordenadas) e inválidas se ignoran.
 * - Si la primera posición del periodo está fuera, solo se confirma la salida
 *   cuando `posicionAnterior` (última posición previa al periodo) estaba dentro;
 *   sin esa evidencia no se inventa el evento.
 * - La fecha de salida es la primera posición detectada fuera, sin interpolar
 *   el instante exacto de cruce.
 */
export function detectarSalidasGeocerca(args: {
  posiciones: PosicionCronologicaGeocerca[];
  posicionAnterior?: PosicionCronologicaGeocerca | null;
  /** Anillo exterior [lng, lat][] ya extraído con `extractOuterRing`. */
  ring: Array<[number, number]>;
}): SalidaGeocercaDetectada[] {
  const { posiciones, posicionAnterior, ring } = args;
  const salidas: SalidaGeocercaDetectada[] = [];

  const vistos = new Set<string>();
  const validas: PosicionCronologicaGeocerca[] = [];
  for (const p of posiciones) {
    if (!esCoordenadaValidaGeocerca(p.lat, p.lng)) continue;
    const clave = `${p.fechaHora ?? ''}|${Number(p.lat)}|${Number(p.lng)}`;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    validas.push(p);
  }
  if (!validas.length) return salidas;

  let estadoPrevio: boolean | null = null;
  let ultimaDentro: PuntoGeocerca | null = null;

  if (
    posicionAnterior &&
    esCoordenadaValidaGeocerca(posicionAnterior.lat, posicionAnterior.lng)
  ) {
    estadoPrevio = pointInPolygonRing(
      Number(posicionAnterior.lng),
      Number(posicionAnterior.lat),
      ring,
    );
    if (estadoPrevio) {
      ultimaDentro = aPunto(posicionAnterior);
    }
  }

  let salidaAbierta: SalidaGeocercaDetectada | null = null;

  const cerrarConReingreso = (p: PosicionCronologicaGeocerca) => {
    if (!salidaAbierta) return;
    salidaAbierta.fechaReingreso = p.fechaHora;
    salidaAbierta.posicionReingreso = aPunto(p);
    salidaAbierta.duracionFueraSegundos = duracionSegundosEntre(
      salidaAbierta.fechaSalida,
      p.fechaHora,
    );
    salidaAbierta.estadoEvento = 'REINGRESO_DETECTADO';
    salidas.push(salidaAbierta);
    salidaAbierta = null;
  };

  for (const p of validas) {
    const dentro = pointInPolygonRing(Number(p.lng), Number(p.lat), ring);

    if (dentro) {
      if (estadoPrevio === false) {
        cerrarConReingreso(p);
      }
      ultimaDentro = aPunto(p);
    } else if (estadoPrevio === true) {
      // Transición DENTRO → FUERA: única forma de abrir una salida.
      salidaAbierta = {
        fechaSalida: p.fechaHora,
        latSalida: Number(p.lat),
        lngSalida: Number(p.lng),
        ultimaPosicionDentro: ultimaDentro,
        primeraPosicionFuera: aPunto(p),
        fechaReingreso: null,
        posicionReingreso: null,
        duracionFueraSegundos: null,
        estadoEvento: 'SIN_REINGRESO',
      };
    }
    // estadoPrevio === null y fuera → sin evidencia previa, no se confirma.
    // estadoPrevio === false y fuera → sigue fuera, no es una nueva salida.

    estadoPrevio = dentro;
  }

  if (salidaAbierta) {
    salidas.push(salidaAbierta);
  }

  return salidas;
}
