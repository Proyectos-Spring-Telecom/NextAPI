import {
  BadRequestException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { EventoAlarma } from 'src/entities/EventoAlarma';
import { GatewayIngestLog } from 'src/entities/GatewayIngestLog';
import { PanelAlarma } from 'src/entities/PanelAlarma';
import { UltimoEventoAlarma } from 'src/entities/UltimoEventoAlarma';
import { IngestEventoDto } from './dto/ingest-evento.dto';
import { IngestHeartbeatDto } from './dto/ingest-heartbeat.dto';
import { AlarmasGateway } from './alarmas.gateway';
import { mapEventoItem } from './alarmas-mapper';
import { MonitoreoGateway } from 'src/monitoreo/monitoreo.gateway';
import { isoUtcToMexicoCityAsUtcDate, isoUtcToMexicoCityMysql } from 'src/utils/datetime-mexico.util';

const UPSERT_ULTIMO_SQL = `
INSERT INTO UltimoEventoAlarma (
  IdPanel, IdCliente, IdEventoAlarma, CodigoSia, TipoEvento, EsRestauracion,
  Zona, Particion, CodigoUsuario, NombreDispositivo, Severidad,
  IpOrigen, RecibidoEn, TimestampPanel
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON DUPLICATE KEY UPDATE
  IdCliente = VALUES(IdCliente),
  IdEventoAlarma = VALUES(IdEventoAlarma),
  CodigoSia = VALUES(CodigoSia),
  TipoEvento = VALUES(TipoEvento),
  EsRestauracion = VALUES(EsRestauracion),
  Zona = VALUES(Zona),
  Particion = VALUES(Particion),
  CodigoUsuario = VALUES(CodigoUsuario),
  NombreDispositivo = VALUES(NombreDispositivo),
  Severidad = VALUES(Severidad),
  IpOrigen = VALUES(IpOrigen),
  RecibidoEn = VALUES(RecibidoEn),
  TimestampPanel = VALUES(TimestampPanel)
`;

@Injectable()
export class AlarmasIngestService {
  private readonly logger = new Logger(AlarmasIngestService.name);

  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(PanelAlarma)
    private readonly panelRepo: Repository<PanelAlarma>,
    private readonly gateway: AlarmasGateway,
    private readonly monitoreoGateway: MonitoreoGateway,
  ) {}

  async ingestEvento(
    dto: IngestEventoDto,
    idempotencyHeader: string | null,
    options?: { origen?: 'http' | 'rabbitmq' },
  ): Promise<{ accepted: true }> {
    this.assertIdempotencyKey(dto.idempotencyKey, idempotencyHeader, options);

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      try {
        await qr.manager.insert(GatewayIngestLog, {
          idempotencyKey: dto.idempotencyKey,
          tipo: 'evento',
          recibidoEn: isoUtcToMexicoCityAsUtcDate(dto.recibidoEn),
        });
      } catch (error) {
        if (isDuplicateKey(error)) {
          await qr.rollbackTransaction();
          return { accepted: true };
        }
        throw error;
      }

      const { idPanel, idCliente, panel } = await this.resolverPanel(
        dto.idDispositivo,
        dto.idCliente,
        dto.cuentaSia,
      );
      const estatus = idPanel == null ? 0 : 1;

      const saved = await qr.manager.save(
        qr.manager.create(EventoAlarma, {
          idPanel,
          idCliente,
          codigoSia: dto.codigoSia,
          tipoEvento: dto.tipoEvento,
          esRestauracion: dto.esRestauracion ? 1 : 0,
          zona: dto.zona ?? null,
          particion: dto.particion ?? null,
          codigoUsuario: dto.codigoUsuario ?? null,
          nombreDispositivo: dto.nombreDispositivo ?? null,
          severidad: dto.severidad,
          secuencia: dto.seq,
          frameCrudo: dto.frameCrudo ?? '',
          dataDescifrada: dto.dataDescifrada ?? null,
          ipOrigen: dto.ipOrigen ?? null,
          recibidoEn: isoUtcToMexicoCityAsUtcDate(dto.recibidoEn),
          timestampPanel: this.formatTimestampPanelIngest(dto.timestampPanel),
          estatus,
        }),
      );

      await qr.manager.update(
        GatewayIngestLog,
        { idempotencyKey: dto.idempotencyKey },
        { idEventoAlarma: saved.id },
      );
      await qr.commitTransaction();

      if (idPanel == null) {
        this.logger.warn(
          `evento huérfano cuentaSia=${dto.cuentaSia} idEvento=${saved.id}`,
        );
        return { accepted: true };
      }

      try {
        await this.dataSource.query(UPSERT_ULTIMO_SQL, [
          idPanel,
          idCliente,
          saved.id,
          saved.codigoSia,
          saved.tipoEvento,
          saved.esRestauracion,
          saved.zona,
          saved.particion,
          saved.codigoUsuario,
          saved.nombreDispositivo,
          saved.severidad,
          saved.ipOrigen,
          saved.recibidoEn,
          saved.timestampPanel,
        ]);
      } catch (error) {
        this.logger.error(
          `UPSERT UltimoEventoAlarma falló (idEvento=${saved.id}): ${(error as Error)?.message}`,
        );
      }

      const inmueble = await this.cargarInmuebleActivo(idPanel, idCliente);
      this.gateway.emitEventoNuevo(
        idPanel,
        mapEventoItem({
          Id: saved.id,
          IdPanel: idPanel,
          IdCliente: idCliente,
          CodigoSia: saved.codigoSia,
          TipoEvento: saved.tipoEvento,
          EsRestauracion: saved.esRestauracion,
          Zona: saved.zona,
          CodigoUsuario: saved.codigoUsuario,
          NombreDispositivo: saved.nombreDispositivo,
          Severidad: saved.severidad,
          RecibidoEn: saved.recibidoEn,
          PanelId: idPanel,
          CuentaSia: panel?.cuentaSia ?? dto.cuentaSia,
          PanelNombre: panel?.nombre ?? null,
          IdProducto: inmueble?.IdProducto,
          Inmueble: inmueble?.Inmueble ?? null,
          Lat: inmueble?.Lat ?? null,
          Lng: inmueble?.Lng ?? null,
        }),
      );
      void this.monitoreoGateway.notificarDispositivo(idPanel);

      return { accepted: true };
    } catch (error) {
      if (qr.isTransactionActive) {
        await qr.rollbackTransaction();
      }
      throw error;
    } finally {
      await qr.release();
    }
  }

  async ingestHeartbeat(
    dto: IngestHeartbeatDto,
    idempotencyHeader: string | null,
    options?: { origen?: 'http' | 'rabbitmq' },
  ): Promise<{ accepted: true }> {
    this.assertIdempotencyKey(dto.idempotencyKey, idempotencyHeader, options);

    const qr = this.dataSource.createQueryRunner();
    await qr.connect();
    await qr.startTransaction();
    try {
      try {
        await qr.manager.insert(GatewayIngestLog, {
          idempotencyKey: dto.idempotencyKey,
          tipo: 'heartbeat',
          recibidoEn: isoUtcToMexicoCityAsUtcDate(dto.ultimoHeartbeat),
        });
      } catch (error) {
        if (isDuplicateKey(error)) {
          await qr.rollbackTransaction();
          return { accepted: true };
        }
        throw error;
      }

      const { idPanel } = await this.resolverPanel(
        dto.idDispositivo,
        dto.idCliente,
        dto.cuentaSia,
      );

      if (idPanel == null) {
        await qr.commitTransaction();
        this.logger.warn(`heartbeat sin panel cuentaSia=${dto.cuentaSia}`);
        return { accepted: true };
      }

      const ultimoHeartbeat = isoUtcToMexicoCityAsUtcDate(dto.ultimoHeartbeat);

      await qr.manager.update(
        PanelAlarma,
        { idDispositivo: idPanel, estatus: 1 },
        { ultimoHeartbeat },
      );
      await qr.commitTransaction();

      this.gateway.emitHeartbeat(idPanel, ultimoHeartbeat);
      void this.monitoreoGateway.notificarDispositivo(idPanel);
      return { accepted: true };
    } catch (error) {
      if (qr.isTransactionActive) {
        await qr.rollbackTransaction();
      }
      throw error;
    } finally {
      await qr.release();
    }
  }

  private formatTimestampPanelIngest(
    value: string | null | undefined,
  ): string | null {
    if (!value?.trim()) {
      return null;
    }
    if (/T.*(Z|[+-]\d{2}:?\d{2})$/i.test(value)) {
      try {
        return isoUtcToMexicoCityMysql(value);
      } catch {
        return value;
      }
    }
    return value;
  }

  private assertIdempotencyKey(
    bodyKey: string,
    headerKey: string | null,
    options?: { origen?: 'http' | 'rabbitmq' },
  ) {
    if (options?.origen === 'rabbitmq') {
      return;
    }
    if (!headerKey) {
      throw new BadRequestException('Falta header Idempotency-Key');
    }
    if (headerKey.toLowerCase() !== bodyKey.toLowerCase()) {
      throw new BadRequestException(
        'Idempotency-Key no coincide con el body',
      );
    }
  }

  private async resolverPanel(
    idDispositivo: number | null | undefined,
    idClienteBody: number | null | undefined,
    cuentaSia: string,
  ): Promise<{
    idPanel: number | null;
    idCliente: number | null;
    panel: PanelAlarma | null;
  }> {
    let panel: PanelAlarma | null = null;
    if (idDispositivo != null) {
      panel = await this.panelRepo.findOne({
        where: { idDispositivo: Number(idDispositivo), estatus: 1 },
      });
    }
    if (!panel && cuentaSia) {
      panel = await this.panelRepo.findOne({
        where: { cuentaSia, estatus: 1 },
      });
    }

    const idPanel = panel ? Number(panel.idDispositivo) : null;
    const idCliente =
      idClienteBody != null
        ? Number(idClienteBody)
        : panel
          ? Number(panel.idCliente)
          : null;

    return { idPanel, idCliente, panel };
  }

  private async cargarInmuebleActivo(
    idPanel: number,
    idCliente: number | null,
  ): Promise<{
    IdProducto: number;
    Inmueble: string | null;
    Lat: number | null;
    Lng: number | null;
  } | null> {
    if (idCliente == null) {
      return null;
    }
    const rows = await this.dataSource.query(
      `SELECT i.IdProducto, i.Inmueble, i.Lat, i.Lng
         FROM Instalaciones inst
         JOIN Inmuebles i
           ON i.IdProducto = inst.IdProducto AND i.IdCliente = inst.IdCliente
        WHERE inst.IdDispositivo = ?
          AND inst.IdCliente = ?
          AND inst.Estatus = 1
        LIMIT 1`,
      [idPanel, idCliente],
    );
    return rows?.[0] ?? null;
  }
}

function isDuplicateKey(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driver = error.driverError as { code?: string; errno?: number };
  return driver?.code === 'ER_DUP_ENTRY' || driver?.errno === 1062;
}
