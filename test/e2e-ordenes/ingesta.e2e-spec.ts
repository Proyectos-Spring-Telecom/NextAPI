import { Actores, ok } from './actores';
import { clienteListo } from './comunes';
import { Entorno } from './entorno';

/**
 * Motor de activos, fase E (docs/motor-activos.md §7): la ingesta acepta
 * equipos en cualquier estatus. Sin instalación la posición se guarda como
 * evidencia y no abre incidentes al cliente; un inservible que transmite abre
 * un incidente propio. RabbitMQ está apagado en la batería: los mensajes se
 * entregan directo al servicio de ingesta JT808, como lo haría el consumidor.
 */
const e = new Entorno();
let a: Actores;
let C: Awaited<ReturnType<typeof clienteListo>>;
let n = 0;

const op = (metodo: string, ruta: string, cuerpo?: unknown) => a.operacion(metodo, ruta, cuerpo);
const sql = (q: string) => e.mysql.sql('Next', q).trim();
const ingesta = () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Jt808IngestService } = require('src/messaging/jt808/jt808-ingest.service');
  return e.servicioNext(Jt808IngestService) as { handleEnvelope: (env: unknown, rk: string) => Promise<unknown> };
};
/** Una posición JT808 del equipo (deviceId = número de serie). Estado 2 = botón de pánico. */
const transmitir = (numeroSerie: string, fecha: string, estado = 0) =>
  ingesta().handleEnvelope(
    {
      eventId: `e2e-ingesta-${++n}-${Date.now()}`,
      protocol: 'jt808',
      kind: 'position',
      deviceId: numeroSerie,
      receivedAt: new Date().toISOString(),
      payload: { Lat: 18.92, Lng: -99.23, Estado: estado, FechaHora: fecha, Velocidad: 30, Direccion: 90 },
    },
    'jt808.position',
  );
const posiciones = (imei: string) => Number(sql(`SELECT COUNT(*) FROM Posiciones WHERE Imei = ${imei}`));
const incidentes = (condicion: string) => Number(sql(`SELECT COUNT(*) FROM Incidentes WHERE ${condicion}`));
const esperarIncidentes = async (condicion: string, total: number) => {
  // El alta del incidente va fuera de la transacción y sin esperar.
  for (let i = 0; i < 40 && incidentes(condicion) < total; i++) await new Promise((r) => setTimeout(r, 100));
  return incidentes(condicion);
};

const eq: Record<string, { idDispositivo: number; idSim: number; imei: string; serie: string }> = {};

beforeAll(async () => {
  await e.iniciar();
  a = new Actores(e);
  C = await clienteListo(e, a, 'ING010101AA1', 3);
  const [instalado, almacen, roto] = C.inventario;
  for (const [k, v] of Object.entries({ instalado, almacen, roto })) eq[k] = { ...v, serie: `S${v.imei}` };
  const veh = ok(await op('POST', '/productos/vehiculos', { idCliente: C.idClienteNext, placa: 'ING0001' }), 'vehículo');
  ok(
    await op('POST', '/instalaciones', { idCliente: C.idClienteNext, idProducto: Number(veh.data.id), idDispositivo: eq.instalado.idDispositivo, idSim: eq.instalado.idSim }),
    'instalar',
  );
  // Equipo dado por inservible (por revisar → inservible, como lo haría operación).
  ok(await op('PATCH', `/dispositivos/estatus/${eq.roto.idDispositivo}`, { estatus: 3 }), 'por revisar');
  ok(await op('PATCH', `/dispositivos/estatus/${eq.roto.idDispositivo}`, { estatus: 5, motivo: 'Vandalizado' }), 'inservible');
}, 240000);

afterAll(() => e.detener());

describe('Ingesta por estatus del equipo', () => {
  it('un equipo instalado en alerta abre el incidente de su cliente', async () => {
    await transmitir(eq.instalado.serie, '2026-10-30 10:00:00', 2);
    expect(posiciones(eq.instalado.imei)).toBe(1);
    expect(await esperarIncidentes(`IdCliente = ${C.idClienteNext} AND JSON_UNQUOTE(JSON_EXTRACT(DatosOrigen, '$.imei')) = '${eq.instalado.imei}'`, 1)).toBe(1);
  });

  it('un equipo disponible (sin instalación) se guarda, pero su alerta no le abre incidente a nadie', async () => {
    await transmitir(eq.almacen.serie, '2026-10-30 10:05:00', 2);
    expect(posiciones(eq.almacen.imei)).toBe(1);
    expect(Number(sql(`SELECT COUNT(*) FROM TelemetryHuerfanos WHERE DeviceId = '${eq.almacen.serie}'`))).toBe(0);
    await new Promise((r) => setTimeout(r, 1000));
    expect(incidentes(`JSON_UNQUOTE(JSON_EXTRACT(DatosOrigen, '$.imei')) = '${eq.almacen.imei}'`)).toBe(0);
  });

  it('un inservible que transmite abre un solo incidente para monitoreo, en el cliente raíz', async () => {
    await transmitir(eq.roto.serie, '2026-10-30 10:10:00');
    await transmitir(eq.roto.serie, '2026-10-30 10:20:00');
    expect(posiciones(eq.roto.imei)).toBe(2);
    const cond = `JSON_UNQUOTE(JSON_EXTRACT(DatosOrigen, '$.alerta')) = 'inservible_transmite' AND JSON_UNQUOTE(JSON_EXTRACT(DatosOrigen, '$.imei')) = '${eq.roto.imei}'`;
    expect(await esperarIncidentes(cond, 1)).toBe(1);
    await new Promise((r) => setTimeout(r, 500));
    expect(incidentes(cond)).toBe(1);
    const raiz = sql('SELECT Id FROM Clientes WHERE IdPadre IS NULL ORDER BY Id LIMIT 1');
    expect(sql(`SELECT CONCAT(IdCliente, '|', JSON_EXTRACT(DatosOrigen, '$.idClienteDispositivo')) FROM Incidentes WHERE ${cond}`)).toBe(`${raiz}|${C.idClienteNext}`);
  });

  it('un número de serie desconocido sigue yendo a huérfanos', async () => {
    await transmitir('NO-EXISTE-1', '2026-10-30 10:30:00');
    expect(Number(sql(`SELECT COUNT(*) FROM TelemetryHuerfanos WHERE DeviceId = 'NO-EXISTE-1'`))).toBeGreaterThan(0);
  });
});

describe('Equipos sin instalación', () => {
  it('lista los que transmiten sin instalación con su estatus; no el instalado', async () => {
    const r = ok(await op('GET', '/dispositivos/sin-instalacion?desde=2026-10-01'), 'sin instalación');
    const porSerie = new Map((r.data as Array<{ numeroSerie: string; estatus: number }>).map((x) => [x.numeroSerie, x.estatus]));
    expect(porSerie.get(eq.almacen.serie)).toBe(1);
    expect(porSerie.get(eq.roto.serie)).toBe(5);
    expect(porSerie.has(eq.instalado.serie)).toBe(false);
    const soloInservibles = ok(await op('GET', '/dispositivos/sin-instalacion?desde=2026-10-01&estatus=5'), 'filtro').data as Array<{ numeroSerie: string }>;
    expect(soloInservibles.map((x) => x.numeroSerie)).toContain(eq.roto.serie);
    expect(soloInservibles.map((x) => x.numeroSerie)).not.toContain(eq.almacen.serie);
  });

  it('una fecha imposible en el filtro → 400', async () => {
    expect((await op('GET', '/dispositivos/sin-instalacion?desde=2026-13-45')).status).toBe(400);
  });

  it('solo roles 1–3: monitoreo (5) no la ve', async () => {
    expect((await a.monitoreo('GET', '/dispositivos/sin-instalacion')).status).toBe(403);
  });
});

describe('Caché de la búsqueda del equipo', () => {
  it('un equipo recién instalado (en caché como sin instalación) sí abre el incidente de su alerta', async () => {
    const veh = ok(await op('POST', '/productos/vehiculos', { idCliente: C.idClienteNext, placa: 'ING0002' }), 'vehículo 2');
    ok(
      await op('POST', '/instalaciones', { idCliente: C.idClienteNext, idProducto: Number(veh.data.id), idDispositivo: eq.almacen.idDispositivo, idSim: eq.almacen.idSim }),
      'instalar el de almacén',
    );
    // Otra alerta (10, energía): la de pánico ya era su estado anterior y no "inicia".
    await transmitir(eq.almacen.serie, '2026-10-30 11:00:00', 10);
    expect(await esperarIncidentes(`IdCliente = ${C.idClienteNext} AND JSON_UNQUOTE(JSON_EXTRACT(DatosOrigen, '$.imei')) = '${eq.almacen.imei}'`, 1)).toBe(1);
  });
});
