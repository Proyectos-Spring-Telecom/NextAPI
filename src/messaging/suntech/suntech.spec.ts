import { readFileSync } from 'fs';
import { join } from 'path';
import { DeviceNotFoundByImeiError } from '../shared/device-lookup.service';
import { assertSuntechEnvelope, mapSuntechToPosicion } from './suntech-envelope.mapper';
import { SuntechIngestService } from './suntech-ingest.service';
import { SuntechTelemetryEnvelope } from './suntech.types';

jest.mock('../shared/posicion-ingest.service', () => ({
  PosicionIngestService: class {},
}));
jest.mock('src/telemetria-huerfanos/telemetria-huerfanos.service', () => ({
  TelemetriaHuerfanosService: class {},
}));

/**
 * Mensajes reales generados por springSuntech (buildEnvelopes), protocolo universal (ST4315B): STT con GPS,
 * pánico con GPS (posición + alarma) y pánico sin GPS (solo la alarma).
 */
const fixture = JSON.parse(
  readFileSync(join(__dirname, 'suntech-panico.fixture.json'), 'utf8'),
) as SuntechTelemetryEnvelope[];
const [stt, posicionPanico, alarmaPanico, panicoSinGps] = fixture;

describe('suntech envelope', () => {
  it('acepta los mensajes reales del socket', () => {
    expect(fixture.map((e) => assertSuntechEnvelope(e).kind)).toEqual(['position', 'position', 'alarm', 'alarm']);
    expect(panicoSinGps.payload.Lat).toBeNull();
  });

  it('la posición exige coordenadas; la alarma no', () => {
    const sin = (e: SuntechTelemetryEnvelope) => ({ ...e, payload: { ...e.payload, Lat: null, Lng: null } });
    expect(() => assertSuntechEnvelope(sin(stt))).toThrow('Lat/Lng');
    expect(() => assertSuntechEnvelope(sin(alarmaPanico))).not.toThrow();
    expect(() => assertSuntechEnvelope({ ...stt, protocol: 'jimi' })).toThrow('protocol');
  });

  it('mapea a Posiciones: hora de pared, ignición y GPS', () => {
    const p = mapSuntechToPosicion('2300000858', stt.payload);
    expect(p).toMatchObject({
      imei: '2300000858',
      lat: 19.432608,
      lng: -99.133209,
      velocidad: 46,
      ignicion: 1,
      idEvento: 9,
      estado: 1,
      gps: 9,
      alimentacion: null,
      fuentePosicion: 0,
    });
    expect(mapSuntechToPosicion('2300000858', posicionPanico.payload)).toMatchObject({ idEvento: 5, estado: 2 });
  });
});

describe('SuntechIngestService', () => {
  const lookup = {
    resolveByImei: jest.fn().mockResolvedValue({ imei: '2300000858', idTipoDispositivo: 3, idInstalacion: 10, estatus: 2 }),
  };
  const ingest = {
    ingestPosition: jest.fn().mockResolvedValue({}),
    ingestAlarm: jest.fn().mockResolvedValue({ audited: true }),
    ingestSinUbicacion: jest.fn().mockResolvedValue({}),
  };
  const huerfanos = { registrar: jest.fn().mockResolvedValue(undefined) };
  const service = new SuntechIngestService(lookup as never, ingest as never, huerfanos as never);

  beforeEach(() => jest.clearAllMocks());

  it('posición → ingestPosition; alarma con GPS → auditoría; pánico sin GPS → incidente sin ubicación', async () => {
    await service.handleEnvelope(stt, 'suntech.position');
    expect(ingest.ingestPosition).toHaveBeenCalledWith(expect.objectContaining({ protocol: 'suntech', imei: '2300000858' }));

    await service.handleEnvelope(alarmaPanico, 'suntech.alarm.panico');
    expect(ingest.ingestAlarm).toHaveBeenCalledTimes(1);

    await service.handleEnvelope(panicoSinGps, 'suntech.alarm.panico');
    expect(ingest.ingestSinUbicacion).toHaveBeenCalledWith(
      expect.objectContaining({ alerta: expect.objectContaining({ estado: 2, idEvento: 5 }) }),
    );
  });

  it('equipo sin alta → huérfano con protocolo suntech', async () => {
    lookup.resolveByImei.mockRejectedValueOnce(new DeviceNotFoundByImeiError('2300000858'));
    await expect(service.handleEnvelope(stt, 'suntech.position')).resolves.toEqual({});
    expect(huerfanos.registrar).toHaveBeenCalledWith(expect.objectContaining({ protocol: 'suntech', motivo: 'no_registrado' }));
  });
});
