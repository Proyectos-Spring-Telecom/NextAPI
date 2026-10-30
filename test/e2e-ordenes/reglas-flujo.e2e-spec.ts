import { Actores, ok } from './actores';
import { agendar, clienteListo } from './comunes';
import { Entorno, NEXT } from './entorno';

/**
 * Reglas del flujo contra MySQL real (antes eran pruebas unitarias con un
 * repositorio en memoria que no reproducía las actualizaciones condicionales).
 */
const e = new Entorno();
let a: Actores;
let c: Awaited<ReturnType<typeof clienteListo>>;

beforeAll(async () => {
  await e.iniciar();
  a = new Actores(e);
  c = await clienteListo(e, a, 'REG010101AA1', 10);
}, 240000);

afterAll(() => e.detener());

const manana = () => new Date(Date.now() + 86400000).toISOString();
const programar = (cuerpo: Record<string, unknown>) =>
  e.integracion('POST', '/integracion/ordenes-servicio', { tipo: 'instalacion', idCliente: c.idClienteNext, cita: manana(), idTecnico: NEXT.TECNICO.id, ...cuerpo });

async function iniciada(token = a.tokenTecnico) {
  const o = e.nuevaOrdenCrm(c.idCliente, 1);
  const os = await agendar(a, o.idOrden, NEXT.TECNICO, token);
  ok(await a.app('POST', `/ordenes-servicio/${os[0].id}/iniciar`, { claveApp: a.nuevaClave() }), 'iniciar');
  return { ...o, id: os[0].id as number };
}

describe('Programar', () => {
  it('un alta de 3 unidades son 3 órdenes; repetir la llamada devuelve las mismas', async () => {
    const r1 = ok(await programar({ referenciaCrm: 'REG-3', unidades: 3 }), 'programar');
    const r2 = ok(await programar({ referenciaCrm: 'REG-3', unidades: 3 }), 'repetir');
    expect(r1.data.map((d: any) => d.unidad)).toEqual([1, 2, 3]);
    expect(r2.data.map((d: any) => d.id)).toEqual(r1.data.map((d: any) => d.id));
    expect(r2.message).toBe('Las órdenes ya estaban programadas');
  });

  it('un mantenimiento lleva el vehículo y es de una sola unidad; el técnico debe tener rol 8', async () => {
    expect((await programar({ referenciaCrm: 'REG-M1', tipo: 'revision' })).status).toBe(400);
    expect((await programar({ referenciaCrm: 'REG-M2', unidades: 2, tipo: 'revision', idInstalacion: 1 })).status).toBe(400);
    expect((await programar({ referenciaCrm: 'REG-T', idTecnico: NEXT.ADMIN.id })).status).toBe(400);
  });

  it('el CRM no reprograma órdenes que programó operación', async () => {
    const prog = ok(await a.operacion('POST', '/ordenes-servicio/programar', { tipo: 'instalacion', idCliente: c.idClienteNext, cita: manana(), idTecnico: NEXT.TECNICO.id }), 'programar');
    const r = await e.integracion('PATCH', `/integracion/ordenes-servicio/${prog.data[0].id}`, { cita: manana() });
    expect(r.status).toBe(404);
  });
});

describe('En campo', () => {
  it('no cruza de alta a mantenimiento; otro técnico no ve la orden', async () => {
    const o = e.nuevaOrdenCrm(c.idCliente, 1);
    const os = await agendar(a, o.idOrden);
    expect((await a.app('POST', `/ordenes-servicio/${os[0].id}/iniciar`, { claveApp: a.nuevaClave(), tipoServicio: 'revision' })).status).toBe(400);
    expect((await a.app('POST', `/ordenes-servicio/${os[0].id}/iniciar`, { claveApp: a.nuevaClave() }, a.tokenTecnico2)).status).toBe(404);
  });

  it('el código no aplica a un alta', async () => {
    const o = await iniciada();
    expect((await a.app('POST', `/ordenes-servicio/${o.id}/codigo`)).status).toBe(400);
  });

  it('pruebas: no se valida una que no se pidió ni una clave fuera del catálogo', async () => {
    const o = await iniciada();
    expect((await a.monitoreo('POST', `/ordenes-servicio/${o.id}/pruebas/transmision/validar`, { correcta: true })).status).toBe(400);
    expect((await a.app('POST', `/ordenes-servicio/${o.id}/pruebas/volar/solicitar`)).status).toBe(400);
  });

  it('una decisión de autorización ya tomada no se cambia (409)', async () => {
    const vehiculoA = Number(e.consulta('Next', `SELECT IdProducto FROM Instalaciones WHERE Estatus = 1 LIMIT 1`)[0]?.[0] ?? 0);
    if (!vehiculoA) return; // sin vehículos con equipo en este cliente: lo cubre robustez [1.1]
    const o = await iniciada();
    ok(await a.app('PATCH', `/ordenes-servicio/${o.id}`, { idProducto: vehiculoA }), 'vehículo');
    ok(await a.app('POST', `/ordenes-servicio/${o.id}/autorizacion`, {}), 'autorización');
    ok(await a.operacion('POST', `/ordenes-servicio/${o.id}/autorizacion/decision`, { autorizada: true }), 'autorizar');
    expect((await a.operacion('POST', `/ordenes-servicio/${o.id}/autorizacion/decision`, { autorizada: false })).status).toBe(409);
  });
});

describe('No cumplida y cancelar', () => {
  it('el técnico no ajusta el cobro, el motivo debe aplicar y algunos piden observaciones', async () => {
    const o = await iniciada();
    expect((await a.app('POST', `/ordenes-servicio/${o.id}/no-cumplida`, { claveMotivo: 'cliente_ausente', cobrable: false })).status).toBe(403);
    expect((await a.app('POST', `/ordenes-servicio/${o.id}/no-cumplida`, { claveMotivo: 'falta_material' })).status).toBe(400);
    expect((await a.app('POST', `/ordenes-servicio/${o.id}/no-cumplida`, { claveMotivo: 'cancelada_por_cliente' })).status).toBe(400);
    ok(await a.app('POST', `/ordenes-servicio/${o.id}/no-cumplida`, { claveMotivo: 'cliente_ausente' }), 'no cumplida');
    const det = ok(await a.app('GET', `/ordenes-servicio/${o.id}`), 'detalle').data[0];
    expect(det).toMatchObject({ estatus: 'no_cumplida', cobrable: true, claveMotivo: 'cliente_ausente' });
  });

  it('operación sí ajusta el cobro', async () => {
    const o = await iniciada();
    ok(await a.operacion('POST', `/ordenes-servicio/${o.id}/no-cumplida`, { claveMotivo: 'cliente_ausente', cobrable: false }), 'no cumplida');
    expect(ok(await a.operacion('GET', `/ordenes-servicio/${o.id}`), 'detalle').data[0].cobrable).toBe(false);
  });

  it('el CRM cancela una programada solo con motivo; una iniciada da 409', async () => {
    const r = ok(await programar({ referenciaCrm: 'REG-C1' }), 'programar');
    const id = r.data[0].id;
    expect((await e.integracion('POST', `/integracion/ordenes-servicio/${id}/cancelar`, {})).status).toBe(400);
    ok(await e.integracion('POST', `/integracion/ordenes-servicio/${id}/cancelar`, { claveMotivo: 'cancelada_por_cliente' }), 'cancelar');
    const r2 = ok(await programar({ referenciaCrm: 'REG-C2' }), 'programar');
    ok(await a.app('POST', `/ordenes-servicio/${r2.data[0].id}/iniciar`, { claveApp: a.nuevaClave() }), 'iniciar');
    expect((await e.integracion('POST', `/integracion/ordenes-servicio/${r2.data[0].id}/cancelar`, { claveMotivo: 'cancelada_por_cliente' })).status).toBe(409);
  });

  it('una orden de la etapa 1 (creada por la app) el técnico la cancela sin motivo', async () => {
    const o = ok(await a.app('POST', '/ordenes-servicio', { claveApp: a.nuevaClave(), tipoServicio: 'instalacion', idCliente: c.idClienteNext }), 'crear');
    ok(await a.app('POST', `/ordenes-servicio/${o.data.id}/cancelar`, {}), 'cancelar');
    expect(ok(await a.app('GET', `/ordenes-servicio/${o.data.id}`), 'detalle').data[0].estatus).toBe('cancelada');
  });

  it('el paro de motor solo se exige si el vehículo tiene inmovilizador', async () => {
    const o = await iniciada();
    const veh = ok(await a.app('POST', '/productos/vehiculos', { idCliente: c.idClienteNext, placa: 'SININM1' }), 'vehículo');
    const eq = c.inventario[9];
    await a.checklist(o.id, { idProducto: Number(veh.data.id), idDispositivoNuevo: eq.idDispositivo, idSimNuevo: eq.idSim });
    ok(await a.app('PATCH', `/ordenes-servicio/${o.id}`, { respuestas: [{ seccion: 'vehiculo_cuenta_con', clave: 'inmovilizador', valor: false }] }), 'sin inmovilizador');
    for (const p of ['transmision', 'boton_panico']) ok(await a.app('POST', `/ordenes-servicio/${o.id}/pruebas/${p}/solicitar`), `pedir ${p}`);
    await a.validarPruebas(o.id);
    const det = ok(await a.app('GET', `/ordenes-servicio/${o.id}`), 'detalle').data[0];
    expect(det.faltantesParaCerrar).toEqual([]);
    ok(await a.app('POST', `/ordenes-servicio/${o.id}/cerrar`), 'cerrar sin paro de motor');
  });
});

describe('Lo que muestran la App y el front', () => {
  it('agenda y detalle traen el nombre del cliente y, ya con vehículo, su placa y económico', async () => {
    const o = await iniciada();
    const veh = ok(await a.app('POST', '/productos/vehiculos', { idCliente: c.idClienteNext, placa: 'CTX0001', numeroEconomico: 'ECO-7' }), 'vehículo');
    ok(await a.app('PATCH', `/ordenes-servicio/${o.id}`, { idProducto: Number(veh.data.id) }), 'vehículo en la orden');
    const det = ok(await a.app('GET', `/ordenes-servicio/${o.id}`), 'detalle').data[0];
    expect(det).toMatchObject({ placa: 'CTX0001', numeroEconomico: 'ECO-7' });
    expect(det.nombreCliente).toEqual(expect.any(String));
    const agenda = ok(await a.app('GET', '/ordenes-servicio/paginado/1/50?estatus=borrador'), 'en curso').data as any[];
    expect(agenda.find((x) => x.id === o.id)).toMatchObject({ placa: 'CTX0001', nombreCliente: det.nombreCliente });
  });
});

describe('Esquema', () => {
  it('las tablas de órdenes de servicio de producción + los SQL de despliegue coinciden con las entidades', () => {
    expect(e.diferenciasEsquema).toEqual([]);
  });
});
