import { EnumCatEventos } from '../../common/cat-eventos.enum';
import {
  assertJt808Envelope,
  mapAcometidasToPosicion,
  parseJt808Envelope,
} from './jt808-envelope.mapper';

const eventId =
  'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456';

describe('jt808-envelope.mapper', () => {
  it('parsea position rutinaria', () => {
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
        Estado: null,
        FechaHora: '2026-08-31 16:15:03',
        Velocidad: 45,
        Direccion: 182,
        Odometro: 1235,
        Ignicion: null,
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

    const pos = mapAcometidasToPosicion(867806072429049, envelope.payload);
    expect(pos.imei).toBe(867806072429049);
    expect(pos.lat).toBe(19.432608);
    expect(pos.idEvento).toBe(EnumCatEventos.TRANSMISION);
    expect(pos.estado).toBeNull();
    expect(pos.ignicion).toBeNull();
    expect((pos as Record<string, unknown>).jt808).toBeUndefined();
  });

  it('parsea alarm DSM con bloque jt808', () => {
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
        IdEvento: EnumCatEventos.DSM_DISTRACCION,
        Alarma1: 4,
        Alarma2: 1,
        Estado: null,
        Ignicion: null,
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
          code: 'DSM_DISTRACCION',
          label: 'Distracción (no mira al frente)',
        },
      },
    });

    const pos = mapAcometidasToPosicion(867806072429049, envelope.payload);
    expect(pos.idEvento).toBe(EnumCatEventos.DSM_DISTRACCION);
    expect(pos.alarma1).toBe(4);
    expect(pos.alarma2).toBe(1);
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
});
