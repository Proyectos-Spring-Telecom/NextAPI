import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { Repository } from 'typeorm';
import { Dispositivos } from 'src/entities/Dispositivos';

export interface DeviceResolved {
  imei: number;
  idCliente: number;
}

export class DeviceNotFoundError extends Error {
  constructor(public readonly numeroSerie: string) {
    super(`Dispositivo desconocido: NumeroSerie=${numeroSerie}`);
    this.name = 'DeviceNotFoundError';
  }
}

export class DeviceImeiMissingError extends Error {
  constructor(public readonly numeroSerie: string) {
    super(`Dispositivo sin Imei: NumeroSerie=${numeroSerie}`);
    this.name = 'DeviceImeiMissingError';
  }
}

@Injectable()
export class DeviceLookupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DeviceLookupService.name);
  private redis?: Redis;

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Dispositivos)
    private readonly dispositivoRepo: Repository<Dispositivos>,
  ) {}

  onModuleInit() {
    const enabled =
      String(this.config.get('REDIS_ENABLED') ?? 'false').toLowerCase() ===
      'true';
    if (!enabled) {
      return;
    }
    const host = this.config.get<string>('REDIS_HOST') ?? '127.0.0.1';
    const port = Number(this.config.get('REDIS_PORT') ?? 6379) || 6379;
    const password = this.config.get<string>('REDIS_PASSWORD');
    this.redis = new Redis({
      host,
      port,
      password: password || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    this.redis.connect().catch((err) => {
      this.logger.warn(
        `Redis no disponible — lookup solo MySQL: ${(err as Error).message}`,
      );
      this.redis?.disconnect();
      this.redis = undefined;
    });
  }

  async onModuleDestroy() {
    await this.redis?.quit().catch(() => undefined);
  }

  async resolve(numeroSerie: string): Promise<DeviceResolved> {
    const deviceId = numeroSerie.trim();
    if (!deviceId) {
      throw new DeviceNotFoundError(numeroSerie);
    }

    const cached = await this.readCache(deviceId);
    if (cached) {
      this.logger.debug(`cache hit device:ns:${deviceId}`);
      return cached;
    }

    const row = await this.dispositivoRepo.findOne({
      where: { numeroSerie: deviceId, estatus: 1 },
      select: ['imei', 'idCliente'],
    });

    if (!row) {
      throw new DeviceNotFoundError(deviceId);
    }
    if (row.imei == null) {
      throw new DeviceImeiMissingError(deviceId);
    }

    const resolved: DeviceResolved = {
      imei: Number(row.imei),
      idCliente: Number(row.idCliente),
    };
    await this.writeCache(deviceId, resolved);
    return resolved;
  }

  private cacheKey(deviceId: string): string {
    return `device:ns:${deviceId}`;
  }

  private ttlSec(): number {
    return Number(this.config.get('REDIS_DEVICE_CACHE_TTL_SEC') ?? 600) || 600;
  }

  private async readCache(deviceId: string): Promise<DeviceResolved | null> {
    if (!this.redis) {
      return null;
    }
    try {
      const raw = await this.redis.get(this.cacheKey(deviceId));
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw) as DeviceResolved;
      if (
        parsed?.imei != null &&
        Number.isFinite(Number(parsed.imei)) &&
        parsed.idCliente != null
      ) {
        return {
          imei: Number(parsed.imei),
          idCliente: Number(parsed.idCliente),
        };
      }
    } catch (error) {
      this.logger.warn(
        `Redis read falló device:ns:${deviceId}: ${(error as Error).message}`,
      );
    }
    return null;
  }

  private async writeCache(
    deviceId: string,
    value: DeviceResolved,
  ): Promise<void> {
    if (!this.redis) {
      return;
    }
    try {
      await this.redis.set(
        this.cacheKey(deviceId),
        JSON.stringify(value),
        'EX',
        this.ttlSec(),
      );
    } catch (error) {
      this.logger.warn(
        `Redis write falló device:ns:${deviceId}: ${(error as Error).message}`,
      );
    }
  }
}
