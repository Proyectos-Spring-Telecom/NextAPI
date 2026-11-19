import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnumTipoProducto } from 'src/common/estatus.enum';
import { TenantFilterService, UsuarioAlcance } from 'src/common/tenant-filter/tenant-filter.service';
import { MonitoreoVehiculoItem } from 'src/monitoreo/monitoreo.mapper';
import { MonitoreoService } from 'src/monitoreo/monitoreo.service';
import { nowMexicoCityAsUtcDate } from 'src/utils/datetime-mexico.util';
import { GeocodificacionService } from './geocodificacion.service';
import {
  armarMensaje,
  clasificar,
  CRITERIO_DEFECTO,
  CriterioMovimiento,
  DIRECCION_VIGENTE_M,
  distanciaM,
  ignicionConfiable,
  SituacionUnidad,
  urlMapa,
} from './reporte-flota.reglas';

export interface ReporteFlotaUnidad {
  idInstalacion: number;
  idCliente: number;
  cliente: string | null;
  economico: string | null;
  placa: string | null;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  numeroSerie: string | null;
  imei: string | null;
  idTipoDispositivo: number | null;
  situacion: SituacionUnidad;
  estado: number | null;
  velocidad: number | null;
  /** Rumbo en grados (`UltimaPosicion.Direccion`). */
  rumbo: number | null;
  ignicion: number | null;
  /** La ignición solo es confiable en TrackCam y TrackGas; en AVL se informa pero no se usa. */
  ignicionConfiable: boolean;
  lat: number | null;
  lng: number | null;
  fechaHora: string | null;
  fhRegistro: string | null;
  sinReporteDesde: string | null;
  /** Dirección (calle, colonia, ciudad…); null si no se ha geocodificado todavía o no hay. */
  direccion: string | null;
  /** true si la dirección se está buscando: pedirla con `GET /reporte-flota/:idInstalacion`. */
  direccionPendiente: boolean;
  mapaUrl: string | null;
  /** Texto listo para WhatsApp. */
  mensaje: string;
}

export interface ReporteFlotaResponse {
  generadoEn: string;
  criterio: CriterioMovimiento;
  resumen: { total: number; enMovimiento: number; detenidas: number; sinReporte: number; sinPosicion: number };
  unidades: ReporteFlotaUnidad[];
}

@Injectable()
export class ReporteFlotaService {
  private readonly criterio: CriterioMovimiento;
  private readonly precargaMax: number;
  /** Última dirección encontrada por instalación: la unidad en movimiento cambia de coordenada en cada consulta. */
  private readonly ultimaDireccion = new Map<number, { lat: number; lng: number; texto: string }>();
  /** Instalaciones esperando dirección, con su coordenada más reciente. */
  private readonly porResolver = new Map<number, { lat: number; lng: number }>();
  private trabajando = false;

  constructor(
    private readonly monitoreo: MonitoreoService,
    private readonly tenantFilter: TenantFilterService,
    private readonly geo: GeocodificacionService,
    config: ConfigService,
  ) {
    const n = (k: string, d: number) => {
      const v = Number(config.get(k));
      return Number.isFinite(v) && v >= 0 ? v : d;
    };
    this.criterio = {
      velocidadKmh: n('REPORTE_FLOTA_VELOCIDAD_KMH', CRITERIO_DEFECTO.velocidadKmh),
      vigenciaMin: n('REPORTE_FLOTA_VIGENCIA_MIN', CRITERIO_DEFECTO.vigenciaMin),
    };
    this.precargaMax = n('REPORTE_FLOTA_PRECARGA_MAX', 30);
  }

  /** Vehículos del alcance del usuario con su resumen; `situacion` filtra la lista (el resumen es de todos). */
  async reporte(alcance: UsuarioAlcance, situacion: SituacionUnidad | 'todas' = 'movimiento'): Promise<ReporteFlotaResponse> {
    const ahora = new Date();
    const pared = nowMexicoCityAsUtcDate();
    const { posicion } = await this.monitoreo.listado(alcance.userId, alcance.idCliente, alcance.rol);
    const vehiculos = posicion.filter((p) => Number(p.idTipoProducto) === EnumTipoProducto.VEHICULO) as MonitoreoVehiculoItem[];

    const resumen = { total: vehiculos.length, enMovimiento: 0, detenidas: 0, sinReporte: 0, sinPosicion: 0 };
    const clasificados = vehiculos.map((v) => {
      const s = clasificar(v, pared, this.criterio);
      if (s === 'movimiento') resumen.enMovimiento++;
      else if (s === 'detenida') resumen.detenidas++;
      else if (s === 'sinReporte') resumen.sinReporte++;
      else resumen.sinPosicion++;
      return { v, s };
    });

    const elegidos = clasificados
      .filter((x) => situacion === 'todas' || x.s === situacion)
      .sort((a, b) => (b.v.fechaHora ?? '').localeCompare(a.v.fechaHora ?? ''));

    const porBuscar: Array<{ id: number; lat: number; lng: number }> = [];
    const unidades = elegidos.map(({ v, s }) => {
      if (v.lat == null || v.lng == null) return this.armar(v, s, null, false, ahora);
      const exacta = this.geo.enCache(v.lat, v.lng);
      if (exacta !== undefined) {
        if (exacta) this.recordar(v.idInstalacion, v.lat, v.lng, exacta);
        return this.armar(v, s, exacta, false, ahora);
      }
      porBuscar.push({ id: v.idInstalacion, lat: v.lat, lng: v.lng });
      // Mientras se busca la nueva, la última que se le encontró si no ha avanzado mucho.
      const previa = this.ultimaDireccion.get(v.idInstalacion);
      const cercana = previa && distanciaM(previa, { lat: v.lat, lng: v.lng }) <= DIRECCION_VIGENTE_M ? previa.texto : null;
      return this.armar(v, s, cercana, cercana == null && this.geo.activa, ahora);
    });

    // Las que faltan se buscan en segundo plano (1 por segundo); la siguiente consulta ya las trae.
    // Primero las que no tienen ninguna dirección.
    const sinNinguna = new Set(unidades.filter((u) => u.direccionPendiente).map((u) => u.idInstalacion));
    porBuscar.sort((a, b) => Number(sinNinguna.has(b.id)) - Number(sinNinguna.has(a.id)));
    this.encolar(porBuscar);

    // Misma convención que `fechaHora` (hora de pared de México marcada como UTC).
    return { generadoEn: pared.toISOString(), criterio: this.criterio, resumen, unidades };
  }

  /** Una unidad con su dirección ya resuelta (espera a la geocodificación). */
  async unidad(alcance: UsuarioAlcance, idInstalacion: number): Promise<ReporteFlotaUnidad> {
    await this.tenantFilter.assertInstalacionVisible(alcance, idInstalacion);
    const item = await this.monitoreo.obtenerPorInstalacion(idInstalacion);
    if (!item) throw new NotFoundException('Instalación no encontrada');
    if (Number(item.idTipoProducto) !== EnumTipoProducto.VEHICULO) {
      throw new BadRequestException('El reporte de flota solo aplica a vehículos');
    }
    const v = item as MonitoreoVehiculoItem;
    const ahora = new Date();
    const dir = v.lat != null && v.lng != null ? await this.geo.direccion(v.lat, v.lng) : null;
    if (dir && v.lat != null && v.lng != null) this.recordar(v.idInstalacion, v.lat, v.lng, dir);
    return this.armar(v, clasificar(v, nowMexicoCityAsUtcDate(), this.criterio), dir, false, ahora);
  }

  /**
   * Cola por instalación, no por coordenada: si la unidad ya está en la cola
   * solo se actualiza su coordenada, y al llegar su turno se busca la más
   * reciente (la unidad en movimiento avanza mientras espera).
   */
  private encolar(items: Array<{ id: number; lat: number; lng: number }>): void {
    if (!this.geo.activa) return;
    for (const c of items) {
      if (this.porResolver.has(c.id) || this.porResolver.size < this.precargaMax) {
        this.porResolver.set(c.id, { lat: c.lat, lng: c.lng });
      }
    }
    if (!this.trabajando && this.porResolver.size) void this.resolverCola();
  }

  private async resolverCola(): Promise<void> {
    this.trabajando = true;
    try {
      while (this.porResolver.size) {
        const [id, c] = this.porResolver.entries().next().value as [number, { lat: number; lng: number }];
        this.porResolver.delete(id);
        try {
          const texto = await this.geo.direccion(c.lat, c.lng);
          if (texto) this.recordar(id, c.lat, c.lng, texto);
        } catch {
          /* se reintenta en la siguiente consulta */
        }
      }
    } finally {
      this.trabajando = false;
    }
  }

  private recordar(idInstalacion: number, lat: number, lng: number, texto: string): void {
    if (this.ultimaDireccion.size >= 5000 && !this.ultimaDireccion.has(idInstalacion)) this.ultimaDireccion.clear();
    this.ultimaDireccion.set(idInstalacion, { lat, lng, texto });
  }

  private armar(
    v: MonitoreoVehiculoItem,
    situacion: SituacionUnidad,
    direccion: string | null,
    direccionPendiente: boolean,
    ahora: Date,
  ): ReporteFlotaUnidad {
    const base = {
      economico: v.economico,
      placa: v.placa,
      marca: v.marca,
      modelo: v.modelo,
      anio: v.anioVehiculo ?? null,
      situacion,
      velocidad: v.velocidad,
      ignicion: v.ignicion,
      idTipoDispositivo: v.idTipoDispositivo,
      lat: v.lat,
      lng: v.lng,
      fechaHora: v.fechaHora,
      direccion,
    };
    return {
      idInstalacion: v.idInstalacion,
      idCliente: v.idCliente,
      cliente: v.cliente,
      numeroSerie: v.numeroSerieVehiculo,
      imei: v.imei,
      estado: v.estado,
      rumbo: v.direccion,
      ignicionConfiable: ignicionConfiable(v.idTipoDispositivo),
      fhRegistro: v.fhRegistro,
      sinReporteDesde: v.sinReporteDesde,
      direccionPendiente: direccionPendiente && v.lat != null && v.lng != null,
      mapaUrl: v.lat != null && v.lng != null ? urlMapa(v.lat, v.lng) : null,
      ...base,
      mensaje: armarMensaje(base, ahora),
    };
  }
}
