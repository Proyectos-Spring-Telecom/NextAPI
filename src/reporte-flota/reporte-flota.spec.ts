import { armarMensaje, clasificar, claveCoordenada, direccionDeNominatim, distanciaM } from './reporte-flota.reglas';
import { GeocodificacionService } from './geocodificacion.service';

// Hora de pared de México marcada como UTC, como sale de la base.
const ahora = new Date('2026-11-19T12:00:00Z');
const hace = (min: number) => new Date(ahora.getTime() - min * 60_000).toISOString();
const base = { lat: 19.4, lng: -99.1, fechaHora: hace(2), fhRegistro: hace(2), velocidad: 40, sinReporteDesde: null };

describe('reporte de flota: clasificar', () => {
  it('reciente y con velocidad → movimiento', () => {
    expect(clasificar(base, ahora)).toBe('movimiento');
  });
  it('velocidad baja → detenida (la ignición no cuenta)', () => {
    expect(clasificar({ ...base, velocidad: 3 }, ahora)).toBe('detenida');
  });
  it('a velocidad pero la posición es vieja → detenida', () => {
    expect(clasificar({ ...base, fechaHora: hace(40), fhRegistro: hace(40) }, ahora)).toBe('detenida');
  });
  it('episodio de sin reporte abierto → sinReporte', () => {
    expect(clasificar({ ...base, sinReporteDesde: hace(20) }, ahora)).toBe('sinReporte');
  });
  it('sin posición', () => {
    expect(clasificar({ ...base, fechaHora: null, lat: null }, ahora)).toBe('sinPosicion');
  });
});

describe('reporte de flota: mensaje', () => {
  const d = {
    economico: '41', placa: 'NV4064B', marca: 'Nissan', modelo: 'NP300', anio: 2022, situacion: 'movimiento' as const,
    velocidad: 62.4, ignicion: 1, idTipoDispositivo: 3, lat: 19.4, lng: -99.1,
    fechaHora: '2026-11-19T11:58:00.000Z', direccion: 'Av. Reforma, Juárez, Ciudad de México, México',
  };
  it('con dirección, sin ignición en AVL', () => {
    const m = armarMensaje(d, new Date('2026-11-19T18:00:00Z'));
    expect(m.split('\n')[0]).toBe('*Unidad 41 circulando sobre Av. Reforma, Juárez, Ciudad de México, México*');
    expect(m).toContain('Placas: NV4064B | Nissan NP300 2022');
    expect(m).toContain('Vel: 62 km/h');
    expect(m).not.toContain('Ignición');
    expect(m).toContain('https://maps.google.com/?q=19.4,-99.1');
    expect(m).toContain('Última posición: 11:58');
    expect(m).toContain('Reporte generado: 19/11/2026, 12:00');
  });
  it('TrackCam informa la ignición; sin dirección da la coordenada', () => {
    const m = armarMensaje({ ...d, idTipoDispositivo: 5, direccion: null }, ahora);
    expect(m.split('\n')[0]).toBe('*Unidad 41 — última posición: 19.4, -99.1*');
    expect(m).toContain('Ignición: ON | Vel: 62 km/h');
  });
});

describe('reporte de flota: geocodificación', () => {
  it('arma la dirección como el legacy', () => {
    expect(direccionDeNominatim({ road: 'Calle 5', suburb: 'Centro', city: 'Querétaro', state: 'Querétaro', postcode: '76000' }))
      .toBe('Calle 5, Centro, Querétaro, Querétaro, 76000, México');
    expect(direccionDeNominatim({})).toBeNull();
  });

  it('una sola petición por coordenada y luego caché', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ address: { road: 'X', city: 'Y' } }) });
    const original = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    try {
      const geo = new GeocodificacionService({ get: (k: string) => (k === 'GEOCODIFICACION_INTERVALO_MS' ? 0 : undefined) } as never);
      expect(geo.enCache(19.4, -99.1)).toBeUndefined();
      const [a, b] = await Promise.all([geo.direccion(19.4, -99.1), geo.direccion(19.40001, -99.10001)]);
      expect(a).toBe('X, Y, México');
      expect(b).toBe('X, Y, México');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(geo.enCache(19.4, -99.1)).toBe('X, Y, México');
      expect(claveCoordenada(19.4, -99.1)).toBe('19.4000,-99.1000');
    } finally {
      global.fetch = original;
    }
  });

  it('apagada no consulta', async () => {
    const geo = new GeocodificacionService({ get: (k: string) => (k === 'GEOCODIFICACION_ENABLED' ? 'false' : undefined) } as never);
    expect(await geo.direccion(19.4, -99.1)).toBeNull();
  });
});

describe('reporte de flota: distancia', () => {
  it('~111 m por milésima de grado de latitud', () => {
    expect(Math.round(distanciaM({ lat: 19.4, lng: -99.1 }, { lat: 19.401, lng: -99.1 }))).toBe(111);
  });
});

describe('reporte de flota: cola de direcciones', () => {
  const { ReporteFlotaService } = jest.requireActual('./reporte-flota.service');
  const veh = (lat: number) => ({
    idInstalacion: 7, idCliente: 1, idTipoProducto: 1, idTipoDispositivo: 3, lat, lng: -99.1, velocidad: 60,
    fechaHora: new Date().toISOString(), fhRegistro: null, sinReporteDesde: null,
  });

  it('busca la coordenada más reciente de la unidad y luego la reusa cerca', async () => {
    let lat = 19.4;
    const monitoreo = { listado: jest.fn(async () => ({ posicion: [veh(lat)] })) };
    let liberar: () => void = () => undefined;
    const bloqueo = new Promise<void>((r) => (liberar = r));
    const geo = {
      activa: true,
      enCache: jest.fn(() => undefined),
      direccion: jest.fn(async (la: number) => {
        if (geo.direccion.mock.calls.length === 1) await bloqueo;
        return `calle ${la}`;
      }),
    };
    const config = { get: () => undefined };
    const s = new ReporteFlotaService(monitoreo, {}, geo, config);
    const alcance = { userId: 1, idCliente: 1, rol: 1 };

    // Primera consulta: arranca la búsqueda de 19.4 (queda bloqueada).
    await s.reporte(alcance, 'todas');
    // Mientras, la unidad avanza dos veces: la cola guarda solo la última coordenada.
    lat = 19.5; await s.reporte(alcance, 'todas');
    lat = 19.6; await s.reporte(alcance, 'todas');
    liberar();
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    expect(geo.direccion.mock.calls.map((c) => c[0])).toEqual([19.4, 19.6]);

    // A 100 m de la última encontrada: sale esa dirección y no queda pendiente.
    lat = 19.6009;
    const r = await s.reporte(alcance, 'todas');
    expect(r.unidades[0].direccion).toBe('calle 19.6');
    expect(r.unidades[0].direccionPendiente).toBe(false);
  });
});
