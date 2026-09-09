import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ESTATUS_DISPOSITIVO_INGEST_TELEMETRIA,
  EstatusEnum,
} from '../../common/estatus.enum';
import { imeiToString } from '../../common/imei.util';
import { Dispositivos } from '../../entities/Dispositivos';
import { Instalaciones } from '../../entities/Instalaciones';

export interface DeviceResolved {
  /** IMEI como string (bigint BD; evita redondeo JS) */
  imei: string;
  idCliente: number;
  idTipoDispositivo: number;
  /** Instalación activa del dispositivo; null si no hay (geocerca no aplica). */
  idInstalacion: number | null;
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

interface CacheEntry {
  value: DeviceResolved;
  expiresAt: number;
}

@Injectable()
export class DeviceLookupService {
  private readonly logger = new Logger(DeviceLookupService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(
    private readonly config: ConfigService,
    @InjectRepository(Dispositivos)
    private readonly dispositivoRepo: Repository<Dispositivos>,
  ) {}

  async resolve(numeroSerie: string): Promise<DeviceResolved> {
    const deviceId = numeroSerie.trim();
    if (!deviceId) {
      throw new DeviceNotFoundError(numeroSerie);
    }

    const cached = this.readCache(deviceId);
    if (cached) {
      this.logger.debug(`cache hit device:ns:${deviceId}`);
      return cached;
    }

    const row = await this.dispositivoRepo
      .createQueryBuilder('d')
      .leftJoin(
        Instalaciones,
        'i',
        'i.idDispositivo = d.id AND i.idCliente = d.idCliente AND i.estatus = :instActivo',
        { instActivo: EstatusEnum.ACTIVO },
      )
      .select('CAST(d.imei AS CHAR)', 'imei')
      .addSelect('d.idCliente', 'idCliente')
      .addSelect('d.idTipoDispositivo', 'idTipoDispositivo')
      .addSelect('i.id', 'idInstalacion')
      .where('d.numeroSerie = :deviceId', { deviceId })
      .andWhere('d.estatus IN (:...estatus)', {
        estatus: [...ESTATUS_DISPOSITIVO_INGEST_TELEMETRIA],
      })
      .orderBy('i.id', 'DESC')
      .getRawOne<{
        imei: string | null;
        idCliente: string | number;
        idTipoDispositivo: string | number;
        idInstalacion: string | number | null;
      }>();

    if (!row) {
      throw new DeviceNotFoundError(deviceId);
    }
    const imei = imeiToString(row.imei);
    if (!imei) {
      throw new DeviceImeiMissingError(deviceId);
    }

    const idInstalacion =
      row.idInstalacion != null && row.idInstalacion !== ''
        ? Number(row.idInstalacion)
        : null;

    const resolved: DeviceResolved = {
      imei,
      idCliente: Number(row.idCliente),
      idTipoDispositivo: Number(row.idTipoDispositivo),
      idInstalacion:
        idInstalacion != null && Number.isFinite(idInstalacion)
          ? idInstalacion
          : null,
    };
    this.writeCache(deviceId, resolved);
    return resolved;
  }

  private ttlMs(): number {
    const sec =
      Number(this.config.get('DEVICE_LOOKUP_CACHE_TTL_SEC') ?? 600) || 600;
    return sec * 1000;
  }

  private readCache(deviceId: string): DeviceResolved | null {
    const entry = this.cache.get(deviceId);
    if (!entry) {
      return null;
    }
    if (Date.now() >= entry.expiresAt) {
      this.cache.delete(deviceId);
      return null;
    }
    return entry.value;
  }

  private writeCache(deviceId: string, value: DeviceResolved): void {
    this.cache.set(deviceId, {
      value,
      expiresAt: Date.now() + this.ttlMs(),
    });
  }
}
