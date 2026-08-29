import {
  mapAxproEventToIngestDto,
  mapAxproHeartbeatToIngestDto,
} from './axpro-envelope.mapper';
import { AxproTelemetryEnvelope } from './axpro-envelope.types';

describe('axpro-envelope.mapper', () => {
  const eventId =
    'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456';

  it('mapea evento AX PRO a IngestEventoDto', () => {
    const envelope: AxproTelemetryEnvelope = {
      eventId,
      protocol: 'axpro',
      kind: 'event',
      deviceId: '1001',
      receivedAt: '2026-08-28T18:00:00.000Z',
      payload: {
        codigoSia: 'PA',
        tipoEvento: 'panico',
        severidad: 3,
        esRestauracion: false,
        seq: '0042',
        frameCrudo: 'frame',
      },
    };

    const dto = mapAxproEventToIngestDto(envelope, 'descifrado');
    expect(dto.cuentaSia).toBe('1001');
    expect(dto.codigoSia).toBe('PA');
    expect(dto.idempotencyKey).toBe(eventId);
    expect(dto.dataDescifrada).toBe('descifrado');
    expect(dto.esHeartbeat).toBe(false);
  });

  it('rechaza RP en cola de eventos', () => {
    const envelope: AxproTelemetryEnvelope = {
      eventId,
      protocol: 'axpro',
      kind: 'event',
      deviceId: '1001',
      receivedAt: '2026-08-28T18:00:00.000Z',
      payload: {
        codigoSia: 'RP',
        tipoEvento: 'desconocido',
        severidad: 1,
        seq: '0001',
      },
    };

    expect(() => mapAxproEventToIngestDto(envelope)).toThrow(
      'RP no debe llegar por cola axpro.event',
    );
  });

  it('mapea heartbeat sin campos de evento', () => {
    const envelope: AxproTelemetryEnvelope = {
      eventId,
      protocol: 'axpro',
      kind: 'heartbeat',
      deviceId: '1001',
      receivedAt: '2026-08-28T18:00:00.000Z',
      payload: {
        ultimoHeartbeat: '2026-08-28T18:00:00.000Z',
        seq: '0099',
      },
    };

    const dto = mapAxproHeartbeatToIngestDto(envelope);
    expect(dto.cuentaSia).toBe('1001');
    expect(dto.ultimoHeartbeat).toBe('2026-08-28T18:00:00.000Z');
    expect(dto.idempotencyKey).toBe(eventId);
  });
});
