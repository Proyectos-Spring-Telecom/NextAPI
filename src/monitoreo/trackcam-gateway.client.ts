import {
  BadGatewayException,
  GatewayTimeoutException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

export type TrackcamGatewayPhotoResponse = {
  status: string;
  terminalId: string;
  imei?: string;
  channelIds?: number[];
  Foto1?: string | null;
  Foto2?: string | null;
  Foto3?: string | null;
  location?: Record<string, unknown>;
  warning?: string;
};

export type TrackcamGatewayVideoResponse = {
  status: string;
  terminalId: string;
  imei?: string;
  channelIds?: number[];
  durationSeconds?: number;
  Video1?: string | null;
  Video2?: string | null;
  Video3?: string | null;
  location?: Record<string, unknown>;
  warning?: string;
};

@Injectable()
export class TrackcamGatewayClient {
  private readonly logger = new Logger(TrackcamGatewayClient.name);
  private readonly baseUrl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {
    this.baseUrl = (
      this.config.get<string>('TRACKCAM_GATEWAY_URL', '') ?? ''
    ).replace(/\/+$/, '');
  }

  private assertConfigured(): void {
    if (!this.baseUrl) {
      throw new ServiceUnavailableException(
        'TRACKCAM_GATEWAY_URL no está configurada',
      );
    }
  }

  async startPhoto(args: {
    accessToken: string;
    terminalId: string;
    imei: string;
    channelId?: number;
  }): Promise<TrackcamGatewayPhotoResponse> {
    this.assertConfigured();
    const body: Record<string, unknown> = {
      terminalId: args.terminalId,
      imei: args.imei,
      saveFlag: 0,
    };
    if (args.channelId != null) {
      body.channelId = args.channelId;
    }
    return this.post<TrackcamGatewayPhotoResponse>(
      '/gateway/photo/start',
      body,
      args.accessToken,
      90_000,
    );
  }

  async captureVideo(args: {
    accessToken: string;
    terminalId: string;
    imei: string;
    durationSeconds?: number;
    channelId?: number;
  }): Promise<TrackcamGatewayVideoResponse> {
    this.assertConfigured();
    const durationSeconds = Math.min(
      Math.max(1, Math.round(args.durationSeconds ?? 30)),
      30,
    );
    const body: Record<string, unknown> = {
      terminalId: args.terminalId,
      imei: args.imei,
      durationSeconds,
      streamType: 0,
      dataType: 1,
    };
    if (args.channelId != null) {
      body.channelId = args.channelId;
    }
    // 1 canal ~90 s; multi-canal paralelo ~150 s
    const timeoutMs = args.channelId != null ? 90_000 : 150_000;
    return this.post<TrackcamGatewayVideoResponse>(
      '/gateway/video/capture',
      body,
      args.accessToken,
      timeoutMs,
    );
  }

  private async post<T>(
    path: string,
    body: Record<string, unknown>,
    accessToken: string,
    timeoutMs: number,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    try {
      const res = await firstValueFrom(
        this.http.post<T>(url, body, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: timeoutMs,
          // Gateway puede devolver texto plano en errores
          transformResponse: [
            (data, headers) => {
              const ct = String(headers?.['content-type'] ?? '');
              if (ct.includes('application/json') && typeof data === 'string') {
                try {
                  return JSON.parse(data);
                } catch {
                  return data;
                }
              }
              if (typeof data === 'string') {
                try {
                  return JSON.parse(data);
                } catch {
                  return data;
                }
              }
              return data;
            },
          ],
          validateStatus: () => true,
        }),
      );

      if (res.status >= 200 && res.status < 300) {
        return res.data as T;
      }

      const message =
        typeof res.data === 'string'
          ? res.data
          : (res.data as { message?: string })?.message ??
          `Gateway Trackcam error HTTP ${res.status}`;

      if (res.status === 504) {
        throw new GatewayTimeoutException(message);
      }
      throw new HttpException(message, res.status);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      const ax = error as AxiosError;
      if (ax.code === 'ECONNABORTED') {
        throw new GatewayTimeoutException(
          'Timeout al llamar al gateway Trackcam',
        );
      }
      this.logger.error(
        `Trackcam gateway ${path}: ${ax.message}`,
        ax.stack,
      );
      throw new BadGatewayException(
        ax.message || 'Error de red hacia gateway Trackcam',
      );
    }
  }
}
