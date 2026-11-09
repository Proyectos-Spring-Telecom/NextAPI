import { BadRequestException } from '@nestjs/common';

/**
 * Comandos de la app de rastreo en teléfonos (springTrackPhone,
 * `src/comandos/comandos.ts` del socket). El socket los entrega en la
 * respuesta del siguiente lote del teléfono y confirma con la respuesta de
 * la app.
 */

export type TipoComandoPhone = 'INTERVALO' | 'UBICAR' | 'ESTADO' | 'SMS';

export interface ComandoPhone {
  tipo: TipoComandoPhone;
  contenido: string;
}

const TELEFONO_RE = /^\+?\d{10,15}$/;

/** Intervalo de reporte, 30–3600 s. */
export function comandoIntervaloPhone(segundos: number): ComandoPhone {
  const s = Number(segundos);
  if (!Number.isInteger(s) || s < 30 || s > 3600) {
    throw new BadRequestException('El intervalo del teléfono va de 30 a 3600 segundos');
  }
  return { tipo: 'INTERVALO', contenido: `INTERVALO,${s}` };
}

/** El teléfono toma un fix de GPS en ese momento y lo reporta. */
export function comandoUbicar(): ComandoPhone {
  return { tipo: 'UBICAR', contenido: 'UBICAR' };
}

/** Permisos, batería, GPS activo, optimización de batería y versión (en el resultado del ack). */
export function comandoEstado(): ComandoPhone {
  return { tipo: 'ESTADO', contenido: 'ESTADO' };
}

/** PIN (4–8 dígitos) y números autorizados (hasta 5) del respaldo por SMS. null = sin cambio. */
export function comandoSms(pin: string | null | undefined, numeros: readonly string[] | null | undefined): ComandoPhone {
  const p = pin == null ? null : String(pin).trim();
  if (p !== null && !/^\d{4,8}$/.test(p)) throw new BadRequestException('El PIN de SMS es de 4 a 8 dígitos');
  const n = numeros == null ? null : numeros.map((x) => String(x).replace(/[\s-]/g, ''));
  if (n !== null && (n.length > 5 || n.some((x) => !TELEFONO_RE.test(x)))) {
    throw new BadRequestException('Hasta 5 números autorizados de 10 a 15 dígitos');
  }
  if (p === null && n === null) throw new BadRequestException('Envía pin o numeros');
  return { tipo: 'SMS', contenido: `SMS,${p ?? '-'},${n === null ? '-' : n.join(';')}` };
}
