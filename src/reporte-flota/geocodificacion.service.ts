import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { claveCoordenada, direccionDeNominatim } from './reporte-flota.reglas';

type Entrada = { texto: string | null; expira: number };

/**
 * Geocodificación inversa (coordenada → dirección) para el reporte de flota.
 *
 * Usa Nominatim (OpenStreetMap) como la vista legacy, pero desde el back y una
 * sola vez por coordenada: caché en memoria (~11 m, 7 días; fallos 10 min) y
 * una petición a la vez separadas `GEOCODIFICACION_INTERVALO_MS` (política de
 * Nominatim: máximo 1 por segundo). `GEOCODIFICACION_ENABLED=false` la apaga y
 * `direccion` sale `null`.
 */
@Injectable()
export class GeocodificacionService {
  private readonly logger = new Logger(GeocodificacionService.name);
  private readonly cache = new Map<string, Entrada>();
  private readonly enCurso = new Map<string, Promise<string | null>>();
  private cola: Promise<unknown> = Promise.resolve();

  private readonly habilitada: boolean;
  private readonly url: string;
  private readonly userAgent: string;
  private readonly intervaloMs: number;
  private readonly timeoutMs = 5000;
  private readonly ttlMs = 7 * 24 * 3600_000;
  private readonly ttlFalloMs = 10 * 60_000;
  private readonly maxEntradas = 5000;

  constructor(config: ConfigService) {
    this.habilitada = String(config.get('GEOCODIFICACION_ENABLED') ?? 'true').toLowerCase() !== 'false';
    this.url = config.get<string>('GEOCODIFICACION_URL') || 'https://nominatim.openstreetmap.org/reverse';
    this.userAgent = config.get<string>('GEOCODIFICACION_USER_AGENT') || 'NextAPI/1.0 (reporte-flota)';
    const ms = Number(config.get('GEOCODIFICACION_INTERVALO_MS'));
    this.intervaloMs = Number.isFinite(ms) && ms >= 0 ? ms : 1100;
  }

  get activa(): boolean {
    return this.habilitada;
  }

  /** Solo lo que ya está en caché; `undefined` = no se ha consultado. */
  enCache(lat: number, lng: number): string | null | undefined {
    const e = this.cache.get(claveCoordenada(lat, lng));
    if (!e) return undefined;
    if (e.expira < Date.now()) {
      this.cache.delete(claveCoordenada(lat, lng));
      return undefined;
    }
    return e.texto;
  }

  /** Dirección de la coordenada (espera su turno en la cola). */
  async direccion(lat: number, lng: number): Promise<string | null> {
    if (!this.habilitada || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const previa = this.enCache(lat, lng);
    if (previa !== undefined) return previa;
    const clave = claveCoordenada(lat, lng);
    const pendiente = this.enCurso.get(clave);
    if (pendiente) return pendiente;

    const p = this.encolar(() => this.consultar(lat, lng)).then((texto) => {
      this.guardar(clave, texto);
      return texto;
    });
    this.enCurso.set(clave, p);
    try {
      return await p;
    } finally {
      this.enCurso.delete(clave);
    }
  }

  /** Encola sin esperar (precarga para la siguiente consulta del listado). */
  precargar(coords: Array<{ lat: number; lng: number }>): void {
    if (!this.habilitada) return;
    for (const c of coords) {
      this.direccion(c.lat, c.lng).catch(() => undefined);
    }
  }

  private encolar<T>(fn: () => Promise<T>): Promise<T> {
    const turno = this.cola.then(fn);
    this.cola = turno
      .catch(() => undefined)
      .then(() => new Promise((r) => setTimeout(r, this.intervaloMs)));
    return turno;
  }

  private async consultar(lat: number, lng: number): Promise<string | null> {
    // Otra petición de la cola pudo resolverla mientras esperaba.
    const previa = this.enCache(lat, lng);
    if (previa !== undefined) return previa;
    const url = `${this.url}?lat=${lat}&lon=${lng}&format=json&accept-language=es&zoom=18`;
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': this.userAgent, Accept: 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
      if (!res.ok) {
        this.logger.warn(`Geocodificación ${res.status} para ${claveCoordenada(lat, lng)}`);
        return null;
      }
      const data = (await res.json()) as { address?: Record<string, string> };
      return direccionDeNominatim(data?.address);
    } catch (e) {
      this.logger.warn(`Geocodificación falló: ${(e as Error)?.message}`);
      return null;
    }
  }

  private guardar(clave: string, texto: string | null): void {
    if (this.cache.size >= this.maxEntradas) {
      const primera = this.cache.keys().next().value;
      if (primera !== undefined) this.cache.delete(primera);
    }
    this.cache.set(clave, { texto, expira: Date.now() + (texto ? this.ttlMs : this.ttlFalloMs) });
  }
}
