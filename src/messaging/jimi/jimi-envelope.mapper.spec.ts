import { EnumCatEventos } from '../../common/cat-eventos.enum';
import {
  assertJimiEnvelope,
  extractJimiAudit,
  mapJimiToPosicion,
  parseJimiEnvelope,
  resolveJimiImei,
} from './jimi-envelope.mapper';

const eventId =
  '373923bf2255a795133622f3345f3e2587d59f5b686fb0582fca210c51cf9b29';

const imeiConcox = '860121060275115';

function basePayload(overrides: Record<string, unknown> = {}) {
  return {
    Imei: null as string | null,
    Lat: 18.95,
    Lng: -99.23,
    Estado: 0,
    FechaHora: '2026-09-09 18:37:23',
    Velocidad: 1,
    Direccion: 0,
    Odometro: null as number | null,
    Ignicion: 1 as number | null,
    Alarma1: 201 as number | null,
    Alarma2: null as number | null,
    Energia: null as number | null,
    IdEvento: EnumCatEventos.GEOCERCA,
    IdFoto: null as number | null,
    Bateria: null as number | null,
    Alimentacion: null as number | null,
    GPS: 6 as number | null,
    GSM: 4 as number | null,
    Movimiento: 1 as number | null,
    Combustible: 10.7 as number | null,
    Foto1: null as string | null,
    Foto2: null as string | null,
    Foto3: null as string | null,
    Video1: null as string | null,
    Video2: null as string | null,
    Video3: null as string | null,
    jimi: { protocol: 164 },
    ...overrides,
  };
}

describe('jimi-envelope.mapper', () => {
  it('FechaHora de pared 11:47 no se desplaza a 17:47 (bug DB_TZ UTC)', () => {
    const pos = mapJimiToPosicion(
      imeiConcox,
      basePayload({ FechaHora: '2026-09-10 11:47:10' }) as never,
    );
    const fh = pos.fechaHora as Date;
    expect(fh.getUTCFullYear()).toBe(2026);
    expect(fh.getUTCMonth()).toBe(8);
    expect(fh.getUTCDate()).toBe(10);
    expect(fh.getUTCHours()).toBe(11);
    expect(fh.getUTCMinutes()).toBe(47);
    expect(fh.getUTCSeconds()).toBe(10);
  });

  it('Imei string en payload → resolveJimiImei + fila Posiciones con ese Imei', () => {
    const envelope = assertJimiEnvelope({
      eventId,
      protocol: 'jimi',
      kind: 'position',
      deviceId: imeiConcox,
      receivedAt: '2026-09-10T00:37:27.647Z',
      payload: basePayload({ Imei: imeiConcox, IdEvento: 9 }),
    });

    expect(resolveJimiImei(envelope)).toBe(imeiConcox);

    const pos = mapJimiToPosicion(resolveJimiImei(envelope), envelope.payload);
    expect(pos.imei).toBe(imeiConcox);
    expect(pos.estado).toBe(0);
    expect(pos.ignicion).toBe(1);
    expect(pos.combustible).toBe(11);
    // Hora de pared en componentes UTC (DB_TZ UTC no debe sumar +6h)
    expect((pos.fechaHora as Date).getUTCHours()).toBe(18);
    expect((pos.fechaHora as Date).getUTCMinutes()).toBe(37);
  });

  it('legacy Imei null + deviceId → resuelve por deviceId', () => {
    const envelope = parseJimiEnvelope(
      JSON.stringify({
        eventId,
        protocol: 'jimi',
        kind: 'position',
        deviceId: imeiConcox,
        receivedAt: '2026-09-10T00:37:27.647Z',
        payload: basePayload({ Imei: null }),
      }),
    );

    expect(envelope.payload.Imei).toBeNull();
    expect(resolveJimiImei(envelope)).toBe(imeiConcox);

    const pos = mapJimiToPosicion(resolveJimiImei(envelope), envelope.payload);
    expect(pos.imei).toBe(imeiConcox);
    expect(pos.estado).toBe(0);
    expect(pos.combustible).toBe(11);
  });

  it('parsea position detenido + Combustible y conserva Estado del gateway', () => {
    const raw = JSON.stringify({
      eventId,
      protocol: 'jimi',
      kind: 'position',
      deviceId: imeiConcox,
      receivedAt: '2026-09-10T00:37:27.647Z',
      payload: basePayload({
        Lat: 18.953311111111113,
        Lng: -99.23588444444444,
        Imei: null,
      }),
    });

    const envelope = parseJimiEnvelope(raw);
    expect(envelope.protocol).toBe('jimi');
    expect(envelope.deviceId).toBe(imeiConcox);

    const pos = mapJimiToPosicion(imeiConcox, envelope.payload);
    expect(pos.imei).toBe(imeiConcox);
    expect(pos.estado).toBe(0);
    expect(pos.ignicion).toBe(1);
    expect(pos.idEvento).toBe(EnumCatEventos.GEOCERCA);
    expect(pos.combustible).toBe(11);
    expect(pos.lat).toBeCloseTo(18.953311111111113);

    const audit = extractJimiAudit(envelope.payload, 'position') as {
      Combustible: number;
      Imei: null;
    };
    expect(audit.Combustible).toBe(10.7);
    expect(audit.Imei).toBeNull();
  });

  it('Combustible null no rompe el mapeo', () => {
    const pos = mapJimiToPosicion(
      imeiConcox,
      basePayload({ Combustible: null }) as never,
    );
    expect(pos.combustible).toBeNull();
    expect(pos.imei).toBe(imeiConcox);
  });

  it('mapea Estados del gateway (movimiento / energía / batería / SOS)', () => {
    const base = basePayload({
      Combustible: null,
      Alarma1: null,
      Ignicion: 0,
      Movimiento: 2,
    });

    expect(
      mapJimiToPosicion(imeiConcox, {
        ...base,
        Estado: 1,
        Velocidad: 11,
        IdEvento: EnumCatEventos.TRANSMISION,
      }).estado,
    ).toBe(1);

    expect(
      mapJimiToPosicion(imeiConcox, {
        ...base,
        Estado: 10,
        Velocidad: 0,
        IdEvento: EnumCatEventos.ENERGY_ALARM,
        Alarma1: 2,
      }).estado,
    ).toBe(10);

    expect(
      mapJimiToPosicion(imeiConcox, {
        ...base,
        Estado: 9,
        Velocidad: 0,
        IdEvento: EnumCatEventos.BATERIA_BAJA,
        Alarma1: 25,
      }).estado,
    ).toBe(9);

    expect(
      mapJimiToPosicion(imeiConcox, {
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
      deviceId: imeiConcox,
      receivedAt: '2026-09-10T00:00:00.000Z',
      payload: basePayload({
        Imei: imeiConcox,
        Estado: 2,
        Velocidad: 0,
        Ignicion: 1,
        Alarma1: 1,
        IdEvento: EnumCatEventos.HELP_ME,
        Combustible: null,
        jimi: { source: 'a4', code: 'SOS', label: 'sos' },
      }),
    };

    expect(() => assertJimiEnvelope(sos)).not.toThrow();
    const audit = extractJimiAudit(sos.payload, 'alarm') as {
      jimi: { code: string };
      Imei: string;
    };
    expect(audit.jimi.code).toBe('SOS');
    expect(audit.Imei).toBe(imeiConcox);

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
        deviceId: imeiConcox,
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
