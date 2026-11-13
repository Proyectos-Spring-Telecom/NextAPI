import { EnumCatEventos, nombreCatEvento } from 'src/common/cat-eventos.enum';
import { ETIQUETAS_ESTADO_POSICION } from 'src/incidentes/incidentes-alerta.util';
import { distanciaMetros, redondearKm } from 'src/utils/recorrido.utils';

/**
 * Tramos de operación de una unidad (docs/fis-fiber, ruta del back §2).
 *
 * Regla del semáforo: la unidad está detenida con velocidad menor a 5 km/h o
 * con la ignición apagada; el mismo umbral con que el socket pone `Estado` 0
 * (docs/catalogo-eventos.md), para que la jornada y el semáforo coincidan y el
 * ruido del GPS parado (1–4 km/h) no cuente como movimiento. El día va de 00:00 a 23:59 (hora de pared, la
 * misma de `Posiciones.FechaHora`); un tramo que cruza la medianoche se parte.
 */
export type TipoTramo =
  | 'movimiento'
  | 'detenido_encendido'
  | 'apagado'
  | 'detenido'
  | 'sin_datos';

/** Posición mínima para armar la jornada (orden ASC por fecha). */
export type PuntoOperacion = {
  id: number;
  /** Hora de pared `YYYY-MM-DDTHH:mm:ss`. */
  fechaHora: string;
  lat: number | null;
  lng: number | null;
  velocidad: number | null;
  ignicion: number | null;
  idEvento: number | null;
  estado: number | null;
};

export type TramoOperacion = {
  tipo: TipoTramo;
  inicio: string;
  fin: string;
  min: number;
  km: number;
  velocidadMax: number | null;
  velocidadPromedio: number | null;
  /** Dónde empezó el tramo (última coordenada medida a esa hora). */
  lat: number | null;
  lng: number | null;
};

export type CicloMotor = {
  encendido: string;
  /** null: el motor seguía encendido al terminar el día. */
  apagado: string | null;
  min: number;
  km: number;
  velocidadMax: number | null;
  detenidoEncendidoMin: number;
  sinDatosMin: number;
  /** Venía encendido de antes de las 00:00. */
  continuaDelDiaAnterior: boolean;
};

export type CambioEstado = {
  fechaHora: string;
  estado: number;
  nombre: string | null;
};

export type EventoJornada = {
  fechaHora: string;
  idEvento: number;
  nombre: string | null;
  estado: number | null;
  lat: number | null;
  lng: number | null;
};

export type TiemposJornada = {
  movimientoMin: number;
  detenidoEncendidoMin: number;
  apagadoMin: number;
  /** Detenido en equipos sin ignición (teléfono, reloj). */
  detenidoMin: number;
  sinDatosMin: number;
};

export type ResumenJornada = {
  fecha: string;
  primerEncendido: string | null;
  ultimoApagado: string | null;
  /** El motor venía encendido de antes de las 00:00. */
  encendidoDesdeDiaAnterior: boolean;
  /** El día terminó (o sigue, si es hoy) con el motor encendido. */
  terminaEncendido: boolean;
  primerMovimiento: string | null;
  ultimoMovimiento: string | null;
  /** Del primer encendido al último apagado (o al fin del día). */
  jornadaMin: number;
  km: number;
  horasMotor: number;
  velocidadMax: number | null;
  velocidadPromedio: number | null;
  tiempos: TiemposJornada;
  ciclosMotor: number;
  excesosVelocidad: number;
  posiciones: number;
  /** El equipo reporta ignición (sin ella no hay ciclos de motor). */
  reportaIgnicion: boolean;
};

export type JornadaDia = ResumenJornada & {
  tramos: TramoOperacion[];
  ciclos: CicloMotor[];
  cambiosEstado: CambioEstado[];
  eventos: EventoJornada[];
};

export type OpcionesJornada = {
  /** Fin real del cálculo (ahora, para el día en curso), ms de hora de pared. */
  ahoraMs?: number;
  /** Hueco sin reportes que cuenta como `sin_datos`; por defecto se estima. */
  umbralSinDatosMin?: number;
};

/** Desde esta velocidad la unidad está en movimiento (`Estado` 1 del socket). */
export const VELOCIDAD_MOVIMIENTO_KMH = 5;

/** Mínimo del hueco `sin_datos` cuando se estima con el intervalo del equipo. */
export const UMBRAL_SIN_DATOS_MIN_MINUTOS = 10;
const MS_MIN = 60_000;
const MS_DIA = 86_400_000;

/** Eventos que no se listan en `eventos` (encendido/apagado van en los ciclos). */
const EVENTOS_INFORMATIVOS: ReadonlySet<number> = new Set([
  EnumCatEventos.IGNICION_ON,
  EnumCatEventos.IGNICION_OFF,
  EnumCatEventos.MOVE,
  EnumCatEventos.TRANSMISION,
  EnumCatEventos.CAMERA,
  EnumCatEventos.DISTANCIA,
]);

/** Hora de pared → ms (se trata como UTC para no depender del TZ del proceso). */
export function msDeFecha(fecha: string): number {
  const m = fecha.match(/^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})/);
  if (!m) return Number.NaN;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
}

export function fechaDeMs(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19);
}

/** Días `YYYY-MM-DD` del periodo, inclusive. */
export function diasDelPeriodo(desde: string, hasta: string): string[] {
  const ini = msDeFecha(`${desde}T00:00:00`);
  const fin = msDeFecha(`${hasta}T00:00:00`);
  const dias: string[] = [];
  for (let ms = ini; ms <= fin; ms += MS_DIA) dias.push(fechaDeMs(ms).slice(0, 10));
  return dias;
}

function medida(p: PuntoOperacion): boolean {
  return (
    p.lat != null &&
    p.lng != null &&
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    !(p.lat === 0 && p.lng === 0)
  );
}

/** Ignición del punto; sin dato, la de los eventos 1/2; sin ellos, null. */
function ignicionDe(p: PuntoOperacion): number | null {
  if (p.ignicion === 0 || p.ignicion === 1) return p.ignicion;
  if (p.idEvento === EnumCatEventos.IGNICION_ON) return 1;
  if (p.idEvento === EnumCatEventos.IGNICION_OFF) return 0;
  return null;
}

/** Tipo de tramo con la regla del semáforo. */
export function clasificar(velocidad: number | null, ignicion: number | null): TipoTramo {
  if (ignicion === 0) return 'apagado';
  if ((velocidad ?? 0) >= VELOCIDAD_MOVIMIENTO_KMH) return 'movimiento';
  return ignicion === 1 ? 'detenido_encendido' : 'detenido';
}

/**
 * Hueco sin reportes que cuenta como `sin_datos`: el doble de la mediana del
 * intervalo de reporte con el motor encendido, nunca menos de 10 min.
 */
export function estimarUmbralSinDatos(puntos: readonly PuntoOperacion[]): number {
  const intervalos: number[] = [];
  for (let i = 1; i < puntos.length; i++) {
    if (ignicionDe(puntos[i - 1]) === 0) continue;
    const d =
      (msDeFecha(puntos[i].fechaHora) - msDeFecha(puntos[i - 1].fechaHora)) / MS_MIN;
    if (d > 0) intervalos.push(d);
  }
  if (intervalos.length < 3) return UMBRAL_SIN_DATOS_MIN_MINUTOS;
  intervalos.sort((a, b) => a - b);
  const mediana = intervalos[Math.floor(intervalos.length / 2)];
  return Math.max(UMBRAL_SIN_DATOS_MIN_MINUTOS, 2 * mediana);
}

type Intervalo = {
  tipo: TipoTramo;
  ini: number;
  fin: number;
  km: number;
  velocidad: number | null;
  lat: number | null;
  lng: number | null;
};

/**
 * Línea de tiempo continua de `desdeMs` a `hastaMs`. Cada posición manda
 * hasta la siguiente; si entre ellas hay un hueco mayor al umbral y la unidad
 * no estaba apagada, ese lapso es `sin_datos`. Apagada, el equipo reporta
 * espaciado (p. ej. cada 2 h) y el hueco sigue contando como apagado.
 */
function lineaDeTiempo(
  puntos: readonly PuntoOperacion[],
  desdeMs: number,
  hastaMs: number,
  umbralMs: number,
): Intervalo[] {
  const salida: Intervalo[] = [];
  let ign: number | null = null;
  let ultimaLat: number | null = null;
  let ultimaLng: number | null = null;
  let previa: { tipo: TipoTramo; ms: number; p: PuntoOperacion } | null = null;

  const agregar = (iv: Intervalo) => {
    const ini = Math.max(iv.ini, desdeMs);
    const fin = Math.min(iv.fin, hastaMs);
    if (fin <= ini) return;
    // Km proporcional a la parte que cae en el periodo.
    const km = iv.fin > iv.ini ? (iv.km * (fin - ini)) / (iv.fin - iv.ini) : 0;
    salida.push({ ...iv, ini, fin, km });
  };

  let cerrada = false;
  for (const p of puntos) {
    const ms = msDeFecha(p.fechaHora);
    if (!Number.isFinite(ms)) continue;
    // La primera posición después del periodo cierra el último tramo con la
    // misma regla que verá el día siguiente; las demás ya no cuentan.
    if (ms > hastaMs && (!previa || cerrada)) break;
    if (ms > hastaMs) cerrada = true;
    const ignP = ignicionDe(p);
    if (ignP != null) ign = ignP;

    if (previa) {
      const hueco = ms - previa.ms;
      const km =
        medida(previa.p) && medida(p)
          ? distanciaMetros(
              { lat: previa.p.lat as number, lng: previa.p.lng as number },
              { lat: p.lat as number, lng: p.lng as number },
            ) / 1000
          : 0;
      const tipo =
        hueco > umbralMs && previa.tipo !== 'apagado' ? 'sin_datos' : previa.tipo;
      agregar({
        tipo,
        ini: previa.ms,
        fin: ms,
        km,
        velocidad: previa.p.velocidad,
        lat: ultimaLat,
        lng: ultimaLng,
      });
    } else if (ms > desdeMs) {
      // Antes de la primera posición: apagado si así amaneció; si no, sin datos.
      const tipo = clasificar(p.velocidad, ign);
      agregar({
        tipo: tipo === 'apagado' ? 'apagado' : 'sin_datos',
        ini: desdeMs,
        fin: ms,
        km: 0,
        velocidad: null,
        lat: null,
        lng: null,
      });
    }

    if (medida(p)) {
      ultimaLat = p.lat;
      ultimaLng = p.lng;
    }
    previa = { tipo: clasificar(p.velocidad, ign), ms, p };
  }

  if (cerrada) return salida;
  if (previa && previa.ms < hastaMs) {
    const tipo =
      previa.tipo === 'apagado' || hastaMs - previa.ms <= umbralMs
        ? previa.tipo
        : 'sin_datos';
    agregar({
      tipo,
      ini: previa.ms,
      fin: hastaMs,
      km: 0,
      velocidad: previa.p.velocidad,
      lat: ultimaLat,
      lng: ultimaLng,
    });
  } else if (!previa) {
    agregar({
      tipo: 'sin_datos',
      ini: desdeMs,
      fin: hastaMs,
      km: 0,
      velocidad: null,
      lat: null,
      lng: null,
    });
  }
  return salida;
}

const redondearMin = (ms: number) => Math.round((ms / MS_MIN) * 10) / 10;

/** Une intervalos consecutivos del mismo tipo. */
function unirTramos(intervalos: readonly Intervalo[]): TramoOperacion[] {
  type Acumulado = Omit<Intervalo, 'velocidad'> & { velocidades: number[] };
  const acumulados: Acumulado[] = [];
  for (const { velocidad, ...iv } of intervalos) {
    const vel =
      velocidad != null && velocidad >= VELOCIDAD_MOVIMIENTO_KMH ? [velocidad] : [];
    const ultimo = acumulados[acumulados.length - 1];
    if (ultimo && ultimo.tipo === iv.tipo && ultimo.fin === iv.ini) {
      ultimo.fin = iv.fin;
      ultimo.km += iv.km;
      ultimo.velocidades.push(...vel);
    } else {
      acumulados.push({ ...iv, velocidades: vel });
    }
  }
  return acumulados.map(({ tipo, ini, fin, km, velocidades, lat, lng }) => ({
    tipo,
    inicio: fechaDeMs(ini),
    fin: fechaDeMs(fin),
    min: redondearMin(fin - ini),
    km: redondearKm(km),
    velocidadMax: velocidades.length ? Math.max(...velocidades) : null,
    velocidadPromedio: velocidades.length
      ? Math.round(velocidades.reduce((x, y) => x + y, 0) / velocidades.length)
      : null,
    lat,
    lng,
  }));
}

const ENCENDIDO: ReadonlySet<TipoTramo> = new Set(['movimiento', 'detenido_encendido']);

/**
 * Ciclos de motor: tramos encendidos seguidos; un hueco `sin_datos` entre dos
 * tramos encendidos queda dentro del ciclo. El ciclo cierra al empezar un
 * tramo apagado.
 */
function ciclosDeMotor(
  tramos: readonly TramoOperacion[],
  inicioDia: string,
): CicloMotor[] {
  const ciclos: CicloMotor[] = [];
  let actual:
    | (CicloMotor & { pendienteSinDatos: number; finUltimoEncendido: string })
    | null = null;
  const cerrar = (apagado: string | null) => {
    if (!actual) return;
    const { pendienteSinDatos: _p, finUltimoEncendido, ...c } = actual;
    const fin = apagado ?? finUltimoEncendido;
    ciclos.push({
      ...c,
      apagado,
      min: redondearMin(msDeFecha(fin) - msDeFecha(c.encendido)),
      km: redondearKm(c.km),
    });
    actual = null;
  };

  for (const t of tramos) {
    if (ENCENDIDO.has(t.tipo)) {
      if (!actual) {
        actual = {
          encendido: t.inicio,
          apagado: null,
          min: 0,
          km: 0,
          velocidadMax: null,
          detenidoEncendidoMin: 0,
          sinDatosMin: 0,
          continuaDelDiaAnterior: t.inicio === inicioDia,
          pendienteSinDatos: 0,
          finUltimoEncendido: t.fin,
        };
      }
      actual.sinDatosMin += actual.pendienteSinDatos;
      actual.pendienteSinDatos = 0;
      actual.km += t.km;
      actual.finUltimoEncendido = t.fin;
      if (t.velocidadMax != null) {
        actual.velocidadMax = Math.max(actual.velocidadMax ?? 0, t.velocidadMax);
      }
      if (t.tipo === 'detenido_encendido') actual.detenidoEncendidoMin += t.min;
    } else if (t.tipo === 'sin_datos' && actual) {
      actual.pendienteSinDatos += t.min;
    } else if (t.tipo === 'apagado') {
      cerrar(t.inicio);
    }
  }
  cerrar(null);
  return ciclos.map((c) => ({
    ...c,
    detenidoEncendidoMin: Math.round(c.detenidoEncendidoMin * 10) / 10,
    sinDatosMin: Math.round(c.sinDatosMin * 10) / 10,
  }));
}

/**
 * Jornada de un día. `puntos` va en orden ASC y puede incluir posiciones
 * anteriores al día (la última de ellas dice cómo amaneció la unidad).
 */
export function armarJornada(
  dia: string,
  puntos: readonly PuntoOperacion[],
  opciones: OpcionesJornada = {},
): JornadaDia {
  const inicioMs = msDeFecha(`${dia}T00:00:00`);
  const finDiaMs = inicioMs + MS_DIA;
  const hastaMs = Math.min(finDiaMs, opciones.ahoraMs ?? finDiaMs);
  const delDia = puntos.filter((p) => {
    const ms = msDeFecha(p.fechaHora);
    return ms >= inicioMs && ms < finDiaMs;
  });
  const umbralMin = opciones.umbralSinDatosMin ?? estimarUmbralSinDatos(puntos);

  const tramos =
    hastaMs > inicioMs
      ? unirTramos(lineaDeTiempo(puntos, inicioMs, hastaMs, umbralMin * MS_MIN))
      : [];
  const inicioDia = fechaDeMs(inicioMs);
  // Sin ignición (teléfono, reloj) el movimiento no dice nada del motor.
  const reportaIgnicion = puntos.some((p) => ignicionDe(p) != null);
  const ciclos = reportaIgnicion ? ciclosDeMotor(tramos, inicioDia) : [];

  const tiempos: TiemposJornada = {
    movimientoMin: 0,
    detenidoEncendidoMin: 0,
    apagadoMin: 0,
    detenidoMin: 0,
    sinDatosMin: 0,
  };
  const claveTiempo: Record<TipoTramo, keyof TiemposJornada> = {
    movimiento: 'movimientoMin',
    detenido_encendido: 'detenidoEncendidoMin',
    apagado: 'apagadoMin',
    detenido: 'detenidoMin',
    sin_datos: 'sinDatosMin',
  };
  let kmExacto = 0;
  for (const t of tramos) {
    tiempos[claveTiempo[t.tipo]] += t.min;
    kmExacto += t.km;
  }
  for (const k of Object.keys(tiempos) as Array<keyof TiemposJornada>) {
    tiempos[k] = Math.round(tiempos[k] * 10) / 10;
  }

  const velocidades = delDia
    .map((p) => p.velocidad)
    .filter((v): v is number => v != null && v >= VELOCIDAD_MOVIMIENTO_KMH);
  const movimientos = tramos.filter((t) => t.tipo === 'movimiento');
  const primero = ciclos[0];
  const ultimo = ciclos[ciclos.length - 1];
  const terminaEncendido = ultimo != null && ultimo.apagado == null;
  const finJornada = ultimo ? (ultimo.apagado ?? fechaDeMs(hastaMs)) : null;

  // Cambios de estado: contra el estado con que amaneció (última posición previa).
  const previos = puntos.filter((p) => msDeFecha(p.fechaHora) < inicioMs);
  let estadoPrevio: number | null = previos.length
    ? previos[previos.length - 1].estado
    : null;
  const cambiosEstado: CambioEstado[] = [];
  for (const p of delDia) {
    if (p.estado == null || p.estado === estadoPrevio) continue;
    cambiosEstado.push({
      fechaHora: p.fechaHora,
      estado: p.estado,
      nombre: ETIQUETAS_ESTADO_POSICION[p.estado] ?? null,
    });
    estadoPrevio = p.estado;
  }

  const eventos: EventoJornada[] = delDia
    .filter((p) => p.idEvento != null && !EVENTOS_INFORMATIVOS.has(p.idEvento))
    .map((p) => ({
      fechaHora: p.fechaHora,
      idEvento: p.idEvento as number,
      nombre: nombreCatEvento(p.idEvento),
      estado: p.estado,
      lat: medida(p) ? p.lat : null,
      lng: medida(p) ? p.lng : null,
    }));

  return {
    fecha: dia,
    primerEncendido: primero?.encendido ?? null,
    ultimoApagado: terminaEncendido ? null : (ultimo?.apagado ?? null),
    encendidoDesdeDiaAnterior: primero?.continuaDelDiaAnterior ?? false,
    terminaEncendido,
    primerMovimiento: movimientos[0]?.inicio ?? null,
    ultimoMovimiento: movimientos.length ? movimientos[movimientos.length - 1].fin : null,
    jornadaMin:
      primero && finJornada
        ? redondearMin(msDeFecha(finJornada) - msDeFecha(primero.encendido))
        : 0,
    km: redondearKm(kmExacto),
    horasMotor: reportaIgnicion
      ? Math.round(((tiempos.movimientoMin + tiempos.detenidoEncendidoMin) / 60) * 100) /
        100
      : 0,
    velocidadMax: velocidades.length ? Math.max(...velocidades) : null,
    velocidadPromedio: velocidades.length
      ? Math.round(velocidades.reduce((a, b) => a + b, 0) / velocidades.length)
      : null,
    tiempos,
    ciclosMotor: ciclos.length,
    excesosVelocidad: delDia.filter((p) => p.idEvento === EnumCatEventos.SPEED).length,
    posiciones: delDia.length,
    reportaIgnicion,
    tramos,
    ciclos,
    cambiosEstado,
    eventos,
  };
}

/** La jornada sin listas (flota del día, `incluirJornada`). */
export function resumenDeJornada(j: JornadaDia): ResumenJornada {
  const { tramos: _t, ciclos: _c, cambiosEstado: _ce, eventos: _e, ...resumen } = j;
  return resumen;
}
