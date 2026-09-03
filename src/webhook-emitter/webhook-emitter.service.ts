import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { createHmac } from 'crypto';
import { firstValueFrom } from 'rxjs';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { EstatusEnumBitcora } from 'src/common/ApiResponse';
import { EnumModulos } from 'src/common/estatus.enum';
import {
  WebhookEvent,
  WebhookPayloadSigned,
  WebhookPayloadUnsigned,
} from './interfaces/webhook-event.interface';

@Injectable()
export class WebhookEmitterService {
  private readonly logger = new Logger(WebhookEmitterService.name);
  private readonly subscribers: string[];
  private readonly webhookSecret: string;
  private readonly trackcamWebhookUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {
    const raw = this.configService.get<string>('WEBHOOK_SUBSCRIBERS', '') ?? '';
    this.subscribers = raw
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean);
    this.webhookSecret = this.configService.get<string>('WEBHOOK_SECRET', '') ?? '';
    this.trackcamWebhookUrl =
      this.configService.get<string>('TRACKCAM_WEBHOOK_URL', '')?.trim() ?? '';
  }

  emit(
    event: WebhookEvent,
    tenantId: number,
    entityId: number,
    data: Record<string, unknown>,
  ): void {
    const urls = this.resolveUrls(event);
    if (urls.length === 0) {
      return;
    }
    if (!this.webhookSecret) {
      this.logger.warn(
        `Webhook omitido (${event}): WEBHOOK_SECRET no configurado`,
      );
      return;
    }

    const unsigned = this.buildUnsignedPayload(event, tenantId, entityId, data);
    const signature = this.signPayload(unsigned);
    const signed: WebhookPayloadSigned = { ...unsigned, signature };

    for (const url of urls) {
      void this.dispatch(url, signed);
    }
  }

  private resolveUrls(event: WebhookEvent): string[] {
    if (
      event === WebhookEvent.TRACKCAM_CREATED ||
      event === WebhookEvent.TRACKCAM_UPDATED
    ) {
      return this.trackcamWebhookUrl ? [this.trackcamWebhookUrl] : [];
    }
    return this.subscribers;
  }

  /**
   * Orden fijo: event → timestamp → tenantId → entityId → data
   * (debe coincidir con Shift al validar HMAC).
   */
  private buildUnsignedPayload(
    event: WebhookEvent,
    tenantId: number,
    entityId: number,
    data: Record<string, unknown>,
  ): WebhookPayloadUnsigned {
    return {
      event,
      timestamp: new Date().toISOString(),
      tenantId,
      entityId,
      data,
    };
  }

  private signPayload(unsigned: WebhookPayloadUnsigned): string {
    return createHmac('sha256', this.webhookSecret)
      .update(JSON.stringify(unsigned))
      .digest('hex');
  }

  private async dispatch(
    url: string,
    payload: WebhookPayloadSigned,
  ): Promise<void> {
    try {
      await firstValueFrom(
        this.httpService.post(url, payload, {
          headers: { 'Content-Type': 'application/json' },
          timeout: 5000,
        }),
      );
    } catch (error) {
      const message = (error as Error)?.message ?? 'Error desconocido';
      this.logger.warn(`Webhook falló hacia ${url}: ${message}`);
      try {
        await this.bitacoraLogger.logToBitacora(
          'WebhookEmitter',
          `Error al enviar webhook ${payload.event} a ${url}`,
          'WEBHOOK',
          {
            url,
            event: payload.event,
            tenantId: payload.tenantId,
            entityId: payload.entityId,
          },
          1,
          EnumModulos.VEHICULOS,
          EstatusEnumBitcora.ERROR,
          message,
        );
      } catch (logError) {
        this.logger.error(
          `No se pudo registrar fallo de webhook en bitácora: ${(logError as Error)?.message}`,
        );
      }
    }
  }

}
