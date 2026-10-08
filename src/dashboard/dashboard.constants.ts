import { EnumRoles } from 'src/common/estatus.enum';

/** Roles con `vista: 'operacion'`; cualquier otro rol recibe `vista: 'cliente'`. */
export const ROLES_DASHBOARD_OPERACION: readonly number[] = [
  EnumRoles.SA,
  EnumRoles.DEV,
  EnumRoles.ADMIN,
  EnumRoles.JEFE_MONITOREO,
  EnumRoles.MONITOREO,
];

/** Reportó en los últimos 60 min = en línea */
export const MIN_EN_LINEA = 60;
/** Sin UltimaPosicion o más de 24 h = sin reporte */
export const HORAS_SIN_REPORTE = 24;
/** > 8 km/h o Estado = 1 = en movimiento */
export const VELOCIDAD_MOVIMIENTO = 8;
/** > 90 km/h = exceso de velocidad */
export const VELOCIDAD_EXCESO = 90;

export const DIAS_LOGIN_ACTIVO = 7;
/** Hoy + 6 anteriores */
export const DIAS_ALERTAS = 7;

/** Valores de `Estado` que ya genera el sistema: pánico, puerta, batería, energía, ADAS, DSM, conducción. */
export const ESTADOS_ALERTA: readonly number[] = [2, 3, 9, 10, 12, 13, 14];

export const TOP_CLIENTES = 5;
export const TOP_EXCESOS = 5;
export const ULTIMAS_INSTALACIONES = 5;
export const ULTIMAS_INSTALACIONES_CLIENTE = 15;
export const TOP_SIN_REPORTE = 10;
export const LOTE_IMEIS = 300;

export const CACHE_MS = 60_000;
export const CACHE_ALERTAS_MS = 300_000;
