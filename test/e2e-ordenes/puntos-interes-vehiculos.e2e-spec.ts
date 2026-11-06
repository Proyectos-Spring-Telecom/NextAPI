import { Actores, ok } from './actores';
import { clienteListo } from './comunes';
import { Entorno } from './entorno';

/**
 * Puntos de interés (5/11/2026): son del cliente y se ligan a uno o varios
 * vehículos (`ProductosPuntoInteres`, también de los clientes hijos). Con cada
 * posición de un vehículo ligado, Next guarda la llegada y la salida
 * (`EventosPuntoInteres`) sin cambiar el Estado de la posición. Los reportes
 * del cliente padre incluyen los vehículos de sus hijos, y un vehículo del hijo
 * puede usar los puntos del padre.
 */
const e = new Entorno();
let a: Actores;
let C: Awaited<ReturnType<typeof clienteListo>>;
let H: Awaited<ReturnType<typeof clienteListo>>;
const s: Record<string, number> = {};
let n = 0;
let tok9 = '';

const op = (metodo: string, ruta: string, cuerpo?: unknown) => a.operacion(metodo, ruta, cuerpo);
const como = (token: string, metodo: string, ruta: string, cuerpo?: unknown) => e.llamar(e.nextUrl, metodo, ruta, token, cuerpo);
const sql = (q: string) => e.mysql.sql('Next', q).trim();
const transmitir = (numeroSerie: string, fecha: string, lat: number) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Jt808IngestService } = require('src/messaging/jt808/jt808-ingest.service');
  const ingesta = e.servicioNext(Jt808IngestService) as { handleEnvelope: (env: unknown, rk: string) => Promise<unknown> };
  return ingesta.handleEnvelope(
    {
      eventId: `e2e-poi-${++n}-${Date.now()}`,
      protocol: 'jt808',
      kind: 'position',
      deviceId: numeroSerie,
      receivedAt: new Date().toISOString(),
      payload: { Lat: lat, Lng: -99.2, Estado: 0, FechaHora: fecha, Velocidad: 40, Direccion: 90 },
    },
    'jt808.position',
  );
};
const minutoDe = (idInst: number, min: number) =>
  sql(`SELECT DATE_FORMAT(VigenteDesde + INTERVAL ${min} MINUTE, '%Y-%m-%d %H:%i:%s') FROM Instalaciones WHERE Id = ${idInst}`);
/** Espera a que el ingest (sin esperar) deje sus avisos. */
const esperar = async (cond: () => boolean) => {
  for (let i = 0; i < 50 && !cond(); i++) await new Promise((r) => setTimeout(r, 100));
};

beforeAll(async () => {
  await e.iniciar();
  a = new Actores(e);
  C = await clienteListo(e, a, 'POI010101AA1', 1);
  H = await clienteListo(e, a, 'POH010101AA1', 1);
  sql(`UPDATE Clientes SET IdPadre = ${C.idClienteNext} WHERE Id = ${H.idClienteNext}`);
  e.mysql.sql(
    'Next',
    `INSERT INTO Usuarios (Id, UserName, PasswordHash, EmailConfirmado, Nombre, IdRol, IdCliente, Estatus) VALUES
      (86, 'usu-poi@e2e.local', 'x', 1, 'Usuario', 9, ${C.idClienteNext}, 1)`,
  );
  tok9 = e.tokenNext({ id: 86, rol: 9 }, C.idClienteNext);
  s.veh = Number(ok(await op('POST', '/productos/vehiculos', { idCliente: C.idClienteNext, placa: 'POI0001' }), 'vehículo').data.id);
  s.vehHijo = Number(ok(await op('POST', '/productos/vehiculos', { idCliente: H.idClienteNext, placa: 'POH0001' }), 'vehículo hijo').data.id);
  s.instHijo = Number(
    ok(
      await op('POST', '/instalaciones', { idCliente: H.idClienteNext, idProducto: s.vehHijo, idDispositivo: H.inventario[0].idDispositivo, idSim: H.inventario[0].idSim }),
      'instalar hijo',
    ).data.id,
  );
}, 240000);

afterAll(() => e.detener());

describe('Puntos de interés del cliente para varios vehículos', () => {
  it('monitoreo debe asignarlo a un cliente; el usuario del cliente no lo indica', async () => {
    expect((await op('POST', '/puntos-interes', { nombre: 'Sin cliente', lat: 18.9, lng: -99.2 })).status).toBe(400);
    const p = ok(await como(tok9, 'POST', '/puntos-interes', { nombre: 'Del usuario', lat: 18.9, lng: -99.2 }), 'del usuario');
    expect(sql(`SELECT IdCliente FROM PuntosInteres WHERE Id = ${Number(p.data.id)}`)).toBe(String(C.idClienteNext));
  });

  it('se liga a vehículos del cliente y de su hijo', async () => {
    const p = ok(
      await op('POST', '/puntos-interes', { idCliente: C.idClienteNext, nombre: 'Base', lat: 18.9, lng: -99.2, radioMetros: 200, idsProducto: [s.veh, s.vehHijo] }),
      'punto',
    );
    s.poi = Number(p.data.id);
    const det = ok(await op('GET', `/puntos-interes/${s.poi}`), 'detalle').data;
    expect([...det.idsProducto].sort()).toEqual([s.veh, s.vehHijo].sort());
    expect(ok(await op('GET', `/puntos-interes/list?idProducto=${s.vehHijo}`), 'del vehículo').data.map((x: { id: number }) => x.id)).toEqual([s.poi]);
    const otro = await clienteListo(e, a, 'POX010101AA1', 1);
    const vehOtro = Number(ok(await op('POST', '/productos/vehiculos', { idCliente: otro.idClienteNext, placa: 'POX0001' }), 'otro').data.id);
    expect((await op('PATCH', `/puntos-interes/${s.poi}`, { idsProducto: [vehOtro] })).status).toBe(400);
  });

  it('avisa la llegada y la salida sin cambiar el Estado de la posición', async () => {
    const serie = `S${H.inventario[0].imei}`;
    await transmitir(serie, minutoDe(s.instHijo, 1), 19.5); // lejos: solo fija el estado
    await esperar(() => sql(`SELECT COUNT(*) FROM EstadoPuntoInteres WHERE IdProducto = ${s.vehHijo}`) === '1');
    await transmitir(serie, minutoDe(s.instHijo, 2), 18.9); // llega
    await esperar(() => sql(`SELECT COUNT(*) FROM EventosPuntoInteres WHERE IdProducto = ${s.vehHijo}`) === '1');
    await transmitir(serie, minutoDe(s.instHijo, 3), 18.9011); // ~120 m, sigue dentro
    await transmitir(serie, minutoDe(s.instHijo, 4), 19.5); // sale
    await esperar(() => sql(`SELECT COUNT(*) FROM EventosPuntoInteres WHERE IdProducto = ${s.vehHijo}`) === '2');
    expect(sql(`SELECT GROUP_CONCAT(Tipo ORDER BY FechaHora) FROM EventosPuntoInteres WHERE IdProducto = ${s.vehHijo}`)).toBe('llegada,salida');
    expect(sql(`SELECT GROUP_CONCAT(DISTINCT Estado) FROM Posiciones WHERE Imei = ${H.inventario[0].imei}`)).toBe('0');
    const ev = ok(
      await op('GET', `/puntos-interes/eventos?idInstalacion=${s.instHijo}&fechaInicio=${encodeURIComponent(minutoDe(s.instHijo, 0))}&fechaFinal=${encodeURIComponent(minutoDe(s.instHijo, 10))}`),
      'eventos',
    ).data;
    expect(ev.map((x: { tipo: string }) => x.tipo)).toEqual(['llegada', 'salida']);
    expect(ev[0]).toMatchObject({ idPuntoInteres: s.poi, nombrePuntoInteres: 'Base', idProducto: s.vehHijo });
  });

  it('el reporte del padre incluye al vehículo del hijo; el del hijo usa el punto del padre', async () => {
    const rango = { fechaInicio: minutoDe(s.instHijo, 0), fechaFinal: minutoDe(s.instHijo, 10) };
    const padre = ok(await op('POST', '/reportes/paso-por-poi', { idCliente: C.idClienteNext, idsPuntoInteres: [s.poi], ...rango }), 'reporte padre');
    expect(JSON.stringify(padre)).toContain('POH0001');
    const hijo = await op('POST', '/reportes/paso-por-poi', { idCliente: H.idClienteNext, idsPuntoInteres: [s.poi], ...rango });
    expect(hijo.status).toBeLessThan(300);
  });
});
