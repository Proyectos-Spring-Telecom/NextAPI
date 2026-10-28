import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ApiResponseCommon } from 'src/common/ApiResponse';
import { TelemetryHuerfanos } from 'src/entities/TelemetryHuerfanos';

export type HuerfanoProtocolo = 'jt808' | 'jimi' | 'axpro' | 'fa100s';
export type HuerfanoMotivo = 'no_registrado' | 'sin_imei';

export interface RegistrarHuerfanoRequest {
  protocol: HuerfanoProtocolo;
  deviceId: string;
  motivo: HuerfanoMotivo;
  routingKey?: string | null;
  lat?: number | null;
  lng?: number | null;
}

const UPSERT_SQL = `
INSERT INTO TelemetryHuerfanos
  (Protocol, DeviceId, Motivo, PrimeraVez, UltimaVez, Mensajes, UltimoRoutingKey, UltimaLat, UltimaLng)
VALUES (?, ?, ?, NOW(), NOW(), 1, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  Motivo = VALUES(Motivo),
  UltimaVez = NOW(),
  Mensajes = Mensajes + 1,
  UltimoRoutingKey = VALUES(UltimoRoutingKey),
  UltimaLat = COALESCE(VALUES(UltimaLat), UltimaLat),
  UltimaLng = COALESCE(VALUES(UltimaLng), UltimaLng)`;

/**
 * Equipos que transmiten sin alta en Next (TrackCam, TrackGas, Panel).
 * Los sockets aceptan todo equipo (salvo TrackCam, que tiene registro); NextAPI es
 * la fuente de verdad y aquí deja constancia de lo que no pudo asociar, en vez de
 * descartarlo en silencio. El mensaje se sigue confirmando (no va a la DLQ).
 */
@Injectable()
export class TelemetriaHuerfanosService {
  private readonly logger = new Logger(TelemetriaHuerfanosService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(TelemetryHuerfanos)
    private readonly repo: Repository<TelemetryHuerfanos>,
  ) {}

  /** Upsert por protocolo + equipo. Nunca lanza: un fallo aquí no debe frenar la cola. */
  async registrar(req: RegistrarHuerfanoRequest): Promise<{ nuevo: boolean }> {
    const deviceId = String(req.deviceId ?? '').trim().slice(0, 32);
    if (!deviceId) return { nuevo: false };
    try {
      const res = (await this.dataSource.query(UPSERT_SQL, [
        req.protocol,
        deviceId,
        req.motivo,
        req.routingKey ?? null,
        numeroONull(req.lat),
        numeroONull(req.lng),
      ])) as { affectedRows?: number };
      // MySQL: 1 = fila nueva, 2 = actualizada
      const nuevo = res?.affectedRows === 1;
      if (nuevo) {
        this.logger.warn(
          `Equipo sin alta: protocol=${req.protocol} deviceId=${deviceId} motivo=${req.motivo}`,
        );
      } else {
        this.logger.debug(
          `Equipo sin alta (repite): protocol=${req.protocol} deviceId=${deviceId}`,
        );
      }
      return { nuevo };
    } catch (error) {
      this.logger.error(
        `No se pudo registrar equipo sin alta protocol=${req.protocol} deviceId=${deviceId}: ${(error as Error)?.message}`,
      );
      return { nuevo: false };
    }
  }

  async findAll(
    page: number,
    limit: number,
    filtros: { protocolo?: string; horas?: number } = {},
  ): Promise<ApiResponseCommon> {
    const take = Math.min(Math.max(limit, 1), 500);
    const skip = (Math.max(page, 1) - 1) * take;
    const qb = this.repo
      .createQueryBuilder('h')
      .orderBy('h.ultimaVez', 'DESC')
      .skip(skip)
      .take(take);
    if (filtros.protocolo) {
      qb.andWhere('h.protocol = :protocolo', { protocolo: filtros.protocolo });
    }
    if (filtros.horas && filtros.horas > 0) {
      qb.andWhere('h.ultimaVez >= NOW() - INTERVAL :horas HOUR', {
        horas: Math.floor(filtros.horas),
      });
    }
    const [rows, total] = await qb.getManyAndCount();
    return {
      data: rows.map((r) => ({ ...r, id: Number(r.id), mensajes: Number(r.mensajes) })),
      paginated: {
        total,
        page: Math.max(page, 1),
        limit: take,
        totalPages: Math.ceil(total / take),
      },
    };
  }

  /** Descartar: si el equipo sigue transmitiendo sin alta, vuelve a aparecer como nuevo. */
  async remove(id: number): Promise<{ status: string; message: string }> {
    const res = await this.repo.delete({ id });
    if (!res.affected) {
      throw new NotFoundException(`Equipo sin alta ${id} no existe`);
    }
    return { status: 'success', message: 'Equipo sin alta descartado' };
  }
}

function numeroONull(v: unknown): number | null {
  const n = Number(v);
  return v != null && Number.isFinite(n) ? n : null;
}
