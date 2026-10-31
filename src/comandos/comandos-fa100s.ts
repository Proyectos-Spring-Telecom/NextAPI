import { BadRequestException } from '@nestjs/common';

/**
 * Comandos del reloj FA100S (protocolo v2, docs del proveedor en springFA100S).
 * Cada función arma el cuerpo sin corchetes; el socket agrega `[3G*id*len*…]`
 * y confirma cuando el reloj responde con la misma palabra.
 */

export type TipoComandoFa100s = 'SOS' | 'CENTER' | 'PHB' | 'PHB2' | 'PHB3' | 'FALLDOWN' | 'LSSET' | 'UPLOAD';

export interface ComandoFa100s {
  tipo: TipoComandoFa100s;
  contenido: string;
}

/** Máximo de la sensibilidad de caída que reporta el reloj (LS=actual+máximo). */
export const SENSIBILIDAD_CAIDA_MAXIMA = 6;

const TELEFONO_RE = /^\+?\d{3,20}$/;

function telefono(valor: string, campo: string): string {
  const t = String(valor ?? '').replace(/[\s-]/g, '');
  if (!TELEFONO_RE.test(t)) {
    throw new BadRequestException(`${campo}: teléfono inválido (${valor}); solo dígitos, opcional "+", hasta 20`);
  }
  return t;
}

/** Nombre de la agenda en Unicode (UTF-16 en hex, 4 dígitos por carácter), hasta 10 caracteres. */
export function nombreUnicode(nombre: string): string {
  const texto = String(nombre ?? '').trim();
  if (!texto) throw new BadRequestException('Cada contacto de la agenda necesita nombre');
  if ([...texto].length > 10) throw new BadRequestException(`El nombre "${texto}" pasa de 10 caracteres`);
  let hex = '';
  for (let i = 0; i < texto.length; i++) hex += texto.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0');
  return hex;
}

/** Los tres números SOS en un comando: el reloj marca en ese orden. Vacíos se mandan vacíos. */
export function comandoSos(numeros: readonly string[]): ComandoFa100s {
  if (numeros.length > 3) throw new BadRequestException('El reloj acepta hasta 3 números SOS');
  const tres = [0, 1, 2].map((i) => (numeros[i] ? telefono(numeros[i], `SOS ${i + 1}`) : ''));
  return { tipo: 'SOS', contenido: `SOS,${tres.join(',')}` };
}

/** Número del centro (recibe los SMS del reloj). */
export function comandoCentro(numero: string): ComandoFa100s {
  return { tipo: 'CENTER', contenido: `CENTER,${telefono(numero, 'Centro')}` };
}

/** Agenda de hasta 15: PHB (1–5), PHB2 (6–10), PHB3 (11–15). Un bloque vacío borra esos lugares. */
export function comandosAgenda(contactos: ReadonlyArray<{ nombre: string; telefono: string }>): ComandoFa100s[] {
  if (contactos.length > 15) throw new BadRequestException('La agenda del reloj acepta hasta 15 contactos');
  const bloques: TipoComandoFa100s[] = ['PHB', 'PHB2', 'PHB3'];
  return bloques.map((tipo, b) => {
    const parte = contactos.slice(b * 5, b * 5 + 5);
    const pares = parte.map((c, i) => `${telefono(c.telefono, `Agenda ${b * 5 + i + 1}`)},${nombreUnicode(c.nombre)}`);
    return { tipo, contenido: pares.length ? `${tipo},${pares.join(',')}` : tipo };
  });
}

/** Caída: detección encendida/apagada y llamada al detectarla. */
export function comandoCaida(deteccion: boolean, llamada: boolean): ComandoFa100s {
  return { tipo: 'FALLDOWN', contenido: `FALLDOWN,${deteccion ? 1 : 0},${llamada ? 1 : 0}` };
}

/** Sensibilidad de caída: 1 (más sensible) a 6; mayor número = menos sensible. */
export function comandoSensibilidad(valor: number): ComandoFa100s {
  const v = Number(valor);
  if (!Number.isInteger(v) || v < 1 || v > SENSIBILIDAD_CAIDA_MAXIMA) {
    throw new BadRequestException(`La sensibilidad de caída va de 1 a ${SENSIBILIDAD_CAIDA_MAXIMA}`);
  }
  return { tipo: 'LSSET', contenido: `LSSET,${v}+${SENSIBILIDAD_CAIDA_MAXIMA}` };
}

/** Intervalo de reporte en movimiento, en segundos (el reloj no reporta detenido). */
export function comandoIntervalo(segundos: number): ComandoFa100s {
  const s = Number(segundos);
  if (!Number.isInteger(s) || s < 60 || s > 86400) {
    throw new BadRequestException('El intervalo de reporte va de 60 a 86400 segundos');
  }
  return { tipo: 'UPLOAD', contenido: `UPLOAD,${s}` };
}
