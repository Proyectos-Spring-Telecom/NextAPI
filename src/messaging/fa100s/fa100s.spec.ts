import { readFileSync } from 'fs';
import { join } from 'path';
import {
  DeviceNotFoundByImeiError,
} from '../shared/device-lookup.service';
import {
  assertFa100sEnvelope,
  mapFa100sToPosicion,
} from './fa100s-envelope.mapper';
import { Fa100sIngestService } from './fa100s-ingest.service';
import { Fa100sTelemetryEnvelope } from './fa100s.types';

jest.mock('../shared/posicion-ingest.service', () => ({
  PosicionIngestService: class {},
}));
jest.mock('src/telemetria-huerfanos/telemetria-huerfanos.service', () => ({
  TelemetriaHuerfanosService: class {},
}));

/**
 * Mensajes reales generados por springFA100S (buildEnvelopes) con las tramas
 * del 28/10/2026 13:31–13:32: posición con GPS, caída sin GPS y la posición
 * válida siguiente (que produce el alarm_location).
 */
const fixture = JSON.parse(
  readFileSync(join(__dirname, 'fa100s-caida.fixture.json'), 'utf8'),
) as Fa100sTelemetryEnvelope[];
const [posicion, posicionDeAlarma, alarma, , ubicacionDeAlarma] = fixture;

describe('fa100s envelope', () => {
  it('acepta los 5 mensajes reales', () => {
    expect(fixture.map((e) => assertFa100sEnvelope(e).kind)).toEqual([
      'position',
      'position',
      'alarm',
      'position',
      'alarm_location',
    ]);
    expect(ubicacionDeAlarma.payload.alarmEventId).toBe(alarma.eventId);
    expect(ubicacionDeAlarma.payload.FechaHora).toBe(alarma.payload.FechaHora);
  });

  it('la alarma puede venir sin coordenadas; posición y alarm_location no', () => {
    const sinCoords = (e: Fa100sTelemetryEnvelope) => ({
      ...e,
      payload: { ...e.payload, Lat: null, Lng: null },
    });
    expect(() => assertFa100sEnvelope(sinCoords(alarma))).not.toThrow();
    expect(() => assertFa100sEnvelope(sinCoords(posicion))).toThrow('Lat/Lng');
    expect(() => assertFa100sEnvelope(sinCoords(ubicacionDeAlarma))).toThrow('Lat/Lng');
  });

  it('alarm_location sin alarmEventId → rechazo', () => {
    const { alarmEventId: _omit, ...payload } = ubicacionDeAlarma.payload;
    expect(() => assertFa100sEnvelope({ ...ubicacionDeAlarma, payload })).toThrow(
      'alarmEventId',
    );
  });

  it('mapea a Posiciones: hora de pared, sin ignición, batería y satélites', () => {
    const row = mapFa100sToPosicion('863269078504617', posicionDeAlarma.payload);
    expect(row.fechaHora?.toISOString()).toBe('2026-10-28T13:31:50.000Z');
    expect(row.idEvento).toBe(35);
    expect(row.estado).toBe(2);
    expect(row.ignicion).toBe(0);
    expect(row.bateria).toBe(42);
    expect(row.lat).toBeCloseTo(18.953242, 6);
    expect(row.lng).toBeCloseTo(-99.235572, 6);
  });
});

describe('Fa100sIngestService', () => {
  const resolved = { imei: '863269078504617', idCliente: 1, idTipoDispositivo: 1, idInstalacion: 9 };
  const deviceLookup = { resolveByImei: jest.fn() };
  const posicionIngest = {
    ingestPosition: jest.fn().mockResolvedValue({ posicionId: 1 }),
    ingestAlarm: jest.fn().mockResolvedValue({ audited: true }),
    ingestAlarmLocation: jest.fn().mockResolvedValue({ posicionId: 1 }),
  };
  const huerfanos = { registrar: jest.fn() };
  let service: Fa100sIngestService;

  beforeEach(() => {
    jest.clearAllMocks();
    deviceLookup.resolveByImei.mockResolvedValue(resolved);
    service = new Fa100sIngestService(
      deviceLookup as never,
      posicionIngest as never,
      huerfanos as never,
    );
  });

  it('cada kind va a su camino y se busca por IMEI', async () => {
    await service.handleEnvelope(posicion, 'fa100s.position');
    await service.handleEnvelope(alarma, 'fa100s.alarm.caida');
    await service.handleEnvelope(ubicacionDeAlarma, 'fa100s.alarm.caida');

    expect(deviceLookup.resolveByImei).toHaveBeenCalledWith('863269078504617');
    expect(posicionIngest.ingestPosition).toHaveBeenCalledTimes(1);
    expect(posicionIngest.ingestAlarm).toHaveBeenCalledTimes(1);
    expect(posicionIngest.ingestAlarmLocation).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'alarm_location',
        idInstalacion: 9,
        posicion: expect.objectContaining({ idEvento: 35, lat: 18.953224 }),
      }),
    );
  });

  it('reloj sin alta → equipos sin alta, sin ingest', async () => {
    deviceLookup.resolveByImei.mockRejectedValue(
      new DeviceNotFoundByImeiError('863269078504617'),
    );

    await expect(service.handleEnvelope(posicion, 'fa100s.position')).resolves.toEqual({});

    expect(huerfanos.registrar).toHaveBeenCalledWith(
      expect.objectContaining({
        protocol: 'fa100s',
        deviceId: '863269078504617',
        motivo: 'no_registrado',
      }),
    );
    expect(posicionIngest.ingestPosition).not.toHaveBeenCalled();
  });
});

describe('fa100s FuentePosicion / RadioM', () => {
  it('usa los campos raíz del socket', () => {
    const row = mapFa100sToPosicion('863269078504617', {
      ...posicion.payload,
      positionValid: false,
      FuentePosicion: 1,
      RadioM: 30,
    });
    expect(row).toMatchObject({ fuentePosicion: 1, radioM: 30 });
  });

  it('sin campos raíz (socket anterior) los deduce de fa100s.positionSource', () => {
    expect(mapFa100sToPosicion('863269078504617', posicion.payload)).toMatchObject({
      fuentePosicion: 0,
      radioM: null,
    });
    expect(mapFa100sToPosicion('863269078504617', posicionDeAlarma.payload)).toMatchObject({
      fuentePosicion: 3,
      radioM: null,
    });
  });
});
