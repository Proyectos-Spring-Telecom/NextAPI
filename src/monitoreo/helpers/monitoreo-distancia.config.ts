import { ConfigService } from '@nestjs/config';

export const MONITOREO_DISTANCIA_ENV = {
  saltoGpsMetros: 'MONITOREO_SALTO_GPS_METROS',
  driftDetenidoMetros: 'MONITOREO_DRIFT_DETENIDO_METROS',
} as const;

export const MONITOREO_DISTANCIA_DEFAULTS = {
  saltoGpsMetros: 5000,
  driftDetenidoMetros: 20,
} as const;

export type UmbralesDistanciaHistorico = {
  saltoMaxMetros: number;
  minSegmentoDetenidoMetros: number;
};

export function resolveUmbralesDistanciaHistorico(
  config?: ConfigService,
): UmbralesDistanciaHistorico {
  return {
    saltoMaxMetros: Number(
      config?.get<number>(MONITOREO_DISTANCIA_ENV.saltoGpsMetros) ??
        MONITOREO_DISTANCIA_DEFAULTS.saltoGpsMetros,
    ),
    minSegmentoDetenidoMetros: Number(
      config?.get<number>(MONITOREO_DISTANCIA_ENV.driftDetenidoMetros) ??
        MONITOREO_DISTANCIA_DEFAULTS.driftDetenidoMetros,
    ),
  };
}
