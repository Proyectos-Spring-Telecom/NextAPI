import { SetMetadata } from '@nestjs/common';

export const ACEPTA_LLAVE_API = 'aceptaLlaveApi';

/**
 * La ruta acepta `X-Api-Key` además del JWT (con `JwtOLlaveApiGuard`). Solo
 * para rutas de solo lectura: la llave actúa como usuario Cliente (rol 6).
 */
export const AceptaLlaveApi = () => SetMetadata(ACEPTA_LLAVE_API, true);
