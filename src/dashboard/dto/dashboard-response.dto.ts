import { ApiProperty } from '@nestjs/swagger';

export class DashboardAlcanceDto {
  @ApiProperty({ description: 'Rol del token', example: 6 })
  rol: number;

  @ApiProperty({
    description: 'Clientes distintos de las instalaciones visibles',
    example: 3,
  })
  clientes: number;

  @ApiProperty({
    description: 'Instalaciones visibles activas',
    example: 128,
  })
  unidades: number;
}

export class DashboardHeroDto {
  @ApiProperty({
    description: 'Instalaciones visibles con Estatus = 1',
    example: 128,
  })
  instalacionesActivas: number;

  @ApiProperty({
    description: 'Clientes distintos de esas instalaciones',
    example: 3,
  })
  clientes: number;

  @ApiProperty({
    description:
      'Instalaciones visibles cuyo producto no es inmueble y tienen dispositivo con IMEI',
    example: 110,
  })
  unidadesGps: number;

  @ApiProperty({
    description: 'Unidades GPS que reportaron en los últimos 60 min',
    example: 92,
  })
  enLinea: number;

  @ApiProperty({
    description: 'Unidades GPS sin última posición o sin reportar en más de 24 h',
    example: 6,
  })
  sinReporte: number;

  @ApiProperty({
    description: 'Instalaciones visibles de producto inmueble con panel de alarma',
    example: 12,
  })
  paneles: number;
}

export class DashboardTotalExtraDto {
  @ApiProperty({ description: 'Etiqueta del dato', example: 'Activos' })
  etiqueta: string;

  @ApiProperty({ description: 'Valor del dato', example: 85 })
  valor: number;
}

export class DashboardTotalDto {
  @ApiProperty({
    description: 'Identificador del total',
    enum: ['clientes', 'usuarios'],
    example: 'usuarios',
  })
  clave: 'clientes' | 'usuarios';

  @ApiProperty({ description: 'Etiqueta para mostrar', example: 'Usuarios' })
  etiqueta: string;

  @ApiProperty({ description: 'Total', example: 85 })
  valor: number;

  @ApiProperty({ description: 'Número secundario', example: 41 })
  destacado: number;

  @ApiProperty({
    description: 'Texto del número secundario',
    example: 'entraron en 7 días',
  })
  detalle: string;

  @ApiProperty({
    description: 'destacado / valor × 100, entero 0–100 (0 si valor = 0)',
    example: 48,
  })
  porcentaje: number;

  @ApiProperty({
    description:
      "Datos adicionales. clientes: 'Con unidades activas' y 'Con vehículos', 'Con paneles', 'Con activos', 'Con teléfonos' (clientes distintos con instalaciones activas de esa categoría; se omiten los 0). usuarios: 'Activos', 'Inactivos' y un elemento por rol con usuarios activos (orden desc).",
    type: [DashboardTotalExtraDto],
  })
  extras: DashboardTotalExtraDto[];
}

export class DashboardEquipoDto {
  @ApiProperty({
    description: 'Tipo de equipo',
    enum: ['vehiculos', 'paneles', 'activos', 'telefonos'],
    example: 'vehiculos',
  })
  categoria: 'vehiculos' | 'paneles' | 'activos' | 'telefonos';

  @ApiProperty({
    description: "Etiqueta: 'Vehículos', 'Paneles', 'Activos' o 'Teléfonos'",
    example: 'Vehículos',
  })
  etiqueta: string;

  @ApiProperty({
    description: 'Instalaciones activas visibles de esa categoría',
    example: 96,
  })
  total: number;

  @ApiProperty({
    description:
      'Vehículos, activos y teléfonos: en movimiento ahora (incluye exceso). Paneles: en línea',
    example: 38,
  })
  activos: number;

  @ApiProperty({
    description: "Texto de `activos`: 'en movimiento' o 'en línea'",
    example: 'en movimiento',
  })
  activosTexto: string;
}

export class DashboardEstadoMovimientoDto {
  @ApiProperty({
    description: 'Tipo de equipo',
    enum: ['vehiculos', 'activos', 'telefonos', 'paneles'],
    example: 'vehiculos',
  })
  categoria: 'vehiculos' | 'activos' | 'telefonos' | 'paneles';

  @ApiProperty({ description: 'Etiqueta para mostrar', example: 'Vehículos' })
  etiqueta: string;

  @ApiProperty({ description: 'Instalaciones de la categoría', example: 96 })
  total: number;

  @ApiProperty({
    description:
      'Estado = 1 o velocidad > 8 km/h. En paneles: en línea',
    example: 30,
  })
  movimiento: number;

  @ApiProperty({
    description: 'Velocidad > 90 km/h o Estado = 7 (0 en paneles)',
    example: 3,
  })
  exceso: number;

  @ApiProperty({
    description: 'Detenidas sin estado de tiempo detenido (0 en paneles)',
    example: 40,
  })
  detenido: number;

  @ApiProperty({ description: 'Estado = 4, detenidas 30 min (0 en paneles)', example: 6 })
  detenido30: number;

  @ApiProperty({ description: 'Estado = 5, detenidas 60 min (0 en paneles)', example: 4 })
  detenido60: number;

  @ApiProperty({ description: 'Estado = 6, detenidas 90 min (0 en paneles)', example: 7 })
  detenido90: number;

  @ApiProperty({
    description:
      'Sin última posición o sin reportar en más de 24 h. En paneles: fuera de línea',
    example: 6,
  })
  sinReporte: number;
}

export class DashboardExcesoDiaDto {
  @ApiProperty({ description: 'Fecha (hora México)', example: '2026-10-07' })
  fecha: string;

  @ApiProperty({
    description: 'Posiciones con velocidad > 90 km/h ese día',
    example: 54,
  })
  reportes: number;

  @ApiProperty({
    description: 'IMEI distintos con exceso ese día',
    example: 9,
  })
  unidades: number;
}

export class DashboardExcesoTopDto {
  @ApiProperty({ description: 'Id de la instalación', example: 345 })
  idInstalacion: number;

  @ApiProperty({
    description: "'ECO · PLACA' en vehículos; si no, nombre del producto",
    example: 'ECO-12 · ABC1234',
  })
  unidad: string;

  @ApiProperty({
    description: 'Nombre completo del cliente',
    example: 'Transportes del Norte',
  })
  cliente: string;

  @ApiProperty({
    description: 'Velocidad máxima registrada en 7 días (km/h)',
    example: 128,
  })
  velocidadMax: number;

  @ApiProperty({
    description: 'Posiciones con velocidad > 90 km/h en 7 días',
    example: 37,
  })
  reportes: number;
}

export class DashboardUnidadAhoraDto {
  @ApiProperty({
    description: 'Estado actual de las unidades GPS',
    enum: ['movimiento', 'detenida', 'sinReporte'],
    example: 'movimiento',
  })
  estado: 'movimiento' | 'detenida' | 'sinReporte';

  @ApiProperty({ description: 'Etiqueta para mostrar', example: 'En movimiento' })
  etiqueta: string;

  @ApiProperty({ description: 'Unidades en ese estado', example: 41 })
  total: number;
}

export class DashboardAlertaDiaDto {
  @ApiProperty({ description: 'Fecha (hora México)', example: '2026-10-07' })
  fecha: string;

  @ApiProperty({
    description:
      'Posiciones con estado de alerta (pánico, puerta, batería, energía, ADAS, DSM, conducción)',
    example: 37,
  })
  total: number;
}

export class DashboardProductoTipoDto {
  @ApiProperty({ description: 'Id de CatTipoProducto', example: 1 })
  idTipoProducto: number;

  @ApiProperty({ description: 'Nombre del tipo de producto', example: 'Vehículo' })
  tipo: string;

  @ApiProperty({ description: 'Instalaciones visibles de ese tipo', example: 96 })
  total: number;
}

export class DashboardDispositivoTipoDto {
  @ApiProperty({ description: 'Id de CatTipoDispositivo', example: 3 })
  idTipoDispositivo: number;

  @ApiProperty({ description: 'Nombre del tipo de dispositivo', example: 'AVL' })
  tipo: string;

  @ApiProperty({
    description: 'Dispositivos de ese tipo (sin inservibles)',
    example: 140,
  })
  total: number;
}

export class DashboardUnidadClienteDto {
  @ApiProperty({ description: 'Id del cliente', example: 12 })
  idCliente: number;

  @ApiProperty({
    description: 'Nombre completo del cliente',
    example: 'Transportes del Norte',
  })
  cliente: string;

  @ApiProperty({ description: 'Instalaciones visibles del cliente', example: 58 })
  total: number;
}

export class DashboardUltimaInstalacionDto {
  @ApiProperty({ description: 'Id de la instalación', example: 345 })
  idInstalacion: number;

  @ApiProperty({
    description: "'ECO · PLACA' en vehículos; si no, nombre del producto",
    example: 'ECO-12 · ABC1234',
  })
  unidad: string;

  @ApiProperty({ description: 'Nombre del tipo de producto', example: 'Vehículo' })
  tipo: string;

  @ApiProperty({ description: 'Id de CatTipoProducto', example: 1 })
  idTipoProducto: number;

  @ApiProperty({
    description: 'Nombre completo del cliente',
    example: 'Transportes del Norte',
  })
  cliente: string;

  @ApiProperty({
    description: 'VigenteDesde (hora México)',
    example: '2026-10-06 17:42:10',
  })
  fecha: string;

  @ApiProperty({
    description: 'IMEI del dispositivo',
    example: '867730051234567',
    nullable: true,
    type: String,
  })
  imei: string | null;

  @ApiProperty({
    description: 'Tipo · modelo del dispositivo',
    example: 'GPS · FMB920',
    nullable: true,
    type: String,
  })
  dispositivo: string | null;

  @ApiProperty({
    description: 'Número de la SIM',
    example: '5512345678',
    nullable: true,
    type: String,
  })
  sim: string | null;

  @ApiProperty({
    description:
      'Estado actual (mismo criterio que estadoMovimiento); paneles usan enLinea/fueraLinea',
    enum: [
      'movimiento',
      'exceso',
      'detenido',
      'detenido30',
      'detenido60',
      'detenido90',
      'sinReporte',
      'enLinea',
      'fueraLinea',
    ],
    example: 'movimiento',
  })
  estado:
    | 'movimiento'
    | 'exceso'
    | 'detenido'
    | 'detenido30'
    | 'detenido60'
    | 'detenido90'
    | 'sinReporte'
    | 'enLinea'
    | 'fueraLinea';

  @ApiProperty({
    description:
      'FechaHora de UltimaPosicion (UltimoHeartbeat en paneles), ISO hora México',
    example: '2026-10-07T15:50:12',
    nullable: true,
    type: String,
  })
  ultimoReporte: string | null;

  @ApiProperty({
    description: 'Velocidad de la última posición (km/h)',
    example: 54,
    nullable: true,
    type: Number,
  })
  velocidad: number | null;
}

export class DashboardSinReporteDto {
  @ApiProperty({ description: 'Id de la instalación', example: 345 })
  idInstalacion: number;

  @ApiProperty({
    description: "'ECO · PLACA' en vehículos; si no, nombre del producto",
    example: 'ECO-12 · ABC1234',
  })
  unidad: string;

  @ApiProperty({
    description: 'Tipo de equipo',
    enum: ['vehiculos', 'activos', 'telefonos', 'paneles'],
    example: 'vehiculos',
  })
  categoria: 'vehiculos' | 'activos' | 'telefonos' | 'paneles';

  @ApiProperty({
    description:
      'FechaHora de UltimaPosicion (UltimoHeartbeat en paneles), ISO hora México; null si nunca reportó',
    example: '2026-10-05T09:12:40',
    nullable: true,
    type: String,
  })
  ultimoReporte: string | null;

  @ApiProperty({
    description: 'Horas desde ultimoReporte (null si nunca reportó)',
    example: 78,
    nullable: true,
    type: Number,
  })
  horas: number | null;
}

export class DashboardResponseDto {
  @ApiProperty({
    description:
      'operacion: SA, Dev, Admin, Jefe de monitoreo y Monitoreo (todos los arreglos). cliente: cualquier otro rol (solo hero, equipos, unidadesAhora, estadoMovimiento, alertasPorDia, excesosPorDia, excesosTop, ultimasInstalaciones y sinReporteTop; el resto vacío).',
    enum: ['operacion', 'cliente'],
    example: 'operacion',
  })
  vista: 'operacion' | 'cliente';

  @ApiProperty({
    description: 'Momento del cálculo (hora México)',
    example: '2026-10-07 15:54:00',
  })
  generadoEn: string;

  @ApiProperty({
    description: 'Alcance visible del token. Todos los roles.',
    type: DashboardAlcanceDto,
  })
  alcance: DashboardAlcanceDto;

  @ApiProperty({
    description:
      'Indicadores principales; siempre 1 elemento (con ceros si no hay datos). Todos los roles.',
    type: [DashboardHeroDto],
  })
  hero: DashboardHeroDto[];

  @ApiProperty({
    description:
      'Totales generales en orden: clientes y usuarios. Solo vista operacion; vista cliente: [].',
    type: [DashboardTotalDto],
  })
  totales: DashboardTotalDto[];

  @ApiProperty({
    description:
      'Tarjeta por tipo de equipo: vehiculos, paneles, activos y telefonos (siempre las 4 en ese orden, con 0 si no hay). Todos los roles.',
    type: [DashboardEquipoDto],
  })
  equipos: DashboardEquipoDto[];

  @ApiProperty({
    description:
      'Semáforo de Monitoreo por categoría: vehiculos, activos, telefonos y paneles (siempre las 4 en ese orden). Cada unidad en un solo grupo. Todos los roles.',
    type: [DashboardEstadoMovimientoDto],
  })
  estadoMovimiento: DashboardEstadoMovimientoDto[];

  @ApiProperty({
    description:
      'Unidades GPS ahora: movimiento, detenida y sinReporte (siempre las 3 en ese orden). Todos los roles.',
    type: [DashboardUnidadAhoraDto],
  })
  unidadesAhora: DashboardUnidadAhoraDto[];

  @ApiProperty({
    description:
      'Alertas GPS por día: 7 filas (hoy y 6 anteriores) con ceros, orden ascendente. Todos los roles.',
    type: [DashboardAlertaDiaDto],
  })
  alertasPorDia: DashboardAlertaDiaDto[];

  @ApiProperty({
    description:
      'Excesos de velocidad (> 90 km/h) por día: 7 filas (hoy y 6 anteriores) con ceros, orden ascendente. Todos los roles.',
    type: [DashboardExcesoDiaDto],
  })
  excesosPorDia: DashboardExcesoDiaDto[];

  @ApiProperty({
    description:
      'Top 5 unidades por velocidad máxima en 7 días (> 90 km/h), desc. Todos los roles.',
    type: [DashboardExcesoTopDto],
  })
  excesosTop: DashboardExcesoTopDto[];

  @ApiProperty({
    description:
      'Instalaciones visibles por tipo de producto, desc, sin ceros. Solo vista operacion; vista cliente: [].',
    type: [DashboardProductoTipoDto],
  })
  productosPorTipo: DashboardProductoTipoDto[];

  @ApiProperty({
    description:
      'Dispositivos del alcance por tipo (sin inservibles), desc, sin ceros. Solo vista operacion; vista cliente: [].',
    type: [DashboardDispositivoTipoDto],
  })
  dispositivosPorTipo: DashboardDispositivoTipoDto[];

  @ApiProperty({
    description:
      'Top 5 clientes por instalaciones visibles, desc (vacío si el alcance tiene un solo cliente). Solo vista operacion; vista cliente: [].',
    type: [DashboardUnidadClienteDto],
  })
  unidadesPorCliente: DashboardUnidadClienteDto[];

  @ApiProperty({
    description:
      'Últimas instalaciones por VigenteDesde, más reciente primero: 5 en vista operacion, hasta 15 en vista cliente.',
    type: [DashboardUltimaInstalacionDto],
  })
  ultimasInstalaciones: DashboardUltimaInstalacionDto[];

  @ApiProperty({
    description:
      'Hasta 10 unidades en sinReporte/fueraLinea (mismo criterio que estadoMovimiento), primero las que nunca reportaron y luego por más tiempo sin reportar. Solo vista cliente; vista operacion: [].',
    type: [DashboardSinReporteDto],
  })
  sinReporteTop: DashboardSinReporteDto[];
}
