import { BadGatewayException, HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';

export type EventoTrackPhone = 'telefono.alta' | 'telefono.codigo' | 'telefono.baja' | 'telefono.consultar';

/** Lo que springTrackPhone devuelve de un teléfono (sin token ni PIN). */
export interface TelefonoApp {
  imei: string;
  idCliente: number;
  etiqueta: string | null;
  estado: 'pendiente' | 'activo' | 'baja';
  intervaloSeg: number;
  modelo: string | null;
  appVersion: string | null;
  creadoAt: string;
  activadoAt: string | null;
  ultimoAt: string | null;
  codigo?: string;
  venceAt?: string;
}

const TIMEOUT_MS = 10_000;

/**
 * Cliente del registro de springTrackPhone (`POST /webhooks/next`), con la
 * misma firma HMAC que el webhook de TrackCam. A diferencia de ese webhook,
 * es síncrono: la respuesta trae el código de alta que se muestra una vez.
 * `TRACKPHONE_URL` (p. ej. https://spcode.ddns.net/api-springtrackphone) y
 * `TRACKPHONE_WEBHOOK_SECRET` (el `WEBHOOK_SECRET` del socket).
 */
@Injectable()
export class TrackPhoneClient {
  constructor(private readonly config: ConfigService) {}

  async llamar<T = TelefonoApp>(event: EventoTrackPhone, idCliente: number, data: Record<string, unknown>): Promise<T> {
    const url = (this.config.get<string>('TRACKPHONE_URL') ?? '').trim().replace(/\/$/, '');
    const secret = (this.config.get<string>('TRACKPHONE_WEBHOOK_SECRET') ?? '').trim();
    if (!url || !secret) {
      throw new ServiceUnavailableException('springTrackPhone no está configurado (TRACKPHONE_URL / TRACKPHONE_WEBHOOK_SECRET)');
    }
    const unsigned = { event, timestamp: new Date().toISOString(), tenantId: idCliente, entityId: 0, data };
    const signature = createHmac('sha256', secret).update(JSON.stringify(unsigned)).digest('hex');
    let res: Response;
    try {
      res = await fetch(`${url}/webhooks/next`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...unsigned, signature }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new BadGatewayException(`springTrackPhone no respondió: ${(error as Error)?.message}`);
    }
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (!res.ok) {
      const mensaje = typeof body?.message === 'string' ? body.message : `HTTP ${res.status}`;
      // 404 / 409 / 400 del socket se pasan tal cual; lo demás es falla del socket.
      throw [400, 404, 409].includes(res.status)
        ? new HttpException(mensaje, res.status)
        : new BadGatewayException(`springTrackPhone: ${mensaje}`);
    }
    return body as T;
  }
}
