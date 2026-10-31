import { BadRequestException } from '@nestjs/common';

/**
 * Comandos de la TrackCam (JT808, gateway springTrackCam). `PARAMS` escribe
 * parámetros con 0x8103 y el gateway confirma releyéndolos (0x8104);
 * `LEERPARAMS` solo los lee. Lo leído regresa en el ack (`resultado`).
 */

export type TipoComandoJt808 = 'PARAMS' | 'LEERPARAMS';

export interface ComandoJt808 {
  tipo: TipoComandoJt808;
  contenido: string;
}

export interface ParametroTrackCam {
  /** Id JT808 (tabla 10 de JT/T 808), DWORD. */
  id: number;
  etiqueta: string;
  unidad?: string;
  min: number;
  max: number;
}

/**
 * Lo que la consola puede cambiar. Fuera a propósito: heartbeat, alarmas con
 * foto, servidor, APN y puertos (los mantiene el perfil del gateway; un error
 * deja a la cámara sin conexión), máscaras de alarma, fotos programadas y el
 * odómetro (cambia solo y no se puede verificar releyendo). El gateway tiene
 * la misma lista (`PARAMETROS_PERMITIDOS` en springTrackCam) y rechaza el resto.
 */
export const PARAMETROS_TRACKCAM = {
  intervaloReporteSegundos: { id: 0x0029, etiqueta: 'Intervalo de reporte con motor encendido', unidad: 's', min: 5, max: 3600 },
  intervaloReposoSegundos: { id: 0x0027, etiqueta: 'Intervalo de reporte con motor apagado', unidad: 's', min: 30, max: 86400 },
  intervaloEmergenciaSegundos: { id: 0x0028, etiqueta: 'Intervalo de reporte en emergencia', unidad: 's', min: 5, max: 3600 },
  estrategiaReporte: { id: 0x0020, etiqueta: 'Estrategia de reporte (0 tiempo, 1 distancia, 2 ambos)', min: 0, max: 2 },
  distanciaReporteMetros: { id: 0x002c, etiqueta: 'Distancia de reporte', unidad: 'm', min: 50, max: 100000 },
  anguloGiroGrados: { id: 0x0030, etiqueta: 'Ángulo de giro que manda reporte', unidad: '°', min: 0, max: 180 },
  velocidadMaximaKmh: { id: 0x0055, etiqueta: 'Velocidad máxima', unidad: 'km/h', min: 0, max: 250 },
  duracionExcesoSegundos: { id: 0x0056, etiqueta: 'Duración del exceso de velocidad antes de la alarma', unidad: 's', min: 0, max: 3600 },
  conduccionContinuaSegundos: { id: 0x0057, etiqueta: 'Conducción continua máxima', unidad: 's', min: 0, max: 86400 },
  conduccionDiariaSegundos: { id: 0x0058, etiqueta: 'Conducción acumulada máxima por día', unidad: 's', min: 0, max: 86400 },
  descansoMinimoSegundos: { id: 0x0059, etiqueta: 'Descanso mínimo', unidad: 's', min: 0, max: 86400 },
  estacionamientoMaximoSegundos: { id: 0x005a, etiqueta: 'Estacionamiento máximo', unidad: 's', min: 0, max: 86400 },
} as const satisfies Record<string, ParametroTrackCam>;

export type NombreParametroTrackCam = keyof typeof PARAMETROS_TRACKCAM;
export const NOMBRES_PARAMETROS_TRACKCAM = Object.keys(PARAMETROS_TRACKCAM) as NombreParametroTrackCam[];

/** `0x0029` (llave de Deseado/Leido y del ack). */
export const hexParametro = (id: number) => `0x${id.toString(16).padStart(4, '0')}`;

/** `PARAMS,0029=30,0027=600` con los valores enviados (validados contra el catálogo). */
export function comandoParametros(valores: Partial<Record<NombreParametroTrackCam, number>>): ComandoJt808 {
  const partes: string[] = [];
  for (const nombre of NOMBRES_PARAMETROS_TRACKCAM) {
    const v = valores[nombre];
    if (v === undefined) continue;
    const p: ParametroTrackCam = PARAMETROS_TRACKCAM[nombre];
    if (!Number.isInteger(v) || v < p.min || v > p.max) {
      throw new BadRequestException(`${nombre}: entero entre ${p.min} y ${p.max}`);
    }
    partes.push(`${p.id.toString(16).padStart(4, '0')}=${v}`);
  }
  if (!partes.length) throw new BadRequestException('Envía al menos un parámetro');
  return { tipo: 'PARAMS', contenido: `PARAMS,${partes.join(',')}` };
}

export function comandoLeerParametros(): ComandoJt808 {
  return { tipo: 'LEERPARAMS', contenido: 'LEERPARAMS' };
}

/** `{ "0x0029": 30 }` → `{ intervaloReporteSegundos: 30 }` (solo los del catálogo). */
export function porNombre(valores: Record<string, unknown> | null | undefined): Partial<Record<NombreParametroTrackCam, number>> {
  const r: Partial<Record<NombreParametroTrackCam, number>> = {};
  if (!valores) return r;
  for (const nombre of NOMBRES_PARAMETROS_TRACKCAM) {
    const v = valores[hexParametro(PARAMETROS_TRACKCAM[nombre].id)];
    if (typeof v === 'number') r[nombre] = v;
  }
  return r;
}
