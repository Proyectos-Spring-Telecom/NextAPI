import { Actores, ok } from './actores';
import { clienteListo } from './comunes';
import { Entorno } from './entorno';

/**
 * Motor de activos, fase C (docs/motor-activos.md §3): varias instalaciones
 * activas por vehículo, una por clase de equipo (AVL, TRACKCAM, PANEL, RELOJ),
 * y el histórico del vehículo con la fuente de cada punto.
 */
const e = new Entorno();
let a: Actores;
let C: Awaited<ReturnType<typeof clienteListo>>;
const s: Record<string, number> = {};
const imei: Record<string, string> = {};

const op = (metodo: string, ruta: string, cuerpo?: unknown) => a.operacion(metodo, ruta, cuerpo);
const sql = (q: string) => e.mysql.sql('Next', q).trim();
const estatusProducto = () => Number(sql(`SELECT Estatus FROM Productos WHERE Id = ${s.veh}`));
const instalar = (idDispositivo: number, idSim?: number) =>
  op('POST', '/instalaciones', { idCliente: C.idClienteNext, idProducto: s.veh, idDispositivo, ...(idSim ? { idSim } : {}) });
const posicion = (im: string, fecha: string) =>
  sql(`INSERT INTO Posiciones (Imei, Lat, Lng, FechaHora, Velocidad, Direccion) VALUES (${im}, 18.9, -99.2, '${fecha}', 30, 90)`);

beforeAll(async () => {
  await e.iniciar();
  a = new Actores(e);
  C = await clienteListo(e, a, 'CLA010101AA1', 4);
  // El catálogo sembrado puede no traer TrackCam (5): en producción sí existe.
  sql(`INSERT IGNORE INTO CatTipoDispositivo (Id, Codigo, Nombre, Estatus, Clase) VALUES (5, 'TRACKCAM', 'TrackCam', 1, 'TRACKCAM')`);
  sql(`UPDATE CatTipoDispositivo SET Clase = 'TRACKCAM' WHERE Id = 5`);
  s.gps = C.inventario[0].idDispositivo;
  s.cam = C.inventario[1].idDispositivo;
  s.gps2 = C.inventario[2].idDispositivo;
  s.cam2 = C.inventario[3].idDispositivo;
  imei.gps = C.inventario[0].imei;
  imei.cam = C.inventario[1].imei;
  sql(`UPDATE Dispositivos SET IdTipoDispositivo = 5 WHERE Id IN (${s.cam}, ${s.cam2})`);
  s.veh = Number(ok(await op('POST', '/productos/vehiculos', { idCliente: C.idClienteNext, placa: 'CLA0001' }), 'vehículo').data.id);
}, 240000);

afterAll(() => e.detener());

describe('Una instalación activa por clase y vehículo', () => {
  it('GPS y TrackCam en el mismo vehículo; un segundo GPS no', async () => {
    s.instGps = Number(ok(await instalar(s.gps, C.inventario[0].idSim), 'GPS').data.id);
    s.instCam = Number(ok(await instalar(s.cam, C.inventario[1].idSim), 'TrackCam').data.id);
    expect(sql(`SELECT GROUP_CONCAT(Clase ORDER BY Id) FROM Instalaciones WHERE IdProducto = ${s.veh} AND Estatus = 1`)).toBe('AVL,TRACKCAM');
    expect(estatusProducto()).toBe(2);
    const otro = await instalar(s.gps2);
    expect(otro.status).toBe(400);
    expect(JSON.stringify(otro.body)).toContain('AVL');
  });

  it('el cambio de equipo es de la misma clase: un GPS no se cambia por una TrackCam', async () => {
    const r = await op('PATCH', `/instalaciones/${s.instGps}`, { idDispositivo: s.cam2, estatusInstalacionAnterior: 3, estatusDispositivoAnterior: 3 });
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).toContain('otra instalación');
  });

  it('el histórico del vehículo junta las dos fuentes', async () => {
    sql(`UPDATE Instalaciones SET VigenteDesde = '2026-10-20 00:00:00' WHERE Id IN (${s.instGps}, ${s.instCam})`);
    posicion(imei.gps, '2026-10-20 10:00:00');
    posicion(imei.cam, '2026-10-20 10:00:30');
    posicion(imei.gps, '2026-10-20 10:01:00');
    const r = ok(await op('GET', `/monitoreo/producto/${s.veh}/historico?fechaInicio=2026-10-20 00:00:00&fechaFinal=2026-10-20 23:59:59`), 'histórico vehículo');
    expect(r.porFuente.map((x: { fuente: string; total: number }) => `${x.fuente}:${x.total}`).sort()).toEqual(['avl:2', 'trackcam:1']);
    expect(r.posiciones.map((p: { fuente: string }) => p.fuente)).toEqual(['avl', 'trackcam', 'avl']);
  });

  it('dar de baja la TrackCam deja el vehículo instalado; sin ninguna, vuelve a activo', async () => {
    ok(await op('PATCH', `/instalaciones/estatus/${s.instCam}`, { estatusInstalacion: 0 }), 'baja TrackCam');
    expect(estatusProducto()).toBe(2);
    expect(sql(`SELECT CONCAT(Accion, '|', EstatusAnterior, '|', EstatusNuevo) FROM MovimientosRecurso WHERE TipoRecurso = 'producto' AND IdRecurso = ${s.veh} ORDER BY Id DESC LIMIT 1`)).toBe('baja|2|2');
    ok(await op('PATCH', `/instalaciones/estatus/${s.instGps}`, { estatusInstalacion: 0 }), 'baja GPS');
    expect(estatusProducto()).toBe(1);
  });

  it('reactivar una de las dos con el vehículo ya instalado por la otra', async () => {
    ok(await instalar(s.cam2), 'otra TrackCam');
    expect(estatusProducto()).toBe(2);
    ok(await op('PATCH', `/dispositivos/estatus/${s.gps}`, { estatus: 1 }), 'GPS revisado');
    ok(await op('PATCH', `/sims/estatus/${C.inventario[0].idSim}`, { estatus: 1 }), 'SIM revisada');
    ok(await op('PATCH', `/instalaciones/estatus/${s.instGps}`, { estatusInstalacion: 1 }), 'reactivar GPS');
    expect(sql(`SELECT COUNT(*) FROM Instalaciones WHERE IdProducto = ${s.veh} AND Estatus = 1`)).toBe('2');
  });
});

describe('Cambio de vehículo con varias instalaciones', () => {
  it('el GPS pasa a otro vehículo: el anterior conserva su TrackCam y sigue instalado, sin pedir su estatus de salida', async () => {
    const otro = Number(ok(await op('POST', '/productos/vehiculos', { idCliente: C.idClienteNext, placa: 'CLA0002' }), 'vehículo 2').data.id);
    const r = ok(await op('PATCH', `/instalaciones/${s.instGps}`, { idProducto: otro, estatusInstalacionAnterior: 3 }), 'cambio de vehículo');
    const nueva = Number(r.data.id);
    expect(sql(`SELECT IdProducto FROM Instalaciones WHERE Id = ${nueva}`)).toBe(String(otro));
    expect(estatusProducto()).toBe(2); // conserva la TrackCam
    expect(Number(sql(`SELECT Estatus FROM Productos WHERE Id = ${otro}`))).toBe(2);
    expect(sql(`SELECT CONCAT(Accion, '|', EstatusAnterior, '|', EstatusNuevo) FROM MovimientosRecurso WHERE TipoRecurso = 'producto' AND IdRecurso = ${s.veh} ORDER BY Id DESC LIMIT 1`)).toBe('cambio|2|2');
  });

  it('fechas inválidas en el histórico del vehículo → 400', async () => {
    expect((await op('GET', `/monitoreo/producto/${s.veh}/historico?fechaInicio=2026-10-21 00:00:00&fechaFinal=2026-10-20 00:00:00`)).status).toBe(400);
  });
});
