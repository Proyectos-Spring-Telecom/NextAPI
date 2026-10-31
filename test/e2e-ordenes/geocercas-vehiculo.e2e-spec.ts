import { Actores, ok } from './actores';
import { clienteListo } from './comunes';
import { Entorno } from './entorno';

/**
 * Motor de activos, fase C (docs/motor-activos.md §3): la geocerca cuelga del
 * vehículo (`Geocercas.IdProducto`), no de la versión de la instalación. Un
 * cambio de equipo ya no la pierde: sigue marcando la salida en tiempo real
 * (Estado 8) y en el reporte de salidas de la instalación.
 */
const e = new Entorno();
let a: Actores;
let C: Awaited<ReturnType<typeof clienteListo>>;
const s: Record<string, number> = {};
let n = 0;

const op = (metodo: string, ruta: string, cuerpo?: unknown) => a.operacion(metodo, ruta, cuerpo);
const sql = (q: string) => e.mysql.sql('Next', q).trim();
/** Caja alrededor de (18.90, -99.20). */
const ZONA = {
  type: 'Polygon',
  coordinates: [[[-99.21, 18.89], [-99.19, 18.89], [-99.19, 18.91], [-99.21, 18.91], [-99.21, 18.89]]],
};
const transmitir = (numeroSerie: string, fecha: string, lat: number) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Jt808IngestService } = require('src/messaging/jt808/jt808-ingest.service');
  const ingesta = e.servicioNext(Jt808IngestService) as { handleEnvelope: (env: unknown, rk: string) => Promise<unknown> };
  return ingesta.handleEnvelope(
    {
      eventId: `e2e-geocerca-${++n}-${Date.now()}`,
      protocol: 'jt808',
      kind: 'position',
      deviceId: numeroSerie,
      receivedAt: new Date().toISOString(),
      payload: { Lat: lat, Lng: -99.2, Estado: 0, FechaHora: fecha, Velocidad: 40, Direccion: 90 },
    },
    'jt808.position',
  );
};
/** Hora de pared a `min` minutos de la VigenteDesde de la instalación. */
const minutoDe = (idInst: number, min: number) =>
  sql(`SELECT DATE_FORMAT(VigenteDesde + INTERVAL ${min} MINUTE, '%Y-%m-%d %H:%i:%s') FROM Instalaciones WHERE Id = ${idInst}`);

beforeAll(async () => {
  await e.iniciar();
  a = new Actores(e);
  C = await clienteListo(e, a, 'GEO010101AA1', 2);
  // Usuario del cliente al que se asigna la geocerca (es obligatorio).
  e.mysql.sql(
    'Next',
    `INSERT INTO Usuarios (Id, UserName, PasswordHash, EmailConfirmado, Nombre, IdRol, IdCliente, Estatus) VALUES
      (84, 'cli-geo@e2e.local', 'x', 1, 'Cliente', 6, ${C.idClienteNext}, 1)`,
  );
  s.veh = Number(ok(await op('POST', '/productos/vehiculos', { idCliente: C.idClienteNext, placa: 'GEO0001' }), 'vehículo').data.id);
  const inst = ok(
    await op('POST', '/instalaciones', { idCliente: C.idClienteNext, idProducto: s.veh, idDispositivo: C.inventario[0].idDispositivo, idSim: C.inventario[0].idSim }),
    'instalar',
  );
  s.inst = Number(inst.data.id);
}, 240000);

afterAll(() => e.detener());

describe('Geocerca del vehículo', () => {
  it('se da de alta por vehículo; con idInstalacion (obsoleto) toma el vehículo de esa instalación', async () => {
    const g = ok(await op('POST', '/geocercas', { idCliente: C.idClienteNext, idProducto: s.veh, nombre: 'Patio', geocerca: ZONA, usuariosIds: [84] }), 'geocerca');
    s.geo = Number(g.data.id);
    const vieja = ok(await op('POST', '/geocercas', { idCliente: C.idClienteNext, idInstalacion: s.inst, nombre: 'Patio 2', geocerca: ZONA, usuariosIds: [84] }), 'geocerca obsoleta');
    expect(sql(`SELECT IdProducto FROM Geocercas WHERE Id = ${Number(vieja.data.id)}`)).toBe(String(s.veh));
    const det = ok(await op('GET', `/geocercas/${s.geo}`), 'detalle').data;
    expect(det).toMatchObject({ idProducto: s.veh, idInstalacion: s.inst });
  });

  it('sobrevive al cambio de equipo y sigue marcando la salida (Estado 8) con el equipo nuevo', async () => {
    const cambio = ok(
      await op('PATCH', `/instalaciones/${s.inst}`, {
        idDispositivo: C.inventario[1].idDispositivo,
        estatusInstalacionAnterior: 3,
        estatusDispositivoAnterior: 3,
        comentario: 'Cambio de equipo',
      }),
      'cambio',
    );
    s.instNueva = Number(cambio.data.id);
    expect(sql(`SELECT COUNT(*) FROM Geocercas WHERE Id = ${s.geo} AND Estatus = 1`)).toBe('1');
    expect(ok(await op('GET', `/geocercas/${s.geo}`), 'detalle').data).toMatchObject({ idProducto: s.veh, idInstalacion: s.instNueva });

    const serie = `S${C.inventario[1].imei}`;
    await transmitir(serie, minutoDe(s.instNueva, 1), 18.9); // dentro
    await transmitir(serie, minutoDe(s.instNueva, 2), 19.5); // fuera
    expect(sql(`SELECT GROUP_CONCAT(Estado ORDER BY FechaHora) FROM Posiciones WHERE Imei = ${C.inventario[1].imei}`)).toBe('0,8');
  });

  it('el reporte de salidas de la instalación la sigue evaluando', async () => {
    const r = ok(
      await op('POST', '/reportes/salidas-geocerca-instalacion', {
        idInstalacion: s.instNueva,
        fechaInicio: minutoDe(s.instNueva, -60),
        fechaFinal: minutoDe(s.instNueva, 24 * 60),
      }),
      'salidas',
    );
    const data = r.data ?? r;
    expect(data.resumen.geocercasEvaluadas).toBeGreaterThanOrEqual(1);
    expect(data.resumen.totalSalidas).toBeGreaterThanOrEqual(1);
  });
});
