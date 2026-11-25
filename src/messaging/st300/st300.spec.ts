import { readFileSync } from 'fs';
import { join } from 'path';
import { DeviceNotFoundByImeiError } from '../shared/device-lookup.service';
import { assertSt300Envelope, mapSt300ToPosicion } from './st300-envelope.mapper';
import { St300IngestService } from './st300-ingest.service';
import { St300TelemetryEnvelope } from './st300.types';

jest.mock('../shared/posicion-ingest.service', () => ({
  PosicionIngestService: class {},
}));
jest.mock('src/telemetria-huerfanos/telemetria-huerfanos.service', () => ({
  TelemetriaHuerfanosService: class {},
}));

/**
 * Mensajes reales generados por springST300 (buildEnvelopes): STT con GPS,
 * pánico con GPS (posición + alarma) y pánico sin GPS (solo la alarma).
 */
const fixture = JSON.parse(
  readFileSync(join(__dirname, 'st300-panico.fixture.json'), 'utf8'),
) as St300TelemetryEnvelope[];
const [stt, posicionPanico, alarmaPanico, panicoSinGps] = fixture;

describe('st300 envelope', () => {
  it('acepta los mensajes reales del socket', () => {
    expect(fixture.map((e) => assertSt300Envelope(e).kind)).toEqual(['position', 'position', 'alarm', 'alarm']);
    expect(panicoSinGps.payload.Lat).toBeNull();
  });

  it('la posición exige coordenadas; la alarma no', () => {
    const sin = (e: St300TelemetryEnvelope) => ({ ...e, payload: { ...e.payload, Lat: null, Lng: null } });
    expect(() => assertSt300Envelope(sin(stt))).toThrow('Lat/Lng');
    expect(() => assertSt300Envelope(sin(alarmaPanico))).not.toThrow();
    expect(() => assertSt300Envelope({ ...stt, protocol: 'jimi' })).toThrow('protocol');
  });

  it('mapea a Posiciones: hora de pared, ignición, GPS, alimentación', () => {
    const p = mapSt300ToPosicion('205124563', stt.payload);
    expect(p).toMatchObject({
      imei: '205124563',
      lat: 19.432608,
      lng: -99.133209,
      velocidad: 46,
      ignicion: 1,
      idEvento: 9,
      estado: 1,
      gps: 9,
      alimentacion: 12.5,
      fuentePosicion: 0,
    });
    expect(mapSt300ToPosicion('205124563', posicionPanico.payload)).toMatchObject({ idEvento: 5, estado: 2 });
  });
});

describe('St300IngestService', () => {
  const lookup = {
    resolveByImei: jest.fn().mockResolvedValue({ imei: '205124563', idTipoDispositivo: 3, idInstalacion: 10, estatus: 2 }),
  };
  const ingest = {
    ingestPosition: jest.fn().mockResolvedValue({}),
    ingestAlarm: jest.fn().mockResolvedValue({ audited: true }),
    ingestSinUbicacion: jest.fn().mockResolvedValue({}),
  };
  const huerfanos = { registrar: jest.fn().mockResolvedValue(undefined) };
  const service = new St300IngestService(lookup as never, ingest as never, huerfanos as never);

  beforeEach(() => jest.clearAllMocks());

  it('posición → ingestPosition; alarma con GPS → auditoría; pánico sin GPS → incidente sin ubicación', async () => {
    await service.handleEnvelope(stt, 'st300.position');
    expect(ingest.ingestPosition).toHaveBeenCalledWith(expect.objectContaining({ protocol: 'st300', imei: '205124563' }));

    await service.handleEnvelope(alarmaPanico, 'st300.alarm.panico');
    expect(ingest.ingestAlarm).toHaveBeenCalledTimes(1);

    await service.handleEnvelope(panicoSinGps, 'st300.alarm.panico');
    expect(ingest.ingestSinUbicacion).toHaveBeenCalledWith(
      expect.objectContaining({ alerta: expect.objectContaining({ estado: 2, idEvento: 5 }) }),
    );
  });

  it('equipo sin alta → huérfano con protocolo st300', async () => {
    lookup.resolveByImei.mockRejectedValueOnce(new DeviceNotFoundByImeiError('205124563'));
    await expect(service.handleEnvelope(stt, 'st300.position')).resolves.toEqual({});
    expect(huerfanos.registrar).toHaveBeenCalledWith(expect.objectContaining({ protocol: 'st300', motivo: 'no_registrado' }));
  });
});
