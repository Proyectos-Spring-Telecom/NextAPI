/**
 * Reglas del paro de motor (docs/fis-fiber, ruta del back §3.10). Puras, para
 * probarlas sin base ni cola.
 */
export type AccionInmovilizador = 'paro' | 'reanudar';

export const TIPO_COMANDO: Record<AccionInmovilizador, string> = {
  paro: 'PARO_MOTOR',
  reanudar: 'REANUDAR_MOTOR',
};

/**
 * `INMOVILIZADOR_CLASES` ("GPS:jimi,TRACKGAS:jimi"): qué clase de equipo tiene
 * relevador de corte y a qué socket va el comando. Vacío = nadie.
 */
export function parseClasesInmovilizador(raw: string | undefined): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const parte of (raw ?? '').split(',')) {
    const [clase, protocolo] = parte.split(':').map((x) => x?.trim());
    if (clase && protocolo && /^[a-z0-9_-]+$/i.test(protocolo))
      mapa.set(clase.toUpperCase(), protocolo.toLowerCase());
  }
  return mapa;
}

/**
 * Motivo por el que NO se puede mandar un paro, o null si se puede: la última
 * posición debe ser reciente y con la unidad casi detenida (un corte en
 * marcha es peligroso). Reanudar no tiene restricción.
 */
export function bloqueoParo(args: {
  accion: AccionInmovilizador;
  velocidad: number | null;
  fechaPosicionMs: number | null;
  ahoraMs: number;
  velocidadMax: number;
  antiguedadMaxMin: number;
}): string | null {
  if (args.accion === 'reanudar') return null;
  if (args.fechaPosicionMs == null || !Number.isFinite(args.fechaPosicionMs)) {
    return 'La unidad no tiene posición: no se puede confirmar que esté detenida';
  }
  const minutos = (args.ahoraMs - args.fechaPosicionMs) / 60_000;
  if (minutos > args.antiguedadMaxMin) {
    return `La última posición es de hace ${Math.round(minutos)} min: no se puede confirmar que esté detenida (máximo ${args.antiguedadMaxMin} min)`;
  }
  if ((args.velocidad ?? 0) >= args.velocidadMax) {
    return `La unidad va a ${args.velocidad} km/h: el paro solo se manda con la unidad detenida (menos de ${args.velocidadMax} km/h)`;
  }
  return null;
}
