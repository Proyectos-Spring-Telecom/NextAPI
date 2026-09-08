import { EnumCatEventos } from '../../common/cat-eventos.enum';
import {
  assertJt808Envelope,
  extractJt808Audit,
  isPublicHttpUrl,
  mapAcometidasToPosicion,
  parseJt808Envelope,
} from './jt808-envelope.mapper';

const eventId =
  'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456';

describe('jt808-envelope.mapper', () => {
  it('parsea position rutinaria y persiste Estado del gateway', () => {
    const raw = JSON.stringify({
      eventId,
      protocol: 'jt808',
      kind: 'position',
      deviceId: '007773050481',
      receivedAt: '2026-08-31T22:15:03.412Z',
      payload: {
        Imei: null,
        Lat: 19.432608,
        Lng: -99.133209,
        Estado: 0,
        FechaHora: '2026-08-31 16:15:03',
        Velocidad: 45,
        Direccion: 182,
        Odometro: 1235,
        Ignicion: 1,
        Alarma1: null,
        Alarma2: null,
        Energia: null,
        IdEvento: EnumCatEventos.TRANSMISION,
        IdFoto: null,
        Bateria: null,
        Alimentacion: null,
        GPS: 12,
        GSM: 28,
        Movimiento: 2,
        Combustible: null,
        Foto1: null,
        Foto2: null,
        Foto3: null,
        Video1: null,
        Video2: null,
        Video3: null,
      },
    });

    const envelope = parseJt808Envelope(raw);
    expect(envelope.kind).toBe('position');
    expect(envelope.deviceId).toBe('007773050481');

    const pos = mapAcometidasToPosicion('867806072429049', envelope.payload);
    expect(pos.imei).toBe('867806072429049');
    expect(pos.lat).toBe(19.432608);
    expect(pos.idEvento).toBe(EnumCatEventos.TRANSMISION);
    expect(pos.estado).toBe(0);
    expect(pos.ignicion).toBe(1);
    expect(pos.idFoto1).toBeNull();
    expect(pos.idVideo1).toBeNull();
    expect((pos as Record<string, unknown>).jt808).toBeUndefined();
    expect((pos as Record<string, unknown>).foto1).toBeUndefined();
  });

  it('mapea Estados especiales del gateway (velocidad/pánico/fatiga)', () => {
    const base = {
      Imei: null as string | null,
      Lat: 1,
      Lng: 1,
      FechaHora: '2026-09-03 17:00:00',
      Direccion: 0,
      Odometro: null as number | null,
      Ignicion: 1 as number | null,
      Alarma1: null as number | null,
      Alarma2: null as number | null,
      Energia: null as number | null,
      IdFoto: null as number | null,
      Bateria: null as number | null,
      Alimentacion: null as number | null,
      GPS: null as number | null,
      GSM: null as number | null,
      Movimiento: null as number | null,
      Combustible: null as number | null,
      Foto1: null as string | null,
      Foto2: null as string | null,
      Foto3: null as string | null,
      Video1: null as string | null,
      Video2: null as string | null,
      Video3: null as string | null,
    };

    expect(
      mapAcometidasToPosicion('1', {
        ...base,
        Estado: 7,
        Velocidad: 120,
        IdEvento: EnumCatEventos.SPEED,
      }).estado,
    ).toBe(7);

    expect(
      mapAcometidasToPosicion('1', {
        ...base,
        Estado: 2,
        Velocidad: 0,
        IdEvento: EnumCatEventos.HELP_ME,
      }).estado,
    ).toBe(2);

    const fatiga = mapAcometidasToPosicion('1', {
      ...base,
      Estado: 13,
      Velocidad: 55,
      Alarma1: 1,
      Alarma2: 2,
      IdEvento: EnumCatEventos.DSM_FATIGA,
    });
    expect(fatiga.estado).toBe(13);
    expect(fatiga.idEvento).toBe(21);
  });

  it('deja FKs media en null aunque el payload traiga URLs (persistencia en ingest)', () => {
    const envelope = assertJt808Envelope({
      eventId,
      protocol: 'jt808',
      kind: 'position',
      deviceId: '007773050481',
      receivedAt: '2026-09-03T23:30:00.000Z',
      payload: {
        Imei: null,
        Lat: 18.953172,
        Lng: -99.235769,
        Estado: 1,
        FechaHora: '2026-09-03 17:19:29',
        Velocidad: 0,
        Direccion: 175,
        Odometro: null,
        Ignicion: 1,
        Alarma1: null,
        Alarma2: null,
        Energia: null,
        IdEvento: EnumCatEventos.CAMERA,
        IdFoto: null,
        Bateria: null,
        Alimentacion: null,
        GPS: null,
        GSM: null,
        Movimiento: null,
        Combustible: null,
        Foto1: 'https://example.com/a.jpg',
        Foto2: null,
        Foto3: null,
        Video1: 'https://example.com/a.mp4',
        Video2: null,
        Video3: null,
      },
    });

    const pos = mapAcometidasToPosicion('1', envelope.payload);
    expect(pos.estado).toBe(1);
    expect(pos.idFoto).toBeNull();
    expect(pos.idFoto1).toBeNull();
    expect(pos.idVideo1).toBeNull();
  });

  it('parsea alarm DSM y arma auditoría sin mapear a Posiciones en consumer', () => {
    const envelope = assertJt808Envelope({
      eventId,
      protocol: 'jt808',
      kind: 'alarm',
      deviceId: '007773050481',
      receivedAt: '2026-08-31T22:20:01.000Z',
      payload: {
        Lat: 19.4351,
        Lng: -99.1305,
        FechaHora: '2026-08-31 16:20:01',
        Velocidad: 62,
        IdEvento: EnumCatEventos.DSM_FATIGA,
        Alarma1: 1,
        Alarma2: 2,
        Estado: 13,
        Ignicion: 1,
        Imei: null,
        Energia: null,
        Bateria: null,
        Alimentacion: null,
        Combustible: null,
        Direccion: 90,
        Odometro: null,
        IdFoto: null,
        GPS: 11,
        GSM: 26,
        Movimiento: 2,
        Foto1: null,
        Foto2: null,
        Foto3: null,
        Video1: null,
        Video2: null,
        Video3: null,
        jt808: {
          source: 'dsm',
          code: 'DSM_FATIGA',
          label: 'Fatiga',
        },
      },
    });

    expect(envelope.kind).toBe('alarm');
    const audit = extractJt808Audit(envelope.payload, 'alarm') as Record<
      string,
      unknown
    >;
    expect(audit.IdEvento).toBe(EnumCatEventos.DSM_FATIGA);
    expect(audit.Estado).toBe(13);
    expect(audit.jt808).toEqual({
      source: 'dsm',
      code: 'DSM_FATIGA',
      label: 'Fatiga',
    });
  });

  it('isPublicHttpUrl acepta solo http(s)', () => {
    expect(isPublicHttpUrl('https://cdn.example.com/a.jpg')).toBe(true);
    expect(isPublicHttpUrl('http://cdn.example.com/a.jpg')).toBe(true);
    expect(isPublicHttpUrl('/var/data/trackcam/a.jpg')).toBe(false);
    expect(isPublicHttpUrl('C:\\media\\a.jpg')).toBe(false);
    expect(isPublicHttpUrl(null)).toBe(false);
  });

  it('rechaza photo sin IdEvento Camera', () => {
    expect(() =>
      assertJt808Envelope({
        eventId,
        protocol: 'jt808',
        kind: 'photo',
        deviceId: '007773050481',
        receivedAt: '2026-08-31T22:25:08.000Z',
        payload: {
          Lat: 19.4326,
          Lng: -99.1332,
          FechaHora: '2026-08-31 16:25:08',
          IdEvento: EnumCatEventos.TRANSMISION,
          Velocidad: 0,
          Direccion: 0,
          Estado: null,
          Ignicion: null,
          Imei: null,
        },
      }),
    ).toThrow(`photo debe traer IdEvento=${EnumCatEventos.CAMERA}`);
  });

  it('CatEventos incluye Sobrecupo=20 y whitelist DSM 21-23', () => {
    expect(EnumCatEventos.SOBRECUPO).toBe(20);
    expect(EnumCatEventos.DSM_FATIGA).toBe(21);
    expect(EnumCatEventos.DSM_CELULAR).toBe(22);
    expect(EnumCatEventos.DSM_FUMAR).toBe(23);
  });
});
