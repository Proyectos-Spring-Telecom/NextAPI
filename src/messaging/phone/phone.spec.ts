import { DeviceNotFoundByImeiError } from '../shared/device-lookup.service';
import { assertPhoneEnvelope, mapPhoneToPosicion } from './phone-envelope.mapper';
import { PhoneIngestService } from './phone-ingest.service';
import { PhoneTelemetryEnvelope } from './phone.types';

jest.mock('../shared/posicion-ingest.service', () => ({
  PosicionIngestService: class {},
}));
jest.mock('src/telemetria-huerfanos/telemetria-huerfanos.service', () => ({
  TelemetriaHuerfanosService: class {},
}));

/** Lo que publica springTrackPhone (envelopeDe) para un reporte con fix fusionado. */
const envelope: PhoneTelemetryEnvelope = {
  eventId: 'a'.repeat(64),
  protocol: 'phone',
  kind: 'position',
  deviceId: '990123456789012',
  receivedAt: '2026-11-08T18:00:01.000Z',
  payload: {
    Imei: '990123456789012',
    Lat: 19.4282,
    Lng: -99.1933,
    Estado: 0,
    FechaHora: '2026-11-08 11:59:58',
    Velocidad: 0,
    Direccion: 0,
    IdEvento: 7,
    Bateria: 87,
    Alimentacion: 0,
    GSM: 3,
    Movimiento: 1,
    positionValid: false,
    FuentePosicion: 4,
    RadioM: 35,
    phone: { reporteId: '0b9f6f7e-1d2c-4a8b-9c3d-2e1f0a9b8c7d', origen: 'telefono', diferida: false },
  },
};

describe('phone envelope', () => {
  it('acepta la posición del socket', () => {
    expect(assertPhoneEnvelope(envelope).kind).toBe('position');
  });

  it('sin coordenadas, con fuente 3 (última válida) o con otro kind → rechazo', () => {
    expect(() => assertPhoneEnvelope({ ...envelope, payload: { ...envelope.payload, Lat: null } })).toThrow('Lat/Lng');
    expect(() => assertPhoneEnvelope({ ...envelope, payload: { ...envelope.payload, FuentePosicion: 3 } })).toThrow(
      'FuentePosicion',
    );
    expect(() => assertPhoneEnvelope({ ...envelope, kind: 'alarm' })).toThrow('kind');
    expect(() => assertPhoneEnvelope({ ...envelope, protocol: 'fa100s' })).toThrow('protocol');
  });

  it('mapea a Posiciones: fuente 4 y su radio, sin ignición ni satélites', () => {
    const p = mapPhoneToPosicion('990123456789012', envelope.payload);
    expect(p).toMatchObject({
      imei: '990123456789012',
      lat: 19.4282,
      lng: -99.1933,
      fuentePosicion: 4,
      radioM: 35,
      ignicion: 0,
      gps: null,
      gsm: 3,
      bateria: 87,
      idEvento: 7,
    });
  });
});

describe('PhoneIngestService', () => {
  const posicionIngest = { ingestPosition: jest.fn().mockResolvedValue({ posicionId: 1 }) };
  const huerfanos = { registrar: jest.fn().mockResolvedValue(undefined) };

  it('teléfono sin alta en Next → huérfano, sin posición', async () => {
    const lookup = { resolveByImei: jest.fn().mockRejectedValue(new DeviceNotFoundByImeiError('990123456789012')) };
    const svc = new PhoneIngestService(lookup as never, posicionIngest as never, huerfanos as never);
    await expect(svc.handleEnvelope(envelope, 'phone.position')).resolves.toEqual({});
    expect(huerfanos.registrar).toHaveBeenCalledWith(
      expect.objectContaining({ protocol: 'phone', deviceId: '990123456789012', motivo: 'no_registrado' }),
    );
    expect(posicionIngest.ingestPosition).not.toHaveBeenCalled();
  });

  it('teléfono dado de alta → ingestPosition con su instalación', async () => {
    const lookup = {
      resolveByImei: jest.fn().mockResolvedValue({ imei: '990123456789012', idTipoDispositivo: 4, idInstalacion: 9, estatus: 1 }),
    };
    const svc = new PhoneIngestService(lookup as never, posicionIngest as never, huerfanos as never);
    await svc.handleEnvelope(envelope, 'phone.position');
    expect(posicionIngest.ingestPosition).toHaveBeenCalledWith(
      expect.objectContaining({
        protocol: 'phone',
        idTipoDispositivo: 4,
        idInstalacion: 9,
        posicion: expect.objectContaining({ fuentePosicion: 4, radioM: 35 }),
      }),
    );
  });
});
