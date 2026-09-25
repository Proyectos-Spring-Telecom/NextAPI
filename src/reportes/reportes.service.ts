import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
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
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';
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
};

/** Recorrido de un IMEI / instalación en el periodo. */
export type DistanciaRecorridoItem = {
  idInstalacion: number;
  idDispositivo: number;
  imei: string;
  numeroSerie: string | null;
  /** Distancia total del recorrido (km, 2 decimales). */
  totalDistancia: number;
  total: number;
  /** Orden DESC por fechaHora (más reciente primero), igual que histórico. */
  posiciones: DistanciaPosicionItem[];
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
};

type InstalacionCandidata = {
  idInstalacion: number;
  idDispositivo: number;
  imei: string;
  numeroSerie: string | null;
} & ProductoPlanoPasoPoi;

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
    private readonly tenantFilter: TenantFilterService,
  ) {}

  async pasoPorPuntoInteres(
    dto: PasoPorPoiDto,
    idClienteToken: number,
    rol: number,
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

      const idsFiltro = await this.resolverIdsInstalacionPorFiltro(
        idCliente,
        dto.filtro,
        dto.valores,
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

      const idsFiltro = await this.resolverIdsInstalacionPorFiltro(
        idCliente,
        dto.filtro,
        dto.valores,
        true,
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

      const idsFiltro = await this.resolverIdsInstalacionPorFiltro(
        idCliente,
        dto.filtro,
        dto.valores,
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

      const idsFiltro = await this.resolverIdsInstalacionPorFiltro(
        idCliente,
        dto.filtro,
        dto.valores,
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
  ): Promise<{ data: DistanciaResult }> {
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

      const idsFiltro = await this.resolverIdsInstalacionPorFiltro(
        idCliente,
        dto.filtro,
        dto.valores,
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
            totalDistancia: 0,
            totalRecorridos: 0,
            totalPosiciones: 0,
            recorridos: [],
          },
        };
      }

      const posiciones = await this.consultarPosicionesPorPeriodo({
        candidatos,
        fechaInicio,
        fechaFinal,
      });

      const byImeiCand = new Map(
        candidatos.map((c) => [imeiToString(c.imei) ?? c.imei, c]),
      );

      const porImei = new Map<string, ReportePosicionItem[]>();
      for (const p of posiciones) {
        const imei = imeiToString(p.imei) ?? p.imei ?? '';
        if (!imei) continue;
        const list = porImei.get(imei);
        if (list) {
          list.push(p);
        } else {
          porImei.set(imei, [p]);
        }
      }

      const recorridos: DistanciaRecorridoItem[] = [];
      let totalDistancia = 0;
      let totalPosiciones = 0;

      for (const [imei, pts] of porImei) {
        const cand = byImeiCand.get(imei);
        if (!cand) continue;

        const distancia = calcularDistanciaHistoricoMonitoreo(
          pts.map((p) => ({
            id: p.id,
            lat: p.lat,
            lng: p.lng,
            fechaHora: p.fechaHora ?? '',
          })),
          { yaOrdenadoDesc: true },
        );

        const posicionesConKm: DistanciaPosicionItem[] = pts.map((p) => ({
          ...p,
          totalDistancia: distancia.acumuladoKmPorId.get(p.id) ?? 0,
        }));

        totalDistancia += distancia.totalDistanciaKm;
        totalPosiciones += posicionesConKm.length;

        recorridos.push({
          idInstalacion: cand.idInstalacion,
          idDispositivo: cand.idDispositivo,
          imei: cand.imei,
          numeroSerie: cand.numeroSerie,
          totalDistancia: distancia.totalDistanciaKm,
          total: posicionesConKm.length,
          posiciones: posicionesConKm,
        });
      }

      recorridos.sort((a, b) => a.idInstalacion - b.idInstalacion);

      return {
        data: {
          idCliente,
          fechaInicio,
          fechaFinal,
          totalDistancia: redondearKm(totalDistancia),
          totalRecorridos: recorridos.length,
          totalPosiciones,
          recorridos,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
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
      .innerJoin(
        Dispositivos,
        'd',
        'd.id = i.idDispositivo AND d.idCliente = i.idCliente',
      )
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
      .where('i.idCliente = :idCliente', { idCliente })
      .andWhere('i.estatus = :activo', { activo: EstatusEnum.ACTIVO })
      .andWhere('i.idDispositivo IS NOT NULL')
      .andWhere('d.imei IS NOT NULL')
      .andWhere('d.idTipoDispositivo <> :panel', {
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
      .filter((r) => r.imei !== '' && Number.isFinite(r.idInstalacion));
  }

  /** Solo instalaciones de productos vehículo (con fila en `Vehiculos`). */
  private async cargarInstalacionesVehiculo(
    idCliente: number,
    idsFiltro: number[] | null,
  ): Promise<InstalacionCandidataVehiculo[]> {
    const qb = this.instalacionesRepo
      .createQueryBuilder('i')
      .innerJoin(
        Dispositivos,
        'd',
        'd.id = i.idDispositivo AND d.idCliente = i.idCliente',
      )
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
      .where('i.idCliente = :idCliente', { idCliente })
      .andWhere('i.estatus = :activo', { activo: EstatusEnum.ACTIVO })
      .andWhere('i.idDispositivo IS NOT NULL')
      .andWhere('d.imei IS NOT NULL')
      .andWhere('d.idTipoDispositivo <> :panel', {
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
      .filter((r) => r.imei !== '' && Number.isFinite(r.idInstalacion));
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

    const byImei = new Map(candidatos.map((c) => [c.imei, c]));
    const imeis = [...byImei.keys()];

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
      ])
      .where('p.imei IN (:...imeis)', { imeis })
      .andWhere('p.fechaHora >= :fechaInicio', { fechaInicio })
      .andWhere('p.fechaHora <= :fechaFinal', { fechaFinal })
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
      const cand = byImei.get(imei);
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
    const byImei = new Map(
      candidatos.map((c) => [imeiToString(c.imei) ?? c.imei, c]),
    );
    const imeis = [...byImei.keys()].filter((imei) => imei !== '');
    if (!imeis.length) return [];

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
      ])
      .where('p.imei IN (:...imeis)', { imeis })
      .andWhere('p.fechaHora >= :fechaInicio', { fechaInicio })
      .andWhere('p.fechaHora <= :fechaFinal', { fechaFinal })
      .orderBy('p.fechaHora', 'DESC')
      .addOrderBy('p.id', 'DESC')
      .getRawMany<Record<string, unknown>>();

    const result: ReportePosicionItem[] = [];
    for (const row of rows) {
      const imei = imeiToString(row.imei);
      if (!imei) continue;
      const cand = byImei.get(imei);
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
    const byImei = new Map(
      candidatos.map((c) => [imeiToString(c.imei) ?? c.imei, c]),
    );
    const imeis = [...byImei.keys()].filter((imei) => imei !== '');
    if (!imeis.length) return [];

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
      ])
      .where('up.imei IN (:...imeis)', { imeis })
      .andWhere('up.fechaHora >= :fechaInicio', { fechaInicio })
      .andWhere('up.fechaHora <= :fechaFinal', { fechaFinal })
      .orderBy('up.fechaHora', 'DESC')
      .addOrderBy('up.id', 'DESC')
      .getRawMany<Record<string, unknown>>();

    const result: ReportePosicionItem[] = [];
    for (const row of rows) {
      const imei = imeiToString(row.imei);
      if (!imei) continue;
      const cand = byImei.get(imei);
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
    const byImei = new Map(candidatos.map((c) => [c.imei, c]));
    const imeis = [...byImei.keys()];

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
      .where('p.imei IN (:...imeis)', { imeis })
      .andWhere('p.fechaHora >= :fechaInicio', { fechaInicio })
      .andWhere('p.fechaHora <= :fechaFinal', { fechaFinal })
      .andWhere('p.velocidad >= :velocidadMin', { velocidadMin })
      .orderBy('p.fechaHora', 'DESC')
      .addOrderBy('p.id', 'DESC')
      .getRawMany<Record<string, unknown>>();

    const result: VelocidadItem[] = [];
    for (const row of rows) {
      const imei = String(row.imei ?? '').trim();
      const cand = byImei.get(imei);
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
