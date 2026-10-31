import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TramosInstalacionService } from 'src/motor-activos/tramos-instalacion.service';
import {
  condicionTramos,
  enTramoRecortado,
  recortarTramos,
  type TramoEnPeriodo,
} from 'src/motor-activos/tramos-instalacion';
import { Instalaciones } from 'src/entities/Instalaciones';
import { Dispositivos } from 'src/entities/Dispositivos';
import { Posiciones } from 'src/entities/Posiciones';
import { UltimaPosicion } from 'src/entities/UltimaPosicion';
import { PuntosInteres } from 'src/entities/PuntosInteres';
import { Productos } from 'src/entities/Productos';
import { CatTipoProducto } from 'src/entities/CatTipoProducto';
import { Vehiculos } from 'src/entities/Vehiculos';
import { Activos } from 'src/entities/Activos';
import { Personas } from 'src/entities/Personas';
import { Inmuebles } from 'src/entities/Inmuebles';
import { CatMarcas } from 'src/entities/CatMarcas';
import { CatModelos } from 'src/entities/CatModelos';
import { CatTipoCombustible } from 'src/entities/CatTipoCombustible';
import {
  TenantFilterService,
  UsuarioAlcance,
} from 'src/common/tenant-filter/tenant-filter.service';
import type { Paginated } from 'src/common/ApiResponse';
import {
  EnumTipoDispositivo,
  EnumTipoProducto,
  EstatusEnum,
} from 'src/common/estatus.enum';
import { parseFechaHistorico, formatFechaPosicion } from 'src/monitoreo/helpers/monitoreo-historico.helpers';
import { imeiToString } from 'src/common/imei.util';
import { PasoPorPoiDto } from './dto/paso-por-poi.dto';
import type { FiltroPasoPorPoi } from './dto/paso-por-poi.dto';
import { VelocidadDto } from './dto/velocidad.dto';
import { ReportePosicionesDto } from './dto/reporte-posiciones.dto';
import { UltimaPosicionDto } from './dto/ultima-posicion.dto';
import { DistanciaDto } from './dto/distancia.dto';
import { ReporteSalidasGeocercaDto } from './dto/salidas-geocerca.dto';
import { ReporteSalidasGeocercaInstalacionDto } from './dto/salidas-geocerca-instalacion.dto';
import { limitarIdsInstalacionPorAsignacion } from './helpers/alcance-instalaciones.helpers';
import { Geocercas } from 'src/entities/Geocercas';
import { Clientes } from 'src/entities/Clientes';
import { nombreCliente as nombreClienteRelacion } from 'src/productos/map-relaciones.util';
import { extractOuterRing } from 'src/messaging/shared/estado-geocerca.util';
import {
  codificarCursorRecorrido,
  decodificarCursorRecorrido,
  detectarHuecosTransmision,
  detectarSalidasGeocerca,
  duracionSegundosEntre,
  estadoRespectoGeocerca,
  fusionarSegmentosConsecutivos,
  type PosicionCronologicaGeocerca,
  type SalidaGeocercaDetectada,
} from './helpers/salidas-geocerca.helpers';
import { RecorridoSalidaGeocercaDto } from './dto/recorrido-salida-geocerca.dto';
import { calcularDistanciaHistoricoMonitoreo } from 'src/monitoreo/helpers/monitoreo-distancia.helpers';
import { redondearKm } from 'src/utils/recorrido.utils';

/** Producto base + detalle por tipo (plano; mismos nombres que instalaciones). */
export type ProductoPlanoPasoPoi = {
  idProducto: number | null;
  nombreProducto: string | null;
  estatusProducto: number | null;
  idTipoProducto: number | null;
  nombreTipoProducto: string | null;
  codigoTipoProducto: string | null;

  placaVehiculo: string | null;
  ecoVehiculo: string | null;
  idMarcaVehiculo: number | null;
  nombreMarcaVehiculo: string | null;
  idModeloVehiculo: number | null;
  nombreModeloVehiculo: string | null;
  anioVehiculo: number | null;
  colorVehiculo: string | null;
  numeroSerieVehiculo: string | null;
  fotoVehiculo: string | null;
  fotoFrenteVehiculo: string | null;
  tarjetaCirculacionVehiculo: string | null;
  polizaSeguroVehiculo: string | null;
  permisoCargaVehiculo: string | null;
  idCombustibleVehiculo: number | null;
  nombreCombustibleVehiculo: string | null;
  kmVehiculo: number | null;
  capacidadLitrosVehiculo: number | null;

  nombreActivo: string | null;
  descripcionActivo: string | null;

  inmueble: string | null;
  direccionFiscalInmueble: string | null;
  nombreRepresentanteInmueble: string | null;
  telefonoRepresentanteInmueble: string | null;
  correoRepresentanteInmueble: string | null;
  latInmueble: number | null;
  lngInmueble: number | null;

  nombrePersona: string | null;
  telefonoPersona: string | null;
};

export type DispositivoPasoPoiItem = {
  idInstalacion: number;
  idDispositivo: number;
  imei: string;
  numeroSerie: string | null;
  cantidadPosiciones: number;
  primeraDeteccion: Date | string;
  ultimaDeteccion: Date | string;
} & ProductoPlanoPasoPoi;

/** Fila plana: instalación + producto (sin inmueble) + campos de Posiciones. */
export type PosicionPasoPoiItem = {
  idInstalacion: number;
  idDispositivo: number;
  imei: string;
  numeroSerie: string | null;

  idPosicion: number;
  lat: number;
  lng: number;
  estado: number | null;
  fechaHora: Date | string;
  velocidad: number | null;
  direccion: number | null;
  odometro: number | null;
  ignicion: number | null;
  alarma1: number | null;
  alarma2: number | null;
  energia: number | null;
  idEvento: number | null;
  idFoto: number | null;
  fhRegistro: Date | string | null;
  bateria: number | null;
  alimentacion: number | null;
  gps: number | null;
  gsm: number | null;
  movimiento: number | null;
  combustible: number | null;
  idFoto1: number | null;
  idFoto2: number | null;
  idFoto3: number | null;
  idVideo1: number | null;
  idVideo2: number | null;
  idVideo3: number | null;
  /** 0 GPS, 1 WiFi, 2 antena, 3 última válida; null = no informado. */
  fuentePosicion: number | null;
  /** Radio (m) de una ubicación aproximada. */
  radioM: number | null;
} & ProductoPlanoPasoPoi;

export type PasoPorPoiPuntoItem = {
  idPuntoInteres: number;
  nombrePuntoInteres: string;
  lat: number;
  lng: number;
  radioMetros: number;
  totalDispositivos: number;
  totalPosiciones: number;
  dispositivos: DispositivoPasoPoiItem[];
  posiciones: PosicionPasoPoiItem[];
};

export type PasoPorPoiResult = {
  idCliente: number;
  fechaInicio: string;
  fechaFinal: string;
  instalacionesEvaluadas: number;
  /** Dispositivos distintos que pasaron por al menos un POI del request. */
  totalDispositivosUnicos: number;
  puntos: PasoPorPoiPuntoItem[];
};

/** Item plano del reporte de velocidad (campos de Posiciones + vehículo). */
export type VelocidadItem = {
  imei: string | null;
  id: number;
  placas: string | null;
  economico: string | null;
  descripcion: string | null;
  lat: number;
  lng: number;
  estado: number | null;
  ignicion: number | null;
  velocidad: number | null;
  fechaHora: string | null;
  modelo: string | null;
  numeroSerie: string | null;
  imagen: string | null;
  idProducto: number | null;
};

export type VelocidadResult = {
  idCliente: number;
  fechaInicio: string;
  fechaFinal: string;
  velocidad: number;
  total: number;
  posiciones: VelocidadItem[];
};

/** Fila de `Posiciones` / `UltimaPosicion` + contexto instalación/producto (plano). */
export type ReportePosicionItem = {
  idInstalacion: number;
  idDispositivo: number;
  numeroSerie: string | null;

  id: number;
  imei: string | null;
  lat: number;
  lng: number;
  estado: number | null;
  fechaHora: string | null;
  velocidad: number | null;
  direccion: number | null;
  odometro: number | null;
  ignicion: number | null;
  alarma1: number | null;
  alarma2: number | null;
  energia: number | null;
  idEvento: number | null;
  idFoto: number | null;
  fhRegistro: string | null;
  bateria: number | null;
  alimentacion: number | null;
  gps: number | null;
  gsm: number | null;
  movimiento: number | null;
  combustible: number | null;
  idFoto1: number | null;
  idFoto2: number | null;
  idFoto3: number | null;
  idVideo1: number | null;
  idVideo2: number | null;
  idVideo3: number | null;
  /** 0 GPS, 1 WiFi, 2 antena, 3 última válida; null = no informado. */
  fuentePosicion: number | null;
  /** Radio (m) de una ubicación aproximada. */
  radioM: number | null;
} & ProductoPlanoPasoPoi;

export type ReportePosicionesResult = {
  idCliente: number;
  fechaInicio: string;
  fechaFinal: string;
  total: number;
  posiciones: ReportePosicionItem[];
};

/** Misma forma que el reporte de posiciones; origen `UltimaPosicion`. */
export type UltimaPosicionResult = ReportePosicionesResult;

/** Posición del reporte de distancia con km acumulados hasta ese punto. */
export type DistanciaPosicionItem = ReportePosicionItem & {
  /** Km acumulados desde el punto más antiguo hasta este (2 decimales). */
  totalDistancia: number;
  /** Km del tramo desde la posición anterior en el tiempo (0 en la más antigua). */
  distanciaTramo: number;
};

/** Km recorridos en un día (hora de pared), para la gráfica. */
export type DistanciaPorDiaItem = {
  /** `YYYY-MM-DD` */
  fecha: string;
  km: number;
};

/** Recorrido de un IMEI / instalación en el periodo. */
export type DistanciaRecorridoItem = {
  idInstalacion: number;
  idDispositivo: number;
  imei: string;
  numeroSerie: string | null;
  placas: string | null;
  economico: string | null;
  /** Misma regla que velocidad: `nombreProducto ?? economico`. */
  descripcion: string | null;
  /** Distancia total del recorrido (km, 2 decimales). */
  totalDistancia: number;
  total: number;
  /** Un punto por cada día del periodo (0 si no hubo movimiento). */
  porDia: DistanciaPorDiaItem[];
  /** Orden DESC por fechaHora (más reciente primero), igual que histórico. Vacío en modo paginado (usar `filas`). */
  posiciones: DistanciaPosicionItem[];
};

/** Renglón ligero de la tabla (modo paginado). */
export type DistanciaFilaItem = {
  idInstalacion: number;
  idPosicion: number;
  imei: string;
  placas: string | null;
  economico: string | null;
  descripcion: string | null;
  fechaHora: string | null;
  lat: number;
  lng: number;
  velocidad: number | null;
  ignicion: number | null;
  estado: number | null;
  distanciaTramo: number;
  distanciaAcumulada: number;
};

export type DistanciaResult = {
  idCliente: number;
  fechaInicio: string;
  fechaFinal: string;
  /** Suma de `totalDistancia` de todos los recorridos (km). */
  totalDistancia: number;
  totalRecorridos: number;
  totalPosiciones: number;
  recorridos: DistanciaRecorridoItem[];
  /** Solo en modo paginado: la página de renglones. */
  filas?: DistanciaFilaItem[];
};

/** Evento de salida de geocerca (transición DENTRO → FUERA). */
export type SalidaGeocercaItem = {
  idCliente: number;
  nombreCliente: string | null;
  idInstalacion: number;
  idDispositivo: number;
  imei: string;
  numeroSerie: string | null;
  placas: string | null;
  economico: string | null;
  idGeocerca: number;
  nombreGeocerca: string;
  /** Geometría GeoJSON almacenada en `Geocercas.Geocerca` (polígono para mapa). */
  geocercaGeometria: unknown;
  /** Segundos fuera: hasta el reingreso o, sin reingreso, hasta la última posición del periodo. */
  tiempoAcumuladoSegundos: number | null;
  /** Fecha con la que se cerró `tiempoAcumuladoSegundos`. */
  tiempoAcumuladoHasta: string | null;
} & SalidaGeocercaDetectada;

export type SalidasGeocercaResult = {
  idCliente: number;
  nombreCliente: string | null;
  fechaInicio: string;
  fechaFinal: string;
  resumen: {
    totalSalidas: number;
    totalDispositivos: number;
    totalGeocercas: number;
    instalacionesEvaluadas: number;
    geocercasEvaluadas: number;
  };
  salidas: SalidaGeocercaItem[];
};

type GeocercaAplicable = {
  id: number;
  nombre: string;
  idInstalacion: number;
  ring: Array<[number, number]>;
  geometria: unknown;
};

/** Cabecera de la única instalación del reporte por instalación. */
export type InstalacionSalidaGeocercaItem = {
  idInstalacion: number;
  idDispositivo: number | null;
  imei: string | null;
  numeroSerie: string | null;
  placas: string | null;
  economico: string | null;
  idProducto: number | null;
  nombreProducto: string | null;
};

export type SalidasGeocercaInstalacionResult = {
  idCliente: number;
  nombreCliente: string | null;
  fechaInicio: string;
  fechaFinal: string;
  instalacion: InstalacionSalidaGeocercaItem | null;
  /**
   * Dispositivos asociados a la instalación dentro del periodo, según
   * `Instalaciones` vigente + cadena de `HistoricoInstalaciones`.
   * Más de uno cuando hubo cambio de dispositivo en el periodo.
   */
  dispositivosEnPeriodo: DispositivoEnPeriodoItem[];
  resumen: {
    totalSalidas: number;
    /** Geocercas distintas con al menos una salida. */
    totalGeocercas: number;
    geocercasEvaluadas: number;
  };
  salidas: SalidaGeocercaItem[];
};

/** Tramo en que un dispositivo estuvo asociado a la instalación. */
export type DispositivoEnPeriodoItem = {
  idDispositivo: number;
  idProducto: number | null;
  imei: string;
  numeroSerie: string | null;
  placas: string | null;
  economico: string | null;
  /** Inicio de vigencia del tramo (asignación), `YYYY-MM-DD HH:mm:ss`. */
  vigenteDesde: string | null;
  /** Fin de vigencia del tramo; `null` = dispositivo actual. */
  vigenteHasta: string | null;
  /** Ventana efectiva consultada (intersección vigencia ∩ periodo). */
  desde: string;
  hasta: string;
};

/** Posición del recorrido posterior a una salida (GPS real, sin interpolar). */
export type RecorridoPosicionItem = {
  idPosicion: number;
  idDispositivo: number;
  imei: string;
  fechaHora: string | null;
  lat: number;
  lng: number;
  velocidad: number | null;
  estado: number | null;
  ignicion: number | null;
  /** Respecto a la geocerca del evento, calculado con su geometría actual. */
  estadoRespectoGeocerca: 'DENTRO' | 'FUERA' | null;
};

export type RecorridoSalidaGeocercaResult = {
  instalacion: InstalacionSalidaGeocercaItem | null;
  geocerca: {
    idGeocerca: number;
    nombre: string;
    geometria: unknown;
  };
  eventoSeleccionado: SalidaGeocercaItem;
  rangoEfectivo: {
    fechaInicio: string;
    fechaFinal: string;
    hastaUltimaPosicion: boolean;
  };
  dispositivosEnPeriodo: DispositivoEnPeriodoItem[];
  posiciones: RecorridoPosicionItem[];
  transiciones: Array<{
    tipo: 'SALIDA' | 'REINGRESO';
    fechaHora: string | null;
    idPosicion: number;
    idGeocerca: number;
  }>;
  ultimaPosicion: RecorridoPosicionItem | null;
  paginacion: {
    limite: number;
    devueltas: number;
    hayMas: boolean;
    cursorSiguiente: string | null;
  };
  avisos: {
    posicionesInvalidasOmitidas: number;
    posicionesDuplicadasOmitidas: number;
    huecosTransmision: Array<{
      desde: string;
      hasta: string;
      duracionSegundos: number;
    }>;
    ultimaPosicionDesactualizada: boolean;
    segundosSinTransmisionAlFinDelRango: number | null;
    limitaciones: string[];
  };
};

type InstalacionCandidataBase = {
  idInstalacion: number;
  idDispositivo: number;
  imei: string;
  numeroSerie: string | null;
};

type InstalacionCandidata = InstalacionCandidataBase & ProductoPlanoPasoPoi;

type InstalacionCandidataVehiculo = {
  idInstalacion: number;
  idDispositivo: number;
  imei: string;
  numeroSerie: string | null;
  idProducto: number | null;
  nombreProducto: string | null;
  placas: string | null;
  economico: string | null;
  modelo: string | null;
  imagen: string | null;
};

type PoiNorm = {
  id: number;
  nombre: string;
  lat: number;
  lng: number;
  radioMetros: number;
};

/** Candidata de una instalación en uno de sus tramos de vigencia (§6). */
type CandidataEnTramo<T> = T & { tramo: TramoEnPeriodo };

/** Candidata dueña de la posición `(imei, fechaHora)`; null si cae fuera de todo tramo. */
function ubicarCandidata<T extends { imei: string; tramo: TramoEnPeriodo }>(
  candidatas: readonly T[],
  imei: string,
  fechaHora: unknown,
): T | null {
  const fecha = formatFechaPosicion(fechaHora as string | Date | null | undefined)?.replace('T', ' ');
  if (!fecha) return null;
  return (
    candidatas.find(
      (c) => c.imei === imei && enTramoRecortado(c.tramo, fecha),
    ) ?? null
  );
}

function productoDe(c: object): number | null {
  const id = (c as { idProducto?: unknown }).idProducto;
  return id == null ? null : Number(id);
}

/**
 * La candidata con la etiqueta de otro producto: nombre, placas y económico de
 * ese producto; el resto de los datos del producto actual, vacíos.
 */
function conProducto<T extends object>(
  c: T,
  idProducto: number,
  e: { nombre: string | null; placa: string | null; eco: string | null } | undefined,
): T {
  const salida = { ...c } as Record<string, unknown>;
  for (const k of Object.keys(productoPlanoVacio())) {
    if (k in salida) salida[k] = null;
  }
  const valores: Record<string, unknown> = {
    idProducto,
    nombreProducto: e?.nombre ?? null,
    placaVehiculo: e?.placa ?? null,
    ecoVehiculo: e?.eco ?? null,
    placas: e?.placa ?? null,
    economico: e?.eco ?? null,
    modelo: null,
    imagen: null,
  };
  for (const [k, v] of Object.entries(valores)) {
    if (k in salida) salida[k] = v;
  }
  return salida as T;
}

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function str(value: unknown): string | null {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

function mapProductoPlano(row: Record<string, unknown>): ProductoPlanoPasoPoi {
  return {
    idProducto: num(row.idProducto),
    nombreProducto: str(row.nombreProducto),
    estatusProducto: num(row.estatusProducto),
    idTipoProducto: num(row.idTipoProducto),
    nombreTipoProducto: str(row.nombreTipoProducto),
    codigoTipoProducto: str(row.codigoTipoProducto),

    placaVehiculo: str(row.placaVehiculo),
    ecoVehiculo: str(row.ecoVehiculo),
    idMarcaVehiculo: num(row.idMarcaVehiculo),
    nombreMarcaVehiculo: str(row.nombreMarcaVehiculo),
    idModeloVehiculo: num(row.idModeloVehiculo),
    nombreModeloVehiculo: str(row.nombreModeloVehiculo),
    anioVehiculo: num(row.anioVehiculo),
    colorVehiculo: str(row.colorVehiculo),
    numeroSerieVehiculo: str(row.numeroSerieVehiculo),
    fotoVehiculo: str(row.fotoVehiculo),
    fotoFrenteVehiculo: str(row.fotoFrenteVehiculo),
    tarjetaCirculacionVehiculo: str(row.tarjetaCirculacionVehiculo),
    polizaSeguroVehiculo: str(row.polizaSeguroVehiculo),
    permisoCargaVehiculo: str(row.permisoCargaVehiculo),
    idCombustibleVehiculo: num(row.idCombustibleVehiculo),
    nombreCombustibleVehiculo: str(row.nombreCombustibleVehiculo),
    kmVehiculo: num(row.kmVehiculo),
    capacidadLitrosVehiculo: num(row.capacidadLitrosVehiculo),

    nombreActivo: str(row.nombreActivo),
    descripcionActivo: str(row.descripcionActivo),

    inmueble: str(row.inmueble),
    direccionFiscalInmueble: str(row.direccionFiscalInmueble),
    nombreRepresentanteInmueble: str(row.nombreRepresentanteInmueble),
    telefonoRepresentanteInmueble: str(row.telefonoRepresentanteInmueble),
    correoRepresentanteInmueble: str(row.correoRepresentanteInmueble),
    latInmueble: num(row.latInmueble),
    lngInmueble: num(row.lngInmueble),

    nombrePersona: str(row.nombrePersona),
    telefonoPersona: str(row.telefonoPersona),
  };
}

function productoPlanoVacio(): ProductoPlanoPasoPoi {
  return {
    idProducto: null,
    nombreProducto: null,
    estatusProducto: null,
    idTipoProducto: null,
    nombreTipoProducto: null,
    codigoTipoProducto: null,
    placaVehiculo: null,
    ecoVehiculo: null,
    idMarcaVehiculo: null,
    nombreMarcaVehiculo: null,
    idModeloVehiculo: null,
    nombreModeloVehiculo: null,
    anioVehiculo: null,
    colorVehiculo: null,
    numeroSerieVehiculo: null,
    fotoVehiculo: null,
    fotoFrenteVehiculo: null,
    tarjetaCirculacionVehiculo: null,
    polizaSeguroVehiculo: null,
    permisoCargaVehiculo: null,
    idCombustibleVehiculo: null,
    nombreCombustibleVehiculo: null,
    kmVehiculo: null,
    capacidadLitrosVehiculo: null,
    nombreActivo: null,
    descripcionActivo: null,
    inmueble: null,
    direccionFiscalInmueble: null,
    nombreRepresentanteInmueble: null,
    telefonoRepresentanteInmueble: null,
    correoRepresentanteInmueble: null,
    latInmueble: null,
    lngInmueble: null,
    nombrePersona: null,
    telefonoPersona: null,
  };
}

function pickProducto(
  c: InstalacionCandidata | PosicionPasoPoiItem,
): ProductoPlanoPasoPoi {
  return {
    idProducto: c.idProducto,
    nombreProducto: c.nombreProducto,
    estatusProducto: c.estatusProducto,
    idTipoProducto: c.idTipoProducto,
    nombreTipoProducto: c.nombreTipoProducto,
    codigoTipoProducto: c.codigoTipoProducto,

    placaVehiculo: c.placaVehiculo,
    ecoVehiculo: c.ecoVehiculo,
    idMarcaVehiculo: c.idMarcaVehiculo,
    nombreMarcaVehiculo: c.nombreMarcaVehiculo,
    idModeloVehiculo: c.idModeloVehiculo,
    nombreModeloVehiculo: c.nombreModeloVehiculo,
    anioVehiculo: c.anioVehiculo,
    colorVehiculo: c.colorVehiculo,
    numeroSerieVehiculo: c.numeroSerieVehiculo,
    fotoVehiculo: c.fotoVehiculo,
    fotoFrenteVehiculo: c.fotoFrenteVehiculo,
    tarjetaCirculacionVehiculo: c.tarjetaCirculacionVehiculo,
    polizaSeguroVehiculo: c.polizaSeguroVehiculo,
    permisoCargaVehiculo: c.permisoCargaVehiculo,
    idCombustibleVehiculo: c.idCombustibleVehiculo,
    nombreCombustibleVehiculo: c.nombreCombustibleVehiculo,
    kmVehiculo: c.kmVehiculo,
    capacidadLitrosVehiculo: c.capacidadLitrosVehiculo,

    nombreActivo: c.nombreActivo,
    descripcionActivo: c.descripcionActivo,

    inmueble: c.inmueble,
    direccionFiscalInmueble: c.direccionFiscalInmueble,
    nombreRepresentanteInmueble: c.nombreRepresentanteInmueble,
    telefonoRepresentanteInmueble: c.telefonoRepresentanteInmueble,
    correoRepresentanteInmueble: c.correoRepresentanteInmueble,
    latInmueble: c.latInmueble,
    lngInmueble: c.lngInmueble,

    nombrePersona: c.nombrePersona,
    telefonoPersona: c.telefonoPersona,
  };
}

@Injectable()
export class ReportesService {
  constructor(
    @InjectRepository(PuntosInteres)
    private readonly puntosRepo: Repository<PuntosInteres>,
    @InjectRepository(Instalaciones)
    private readonly instalacionesRepo: Repository<Instalaciones>,
    @InjectRepository(Geocercas)
    private readonly geocercasRepo: Repository<Geocercas>,
    @InjectRepository(Clientes)
    private readonly clientesRepo: Repository<Clientes>,
    private readonly tenantFilter: TenantFilterService,
    private readonly tramos: TramosInstalacionService,
  ) {}

  /**
   * Expande las candidatas (instalaciones con su equipo actual) a una por tramo
   * de vigencia dentro del periodo (docs/motor-activos.md §6): cada equipo que
   * tuvo la instalación, solo mientras estuvo instalado en ella.
   */
  private async candidatasPorTramo<T extends InstalacionCandidataBase>(
    candidatos: readonly T[],
    fechaInicio: string,
    fechaFinal: string,
  ): Promise<Array<CandidataEnTramo<T>>> {
    if (!candidatos.length) return [];
    const porInstalacion = await this.tramos.tramosDe(candidatos.map((c) => c.idInstalacion));
    const recortados = candidatos.flatMap((c) =>
      recortarTramos(porInstalacion.get(c.idInstalacion) ?? [], fechaInicio, fechaFinal).map((tramo) => ({ c, tramo })),
    );
    // Número de serie de los equipos anteriores (el actual ya viene en la candidata).
    const otros = [
      ...new Set(recortados.filter(({ c, tramo }) => tramo.idDispositivo !== c.idDispositivo).map(({ tramo }) => tramo.idDispositivo)),
    ];
    const series = new Map<number, string | null>();
    if (otros.length) {
      const filas = await this.instalacionesRepo.manager
        .getRepository(Dispositivos)
        .find({ where: { id: In(otros) }, select: { id: true, numeroSerie: true } });
      filas.forEach((d) => series.set(Number(d.id), d.numeroSerie ?? null));
    }
    // Tramos de otro producto (cambio de vehículo con el mismo equipo): su
    // etiqueta es la de ese producto, no la del actual.
    const otrosProductos = [
      ...new Set(
        recortados
          .filter(({ c, tramo }) => tramo.idProducto != null && tramo.idProducto !== productoDe(c))
          .map(({ tramo }) => tramo.idProducto as number),
      ),
    ];
    const etiquetas = new Map<number, { nombre: string | null; placa: string | null; eco: string | null }>();
    if (otrosProductos.length) {
      const filas = await this.instalacionesRepo.manager
        .getRepository(Productos)
        .createQueryBuilder('prod')
        .leftJoin(Vehiculos, 'v', 'v.idProducto = prod.id AND v.idCliente = prod.idCliente')
        .select(['prod.id AS id', 'prod.nombre AS nombre', 'v.placa AS placa', 'v.numeroEconomico AS eco'])
        .where('prod.id IN (:...ids)', { ids: otrosProductos })
        .getRawMany<Record<string, unknown>>();
      filas.forEach((r) => etiquetas.set(Number(r.id), { nombre: str(r.nombre), placa: str(r.placa), eco: str(r.eco) }));
    }
    return recortados.map(({ c, tramo }) => {
      const otroProducto = tramo.idProducto != null && tramo.idProducto !== productoDe(c);
      return {
        ...(otroProducto ? conProducto(c, tramo.idProducto as number, etiquetas.get(tramo.idProducto as number)) : c),
        idDispositivo: tramo.idDispositivo,
        imei: tramo.imei,
        numeroSerie: tramo.idDispositivo === c.idDispositivo ? c.numeroSerie : (series.get(tramo.idDispositivo) ?? null),
        tramo,
      };
    });
  }

  async pasoPorPuntoInteres(
    dto: PasoPorPoiDto,
    idClienteToken: number,
    rol: number,
    idUsuario: number,
  ): Promise<{ data: PasoPorPoiResult }> {
    try {
      const idCliente = Number(dto.idCliente);
      await this.assertClienteEnAlcance(rol, idClienteToken, idCliente);

      let fechaInicio: string;
      let fechaFinal: string;
      try {
        fechaInicio = parseFechaHistorico(dto.fechaInicio);
        fechaFinal = parseFechaHistorico(dto.fechaFinal);
      } catch {
        throw new BadRequestException(
          'fechaInicio / fechaFinal tienen un formato inválido',
        );
      }
      if (fechaInicio > fechaFinal) {
        throw new BadRequestException(
          'fechaInicio no puede ser posterior a fechaFinal',
        );
      }

      const idsPoi = this.normalizeIds(dto.idsPuntoInteres);
      if (!idsPoi?.length) {
        throw new BadRequestException(
          'idsPuntoInteres debe incluir al menos un ID válido',
        );
      }

      const pois = await this.cargarPuntosDelCliente(idCliente, idsPoi);

      const idsFiltro = await this.limitarPorAsignacion(
        { userId: idUsuario, idCliente: idClienteToken, rol },
        await this.resolverIdsInstalacionPorFiltro(
          idCliente,
          dto.filtro,
          dto.valores,
        ),
      );

      const candidatos =
        idsFiltro !== null && idsFiltro.length === 0
          ? []
          : await this.cargarInstalacionesCandidatas(idCliente, idsFiltro);

      const puntos: PasoPorPoiPuntoItem[] = [];
      const dispositivosUnicos = new Set<number>();

      if (!candidatos.length) {
        for (const poi of pois) {
          puntos.push({
            idPuntoInteres: poi.id,
            nombrePuntoInteres: poi.nombre,
            lat: poi.lat,
            lng: poi.lng,
            radioMetros: poi.radioMetros,
            totalDispositivos: 0,
            totalPosiciones: 0,
            dispositivos: [],
            posiciones: [],
          });
        }
      } else {
        for (const poi of pois) {
          const posiciones = await this.consultarPosicionesPorRadio({
            candidatos,
            lat: poi.lat,
            lng: poi.lng,
            radioMetros: poi.radioMetros,
            fechaInicio,
            fechaFinal,
          });
          const dispositivos = this.agregarDispositivosDesdePosiciones(
            posiciones,
          );
          for (const d of dispositivos) {
            dispositivosUnicos.add(d.idDispositivo);
          }
          puntos.push({
            idPuntoInteres: poi.id,
            nombrePuntoInteres: poi.nombre,
            lat: poi.lat,
            lng: poi.lng,
            radioMetros: poi.radioMetros,
            totalDispositivos: dispositivos.length,
            totalPosiciones: posiciones.length,
            dispositivos,
            posiciones,
          });
        }
      }

      return {
        data: {
          idCliente,
          fechaInicio,
          fechaFinal,
          instalacionesEvaluadas: candidatos.length,
          totalDispositivosUnicos: dispositivosUnicos.size,
          puntos,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async velocidad(
    dto: VelocidadDto,
    idClienteToken: number,
    rol: number,
    idUsuario: number,
  ): Promise<{ data: VelocidadResult }> {
    try {
      const idCliente = Number(dto.idCliente);
      await this.assertClienteEnAlcance(rol, idClienteToken, idCliente);

      let fechaInicio: string;
      let fechaFinal: string;
      try {
        fechaInicio = parseFechaHistorico(dto.fechaInicio);
        fechaFinal = parseFechaHistorico(dto.fechaFinal);
      } catch {
        throw new BadRequestException(
          'fechaInicio / fechaFinal tienen un formato inválido',
        );
      }
      if (fechaInicio > fechaFinal) {
        throw new BadRequestException(
          'fechaInicio no puede ser posterior a fechaFinal',
        );
      }

      const velocidadMin = Number(dto.velocidad);
      if (!Number.isFinite(velocidadMin) || velocidadMin < 0) {
        throw new BadRequestException('velocidad debe ser un número >= 0');
      }

      const idsFiltro = await this.limitarPorAsignacion(
        { userId: idUsuario, idCliente: idClienteToken, rol },
        await this.resolverIdsInstalacionPorFiltro(
          idCliente,
          dto.filtro,
          dto.valores,
          true,
        ),
      );

      const candidatos =
        idsFiltro !== null && idsFiltro.length === 0
          ? []
          : await this.cargarInstalacionesVehiculo(idCliente, idsFiltro);

      if (!candidatos.length) {
        return {
          data: {
            idCliente,
            fechaInicio,
            fechaFinal,
            velocidad: velocidadMin,
            total: 0,
            posiciones: [],
          },
        };
      }

      const posiciones = await this.consultarPosicionesPorVelocidad({
        candidatos,
        velocidadMin,
        fechaInicio,
        fechaFinal,
      });

      return {
        data: {
          idCliente,
          fechaInicio,
          fechaFinal,
          velocidad: velocidadMin,
          total: posiciones.length,
          posiciones,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async posiciones(
    dto: ReportePosicionesDto,
    idClienteToken: number,
    rol: number,
    idUsuario: number,
  ): Promise<{ data: ReportePosicionesResult }> {
    try {
      const idCliente = Number(dto.idCliente);
      await this.assertClienteEnAlcance(rol, idClienteToken, idCliente);

      let fechaInicio: string;
      let fechaFinal: string;
      try {
        fechaInicio = parseFechaHistorico(dto.fechaInicio);
        fechaFinal = parseFechaHistorico(dto.fechaFinal);
      } catch {
        throw new BadRequestException(
          'fechaInicio / fechaFinal tienen un formato inválido',
        );
      }
      if (fechaInicio > fechaFinal) {
        throw new BadRequestException(
          'fechaInicio no puede ser posterior a fechaFinal',
        );
      }

      const idsFiltro = await this.limitarPorAsignacion(
        { userId: idUsuario, idCliente: idClienteToken, rol },
        await this.resolverIdsInstalacionPorFiltro(
          idCliente,
          dto.filtro,
          dto.valores,
        ),
      );

      const candidatos =
        idsFiltro !== null && idsFiltro.length === 0
          ? []
          : await this.cargarInstalacionesCandidatas(idCliente, idsFiltro);

      if (!candidatos.length) {
        return {
          data: {
            idCliente,
            fechaInicio,
            fechaFinal,
            total: 0,
            posiciones: [],
          },
        };
      }

      const posiciones = await this.consultarPosicionesPorPeriodo({
        candidatos,
        fechaInicio,
        fechaFinal,
      });

      return {
        data: {
          idCliente,
          fechaInicio,
          fechaFinal,
          total: posiciones.length,
          posiciones,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async ultimaPosicion(
    dto: UltimaPosicionDto,
    idClienteToken: number,
    rol: number,
    idUsuario: number,
  ): Promise<{ data: UltimaPosicionResult }> {
    try {
      const idCliente = Number(dto.idCliente);
      await this.assertClienteEnAlcance(rol, idClienteToken, idCliente);

      let fechaInicio: string;
      let fechaFinal: string;
      try {
        fechaInicio = parseFechaHistorico(dto.fechaInicio);
        fechaFinal = parseFechaHistorico(dto.fechaFinal);
      } catch {
        throw new BadRequestException(
          'fechaInicio / fechaFinal tienen un formato inválido',
        );
      }
      if (fechaInicio > fechaFinal) {
        throw new BadRequestException(
          'fechaInicio no puede ser posterior a fechaFinal',
        );
      }

      const idsFiltro = await this.limitarPorAsignacion(
        { userId: idUsuario, idCliente: idClienteToken, rol },
        await this.resolverIdsInstalacionPorFiltro(
          idCliente,
          dto.filtro,
          dto.valores,
        ),
      );

      const candidatos =
        idsFiltro !== null && idsFiltro.length === 0
          ? []
          : await this.cargarInstalacionesCandidatas(idCliente, idsFiltro);

      if (!candidatos.length) {
        return {
          data: {
            idCliente,
            fechaInicio,
            fechaFinal,
            total: 0,
            posiciones: [],
          },
        };
      }

      const posiciones = await this.consultarUltimasPosicionesPorPeriodo({
        candidatos,
        fechaInicio,
        fechaFinal,
      });

      return {
        data: {
          idCliente,
          fechaInicio,
          fechaFinal,
          total: posiciones.length,
          posiciones,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  /**
   * Distancia recorrida por IMEI en el periodo.
   * Misma lógica Haversine que `GET /monitoreo/:idInstalacion/historico`
   * (`calcularDistanciaHistoricoMonitoreo`: suma todos los tramos consecutivos).
   */
  async distancia(
    dto: DistanciaDto,
    idClienteToken: number,
    rol: number,
    idUsuario: number,
  ): Promise<{ data: DistanciaResult; paginated?: Paginated }> {
    try {
      const idCliente = Number(dto.idCliente);
      await this.assertClienteEnAlcance(rol, idClienteToken, idCliente);

      // Paginación opcional: sin page ni limit → respuesta completa (compatibilidad).
      const paginar = dto.page != null || dto.limit != null;
      const page = paginar ? Math.max(1, Math.trunc(Number(dto.page) || 1)) : 1;
      const limit = paginar
        ? Math.min(200, Math.max(1, Math.trunc(Number(dto.limit) || 20)))
        : 0;

      let fechaInicio: string;
      let fechaFinal: string;
      try {
        fechaInicio = parseFechaHistorico(dto.fechaInicio);
        fechaFinal = parseFechaHistorico(dto.fechaFinal);
      } catch {
        throw new BadRequestException(
          'fechaInicio / fechaFinal tienen un formato inválido',
        );
      }
      if (fechaInicio > fechaFinal) {
        throw new BadRequestException(
          'fechaInicio no puede ser posterior a fechaFinal',
        );
      }

      const idsFiltro = await this.limitarPorAsignacion(
        { userId: idUsuario, idCliente: idClienteToken, rol },
        await this.resolverIdsInstalacionPorFiltro(
          idCliente,
          dto.filtro,
          dto.valores,
        ),
      );

      const candidatos =
        idsFiltro !== null && idsFiltro.length === 0
          ? []
          : await this.cargarInstalacionesCandidatas(idCliente, idsFiltro);

      if (!candidatos.length) {
        return this.armarRespuestaDistancia(
          {
            idCliente,
            fechaInicio,
            fechaFinal,
            totalDistancia: 0,
            totalRecorridos: 0,
            totalPosiciones: 0,
          },
          [],
          paginar,
          page,
          limit,
        );
      }

      const posiciones = await this.consultarPosicionesPorPeriodo({
        candidatos,
        fechaInicio,
        fechaFinal,
      });

      const candPorInstalacion = new Map(
        candidatos.map((c) => [c.idInstalacion, c]),
      );

      // Un recorrido por instalación y equipo: tras un cambio de dispositivo, la
      // misma instalación aporta un recorrido por cada equipo que tuvo (§6).
      const porRecorrido = new Map<string, ReportePosicionItem[]>();
      for (const p of posiciones) {
        const imei = imeiToString(p.imei) ?? p.imei ?? '';
        if (!imei) continue;
        const clave = `${p.idInstalacion}|${imei}`;
        const list = porRecorrido.get(clave);
        if (list) {
          list.push(p);
        } else {
          porRecorrido.set(clave, [p]);
        }
      }

      const recorridos: DistanciaRecorridoItem[] = [];
      let totalDistancia = 0;
      let totalPosiciones = 0;

      for (const pts of porRecorrido.values()) {
        const base = candPorInstalacion.get(pts[0].idInstalacion);
        if (!base) continue;
        const cand = {
          ...base,
          idDispositivo: pts[0].idDispositivo,
          imei: imeiToString(pts[0].imei) ?? base.imei,
          numeroSerie: pts[0].numeroSerie,
        };

        const distancia = calcularDistanciaHistoricoMonitoreo(
          pts.map((p) => ({
            id: p.id,
            lat: p.lat,
            lng: p.lng,
            fechaHora: p.fechaHora ?? '',
          })),
          { yaOrdenadoDesc: true },
        );

        // pts viene en orden DESC: pts[i + 1] es el punto anterior en el tiempo.
        // El tramo se deriva del acumulado (sin recalcular distancias).
        const acum = (id: number) =>
          distancia.acumuladoKmPorId.get(id) ?? 0;
        const posicionesConKm: DistanciaPosicionItem[] = pts.map((p, i) => {
          const tramo =
            i < pts.length - 1 ? acum(pts[i].id) - acum(pts[i + 1].id) : 0;
          const tramoRedondeado = redondearKm(tramo);
          return {
            ...p,
            totalDistancia: acum(p.id),
            // Negativo solo puede venir del redondeo: se deja en 0.
            distanciaTramo: tramoRedondeado > 0 ? tramoRedondeado : 0,
          };
        });

        totalDistancia += distancia.totalDistanciaKm;
        totalPosiciones += posicionesConKm.length;

        recorridos.push({
          idInstalacion: cand.idInstalacion,
          idDispositivo: cand.idDispositivo,
          imei: cand.imei,
          numeroSerie: cand.numeroSerie,
          placas: cand.placaVehiculo,
          economico: cand.ecoVehiculo,
          descripcion: cand.nombreProducto ?? cand.ecoVehiculo,
          totalDistancia: distancia.totalDistanciaKm,
          total: posicionesConKm.length,
          porDia: this.distanciaPorDia(
            posicionesConKm,
            fechaInicio,
            fechaFinal,
          ),
          posiciones: posicionesConKm,
        });
      }

      recorridos.sort((a, b) => a.idInstalacion - b.idInstalacion);

      return this.armarRespuestaDistancia(
        {
          idCliente,
          fechaInicio,
          fechaFinal,
          totalDistancia: redondearKm(totalDistancia),
          totalRecorridos: recorridos.length,
          totalPosiciones,
        },
        recorridos,
        paginar,
        page,
        limit,
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  /**
   * Km por día de un recorrido: suma `distanciaTramo` por día de la posición
   * (el tramo se asigna al día del punto más reciente) y completa con 0
   * todos los días del periodo para que las series compartan el eje X.
   */
  private distanciaPorDia(
    posiciones: DistanciaPosicionItem[],
    fechaInicio: string,
    fechaFinal: string,
  ): DistanciaPorDiaItem[] {
    const kmPorDia = new Map<string, number>();
    for (const p of posiciones) {
      if (!p.fechaHora) continue;
      const dia = p.fechaHora.slice(0, 10);
      kmPorDia.set(dia, (kmPorDia.get(dia) ?? 0) + p.distanciaTramo);
    }

    const inicio = fechaInicio.slice(0, 10);
    const fin = fechaFinal.slice(0, 10);
    const [anioI, mesI, diaI] = inicio.split('-').map(Number);
    const [anioF, mesF, diaF] = fin.split('-').map(Number);
    const desdeMs = Date.UTC(anioI, (mesI ?? 1) - 1, diaI ?? 1);
    const hastaMs = Date.UTC(anioF, (mesF ?? 1) - 1, diaF ?? 1);
    if (!Number.isFinite(desdeMs) || !Number.isFinite(hastaMs) || desdeMs > hastaMs) {
      return [];
    }

    const resultado: DistanciaPorDiaItem[] = [];
    // Se avanza en UTC para no depender de la zona horaria del servidor.
    for (let ms = desdeMs; ms <= hastaMs; ms += 86_400_000) {
      const fecha = new Date(ms).toISOString().slice(0, 10);
      resultado.push({ fecha, km: redondearKm(kmPorDia.get(fecha) ?? 0) });
    }
    return resultado;
  }

  /**
   * Arma la respuesta de `distancia`: sin paginar devuelve los recorridos
   * completos; paginando, aplana todas las posiciones en `filas` (orden
   * estable), corta la página y deja `recorridos[].posiciones` vacío.
   * Los totales y `porDia` siempre corresponden al periodo completo.
   */
  private armarRespuestaDistancia(
    base: Omit<DistanciaResult, 'recorridos' | 'filas'>,
    recorridos: DistanciaRecorridoItem[],
    paginar: boolean,
    page: number,
    limit: number,
  ): { data: DistanciaResult; paginated?: Paginated } {
    if (!paginar) {
      return { data: { ...base, recorridos } };
    }

    const filasTodas: DistanciaFilaItem[] = [];
    for (const r of recorridos) {
      for (const p of r.posiciones) {
        filasTodas.push({
          idInstalacion: r.idInstalacion,
          idPosicion: p.id,
          imei: r.imei,
          placas: r.placas,
          economico: r.economico,
          descripcion: r.descripcion,
          fechaHora: p.fechaHora,
          lat: p.lat,
          lng: p.lng,
          velocidad: p.velocidad,
          ignicion: p.ignicion,
          estado: p.estado,
          distanciaTramo: p.distanciaTramo,
          distanciaAcumulada: p.totalDistancia,
        });
      }
    }
    filasTodas.sort(
      (a, b) =>
        String(b.fechaHora ?? '').localeCompare(String(a.fechaHora ?? '')) ||
        a.idInstalacion - b.idInstalacion ||
        b.idPosicion - a.idPosicion,
    );

    const total = filasTodas.length;
    const inicio = (page - 1) * limit;
    return {
      data: {
        ...base,
        recorridos: recorridos.map((r) => ({ ...r, posiciones: [] })),
        filas: filasTodas.slice(inicio, inicio + limit),
      },
      paginated: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  /**
   * Salidas de geocerca a partir del historial de `Posiciones`.
   * Solo lectura: no altera posiciones, estado de monitoreo ni genera alertas.
   * Una geocerca aplica únicamente a su `IdInstalacion` (igual que el ingest
   * en tiempo real); las de `IdInstalacion` NULL no se atribuyen a dispositivos.
   */
  async salidasGeocerca(
    dto: ReporteSalidasGeocercaDto,
    idClienteToken: number,
    rol: number,
    idUsuario: number,
  ): Promise<{ data: SalidasGeocercaResult; paginated?: Paginated }> {
    try {
      const idCliente = Number(dto.idCliente);
      await this.assertClienteEnAlcance(rol, idClienteToken, idCliente);

      // Paginación opcional: sin page ni limit → todas las salidas (export / compatibilidad).
      const paginar = dto.page != null || dto.limit != null;
      const page = paginar ? Math.max(1, Math.trunc(Number(dto.page) || 1)) : 1;
      const limit = paginar
        ? Math.min(200, Math.max(1, Math.trunc(Number(dto.limit) || 20)))
        : 0;

      let fechaInicio: string;
      let fechaFinal: string;
      try {
        fechaInicio = parseFechaHistorico(dto.fechaInicio);
        fechaFinal = parseFechaHistorico(dto.fechaFinal);
      } catch {
        throw new BadRequestException(
          'fechaInicio / fechaFinal tienen un formato inválido',
        );
      }
      if (fechaInicio > fechaFinal) {
        throw new BadRequestException(
          'fechaInicio no puede ser posterior a fechaFinal',
        );
      }

      const cliente = await this.clientesRepo.findOne({
        where: { id: idCliente },
      });
      const nombreCliente = nombreClienteRelacion(cliente);

      const geocercasCliente = await this.cargarGeocercasDelCliente(
        idCliente,
        this.normalizeIds(dto.idsGeocerca),
      );

      const idsFiltro = await this.limitarPorAsignacion(
        { userId: idUsuario, idCliente: idClienteToken, rol },
        await this.resolverIdsInstalacionPorFiltro(
          idCliente,
          dto.filtro,
          dto.valores,
        ),
      );

      const candidatos =
        idsFiltro !== null && idsFiltro.length === 0
          ? []
          : await this.cargarInstalacionesCandidatas(idCliente, idsFiltro);

      const resumenVacio = {
        totalSalidas: 0,
        totalDispositivos: 0,
        totalGeocercas: 0,
        instalacionesEvaluadas: candidatos.length,
        geocercasEvaluadas: 0,
      };
      if (!candidatos.length || !geocercasCliente.length) {
        return this.armarRespuestaSalidas(
          { idCliente, nombreCliente, fechaInicio, fechaFinal, resumen: resumenVacio },
          [],
          paginar,
          page,
          limit,
        );
      }

      // Solo geocercas vinculadas a una instalación autorizada/candidata,
      // con geometría válida (anillo extraído una sola vez por geocerca).
      const idsCandidatos = new Set(candidatos.map((c) => c.idInstalacion));
      const aplicables: GeocercaAplicable[] = [];
      for (const g of geocercasCliente) {
        if (g.idInstalacion == null) continue;
        const idInstalacion = Number(g.idInstalacion);
        if (!idsCandidatos.has(idInstalacion)) continue;
        const ring = extractOuterRing(g.geocerca);
        if (!ring) continue;
        aplicables.push({
          id: Number(g.id),
          nombre: g.nombre,
          idInstalacion,
          ring,
          geometria: g.geocerca,
        });
      }
      if (!aplicables.length) {
        return this.armarRespuestaSalidas(
          {
            idCliente,
            nombreCliente,
            fechaInicio,
            fechaFinal,
            resumen: { ...resumenVacio, geocercasEvaluadas: 0 },
          },
          [],
          paginar,
          page,
          limit,
        );
      }

      const porInstalacion = new Map<number, GeocercaAplicable[]>();
      for (const g of aplicables) {
        const list = porInstalacion.get(g.idInstalacion);
        if (list) list.push(g);
        else porInstalacion.set(g.idInstalacion, [g]);
      }
      const candidatosConGeocerca = candidatos.filter((c) =>
        porInstalacion.has(c.idInstalacion),
      );

      const salidas = await this.detectarSalidasParaCandidatos({
        candidatos: candidatosConGeocerca,
        porInstalacion,
        idCliente,
        nombreCliente,
        fechaInicio,
        fechaFinal,
      });

      return this.armarRespuestaSalidas(
        {
          idCliente,
          nombreCliente,
          fechaInicio,
          fechaFinal,
          resumen: {
            totalSalidas: salidas.length,
            totalDispositivos: new Set(salidas.map((s) => s.idDispositivo))
              .size,
            totalGeocercas: new Set(salidas.map((s) => s.idGeocerca)).size,
            instalacionesEvaluadas: candidatosConGeocerca.length,
            geocercasEvaluadas: aplicables.length,
          },
        },
        salidas,
        paginar,
        page,
        limit,
      );
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  /**
   * Arma la respuesta de `salidasGeocerca`: ordena de la salida más reciente a
   * la más antigua y, si se pidió, corta la página. El resumen se recibe ya
   * calculado sobre el total.
   */
  private armarRespuestaSalidas(
    base: Omit<SalidasGeocercaResult, 'salidas'>,
    salidas: SalidaGeocercaItem[],
    paginar: boolean,
    page: number,
    limit: number,
  ): { data: SalidasGeocercaResult; paginated?: Paginated } {
    const ordenadas = [...salidas].sort(
      (a, b) =>
        String(b.fechaSalida ?? '').localeCompare(String(a.fechaSalida ?? '')) ||
        a.idDispositivo - b.idDispositivo ||
        a.idGeocerca - b.idGeocerca,
    );
    if (!paginar) {
      return { data: { ...base, salidas: ordenadas } };
    }
    const total = ordenadas.length;
    const inicio = (page - 1) * limit;
    return {
      data: { ...base, salidas: ordenadas.slice(inicio, inicio + limit) },
      paginated: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 0,
      },
    };
  }

  /**
   * Salidas de geocerca de UNA sola instalación.
   * El cliente se deriva de la instalación y se valida contra el token:
   * instalación inexistente → 404; cliente fuera de alcance → 403.
   * Solo lectura, igual que `salidasGeocerca`.
   */
  async obtenerSalidasGeocercaPorInstalacion(
    dto: ReporteSalidasGeocercaInstalacionDto,
    idClienteToken: number,
    rol: number,
    idUsuario: number,
  ): Promise<{ data: SalidasGeocercaInstalacionResult }> {
    try {
      const idInstalacion = Number(dto.idInstalacion);

      let fechaInicio: string;
      let fechaFinal: string;
      try {
        fechaInicio = parseFechaHistorico(dto.fechaInicio);
        fechaFinal = parseFechaHistorico(dto.fechaFinal);
      } catch {
        throw new BadRequestException(
          'fechaInicio / fechaFinal tienen un formato inválido',
        );
      }
      if (fechaInicio > fechaFinal) {
        throw new BadRequestException(
          'fechaInicio no puede ser posterior a fechaFinal',
        );
      }

      const instalacionRaw = await this.instalacionesRepo.findOne({
        where: { id: idInstalacion },
        select: [
          'id',
          'idCliente',
          'idDispositivo',
          'idProducto',
          'vigenteDesde',
          'idHistoricoInstalacion',
          'estatus',
        ],
      });
      if (!instalacionRaw) {
        throw new NotFoundException('Instalación no encontrada');
      }
      const idCliente = Number(instalacionRaw.idCliente);
      await this.assertClienteEnAlcance(rol, idClienteToken, idCliente);
      // Roles 7/9 (F5): además del cliente, la instalación debe estar asignada.
      await this.assertInstalacionAsignada(
        { userId: idUsuario, idCliente: idClienteToken, rol },
        idInstalacion,
      );

      const cliente = await this.clientesRepo.findOne({
        where: { id: idCliente },
      });
      const nombreCliente = nombreClienteRelacion(cliente);

      const candidatos = await this.cargarInstalacionesCandidatas(idCliente, [
        idInstalacion,
      ]);
      const cand = candidatos[0] ?? null;
      const instalacion: InstalacionSalidaGeocercaItem | null = cand
        ? {
            idInstalacion: cand.idInstalacion,
            idDispositivo: cand.idDispositivo,
            imei: cand.imei,
            numeroSerie: cand.numeroSerie,
            placas: cand.placaVehiculo,
            economico: cand.ecoVehiculo,
            idProducto: cand.idProducto,
            nombreProducto: cand.nombreProducto,
          }
        : {
            idInstalacion,
            idDispositivo: null,
            imei: null,
            numeroSerie: null,
            placas: null,
            economico: null,
            idProducto: null,
            nombreProducto: null,
          };

      const idsSolicitados = this.normalizeIds(dto.idsGeocerca);
      const geocercasCliente = await this.cargarGeocercasDelCliente(
        idCliente,
        idsSolicitados,
      );

      // Explícitas de este cliente pero asociadas a otra instalación (o sin
      // instalación) no son aplicables a la seleccionada → 400.
      if (idsSolicitados?.length) {
        const noAplicables = geocercasCliente.filter(
          (g) => g.idInstalacion == null || Number(g.idInstalacion) !== idInstalacion,
        );
        if (noAplicables.length) {
          throw new BadRequestException(
            `Las geocercas no están asociadas a la instalación ${idInstalacion}: ${noAplicables
              .map((g) => Number(g.id))
              .join(', ')}`,
          );
        }
      }

      const aplicables: GeocercaAplicable[] = [];
      for (const g of geocercasCliente) {
        if (g.idInstalacion == null || Number(g.idInstalacion) !== idInstalacion) {
          continue;
        }
        const ring = extractOuterRing(g.geocerca);
        if (!ring) continue;
        aplicables.push({
          id: Number(g.id),
          nombre: g.nombre,
          idInstalacion,
          ring,
          geometria: g.geocerca,
        });
      }

      // Dispositivo(s) de ESTA instalación durante el periodo, según la
      // cadena Instalaciones vigente → HistoricoInstalaciones. Nunca se
      // recorren las demás instalaciones ni dispositivos del cliente.
      const dispositivosEnPeriodo =
        await this.resolverDispositivosEnPeriodo({
          instalacionRaw,
          idCliente,
          fechaInicio,
          fechaFinal,
        });

      if (!cand || !aplicables.length || !dispositivosEnPeriodo.length) {
        return {
          data: {
            idCliente,
            nombreCliente,
            fechaInicio,
            fechaFinal,
            instalacion,
            dispositivosEnPeriodo,
            resumen: {
              totalSalidas: 0,
              totalGeocercas: 0,
              geocercasEvaluadas: aplicables.length,
            },
            salidas: [],
          },
        };
      }

      const salidas = await this.detectarSalidasPorTramos({
        idCliente,
        nombreCliente,
        idInstalacion,
        cand,
        tramos: dispositivosEnPeriodo,
        geocercas: aplicables,
      });

      return {
        data: {
          idCliente,
          nombreCliente,
          fechaInicio,
          fechaFinal,
          instalacion,
          dispositivosEnPeriodo,
          resumen: {
            totalSalidas: salidas.length,
            totalGeocercas: new Set(salidas.map((s) => s.idGeocerca)).size,
            geocercasEvaluadas: aplicables.length,
          },
          salidas,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  /**
   * Recorrido posterior a una salida de geocerca de una instalación.
   *
   * A diferencia del listado, NO se detiene en el reingreso: devuelve las
   * posiciones GPS cronológicas de la instalación desde el evento hasta
   * `fechaFinal` (o la última disponible en modo explícito), incluyendo
   * reingresos y nuevas salidas, con paginación por cursor.
   *
   * Seguridad: instalación 404 si no existe, 403 si su cliente está fuera
   * del alcance del token, geocerca 404 si no es del cliente y 400 si no
   * aplica a la instalación. `UsuariosGeocerca` es solo una asociación
   * administrativa (los listados de geocercas filtran por cliente, no por
   * usuario), por lo que no se usa como regla de visibilidad.
   * El evento se verifica re-ejecutando el mismo detector del listado.
   */
  async obtenerRecorridoSalidaGeocerca(
    dto: RecorridoSalidaGeocercaDto,
    idClienteToken: number,
    rol: number,
    idUsuario: number,
  ): Promise<{ data: RecorridoSalidaGeocercaResult }> {
    try {
      const idInstalacion = Number(dto.idInstalacion);
      const idGeocerca = Number(dto.idGeocerca);
      const hastaUltima = dto.hastaUltimaPosicion === true;
      const limite = dto.limite != null ? Number(dto.limite) : 500;

      const parse = (raw: string | undefined, campo: string): string => {
        try {
          return parseFechaHistorico(raw ?? '');
        } catch {
          throw new BadRequestException(
            `${campo} tiene un formato inválido`,
          );
        }
      };
      const fechaSalidaNorm = parse(dto.fechaSalida, 'fechaSalida');
      const fechaInicioCtx = dto.fechaInicio
        ? parse(dto.fechaInicio, 'fechaInicio')
        : fechaSalidaNorm;
      let fechaFinalNorm = dto.fechaFinal
        ? parse(dto.fechaFinal, 'fechaFinal')
        : null;
      if (!fechaFinalNorm && !hastaUltima) {
        throw new BadRequestException(
          'fechaFinal es obligatoria salvo que hastaUltimaPosicion sea true',
        );
      }
      if (fechaFinalNorm && fechaSalidaNorm > fechaFinalNorm) {
        throw new BadRequestException(
          'fechaSalida no puede ser posterior a fechaFinal',
        );
      }
      if (fechaFinalNorm && fechaInicioCtx > fechaFinalNorm) {
        throw new BadRequestException(
          'fechaInicio no puede ser posterior a fechaFinal',
        );
      }

      let cursorDecodificado: { fechaHora: string; idPosicion: number } | null =
        null;
      if (dto.cursor) {
        try {
          cursorDecodificado = decodificarCursorRecorrido(dto.cursor);
        } catch {
          throw new BadRequestException('cursor de paginación inválido');
        }
      }

      const instalacionRaw = await this.instalacionesRepo.findOne({
        where: { id: idInstalacion },
        select: [
          'id',
          'idCliente',
          'idDispositivo',
          'idProducto',
          'vigenteDesde',
          'idHistoricoInstalacion',
          'estatus',
        ],
      });
      if (!instalacionRaw) {
        throw new NotFoundException('Instalación no encontrada');
      }
      const idCliente = Number(instalacionRaw.idCliente);
      await this.assertClienteEnAlcance(rol, idClienteToken, idCliente);
      // Roles 7/9 (F5): además del cliente, la instalación debe estar asignada.
      await this.assertInstalacionAsignada(
        { userId: idUsuario, idCliente: idClienteToken, rol },
        idInstalacion,
      );

      const cliente = await this.clientesRepo.findOne({
        where: { id: idCliente },
      });
      const nombreCliente = nombreClienteRelacion(cliente);

      const candidatos = await this.cargarInstalacionesCandidatas(idCliente, [
        idInstalacion,
      ]);
      const cand = candidatos[0] ?? null;
      if (!cand) {
        throw new NotFoundException(
          'Evento de salida no encontrado para esa instalación',
        );
      }
      const instalacion: InstalacionSalidaGeocercaItem = {
        idInstalacion: cand.idInstalacion,
        idDispositivo: cand.idDispositivo,
        imei: cand.imei,
        numeroSerie: cand.numeroSerie,
        placas: cand.placaVehiculo,
        economico: cand.ecoVehiculo,
        idProducto: cand.idProducto,
        nombreProducto: cand.nombreProducto,
      };

      const [geocerca] = await this.cargarGeocercasDelCliente(idCliente, [
        idGeocerca,
      ]);
      if (
        geocerca.idInstalacion == null ||
        Number(geocerca.idInstalacion) !== idInstalacion
      ) {
        throw new BadRequestException(
          'La geocerca no está asociada a la instalación seleccionada',
        );
      }
      const ring = extractOuterRing(geocerca.geocerca);
      if (!ring) {
        throw new BadRequestException(
          'La geocerca no tiene una geometría válida para evaluar posiciones',
        );
      }
      const aplicable: GeocercaAplicable = {
        id: Number(geocerca.id),
        nombre: geocerca.nombre,
        idInstalacion,
        ring,
        geometria: geocerca.geocerca,
      };

      // Ventana de verificación: desde el contexto hasta el fin efectivo.
      const ventanaInicio =
        fechaInicioCtx < fechaSalidaNorm ? fechaInicioCtx : fechaSalidaNorm;
      const CAP_FUTURO = '9999-12-31 23:59:59';
      const tramosVentana = await this.resolverDispositivosEnPeriodo({
        instalacionRaw,
        idCliente,
        fechaInicio: ventanaInicio,
        fechaFinal: fechaFinalNorm ?? CAP_FUTURO,
      });
      if (!tramosVentana.length) {
        throw new NotFoundException(
          'Evento de salida no encontrado para esa instalación',
        );
      }

      // Modo explícito hasta última posición: el fin efectivo es la última
      // posición GPS disponible de los tramos (nunca una consulta abierta
      // sin este modo y sin fechaFinal).
      let fechaFinalEfectiva = fechaFinalNorm;
      if (!fechaFinalEfectiva) {
        const ultima = await this.consultarUltimaPosicionDeTramos({
          tramos: tramosVentana,
          desde: fechaSalidaNorm,
          hasta: CAP_FUTURO,
          ring,
        });
        fechaFinalEfectiva = ultima
          ? (ultima.fechaHora ?? fechaSalidaNorm).replace('T', ' ')
          : fechaSalidaNorm;
      }

      const tramosDeteccion =
        fechaFinalNorm == null
          ? await this.resolverDispositivosEnPeriodo({
              instalacionRaw,
              idCliente,
              fechaInicio: ventanaInicio,
              fechaFinal: fechaFinalEfectiva,
            })
          : tramosVentana;

      const eventos = await this.detectarSalidasPorTramos({
        idCliente,
        nombreCliente,
        idInstalacion,
        cand,
        tramos: tramosDeteccion,
        geocercas: [aplicable],
      });
      const fechaSalidaT = fechaSalidaNorm.replace(' ', 'T');
      const evento = eventos.find(
        (e) =>
          e.fechaSalida === fechaSalidaT &&
          (dto.idPosicionSalida == null ||
            e.primeraPosicionFuera.idPosicion ===
              Number(dto.idPosicionSalida)),
      );
      if (!evento) {
        throw new NotFoundException(
          'Evento de salida no encontrado para esa instalación, geocerca y fecha indicada',
        );
      }

      // El recorrido inicia siempre en la salida seleccionada.
      const desdeRecorrido = fechaSalidaNorm;
      const tramosRecorrido: DispositivoEnPeriodoItem[] = tramosDeteccion
        .map((t) => ({
          ...t,
          desde: t.desde > desdeRecorrido ? t.desde : desdeRecorrido,
          hasta:
            t.hasta < fechaFinalEfectiva ? t.hasta : fechaFinalEfectiva,
        }))
        .filter((t) => t.desde <= t.hasta);

      const crudas: Array<Record<string, unknown> & { __imei: string; __idDispositivo: number }> = [];
      for (const tramo of tramosRecorrido) {
        const filas = await this.consultarPosicionesRecorridoTramo({
          imei: tramo.imei,
          desde: tramo.desde,
          hasta: tramo.hasta,
          cursor: cursorDecodificado,
          limiteMasUno: limite + 1,
        });
        for (const f of filas) {
          crudas.push({
            ...f,
            fechaHora:
              formatFechaPosicion(
                f.fechaHora as string | Date | null | undefined,
              ) ?? '',
            __imei: tramo.imei,
            __idDispositivo: tramo.idDispositivo,
          });
        }
      }
      crudas.sort(
        (a, b) =>
          String(a.fechaHora ?? '').localeCompare(
            String(b.fechaHora ?? ''),
          ) || Number(a.id) - Number(b.id),
      );

      let invalidas = 0;
      let duplicadas = 0;
      const vistos = new Set<string>();
      const validas: RecorridoPosicionItem[] = [];
      for (const row of crudas) {
        const lat = Number(row.lat);
        const lng = Number(row.lng);
        const fechaHora = formatFechaPosicion(
          row.fechaHora as string | Date | null | undefined,
        );
        const estadoRel = estadoRespectoGeocerca(lat, lng, ring);
        if (estadoRel == null || !fechaHora) {
          invalidas += 1;
          continue;
        }
        const clave = `${row.__imei}|${fechaHora}|${lat}|${lng}`;
        if (vistos.has(clave)) {
          duplicadas += 1;
          continue;
        }
        vistos.add(clave);
        validas.push({
          idPosicion: Number(row.id),
          idDispositivo: row.__idDispositivo,
          imei: row.__imei,
          fechaHora,
          lat,
          lng,
          velocidad: num(row.velocidad),
          estado: num(row.estado),
          ignicion: num(row.ignicion),
          estadoRespectoGeocerca: estadoRel,
        });
      }

      const posiciones = validas.slice(0, limite);
      const hayMas = validas.length > limite;
      const ultimaPagina = posiciones[posiciones.length - 1] ?? null;
      const cursorSiguiente =
        hayMas && ultimaPagina?.fechaHora
          ? codificarCursorRecorrido(
              ultimaPagina.fechaHora,
              ultimaPagina.idPosicion,
            )
          : null;

      const transiciones: RecorridoSalidaGeocercaResult['transiciones'] = [];
      for (const e of eventos) {
        if (!e.fechaSalida || e.fechaSalida < fechaSalidaT) continue;
        transiciones.push({
          tipo: 'SALIDA',
          fechaHora: e.fechaSalida,
          idPosicion: e.primeraPosicionFuera.idPosicion,
          idGeocerca,
        });
        if (e.fechaReingreso && e.posicionReingreso) {
          transiciones.push({
            tipo: 'REINGRESO',
            fechaHora: e.fechaReingreso,
            idPosicion: e.posicionReingreso.idPosicion,
            idGeocerca,
          });
        }
      }
      transiciones.sort(
        (a, b) =>
          String(a.fechaHora ?? '').localeCompare(
            String(b.fechaHora ?? ''),
          ) || a.idPosicion - b.idPosicion,
      );

      const ultimaPosicion = await this.consultarUltimaPosicionDeTramos({
        tramos: tramosRecorrido,
        desde: desdeRecorrido,
        hasta: fechaFinalEfectiva,
        ring,
      });
      const fechaFinalT = fechaFinalEfectiva.replace(' ', 'T');
      const segSinTransmision = ultimaPosicion?.fechaHora
        ? duracionSegundosEntre(ultimaPosicion.fechaHora, fechaFinalT)
        : null;

      return {
        data: {
          instalacion,
          geocerca: {
            idGeocerca,
            nombre: geocerca.nombre,
            geometria: geocerca.geocerca,
          },
          eventoSeleccionado: evento,
          rangoEfectivo: {
            fechaInicio: desdeRecorrido,
            fechaFinal: fechaFinalEfectiva,
            hastaUltimaPosicion: hastaUltima,
          },
          dispositivosEnPeriodo: tramosRecorrido,
          posiciones,
          transiciones,
          ultimaPosicion,
          paginacion: {
            limite,
            devueltas: posiciones.length,
            hayMas,
            cursorSiguiente,
          },
          avisos: {
            posicionesInvalidasOmitidas: invalidas,
            posicionesDuplicadasOmitidas: duplicadas,
            huecosTransmision: detectarHuecosTransmision(posiciones, 900),
            ultimaPosicionDesactualizada:
              segSinTransmision != null && segSinTransmision > 900,
            segundosSinTransmisionAlFinDelRango: segSinTransmision,
            limitaciones: [
              'La última posición es el último GPS dentro del rango: no confirma el estado actual en tiempo real si no hay transmisión reciente.',
              'En eventos SIN_REINGRESO, duracionFueraSegundos es null: no equivale al tiempo transcurrido hasta fechaFinal ni hasta hoy.',
              'Sin historial de geometrías de geocercas: estadoRespectoGeocerca se calcula con la geometría actual de la geocerca, no necesariamente la vigente en la fecha de cada posición.',
              'Los huecos de transmisión (> 900 s entre posiciones de esta página) indican ausencia de evidencia de trayectoria continua; no se interpolan posiciones.',
            ],
          },
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  /** Posiciones crudas de un tramo para el recorrido (con cursor). */
  private async consultarPosicionesRecorridoTramo(args: {
    imei: string;
    desde: string;
    hasta: string;
    cursor: { fechaHora: string; idPosicion: number } | null;
    limiteMasUno: number;
  }): Promise<Array<Record<string, unknown>>> {
    const { imei, desde, hasta, cursor, limiteMasUno } = args;
    const qb = this.instalacionesRepo.manager
      .getRepository(Posiciones)
      .createQueryBuilder('p')
      .select([
        'p.id AS id',
        'CAST(p.imei AS CHAR) AS imei',
        'p.lat AS lat',
        'p.lng AS lng',
        'p.fechaHora AS fechaHora',
        'p.velocidad AS velocidad',
        'p.estado AS estado',
        'p.ignicion AS ignicion',
      ])
      .where('p.imei = :imei', { imei })
      .andWhere('p.fechaHora >= :desde', { desde })
      .andWhere('p.fechaHora <= :hasta', { hasta });
    if (cursor) {
      const cursorFechaDb = cursor.fechaHora.replace('T', ' ');
      qb.andWhere(
        '(p.fechaHora > :cursorFecha OR (p.fechaHora = :cursorFecha AND p.id > :cursorId))',
        { cursorFecha: cursorFechaDb, cursorId: cursor.idPosicion },
      );
    }
    return qb
      .orderBy('p.fechaHora', 'ASC')
      .addOrderBy('p.id', 'ASC')
      .limit(limiteMasUno)
      .getRawMany<Record<string, unknown>>();
  }

  /** Última posición válida de los tramos en [desde, hasta] (o null). */
  private async consultarUltimaPosicionDeTramos(args: {
    tramos: DispositivoEnPeriodoItem[];
    desde: string;
    hasta: string;
    ring: Array<[number, number]>;
  }): Promise<RecorridoPosicionItem | null> {
    const { tramos, desde, hasta, ring } = args;
    let mejor: RecorridoPosicionItem | null = null;
    for (const tramo of tramos) {
      const desdeT = tramo.desde > desde ? tramo.desde : desde;
      const hastaT = tramo.hasta < hasta ? tramo.hasta : hasta;
      if (desdeT > hastaT) continue;
      const row = await this.instalacionesRepo.manager
        .getRepository(Posiciones)
        .createQueryBuilder('p')
        .select([
          'p.id AS id',
          'p.lat AS lat',
          'p.lng AS lng',
          'p.fechaHora AS fechaHora',
          'p.velocidad AS velocidad',
          'p.estado AS estado',
          'p.ignicion AS ignicion',
        ])
        .where('p.imei = :imei', { imei: tramo.imei })
        .andWhere('p.fechaHora >= :desde', { desde: desdeT })
        .andWhere('p.fechaHora <= :hasta', { hasta: hastaT })
        .andWhere('p.lat BETWEEN -90 AND 90')
        .andWhere('p.lng BETWEEN -180 AND 180')
        .andWhere('NOT (p.lat = 0 AND p.lng = 0)')
        .orderBy('p.fechaHora', 'DESC')
        .addOrderBy('p.id', 'DESC')
        .limit(1)
        .getRawOne<Record<string, unknown>>();
      if (!row) continue;
      const fechaHora = formatFechaPosicion(
        row.fechaHora as string | Date | null | undefined,
      );
      if (!fechaHora) continue;
      const item: RecorridoPosicionItem = {
        idPosicion: Number(row.id),
        idDispositivo: tramo.idDispositivo,
        imei: tramo.imei,
        fechaHora,
        lat: Number(row.lat),
        lng: Number(row.lng),
        velocidad: num(row.velocidad),
        estado: num(row.estado),
        ignicion: num(row.ignicion),
        estadoRespectoGeocerca: estadoRespectoGeocerca(
          Number(row.lat),
          Number(row.lng),
          ring,
        ),
      };
      if (
        !mejor ||
        String(item.fechaHora).localeCompare(String(mejor.fechaHora)) > 0 ||
        (item.fechaHora === mejor.fechaHora &&
          item.idPosicion > mejor.idPosicion)
      ) {
        mejor = item;
      }
    }
    return mejor;
  }

  /**
   * Dispositivos asociados a UNA instalación durante el periodo: sus tramos de
   * vigencia (TramosInstalacionService, docs/motor-activos.md §6) recortados al
   * periodo. Solo se consultan posiciones del IMEI de cada tramo dentro de su
   * vigencia, nunca otros dispositivos del cliente.
   */
  private async resolverDispositivosEnPeriodo(args: {
    instalacionRaw: Instalaciones;
    idCliente: number;
    fechaInicio: string;
    fechaFinal: string;
  }): Promise<DispositivoEnPeriodoItem[]> {
    const { instalacionRaw, idCliente, fechaInicio, fechaFinal } = args;

    type Tramo = DispositivoEnPeriodoItem & { idTipoDispositivo: number | null };
    const tramosBase = recortarTramos(
      await this.tramos.tramosDeInstalacion(Number(instalacionRaw.id)),
      fechaInicio,
      fechaFinal,
    );
    if (!tramosBase.length) return [];

    // Una sola consulta por los dispositivos de los tramos (no del cliente).
    const idsDispositivo = [
      ...new Set(tramosBase.map((t) => t.idDispositivo)),
    ];
    const dispRows = await this.instalacionesRepo.manager
      .getRepository(Dispositivos)
      .createQueryBuilder('d')
      .select([
        'd.id AS id',
        'CAST(d.imei AS CHAR) AS imei',
        'd.numeroSerie AS numeroSerie',
        'd.idTipoDispositivo AS idTipoDispositivo',
      ])
      // Sin filtrar por cliente: el equipo de un tramo pasado puede estar hoy en otro.
      .where('d.id IN (:...ids)', { ids: idsDispositivo })
      .getRawMany<Record<string, unknown>>();
    const dispById = new Map(
      dispRows.map((r) => [
        Number(r.id),
        {
          imei: imeiToString(r.imei) ?? '',
          numeroSerie: str(r.numeroSerie),
          idTipoDispositivo: num(r.idTipoDispositivo),
        },
      ]),
    );

    // Placas/económico del producto vigente en cada tramo (una consulta).
    const idsProducto = [
      ...new Set(
        tramosBase
          .map((t) => t.idProducto)
          .filter((id): id is number => id != null),
      ),
    ];
    const vehByProducto = new Map<
      number,
      { placas: string | null; economico: string | null }
    >();
    if (idsProducto.length) {
      const vehRows = await this.instalacionesRepo.manager
        .getRepository(Vehiculos)
        .createQueryBuilder('v')
        .select([
          'v.idProducto AS idProducto',
          'v.placa AS placa',
          'v.numeroEconomico AS numeroEconomico',
        ])
        .where('v.idProducto IN (:...ids)', { ids: idsProducto })
        .andWhere('v.idCliente = :idCliente', { idCliente })
        .getRawMany<Record<string, unknown>>();
      for (const r of vehRows) {
        vehByProducto.set(Number(r.idProducto), {
          placas: str(r.placa),
          economico: str(r.numeroEconomico),
        });
      }
    }

    const tramos: Tramo[] = [];
    for (const t of tramosBase) {
      const disp = dispById.get(t.idDispositivo);
      if (!disp || !disp.imei) continue;
      if (disp.idTipoDispositivo === EnumTipoDispositivo.PANEL_ALARMA) {
        continue;
      }
      const veh = t.idProducto != null ? vehByProducto.get(t.idProducto) : undefined;
      tramos.push({
        idDispositivo: t.idDispositivo,
        idProducto: t.idProducto,
        imei: disp.imei,
        numeroSerie: disp.numeroSerie,
        placas: veh?.placas ?? null,
        economico: veh?.economico ?? null,
        vigenteDesde: t.vigenteDesde,
        vigenteHasta: t.vigenteHasta,
        desde: t.desde,
        hasta: t.hasta,
        idTipoDispositivo: disp.idTipoDispositivo,
      });
    }

    return fusionarSegmentosConsecutivos(tramos).map(
      ({ idTipoDispositivo: _omit, ...resto }) => resto,
    );
  }

  /**
   * Detección por tramos de dispositivo de una sola instalación.
   * Por cada tramo: una consulta de posiciones de su IMEI restringida en BD
   * a [desde, hasta] (vigencia ∩ periodo) y la posición anterior solo dentro
   * de la misma asignación (no evidencia de otro dispositivo/instalación).
   */
  private async detectarSalidasPorTramos(args: {
    idCliente: number;
    nombreCliente: string | null;
    idInstalacion: number;
    cand: InstalacionCandidata;
    tramos: DispositivoEnPeriodoItem[];
    geocercas: GeocercaAplicable[];
  }): Promise<SalidaGeocercaItem[]> {
    const { idCliente, nombreCliente, idInstalacion, tramos, geocercas } =
      args;
    const salidas: SalidaGeocercaItem[] = [];

    for (const tramo of tramos) {
      const candidatoTramo: InstalacionCandidata = {
        idInstalacion,
        idDispositivo: tramo.idDispositivo,
        imei: tramo.imei,
        numeroSerie: tramo.numeroSerie,
        ...productoPlanoVacio(),
        idProducto: tramo.idProducto,
        placaVehiculo: tramo.placas,
        ecoVehiculo: tramo.economico,
      };

      const posiciones = await this.consultarPosicionesCronologicas([
        {
          ...candidatoTramo,
          tramo: {
            idInstalacion,
            idDispositivo: tramo.idDispositivo,
            idProducto: tramo.idProducto,
            imei: tramo.imei,
            desde: tramo.desde,
            hasta: tramo.hasta,
            vigenteDesde: tramo.vigenteDesde ?? tramo.desde,
            vigenteHasta: tramo.vigenteHasta,
            hastaExclusivo: tramo.vigenteHasta != null && tramo.hasta === tramo.vigenteHasta,
          },
        },
      ]);
      const serie = posiciones.map((p) => p.row);
      if (!serie.length) continue;

      const posicionAnterior = await this.consultarPosicionAnterior(
        tramo.imei,
        tramo.desde,
        tramo.vigenteDesde,
      );

      for (const geocerca of geocercas) {
        const detectadas = detectarSalidasGeocerca({
          posiciones: serie,
          posicionAnterior,
          ring: geocerca.ring,
        });
        for (const d of detectadas) {
          // Sin reingreso: tiempo comprobado hasta la última posición del periodo (está fuera).
          const hasta =
            d.fechaReingreso ?? serie[serie.length - 1]?.fechaHora ?? null;
          const tiempoAcumuladoSegundos =
            d.duracionFueraSegundos ??
            (d.fechaSalida && hasta
              ? duracionSegundosEntre(d.fechaSalida, hasta)
              : null);
          salidas.push({
            idCliente,
            nombreCliente,
            idInstalacion,
            idDispositivo: tramo.idDispositivo,
            imei: tramo.imei,
            numeroSerie: tramo.numeroSerie,
            placas: tramo.placas,
            economico: tramo.economico,
            idGeocerca: geocerca.id,
            nombreGeocerca: geocerca.nombre,
            geocercaGeometria: geocerca.geometria,
            tiempoAcumuladoSegundos,
            tiempoAcumuladoHasta: hasta,
            ...d,
          });
        }
      }
    }

    salidas.sort(
      (a, b) =>
        String(a.fechaSalida ?? '').localeCompare(
          String(b.fechaSalida ?? ''),
        ) ||
        a.idDispositivo - b.idDispositivo ||
        a.idGeocerca - b.idGeocerca,
    );
    return salidas;
  }

  /**
   * Núcleo de detección compartido por los reportes de salidas de geocerca.
   * Una sola consulta histórica para todos los IMEI (índice
   * `IX_Posiciones_Imei_Fecha`), orden cronológico ASC + id ASC.
   */
  private async detectarSalidasParaCandidatos(args: {
    candidatos: InstalacionCandidata[];
    porInstalacion: Map<number, GeocercaAplicable[]>;
    idCliente: number;
    nombreCliente: string | null;
    fechaInicio: string;
    fechaFinal: string;
  }): Promise<SalidaGeocercaItem[]> {
    const { candidatos, porInstalacion, idCliente, nombreCliente } = args;
    const { fechaInicio, fechaFinal } = args;
    if (!candidatos.length) return [];

    // Una candidata por tramo de vigencia (§6): cada equipo que tuvo la
    // instalación, solo mientras estuvo instalado.
    const porTramo = await this.candidatasPorTramo(candidatos, fechaInicio, fechaFinal);
    const posiciones = await this.consultarPosicionesCronologicas(porTramo);
    const porCandidata = new Map<CandidataEnTramo<InstalacionCandidata>, PosicionCronologicaGeocerca[]>();
    for (const p of posiciones) {
      const list = porCandidata.get(p.cand);
      if (list) list.push(p.row);
      else porCandidata.set(p.cand, [p.row]);
    }

    const salidas: SalidaGeocercaItem[] = [];
    for (const cand of porTramo) {
      const imei = cand.imei;
      const serie = porCandidata.get(cand) ?? [];
      if (!serie.length) continue;

      const geocercas = porInstalacion.get(cand.idInstalacion) ?? [];
      // Última posición previa al periodo, dentro de la vigencia del tramo
      // (1 query indexada por IMEI y solo para equipos con posiciones en el
      // periodo): permite confirmar la salida si la primera ya está fuera.
      const posicionAnterior = await this.consultarPosicionAnterior(
        imei,
        cand.tramo.desde,
        cand.tramo.vigenteDesde,
      );

      for (const geocerca of geocercas) {
        const detectadas = detectarSalidasGeocerca({
          posiciones: serie,
          posicionAnterior,
          ring: geocerca.ring,
        });
        for (const d of detectadas) {
          // Sin reingreso: tiempo comprobado hasta la última posición del periodo (está fuera).
          const hasta =
            d.fechaReingreso ?? serie[serie.length - 1]?.fechaHora ?? null;
          const tiempoAcumuladoSegundos =
            d.duracionFueraSegundos ??
            (d.fechaSalida && hasta
              ? duracionSegundosEntre(d.fechaSalida, hasta)
              : null);
          salidas.push({
            idCliente,
            nombreCliente,
            idInstalacion: cand.idInstalacion,
            idDispositivo: cand.idDispositivo,
            imei: cand.imei,
            numeroSerie: cand.numeroSerie,
            placas: cand.placaVehiculo,
            economico: cand.ecoVehiculo,
            idGeocerca: geocerca.id,
            nombreGeocerca: geocerca.nombre,
            geocercaGeometria: geocerca.geometria,
            tiempoAcumuladoSegundos,
            tiempoAcumuladoHasta: hasta,
            ...d,
          });
        }
      }
    }

    salidas.sort(
      (a, b) =>
        String(a.fechaSalida ?? '').localeCompare(
          String(b.fechaSalida ?? ''),
        ) ||
        a.idDispositivo - b.idDispositivo ||
        a.idGeocerca - b.idGeocerca,
    );
    return salidas;
  }

  /**
   * Geocercas activas del cliente. Con `ids` explícitos, todos deben existir
   * y pertenecer al cliente (404 en caso contrario, igual que paso-por-poi).
   */
  private async cargarGeocercasDelCliente(
    idCliente: number,
    ids: number[] | null,
  ): Promise<Geocercas[]> {
    if (!ids?.length) {
      return this.geocercasRepo.find({
        where: { idCliente, estatus: EstatusEnum.ACTIVO },
        order: { id: 'ASC' },
      });
    }
    const rows = await this.geocercasRepo.find({
      where: { id: In(ids), idCliente, estatus: EstatusEnum.ACTIVO },
    });
    const byId = new Map(rows.map((r) => [Number(r.id), r]));
    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length) {
      throw new NotFoundException(
        `Geocercas no encontradas, inactivas o no pertenecen al cliente: ${missing.join(', ')}`,
      );
    }
    return ids.map((id) => byId.get(id)!);
  }

  /** Posiciones del periodo en orden cronológico (ASC fechaHora, ASC id). */
  /** Posiciones de candidatas ya expandidas por tramo, con la candidata dueña de cada una. */
  private async consultarPosicionesCronologicas<T extends InstalacionCandidata>(
    porTramo: Array<CandidataEnTramo<T>>,
  ): Promise<Array<{ imei: string; cand: CandidataEnTramo<T>; row: PosicionCronologicaGeocerca }>> {
    if (!porTramo.length) return [];
    const enTramos = condicionTramos('p', porTramo.map((c) => c.tramo));

    const rows = await this.instalacionesRepo.manager
      .getRepository(Posiciones)
      .createQueryBuilder('p')
      .select([
        'p.id AS id',
        'CAST(p.imei AS CHAR) AS imei',
        'p.lat AS lat',
        'p.lng AS lng',
        'p.fechaHora AS fechaHora',
      ])
      .where(enTramos.sql, enTramos.params)
      .orderBy('p.fechaHora', 'ASC')
      .addOrderBy('p.id', 'ASC')
      .getRawMany<Record<string, unknown>>();

    const result: Array<{
      imei: string;
      cand: CandidataEnTramo<T>;
      row: PosicionCronologicaGeocerca;
    }> = [];
    for (const row of rows) {
      const imei = imeiToString(row.imei);
      if (!imei) continue;
      const cand = ubicarCandidata(porTramo, imei, row.fechaHora);
      if (!cand) continue;
      result.push({
        imei,
        cand,
        row: {
          id: Number(row.id),
          lat: Number(row.lat),
          lng: Number(row.lng),
          fechaHora: formatFechaPosicion(
            row.fechaHora as string | Date | null | undefined,
          ),
        },
      });
    }
    return result;
  }

  /**
   * Última posición previa a `fechaInicio` para un IMEI (o null).
   * `fechaMinima` (inicio de vigencia del tramo) evita usar como evidencia
   * posiciones de cuando el dispositivo aún no estaba en esta instalación.
   */
  private async consultarPosicionAnterior(
    imei: string,
    fechaInicio: string,
    fechaMinima?: string | null,
  ): Promise<PosicionCronologicaGeocerca | null> {
    const qb = this.instalacionesRepo.manager
      .getRepository(Posiciones)
      .createQueryBuilder('p')
      .select([
        'p.id AS id',
        'p.lat AS lat',
        'p.lng AS lng',
        'p.fechaHora AS fechaHora',
      ])
      .where('p.imei = :imei', { imei })
      .andWhere('p.fechaHora < :fechaInicio', { fechaInicio });
    if (fechaMinima) {
      // El tramo empieza dentro del periodo: no hay posición previa en esta vigencia.
      if (fechaMinima >= fechaInicio) return null;
      qb.andWhere('p.fechaHora >= :fechaMinima', { fechaMinima });
    }
    const row = await qb
      .orderBy('p.fechaHora', 'DESC')
      .addOrderBy('p.id', 'DESC')
      .limit(1)
      .getRawOne<Record<string, unknown>>();
    if (!row) return null;
    return {
      id: Number(row.id),
      lat: Number(row.lat),
      lng: Number(row.lng),
      fechaHora: formatFechaPosicion(
        row.fechaHora as string | Date | null | undefined,
      ),
    };
  }

  private async assertClienteEnAlcance(
    rol: number,
    idClienteToken: number,
    idCliente: number,
  ): Promise<void> {
    const scope = await this.tenantFilter.idsClientePermitidos(
      rol,
      idClienteToken,
    );
    if (!this.tenantFilter.clienteVisibleEnScope(scope, idCliente)) {
      throw new ForbiddenException(
        'No puedes generar reportes para ese cliente',
      );
    }
  }

  /**
   * Roles 7/9 (F5): limita el filtro de instalaciones a las asignadas al
   * usuario en `UsuariosInstalaciones` (ver `limitarIdsInstalacionPorAsignacion`).
   * Demás roles: sin cambio (ya filtrados por cliente).
   */
  private async limitarPorAsignacion(
    user: UsuarioAlcance,
    idsFiltro: number[] | null,
  ): Promise<number[] | null> {
    const asignadas = await this.tenantFilter.idsInstalacionAsignadas(user);
    return limitarIdsInstalacionPorAsignacion(asignadas, idsFiltro);
  }

  /**
   * Roles 7/9 (F5): una instalación pedida por id que no tiene asignada → 404
   * (no se revela que existe). Demás roles: no-op (ya validado por cliente).
   */
  private async assertInstalacionAsignada(
    user: UsuarioAlcance,
    idInstalacion: number,
  ): Promise<void> {
    if (!this.tenantFilter.esPorAsignacion(user.rol)) return;
    await this.tenantFilter.assertInstalacionVisible(user, idInstalacion);
  }

  private normalizeIds(ids?: number[]): number[] | null {
    if (!ids?.length) return null;
    const unique = [
      ...new Set(
        ids
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    ];
    return unique.length ? unique : null;
  }

  private normalizeValores(valores?: string[]): string[] {
    if (!valores?.length) return [];
    return [
      ...new Set(
        valores
          .map((v) => String(v ?? '').trim())
          .filter((v) => v !== ''),
      ),
    ];
  }

  /**
   * `null` = sin filtro (todas las instalaciones del cliente).
   * `[]` = filtro aplicado sin coincidencias (respuesta vacía).
   * `soloVehiculos` limita a instalaciones con producto tipo vehículo.
   */
  private async resolverIdsInstalacionPorFiltro(
    idCliente: number,
    filtro: FiltroPasoPorPoi | undefined,
    valoresRaw?: string[],
    soloVehiculos = false,
  ): Promise<number[] | null> {
    if (filtro == null) return null;

    const valores = this.normalizeValores(valoresRaw);
    if (!valores.length) return [];

    const qb = this.instalacionesRepo
      .createQueryBuilder('i')
      .select('DISTINCT i.id', 'id')
      .where('i.idCliente = :idCliente', { idCliente })
      .andWhere('i.estatus = :activo', { activo: EstatusEnum.ACTIVO })
      .andWhere('i.idDispositivo IS NOT NULL');

    if (soloVehiculos) {
      qb.innerJoin(
        Productos,
        'prodFiltro',
        'prodFiltro.id = i.idProducto AND prodFiltro.idCliente = i.idCliente',
      ).andWhere('prodFiltro.idTipoProducto = :tipoVehiculo', {
        tipoVehiculo: EnumTipoProducto.VEHICULO,
      });
    }

    if (filtro === 'imei' || filtro === 'numeroSerie') {
      qb.innerJoin(
        Dispositivos,
        'd',
        'd.id = i.idDispositivo AND d.idCliente = i.idCliente',
      ).andWhere('d.idTipoDispositivo <> :panel', {
        panel: EnumTipoDispositivo.PANEL_ALARMA,
      });

      if (filtro === 'imei') {
        qb.andWhere('CAST(d.imei AS CHAR) IN (:...valores)', { valores });
      } else {
        qb.andWhere('d.numeroSerie IN (:...valores)', { valores });
      }
    } else {
      qb.innerJoin(
        Vehiculos,
        'v',
        'v.idProducto = i.idProducto AND v.idCliente = i.idCliente',
      )
        .innerJoin(
          Dispositivos,
          'd',
          'd.id = i.idDispositivo AND d.idCliente = i.idCliente',
        )
        .andWhere('d.idTipoDispositivo <> :panel', {
          panel: EnumTipoDispositivo.PANEL_ALARMA,
        });

      if (filtro === 'placa') {
        qb.andWhere('v.placa IN (:...valores)', { valores });
      } else {
        qb.andWhere('v.numeroEconomico IN (:...valores)', { valores });
      }
    }

    const rows = await qb.getRawMany<{ id: string | number }>();
    return rows
      .map((r) => Number(r.id))
      .filter((id) => Number.isFinite(id) && id > 0);
  }

  private async cargarPuntosDelCliente(
    idCliente: number,
    ids: number[],
  ): Promise<PoiNorm[]> {
    const rows = await this.puntosRepo.find({
      where: { id: In(ids), idCliente },
    });
    const byId = new Map(rows.map((r) => [Number(r.id), r]));
    const missing = ids.filter((id) => !byId.has(id));
    if (missing.length) {
      throw new NotFoundException(
        `Puntos de interés no encontrados o no pertenecen al cliente: ${missing.join(', ')}`,
      );
    }

    return ids.map((id) => {
      const poi = byId.get(id)!;
      return {
        id: Number(poi.id),
        nombre: poi.nombre,
        lat: Number(poi.lat),
        lng: Number(poi.lng),
        radioMetros:
          poi.radioMetros != null && Number(poi.radioMetros) > 0
            ? Number(poi.radioMetros)
            : 25,
      };
    });
  }

  private async cargarInstalacionesCandidatas(
    idCliente: number,
    idsFiltro: number[] | null,
  ): Promise<InstalacionCandidata[]> {
    const qb = this.instalacionesRepo
      .createQueryBuilder('i')
      // Equipo actual (puede no haber, o estar ya en otro cliente): los
      // equipos que cuentan salen de los tramos de vigencia (§6).
      .leftJoin(Dispositivos, 'd', 'd.id = i.idDispositivo')
      .leftJoin(
        Productos,
        'prod',
        'prod.id = i.idProducto AND prod.idCliente = i.idCliente',
      )
      .leftJoin(CatTipoProducto, 'tp', 'tp.id = prod.idTipoProducto')
      .leftJoin(
        Vehiculos,
        'v',
        'v.idProducto = i.idProducto AND v.idCliente = i.idCliente',
      )
      .leftJoin(CatMarcas, 'marVeh', 'marVeh.id = v.idMarcaVehiculo')
      .leftJoin(CatModelos, 'modVeh', 'modVeh.id = v.idModeloVehiculo')
      .leftJoin(CatTipoCombustible, 'tc', 'tc.id = v.idCombustible')
      .leftJoin(
        Activos,
        'a',
        'a.idProducto = i.idProducto AND a.idCliente = i.idCliente',
      )
      .leftJoin(
        Inmuebles,
        'inm',
        'inm.idProducto = i.idProducto AND inm.idCliente = i.idCliente',
      )
      .leftJoin(
        Personas,
        'per',
        'per.idProducto = i.idProducto AND per.idCliente = i.idCliente',
      )
      .select([
        'i.id AS idInstalacion',
        'd.id AS idDispositivo',
        'CAST(d.imei AS CHAR) AS imei',
        'd.numeroSerie AS numeroSerie',
        'prod.id AS idProducto',
        'prod.nombre AS nombreProducto',
        'prod.estatus AS estatusProducto',
        'prod.idTipoProducto AS idTipoProducto',
        'tp.nombre AS nombreTipoProducto',
        'tp.codigo AS codigoTipoProducto',
        'v.placa AS placaVehiculo',
        'v.numeroEconomico AS ecoVehiculo',
        'v.idMarcaVehiculo AS idMarcaVehiculo',
        'marVeh.nombre AS nombreMarcaVehiculo',
        'v.idModeloVehiculo AS idModeloVehiculo',
        'modVeh.nombre AS nombreModeloVehiculo',
        'v.anio AS anioVehiculo',
        'v.color AS colorVehiculo',
        'v.numeroSerie AS numeroSerieVehiculo',
        'v.foto AS fotoVehiculo',
        'v.fotoFrente AS fotoFrenteVehiculo',
        'v.tarjetaCirculacion AS tarjetaCirculacionVehiculo',
        'v.polizaSeguro AS polizaSeguroVehiculo',
        'v.permisoCarga AS permisoCargaVehiculo',
        'v.idCombustible AS idCombustibleVehiculo',
        'tc.nombre AS nombreCombustibleVehiculo',
        'v.km AS kmVehiculo',
        'v.capacidadLitros AS capacidadLitrosVehiculo',
        'a.nombre AS nombreActivo',
        'a.descripcion AS descripcionActivo',
        'inm.inmueble AS inmueble',
        'inm.direccionFiscal AS direccionFiscalInmueble',
        'inm.nombreRepresentante AS nombreRepresentanteInmueble',
        'inm.telefonoRepresentante AS telefonoRepresentanteInmueble',
        'inm.correoRepresentante AS correoRepresentanteInmueble',
        'inm.lat AS latInmueble',
        'inm.lng AS lngInmueble',
        'per.nombre AS nombrePersona',
        'per.telefono AS telefonoPersona',
      ])
      // También las dadas de baja: lo que transmitieron mientras estuvieron
      // instaladas sigue siendo del cliente; sin tramo en el periodo no aportan.
      .where('i.idCliente = :idCliente', { idCliente })
      .andWhere('(d.id IS NULL OR d.idTipoDispositivo <> :panel)', {
        panel: EnumTipoDispositivo.PANEL_ALARMA,
      });

    if (idsFiltro?.length) {
      qb.andWhere('i.id IN (:...ids)', { ids: idsFiltro });
    }

    const rows = await qb.getRawMany<Record<string, unknown>>();
    return rows
      .map((row) => ({
        idInstalacion: Number(row.idInstalacion),
        idDispositivo: Number(row.idDispositivo),
        imei: String(row.imei ?? '').trim(),
        numeroSerie: str(row.numeroSerie),
        ...mapProductoPlano(row),
      }))
      .filter((r) => Number.isFinite(r.idInstalacion));
  }

  /** Solo instalaciones de productos vehículo (con fila en `Vehiculos`). */
  private async cargarInstalacionesVehiculo(
    idCliente: number,
    idsFiltro: number[] | null,
  ): Promise<InstalacionCandidataVehiculo[]> {
    const qb = this.instalacionesRepo
      .createQueryBuilder('i')
      // Equipo actual (puede no haber, o estar ya en otro cliente): los
      // equipos que cuentan salen de los tramos de vigencia (§6).
      .leftJoin(Dispositivos, 'd', 'd.id = i.idDispositivo')
      .innerJoin(
        Productos,
        'prod',
        'prod.id = i.idProducto AND prod.idCliente = i.idCliente',
      )
      .innerJoin(
        Vehiculos,
        'v',
        'v.idProducto = i.idProducto AND v.idCliente = i.idCliente',
      )
      .leftJoin(CatModelos, 'modVeh', 'modVeh.id = v.idModeloVehiculo')
      .select([
        'i.id AS idInstalacion',
        'd.id AS idDispositivo',
        'CAST(d.imei AS CHAR) AS imei',
        'd.numeroSerie AS numeroSerie',
        'prod.id AS idProducto',
        'prod.nombre AS nombreProducto',
        'v.placa AS placas',
        'v.numeroEconomico AS economico',
        'modVeh.nombre AS modelo',
        'v.foto AS imagen',
      ])
      // También las dadas de baja: lo que transmitieron mientras estuvieron
      // instaladas sigue siendo del cliente; sin tramo en el periodo no aportan.
      .where('i.idCliente = :idCliente', { idCliente })
      .andWhere('(d.id IS NULL OR d.idTipoDispositivo <> :panel)', {
        panel: EnumTipoDispositivo.PANEL_ALARMA,
      })
      .andWhere('prod.idTipoProducto = :tipoVehiculo', {
        tipoVehiculo: EnumTipoProducto.VEHICULO,
      });

    if (idsFiltro?.length) {
      qb.andWhere('i.id IN (:...ids)', { ids: idsFiltro });
    }

    const rows = await qb.getRawMany<Record<string, unknown>>();
    return rows
      .map((row) => ({
        idInstalacion: Number(row.idInstalacion),
        idDispositivo: Number(row.idDispositivo),
        imei: String(row.imei ?? '').trim(),
        numeroSerie: str(row.numeroSerie),
        idProducto: num(row.idProducto),
        nombreProducto: str(row.nombreProducto),
        placas: str(row.placas),
        economico: str(row.economico),
        modelo: str(row.modelo),
        imagen: str(row.imagen),
      }))
      .filter((r) => Number.isFinite(r.idInstalacion));
  }

  private async consultarPosicionesPorRadio(args: {
    candidatos: InstalacionCandidata[];
    lat: number;
    lng: number;
    radioMetros: number;
    fechaInicio: string;
    fechaFinal: string;
  }): Promise<PosicionPasoPoiItem[]> {
    const { candidatos, lat, lng, radioMetros, fechaInicio, fechaFinal } =
      args;

    const porTramo = await this.candidatasPorTramo(candidatos, fechaInicio, fechaFinal);
    if (!porTramo.length) return [];
    const enTramos = condicionTramos('p', porTramo.map((c) => c.tramo));

    const metrosPorGradoLat = 111_320;
    const cosLat = Math.cos((lat * Math.PI) / 180);
    const metrosPorGradoLng = Math.max(metrosPorGradoLat * Math.abs(cosLat), 1);
    const deltaLat = radioMetros / metrosPorGradoLat;
    const deltaLng = radioMetros / metrosPorGradoLng;

    const rows = await this.instalacionesRepo.manager
      .getRepository(Posiciones)
      .createQueryBuilder('p')
      .select([
        'p.id AS idPosicion',
        'CAST(p.imei AS CHAR) AS imei',
        'p.lat AS lat',
        'p.lng AS lng',
        'p.estado AS estado',
        'p.fechaHora AS fechaHora',
        'p.velocidad AS velocidad',
        'p.direccion AS direccion',
        'p.odometro AS odometro',
        'p.ignicion AS ignicion',
        'p.alarma1 AS alarma1',
        'p.alarma2 AS alarma2',
        'p.energia AS energia',
        'p.idEvento AS idEvento',
        'p.idFoto AS idFoto',
        'p.fhRegistro AS fhRegistro',
        'p.bateria AS bateria',
        'p.alimentacion AS alimentacion',
        'p.gps AS gps',
        'p.gsm AS gsm',
        'p.movimiento AS movimiento',
        'p.combustible AS combustible',
        'p.idFoto1 AS idFoto1',
        'p.idFoto2 AS idFoto2',
        'p.idFoto3 AS idFoto3',
        'p.idVideo1 AS idVideo1',
        'p.idVideo2 AS idVideo2',
        'p.idVideo3 AS idVideo3',
        'p.fuentePosicion AS fuentePosicion',
        'p.radioM AS radioM',
      ])
      .where(enTramos.sql, enTramos.params)
      .andWhere('p.lat BETWEEN :latMin AND :latMax', {
        latMin: lat - deltaLat,
        latMax: lat + deltaLat,
      })
      .andWhere('p.lng BETWEEN :lngMin AND :lngMax', {
        lngMin: lng - deltaLng,
        lngMax: lng + deltaLng,
      })
      .andWhere(
        `(6371000 * ACOS(LEAST(1, GREATEST(-1,
          COS(RADIANS(:poiLat)) * COS(RADIANS(p.lat))
          * COS(RADIANS(p.lng) - RADIANS(:poiLng))
          + SIN(RADIANS(:poiLat)) * SIN(RADIANS(p.lat))
        )))) <= :radioMetros`,
        { poiLat: lat, poiLng: lng, radioMetros },
      )
      .orderBy('p.fechaHora', 'DESC')
      .addOrderBy('p.id', 'DESC')
      .getRawMany<Record<string, unknown>>();

    const result: PosicionPasoPoiItem[] = [];
    for (const row of rows) {
      const imei = String(row.imei ?? '').trim();
      const cand = ubicarCandidata(porTramo, imei, row.fechaHora);
      if (!cand) continue;

      result.push({
        idInstalacion: cand.idInstalacion,
        idDispositivo: cand.idDispositivo,
        imei: cand.imei,
        numeroSerie: cand.numeroSerie,
        ...pickProducto(cand),

        idPosicion: Number(row.idPosicion),
        lat: Number(row.lat),
        lng: Number(row.lng),
        estado: num(row.estado),
        fechaHora: row.fechaHora as Date | string,
        velocidad: num(row.velocidad),
        direccion: num(row.direccion),
        odometro: num(row.odometro),
        ignicion: num(row.ignicion),
        alarma1: num(row.alarma1),
        alarma2: num(row.alarma2),
        energia: num(row.energia),
        idEvento: num(row.idEvento),
        idFoto: num(row.idFoto),
        fhRegistro: (row.fhRegistro as Date | string | null) ?? null,
        bateria: num(row.bateria),
        alimentacion: num(row.alimentacion),
        gps: num(row.gps),
        gsm: num(row.gsm),
        movimiento: num(row.movimiento),
        combustible: num(row.combustible),
        idFoto1: num(row.idFoto1),
        idFoto2: num(row.idFoto2),
        idFoto3: num(row.idFoto3),
        idVideo1: num(row.idVideo1),
        idVideo2: num(row.idVideo2),
        idVideo3: num(row.idVideo3),
        fuentePosicion: num(row.fuentePosicion),
        radioM: num(row.radioM),
      });
    }

    return result;
  }

  private async consultarPosicionesPorPeriodo(args: {
    candidatos: InstalacionCandidata[];
    fechaInicio: string;
    fechaFinal: string;
  }): Promise<ReportePosicionItem[]> {
    const { candidatos, fechaInicio, fechaFinal } = args;
    const porTramo = await this.candidatasPorTramo(candidatos, fechaInicio, fechaFinal);
    if (!porTramo.length) return [];
    const enTramos = condicionTramos('p', porTramo.map((c) => c.tramo));

    const rows = await this.instalacionesRepo.manager
      .getRepository(Posiciones)
      .createQueryBuilder('p')
      .select([
        'p.id AS id',
        'CAST(p.imei AS CHAR) AS imei',
        'p.lat AS lat',
        'p.lng AS lng',
        'p.estado AS estado',
        'p.fechaHora AS fechaHora',
        'p.velocidad AS velocidad',
        'p.direccion AS direccion',
        'p.odometro AS odometro',
        'p.ignicion AS ignicion',
        'p.alarma1 AS alarma1',
        'p.alarma2 AS alarma2',
        'p.energia AS energia',
        'p.idEvento AS idEvento',
        'p.idFoto AS idFoto',
        'p.fhRegistro AS fhRegistro',
        'p.bateria AS bateria',
        'p.alimentacion AS alimentacion',
        'p.gps AS gps',
        'p.gsm AS gsm',
        'p.movimiento AS movimiento',
        'p.combustible AS combustible',
        'p.idFoto1 AS idFoto1',
        'p.idFoto2 AS idFoto2',
        'p.idFoto3 AS idFoto3',
        'p.idVideo1 AS idVideo1',
        'p.idVideo2 AS idVideo2',
        'p.idVideo3 AS idVideo3',
        'p.fuentePosicion AS fuentePosicion',
        'p.radioM AS radioM',
      ])
      .where(enTramos.sql, enTramos.params)
      .orderBy('p.fechaHora', 'DESC')
      .addOrderBy('p.id', 'DESC')
      .getRawMany<Record<string, unknown>>();

    const result: ReportePosicionItem[] = [];
    for (const row of rows) {
      const imei = imeiToString(row.imei);
      if (!imei) continue;
      const cand = ubicarCandidata(porTramo, imei, row.fechaHora);
      if (!cand) continue;

      result.push({
        idInstalacion: cand.idInstalacion,
        idDispositivo: cand.idDispositivo,
        numeroSerie: cand.numeroSerie,
        ...pickProducto(cand),

        id: Number(row.id),
        imei,
        lat: Number(row.lat),
        lng: Number(row.lng),
        estado: num(row.estado),
        fechaHora: formatFechaPosicion(
          row.fechaHora as string | Date | null | undefined,
        ),
        velocidad: num(row.velocidad),
        direccion: num(row.direccion),
        odometro: num(row.odometro),
        ignicion: num(row.ignicion),
        alarma1: num(row.alarma1),
        alarma2: num(row.alarma2),
        energia: num(row.energia),
        idEvento: num(row.idEvento),
        idFoto: num(row.idFoto),
        fhRegistro: formatFechaPosicion(
          row.fhRegistro as string | Date | null | undefined,
        ),
        bateria: num(row.bateria),
        alimentacion: num(row.alimentacion),
        gps: num(row.gps),
        gsm: num(row.gsm),
        movimiento: num(row.movimiento),
        combustible: num(row.combustible),
        idFoto1: num(row.idFoto1),
        idFoto2: num(row.idFoto2),
        idFoto3: num(row.idFoto3),
        idVideo1: num(row.idVideo1),
        idVideo2: num(row.idVideo2),
        idVideo3: num(row.idVideo3),
        fuentePosicion: num(row.fuentePosicion),
        radioM: num(row.radioM),
      });
    }

    return result;
  }

  private async consultarUltimasPosicionesPorPeriodo(args: {
    candidatos: InstalacionCandidata[];
    fechaInicio: string;
    fechaFinal: string;
  }): Promise<ReportePosicionItem[]> {
    const { candidatos, fechaInicio, fechaFinal } = args;
    const porTramo = await this.candidatasPorTramo(candidatos, fechaInicio, fechaFinal);
    if (!porTramo.length) return [];
    const enTramos = condicionTramos('up', porTramo.map((c) => c.tramo));

    const rows = await this.instalacionesRepo.manager
      .getRepository(UltimaPosicion)
      .createQueryBuilder('up')
      .select([
        'up.id AS id',
        'CAST(up.imei AS CHAR) AS imei',
        'up.lat AS lat',
        'up.lng AS lng',
        'up.estado AS estado',
        'up.fechaHora AS fechaHora',
        'up.velocidad AS velocidad',
        'up.direccion AS direccion',
        'up.odometro AS odometro',
        'up.ignicion AS ignicion',
        'up.alarma1 AS alarma1',
        'up.alarma2 AS alarma2',
        'up.energia AS energia',
        'up.idEvento AS idEvento',
        'up.idFoto AS idFoto',
        'up.fhRegistro AS fhRegistro',
        'up.bateria AS bateria',
        'up.alimentacion AS alimentacion',
        'up.gps AS gps',
        'up.gsm AS gsm',
        'up.movimiento AS movimiento',
        'up.combustible AS combustible',
        'up.idFoto1 AS idFoto1',
        'up.idFoto2 AS idFoto2',
        'up.idFoto3 AS idFoto3',
        'up.idVideo1 AS idVideo1',
        'up.idVideo2 AS idVideo2',
        'up.idVideo3 AS idVideo3',
        'up.fuentePosicion AS fuentePosicion',
        'up.radioM AS radioM',
      ])
      .where(enTramos.sql, enTramos.params)
      .orderBy('up.fechaHora', 'DESC')
      .addOrderBy('up.id', 'DESC')
      .getRawMany<Record<string, unknown>>();

    const result: ReportePosicionItem[] = [];
    for (const row of rows) {
      const imei = imeiToString(row.imei);
      if (!imei) continue;
      const cand = ubicarCandidata(porTramo, imei, row.fechaHora);
      if (!cand) continue;

      result.push({
        idInstalacion: cand.idInstalacion,
        idDispositivo: cand.idDispositivo,
        numeroSerie: cand.numeroSerie,
        ...pickProducto(cand),

        id: Number(row.id),
        imei,
        lat: Number(row.lat),
        lng: Number(row.lng),
        estado: num(row.estado),
        fechaHora: formatFechaPosicion(
          row.fechaHora as string | Date | null | undefined,
        ),
        velocidad: num(row.velocidad),
        direccion: num(row.direccion),
        odometro: num(row.odometro),
        ignicion: num(row.ignicion),
        alarma1: num(row.alarma1),
        alarma2: num(row.alarma2),
        energia: num(row.energia),
        idEvento: num(row.idEvento),
        idFoto: num(row.idFoto),
        fhRegistro: formatFechaPosicion(
          row.fhRegistro as string | Date | null | undefined,
        ),
        bateria: num(row.bateria),
        alimentacion: num(row.alimentacion),
        gps: num(row.gps),
        gsm: num(row.gsm),
        movimiento: num(row.movimiento),
        combustible: num(row.combustible),
        idFoto1: num(row.idFoto1),
        idFoto2: num(row.idFoto2),
        idFoto3: num(row.idFoto3),
        idVideo1: num(row.idVideo1),
        idVideo2: num(row.idVideo2),
        idVideo3: num(row.idVideo3),
        fuentePosicion: num(row.fuentePosicion),
        radioM: num(row.radioM),
      });
    }

    return result;
  }

  private async consultarPosicionesPorVelocidad(args: {
    candidatos: InstalacionCandidataVehiculo[];
    velocidadMin: number;
    fechaInicio: string;
    fechaFinal: string;
  }): Promise<VelocidadItem[]> {
    const { candidatos, velocidadMin, fechaInicio, fechaFinal } = args;
    const porTramo = await this.candidatasPorTramo(candidatos, fechaInicio, fechaFinal);
    if (!porTramo.length) return [];
    const enTramos = condicionTramos('p', porTramo.map((c) => c.tramo));

    const rows = await this.instalacionesRepo.manager
      .getRepository(Posiciones)
      .createQueryBuilder('p')
      .select([
        'p.id AS idPosicion',
        'CAST(p.imei AS CHAR) AS imei',
        'p.lat AS lat',
        'p.lng AS lng',
        'p.estado AS estado',
        'p.fechaHora AS fechaHora',
        'p.velocidad AS velocidad',
        'p.ignicion AS ignicion',
      ])
      .where(enTramos.sql, enTramos.params)
      .andWhere('p.velocidad >= :velocidadMin', { velocidadMin })
      .orderBy('p.fechaHora', 'DESC')
      .addOrderBy('p.id', 'DESC')
      .getRawMany<Record<string, unknown>>();

    const result: VelocidadItem[] = [];
    for (const row of rows) {
      const imei = String(row.imei ?? '').trim();
      const cand = ubicarCandidata(porTramo, imei, row.fechaHora);
      if (!cand) continue;

      result.push({
        imei: imeiToString(cand.imei) ?? cand.imei,
        id: Number(row.idPosicion),
        placas: cand.placas,
        economico: cand.economico,
        descripcion: cand.nombreProducto ?? cand.economico,
        lat: Number(row.lat),
        lng: Number(row.lng),
        estado: num(row.estado),
        ignicion: num(row.ignicion),
        velocidad: num(row.velocidad),
        fechaHora: formatFechaPosicion(
          row.fechaHora as string | Date | null | undefined,
        ),
        modelo: cand.modelo,
        numeroSerie: cand.numeroSerie,
        imagen: cand.imagen,
        idProducto: cand.idProducto,
      });
    }

    return result;
  }

  private agregarDispositivosDesdePosiciones(
    posiciones: PosicionPasoPoiItem[],
  ): DispositivoPasoPoiItem[] {
    const byDevice = new Map<
      number,
      {
        item: DispositivoPasoPoiItem;
        primera: Date | string;
        ultima: Date | string;
        count: number;
      }
    >();

    for (const pos of posiciones) {
      const prev = byDevice.get(pos.idDispositivo);
      if (!prev) {
        byDevice.set(pos.idDispositivo, {
          count: 1,
          primera: pos.fechaHora,
          ultima: pos.fechaHora,
          item: {
            idInstalacion: pos.idInstalacion,
            idDispositivo: pos.idDispositivo,
            imei: pos.imei,
            numeroSerie: pos.numeroSerie,
            ...pickProducto(pos),
            cantidadPosiciones: 1,
            primeraDeteccion: pos.fechaHora,
            ultimaDeteccion: pos.fechaHora,
          },
        });
        continue;
      }
      prev.count += 1;
      if (String(pos.fechaHora) < String(prev.primera)) {
        prev.primera = pos.fechaHora;
      }
      if (String(pos.fechaHora) > String(prev.ultima)) {
        prev.ultima = pos.fechaHora;
      }
      prev.item.cantidadPosiciones = prev.count;
      prev.item.primeraDeteccion = prev.primera;
      prev.item.ultimaDeteccion = prev.ultima;
    }

    return [...byDevice.values()]
      .map((v) => v.item)
      .sort((a, b) => a.idInstalacion - b.idInstalacion);
  }
}
