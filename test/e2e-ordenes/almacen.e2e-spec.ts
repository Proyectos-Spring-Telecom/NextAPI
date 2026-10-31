import { join } from 'path';
import { Actores, ok } from './actores';
import { clienteListo } from './comunes';
import { Entorno } from './entorno';

/**
 * Motor de activos, fase B (docs/motor-activos.md §2): equipo y SIM sin
 * cliente en el almacén, reserva opcional a un cliente, cliente que toman al
 * instalarse y sueltan al salir, y corregir una instalación capturada en el
 * cliente equivocado. Corren en orden: siguen al mismo equipo.
 */
const e = new Entorno();
let a: Actores;
let C: Awaited<ReturnType<typeof clienteListo>>;
let D: Awaited<ReturnType<typeof clienteListo>>;
const CLIENTE = { id: 83, rol: 6 };
let tokCliente: string;
const s: Record<string, number> = {};
let n = 0;

const op = (metodo: string, ruta: string, cuerpo?: unknown) => a.operacion(metodo, ruta, cuerpo);
const cliente = (metodo: string, ruta: string, cuerpo?: unknown) => e.llamar(e.nextUrl, metodo, ruta, tokCliente, cuerpo);
const sql = (q: string) => e.mysql.sql('Next', q).trim();
const clienteDe = (tabla: 'Dispositivos' | 'Sims', id: number) => sql(`SELECT COALESCE(IdCliente, 'almacén') FROM ${tabla} WHERE Id = ${id}`);
const estatus = (tabla: 'Dispositivos' | 'Sims' | 'Productos', id: number) => Number(sql(`SELECT Estatus FROM ${tabla} WHERE Id = ${id}`));
const ultimoMovimiento = (tipo: string, id: number) =>
  sql(`SELECT CONCAT(Accion, '|', COALESCE(IdClienteAnterior, 'null'), '|', COALESCE(IdClienteNuevo, 'null')) FROM MovimientosRecurso
        WHERE TipoRecurso = '${tipo}' AND IdRecurso = ${id} ORDER BY Id DESC LIMIT 1`);
const nuevoEquipo = async (cuerpo: Record<string, unknown> = {}) =>
  ok(await op('POST', '/dispositivos', { idTipoDispositivo: 1, numeroSerie: `ALM${Date.now()}${++n}`, imei: String(865000000000000 + Date.now() % 1e9 + n), ...cuerpo }), 'alta equipo');
const nuevaSim = async (cuerpo: Record<string, unknown> = {}) =>
  ok(await op('POST', '/sims', { idTelefonia: 1, idPlanTelefonia: 1, numeroTelefono: `77790${String(++n).padStart(5, '0')}`, ...cuerpo }), 'alta SIM');
const vehiculo = async (idCliente: number, placa: string) =>
  Number(ok(await op('POST', '/productos/vehiculos', { idCliente, placa }), 'vehículo').data.id);

beforeAll(async () => {
  await e.iniciar();
  a = new Actores(e);
  C = await clienteListo(e, a, 'ALM010101AA1', 1);
  D = await clienteListo(e, a, 'ALM020202BB2', 1);
  e.mysql.sql(
    'Next',
    `INSERT INTO Usuarios (Id, UserName, PasswordHash, EmailConfirmado, Nombre, IdRol, IdCliente, Estatus) VALUES
      (${CLIENTE.id}, 'cli-alm@e2e.local', 'x', 1, 'Cliente', 6, ${C.idClienteNext}, 1)`,
  );
  tokCliente = e.tokenNext(CLIENTE, C.idClienteNext);
}, 240000);

afterAll(() => e.detener());

describe('Alta en el almacén', () => {
  it('operación da de alta equipo y SIM sin cliente; el cliente (6) no puede', async () => {
    s.disp = Number((await nuevoEquipo()).data.id);
    s.sim = Number((await nuevaSim()).data.id);
    expect([clienteDe('Dispositivos', s.disp), clienteDe('Sims', s.sim)]).toEqual(['almacén', 'almacén']);
    expect(ultimoMovimiento('dispositivo', s.disp)).toBe('alta|null|null');
    const r = await cliente('POST', '/dispositivos', { idTipoDispositivo: 1, numeroSerie: 'ALM-CLI-1' });
    expect(r.status).toBe(403);
  });

  it('el selector para instalar en un cliente trae su reservado y, para operación, el almacén; el cliente no ve el almacén', async () => {
    const ids = (ok(await op('GET', `/dispositivos/list?idCliente=${C.idClienteNext}`), 'lista').data as Array<{ id: number }>).map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining([s.disp, C.inventario[0].idDispositivo]));
    const sims = (ok(await op('GET', `/sims/list?idCliente=${C.idClienteNext}`), 'sims').data as Array<{ id: number }>).map((x) => x.id);
    expect(sims).toContain(s.sim);
    const propios = (ok(await cliente('GET', '/dispositivos/list'), 'lista cliente').data as Array<{ id: number }>).map((x) => x.id);
    expect(propios).not.toContain(s.disp);
    expect((await cliente('GET', `/dispositivos/${s.disp}`)).status).toBe(404);
  });
});

describe('Instalar y desinstalar', () => {
  it('al instalar, el equipo y la SIM del almacén toman el cliente de la instalación', async () => {
    s.veh = await vehiculo(C.idClienteNext, 'ALM0001');
    const inst = ok(await op('POST', '/instalaciones', { idCliente: C.idClienteNext, idProducto: s.veh, idDispositivo: s.disp, idSim: s.sim }), 'instalar');
    s.inst = Number(inst.data.id);
    expect([clienteDe('Dispositivos', s.disp), clienteDe('Sims', s.sim)]).toEqual([String(C.idClienteNext), String(C.idClienteNext)]);
    expect(ultimoMovimiento('dispositivo', s.disp)).toBe(`instalacion|null|${C.idClienteNext}`);
  });

  it('un equipo reservado a otro cliente no se instala aquí', async () => {
    const otro = Number((await nuevoEquipo({ idCliente: D.idClienteNext })).data.id);
    const veh = await vehiculo(C.idClienteNext, 'ALM0002');
    const r = await op('POST', '/instalaciones', { idCliente: C.idClienteNext, idProducto: veh, idDispositivo: otro });
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).toContain('otro cliente');
    expect(clienteDe('Dispositivos', otro)).toBe(String(D.idClienteNext));
  });

  it('un equipo instalado no cambia de cliente a mano', async () => {
    const r = await op('PATCH', `/dispositivos/${s.disp}`, { idCliente: D.idClienteNext });
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).toContain('instalado');
  });

  it('la baja regresa equipo y SIM al almacén; la instalación dada de baja sigue mostrando su equipo', async () => {
    ok(await op('PATCH', `/instalaciones/estatus/${s.inst}`, { estatusInstalacion: 0 }), 'baja');
    expect([clienteDe('Dispositivos', s.disp), clienteDe('Sims', s.sim)]).toEqual(['almacén', 'almacén']);
    expect([estatus('Dispositivos', s.disp), estatus('Sims', s.sim)]).toEqual([3, 3]);
    expect(ultimoMovimiento('dispositivo', s.disp)).toBe(`baja|${C.idClienteNext}|null`);
    const det = ok(await op('GET', `/instalaciones/${s.inst}`), 'detalle');
    expect(JSON.stringify(det)).toContain(sql(`SELECT NumeroSerie FROM Dispositivos WHERE Id = ${s.disp}`));
  });

  it('reservar exige disponible; solo operación lo regresa al almacén', async () => {
    expect((await op('PATCH', `/dispositivos/${s.disp}`, { idCliente: D.idClienteNext })).status).toBe(400); // por revisar
    ok(await op('PATCH', `/dispositivos/estatus/${s.disp}`, { estatus: 1 }), 'revisado');
    ok(await op('PATCH', `/dispositivos/${s.disp}`, { idCliente: C.idClienteNext }), 'reservar');
    expect(ultimoMovimiento('dispositivo', s.disp)).toBe(`traspaso|null|${C.idClienteNext}`);
    expect((await cliente('PATCH', `/dispositivos/${s.disp}`, { idCliente: null })).status).toBe(403);
    ok(await op('PATCH', `/dispositivos/${s.disp}`, { idCliente: null }), 'al almacén');
    expect(clienteDe('Dispositivos', s.disp)).toBe('almacén');
    ok(await op('PATCH', `/sims/estatus/${s.sim}`, { estatus: 1 }), 'SIM revisada');
    ok(await op('PATCH', `/sims/${s.sim}`, { idCliente: D.idClienteNext }), 'reservar SIM');
    expect(ultimoMovimiento('sim', s.sim)).toBe(`traspaso|null|${D.idClienteNext}`);
    ok(await op('PATCH', `/sims/${s.sim}`, { idCliente: null }), 'SIM al almacén');
  });

  it('reactivar toma de nuevo el cliente de la instalación', async () => {
    ok(await op('PATCH', `/instalaciones/estatus/${s.inst}`, { estatusInstalacion: 1 }), 'reactivar');
    expect([clienteDe('Dispositivos', s.disp), clienteDe('Sims', s.sim)]).toEqual([String(C.idClienteNext), String(C.idClienteNext)]);
  });
});

describe('Reglas de la revisión', () => {
  it('un usuario de cliente no instala equipo del almacén; solo lo reservado a su cliente', async () => {
    const delAlmacen = Number((await nuevoEquipo()).data.id);
    const veh = await vehiculo(C.idClienteNext, 'ALM0010');
    const r = await cliente('POST', '/instalaciones', { idCliente: C.idClienteNext, idProducto: veh, idDispositivo: delAlmacen });
    expect(r.status).toBe(400);
    expect(clienteDe('Dispositivos', delAlmacen)).toBe('almacén');
  });

  it('cambio de equipo: el que sale regresa al almacén y el que entra toma el cliente', async () => {
    const entra = Number((await nuevoEquipo()).data.id);
    const sale = Number(sql(`SELECT IdDispositivo FROM Instalaciones WHERE Id = ${s.inst}`));
    const r = ok(await op('PATCH', `/instalaciones/${s.inst}`, { idDispositivo: entra, estatusInstalacionAnterior: 3, estatusDispositivoAnterior: 3 }), 'cambio');
    s.inst = Number(r.data.id);
    s.disp = entra;
    expect([clienteDe('Dispositivos', sale), clienteDe('Dispositivos', entra)]).toEqual(['almacén', String(C.idClienteNext)]);
    expect(ultimoMovimiento('dispositivo', sale)).toBe(`cambio|${C.idClienteNext}|null`);
    expect(ultimoMovimiento('dispositivo', entra)).toBe(`cambio|null|${C.idClienteNext}`);
  });

  it('una reserva se suelta si el equipo pasa a por revisar', async () => {
    const reservado = Number((await nuevoEquipo({ idCliente: C.idClienteNext })).data.id);
    ok(await op('PATCH', `/dispositivos/estatus/${reservado}`, { estatus: 3 }), 'a revisión');
    expect(clienteDe('Dispositivos', reservado)).toBe('almacén');
    expect(ultimoMovimiento('dispositivo', reservado)).toBe(`estatus|${C.idClienteNext}|null`);
  });
});

describe('Corregir instalación', () => {
  it('pasa equipo y SIM al cliente correcto en una instalación nueva; lo anterior queda con el cliente original', async () => {
    const vehD = await vehiculo(D.idClienteNext, 'ALM0003');
    expect((await a.monitoreo('PATCH', `/instalaciones/${s.inst}/corregir-cliente`, { idCliente: D.idClienteNext, idProducto: vehD, motivo: 'x' })).status).toBe(403);
    expect((await op('PATCH', `/instalaciones/${s.inst}/corregir-cliente`, { idCliente: C.idClienteNext, idProducto: s.veh, motivo: 'x' })).status).toBe(400);

    const r = ok(
      await op('PATCH', `/instalaciones/${s.inst}/corregir-cliente`, { idCliente: D.idClienteNext, idProducto: vehD, motivo: 'Se capturó en el cliente equivocado' }),
      'corregir',
    );
    s.instD = Number(r.data.id);
    expect(r.data.idInstalacionAnterior).toBe(s.inst);
    expect(sql(`SELECT CONCAT(IdCliente, '|', Estatus, '|', IdDispositivo) FROM Instalaciones WHERE Id = ${s.instD}`)).toBe(`${D.idClienteNext}|1|${s.disp}`);
    expect(sql(`SELECT Estatus FROM Instalaciones WHERE Id = ${s.inst}`)).toBe('0');
    expect([clienteDe('Dispositivos', s.disp), clienteDe('Sims', s.sim)]).toEqual([String(D.idClienteNext), String(D.idClienteNext)]);
    expect([estatus('Dispositivos', s.disp), estatus('Productos', s.veh), estatus('Productos', vehD)]).toEqual([2, 1, 2]);
    expect(ultimoMovimiento('dispositivo', s.disp)).toBe(`traspaso|${C.idClienteNext}|${D.idClienteNext}`);
    expect(sql(`SELECT CONCAT(Campo, '|', ValorAnterior, '|', ValorNuevo) FROM CorreccionesInstalacion WHERE IdInstalacion = ${s.instD}`)).toBe(
      `IdCliente|${C.idClienteNext} (instalación ${s.inst})|${D.idClienteNext}`,
    );
  });
});

describe('Saneamiento (deploy/sql/SaneamientoFaseB.sql)', () => {
  it('lo que no está instalado pasa al almacén con su movimiento; lo instalado conserva su cliente', async () => {
    const reservado = Number((await nuevoEquipo({ idCliente: C.idClienteNext })).data.id);
    const sinInstalacion = Number((await nuevoEquipo({ idCliente: C.idClienteNext })).data.id);
    sql(`UPDATE Dispositivos SET Estatus = 2 WHERE Id = ${sinInstalacion}`); // "instalado" sin instalación
    e.mysql.archivo('Next', join(__dirname, '../../deploy/sql/SaneamientoFaseB.sql'));
    e.mysql.archivo('Next', join(__dirname, '../../deploy/sql/SaneamientoFaseB.sql'));
    expect(clienteDe('Dispositivos', reservado)).toBe('almacén');
    expect(ultimoMovimiento('dispositivo', reservado)).toBe(`traspaso|${C.idClienteNext}|null`);
    expect([clienteDe('Dispositivos', sinInstalacion), estatus('Dispositivos', sinInstalacion)]).toEqual(['almacén', 3]);
    expect(clienteDe('Dispositivos', s.disp)).toBe(String(D.idClienteNext));
  });
});
