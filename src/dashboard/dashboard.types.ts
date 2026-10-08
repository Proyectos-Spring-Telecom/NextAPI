export interface DashboardAlcance {
  rol: number;
  clientes: number;
  unidades: number;
}

export interface DashboardHero {
  /** Instalaciones visibles con Estatus = 1 */
  instalacionesActivas: number;
  /** Clientes distintos de esas instalaciones */
  clientes: number;
  /** Instalaciones visibles cuyo producto no es inmueble y tienen dispositivo con IMEI */
  unidadesGps: number;
  /** unidadesGps con UltimaPosicion.FechaHora >= ahora − MIN_EN_LINEA */
  enLinea: number;
  /** unidadesGps sin UltimaPosicion o con FechaHora < ahora − HORAS_SIN_REPORTE */
  sinReporte: number;
  /** Instalaciones visibles de producto inmueble con PanelAlarma */
  paneles: number;
}

export type DashboardTotalClave = 'clientes' | 'usuarios';

export interface DashboardTotalExtra {
  etiqueta: string;
  valor: number;
}

export interface DashboardTotal {
  clave: DashboardTotalClave;
  etiqueta: string;
  valor: number;
  destacado: number;
  detalle: string;
  /** destacado / valor × 100, entero 0–100 (0 si valor = 0) */
  porcentaje: number;
  /**
   * clientes: Con unidades activas · Con vehículos · Con paneles · Con activos · Con teléfonos (se omiten los 0)
   * usuarios: Activos · Inactivos · un elemento por rol con usuarios activos (desc)
   */
  extras: DashboardTotalExtra[];
}

export type DashboardCategoriaEquipo =
  | 'vehiculos'
  | 'paneles'
  | 'activos'
  | 'telefonos';

export interface DashboardEquipo {
  categoria: DashboardCategoriaEquipo;
  /** 'Vehículos' | 'Paneles' | 'Activos' | 'Teléfonos' */
  etiqueta: string;
  /** Instalaciones activas de esa categoría */
  total: number;
  /** vehiculos/activos/telefonos: en movimiento ahora · paneles: en línea */
  activos: number;
  /** 'en movimiento' | 'en línea' */
  activosTexto: string;
}

export interface DashboardEstadoMovimiento {
  categoria: DashboardCategoriaEquipo;
  etiqueta: string;
  total: number;
  /** Paneles: en línea */
  movimiento: number;
  exceso: number;
  detenido: number;
  detenido30: number;
  detenido60: number;
  detenido90: number;
  /** Paneles: fuera de línea */
  sinReporte: number;
}

export interface DashboardExcesoDia {
  fecha: string;
  reportes: number;
  unidades: number;
}

export interface DashboardExcesoTop {
  idInstalacion: number;
  unidad: string;
  cliente: string;
  velocidadMax: number;
  reportes: number;
}

export type DashboardUnidadEstado = 'movimiento' | 'detenida' | 'sinReporte';

export interface DashboardUnidadAhora {
  estado: DashboardUnidadEstado;
  etiqueta: string;
  total: number;
}

export interface DashboardAlertaDia {
  fecha: string;
  total: number;
}

export interface DashboardProductoTipo {
  idTipoProducto: number;
  tipo: string;
  total: number;
}

export interface DashboardDispositivoTipo {
  idTipoDispositivo: number;
  tipo: string;
  total: number;
}

export interface DashboardUnidadCliente {
  idCliente: number;
  cliente: string;
  total: number;
}

/** Mismo criterio que estadoMovimiento; paneles usan enLinea/fueraLinea. */
export type DashboardEstadoInstalacion =
  | 'movimiento'
  | 'exceso'
  | 'detenido'
  | 'detenido30'
  | 'detenido60'
  | 'detenido90'
  | 'sinReporte'
  | 'enLinea'
  | 'fueraLinea';

export interface DashboardUltimaInstalacion {
  idInstalacion: number;
  unidad: string;
  tipo: string;
  idTipoProducto: number;
  cliente: string;
  fecha: string;
  imei: string | null;
  /** Tipo · modelo del dispositivo */
  dispositivo: string | null;
  /** Número de la SIM */
  sim: string | null;
  estado: DashboardEstadoInstalacion;
  /** UltimaPosicion.FechaHora (o UltimoHeartbeat en paneles), 'YYYY-MM-DDTHH:mm:ss' hora México */
  ultimoReporte: string | null;
  velocidad: number | null;
}

export interface DashboardSinReporte {
  idInstalacion: number;
  unidad: string;
  categoria: DashboardCategoriaEquipo;
  /** 'YYYY-MM-DDTHH:mm:ss' hora México */
  ultimoReporte: string | null;
  /** Horas desde ultimoReporte (null si nunca reportó) */
  horas: number | null;
}

/** operacion: SA, Dev, Admin, Jefe de monitoreo, Monitoreo · cliente: cualquier otro rol */
export type DashboardVista = 'operacion' | 'cliente';

/** Respuesta plana de GET /dashboard (sin wrapper `data`). */
export interface DashboardResponse {
  vista: DashboardVista;
  /** 'YYYY-MM-DD HH:mm:ss' hora México */
  generadoEn: string;
  alcance: DashboardAlcance;
  /** Siempre 1 elemento (con ceros si no hay datos) */
  hero: DashboardHero[];
  totales: DashboardTotal[];
  /** Siempre las 4 en orden: vehiculos, paneles, activos, telefonos */
  equipos: DashboardEquipo[];
  /** Siempre las 4 en orden: vehiculos, activos, telefonos, paneles */
  estadoMovimiento: DashboardEstadoMovimiento[];
  /** Siempre las 3 en orden: movimiento, detenida, sinReporte */
  unidadesAhora: DashboardUnidadAhora[];
  /** 7 filas (hoy y 6 anteriores) con ceros, orden ascendente */
  alertasPorDia: DashboardAlertaDia[];
  /** 7 filas (hoy y 6 anteriores) con ceros, orden ascendente */
  excesosPorDia: DashboardExcesoDia[];
  /** Top 5 por velocidadMax desc */
  excesosTop: DashboardExcesoTop[];
  productosPorTipo: DashboardProductoTipo[];
  dispositivosPorTipo: DashboardDispositivoTipo[];
  unidadesPorCliente: DashboardUnidadCliente[];
  /** operacion: 5 filas · cliente: hasta 15 */
  ultimasInstalaciones: DashboardUltimaInstalacion[];
  /** Solo vista cliente (hasta 10); vista operacion: [] */
  sinReporteTop: DashboardSinReporte[];
}
