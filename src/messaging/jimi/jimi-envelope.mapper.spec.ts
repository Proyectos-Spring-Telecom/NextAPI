import { EnumCatEventos } from '../../common/cat-eventos.enum';
import {
  assertJimiEnvelope,
  extractJimiAudit,
  mapJimiToPosicion,
  parseJimiEnvelope,
} from './jimi-envelope.mapper';

const eventId =
  '373923bf2255a795133622f3345f3e2587d59f5b686fb0582fca210c51cf9b29';

describe('jimi-envelope.mapper', () => {
  it('parsea position detenido + Combustible y conserva Estado del gateway', () => {
    const raw = JSON.stringify({
      eventId,
      protocol: 'jimi',
      kind: 'position',
      deviceId: '860121060275115',
      receivedAt: '2026-09-10T00:37:27.647Z',
      payload: {
        Imei: null,
        Lat: 18.953311111111113,
        Lng: -99.23588444444444,
        Estado: 0,
        FechaHora: '2026-09-09 18:37:23',
        Velocidad: 1,
        Direccion: 0,
        Odometro: null,
        Ignicion: 1,
        Alarma1: 201,
        Alarma2: null,
        Energia: null,
        IdEvento: EnumCatEventos.GEOCERCA,
        IdFoto: null,
        Bateria: null,
        Alimentacion: null,
        GPS: 6,
        GSM: 4,
        Movimiento: 1,
        Combustible: 10.7,
        Foto1: null,
        Foto2: null,
        Foto3: null,
        Video1: null,
        Video2: null,
        Video3: null,
        jimi: { protocol: 164 },
      },
    });

    const envelope = parseJimiEnvelope(raw);
    expect(envelope.protocol).toBe('jimi');
    expect(envelope.deviceId).toBe('860121060275115');

    const pos = mapJimiToPosicion('860121060275115', envelope.payload);
    expect(pos.imei).toBe('860121060275115');
    expect(pos.estado).toBe(0);
    expect(pos.ignicion).toBe(1);
    expect(pos.idEvento).toBe(EnumCatEventos.GEOCERCA);
    expect(pos.combustible).toBe(11);
    expect(pos.lat).toBeCloseTo(18.953311111111113);

    const audit = extractJimiAudit(envelope.payload, 'position') as {
      Combustible: number;
    };
    expect(audit.Combustible).toBe(10.7);
  });

  it('mapea Estados del gateway (movimiento / energía / batería / SOS)', () => {
    const base = {
      Imei: null as null,
      Lat: 18.95,
      Lng: -99.23,
      FechaHora: '2026-09-08 18:48:02',
      Direccion: 0,
      Odometro: null as number | null,
      Ignicion: 0 as number | null,
      Alarma1: null as number | null,
      Alarma2: null as number | null,
      Energia: null as number | null,
      IdFoto: null as number | null,
      Bateria: null as number | null,
      Alimentacion: null as number | null,
      GPS: null as number | null,
      GSM: null as number | null,
      Movimiento: 2 as number | null,
      Combustible: null as number | null,
      Foto1: null as string | null,
      Foto2: null as string | null,
      Foto3: null as string | null,
      Video1: null as string | null,
      Video2: null as string | null,
      Video3: null as string | null,
    };

    expect(
      mapJimiToPosicion('860121060275115', {
        ...base,
        Estado: 1,
        Velocidad: 11,
        IdEvento: EnumCatEventos.TRANSMISION,
      }).estado,
    ).toBe(1);

    expect(
      mapJimiToPosicion('860121060275115', {
        ...base,
        Estado: 10,
        Velocidad: 0,
        IdEvento: EnumCatEventos.ENERGY_ALARM,
        Alarma1: 2,
      }).estado,
    ).toBe(10);

    expect(
      mapJimiToPosicion('860121060275115', {
        ...base,
        Estado: 9,
        Velocidad: 0,
        IdEvento: EnumCatEventos.BATERIA_BAJA,
        Alarma1: 25,
      }).estado,
    ).toBe(9);

    expect(
      mapJimiToPosicion('860121060275115', {
        ...base,
        Estado: 2,
        Velocidad: 0,
        IdEvento: EnumCatEventos.HELP_ME,
        Alarma1: 1,
      }).estado,
    ).toBe(2);
  });

  it('alarm SOS válido; otros codes → BadRequest permanente', () => {
    const sos = {
      eventId,
      protocol: 'jimi',
      kind: 'alarm',
      deviceId: '860121060275115',
      receivedAt: '2026-09-10T00:00:00.000Z',
      payload: {
        Imei: null,
        Lat: 18.95,
        Lng: -99.23,
        Estado: 2,
        FechaHora: '2026-09-09 18:00:00',
        Velocidad: 0,
        Direccion: 0,
        Odometro: null,
        Ignicion: 1,
        Alarma1: 1,
        Alarma2: null,
        Energia: null,
        IdEvento: EnumCatEventos.HELP_ME,
        IdFoto: null,
        Bateria: null,
        Alimentacion: null,
        GPS: null,
        GSM: null,
        Movimiento: 1,
        Combustible: null,
        Foto1: null,
        Foto2: null,
        Foto3: null,
        Video1: null,
        Video2: null,
        Video3: null,
        jimi: { source: 'a4', code: 'SOS', label: 'sos' },
      },
    };

    expect(() => assertJimiEnvelope(sos)).not.toThrow();
    const audit = extractJimiAudit(sos.payload, 'alarm') as {
      jimi: { code: string };
    };
    expect(audit.jimi.code).toBe('SOS');

    expect(() =>
      assertJimiEnvelope({
        ...sos,
        payload: {
          ...sos.payload,
          jimi: { source: 'a4', code: 'POWERCUT', label: 'power' },
        },
      }),
    ).toThrow(/solo admite code=SOS/);
  });

  it('rechaza protocol distinto de jimi', () => {
    expect(() =>
      assertJimiEnvelope({
        eventId,
        protocol: 'jt808',
        kind: 'position',
        deviceId: '860121060275115',
        receivedAt: '2026-09-10T00:00:00.000Z',
        payload: {
          Lat: 1,
          Lng: 1,
          FechaHora: '2026-09-09 12:00:00',
          IdEvento: 9,
        },
      }),
    ).toThrow(/protocol debe ser jimi/);
  });
});
