import { Actores, ok } from './actores';
import { agendar, altaListaParaCerrar, clienteListo, enDias } from './comunes';
import { Entorno, NEXT } from './entorno';

/**
 * Robustez: concurrencia, fallas de red entre el CRM y Next, repeticiones y
 * permisos. Cada prueba reproduce un hallazgo de la revisión del 29/10/2026
 * (docs/remediacion-ordenes-servicio.md, número entre corchetes).
 */
const e = new Entorno();
let a: Actores;
let c: Awaited<ReturnType<typeof clienteListo>>;

beforeAll(async () => {
  await e.iniciar();
  a = new Actores(e);
  c = await clienteListo(e, a, 'ROB010101AA1', 20);
}, 240000);

afterAll(() => e.detener());

const orden = async (unidades = 1, tecnico: { id: number } = NEXT.TECNICO, token?: string) => {
  const o = e.nuevaOrdenCrm(c.idCliente, unidades);
  const os = await agendar(a, o.idOrden, tecnico, token ?? a.tokenTecnico);
  return { ...o, os };
};
let placa = 0;
const nuevaPlaca = () => `ROB${String(++placa).padStart(4, '0')}`;
let equipo = 0;
const nuevoEquipo = () => c.inventario[equipo++];

/** Vehículo con una instalación activa (para los casos de autorización). */
async function vehiculoConEquipo(): Promise<number> {
  const o = await orden();
  const id = await altaListaParaCerrar(a, o.os[0].id, c.idClienteNext, nuevaPlaca(), nuevoEquipo());
  ok(await a.app('POST', `/ordenes-servicio/${o.os[0].id}/cerrar`), 'cerrar');
  return id;
}

describe('Integridad', () => {
  it('[1.1] la autorización queda ligada al vehículo: no se puede cambiar de vehículo después', async () => {
    const vA = await vehiculoConEquipo();
    const vB = await vehiculoConEquipo();
    const o = await orden();
    const id = o.os[0].id;
    ok(await a.app('POST', `/ordenes-servicio/${id}/iniciar`, { claveApp: a.nuevaClave() }), 'iniciar');
    ok(await a.app('PATCH', `/ordenes-servicio/${id}`, { idProducto: vA }), 'vehículo A');
    ok(await a.app('POST', `/ordenes-servicio/${id}/autorizacion`, { observaciones: 'Equipo viejo' }), 'autorización');
    ok(await a.crm('POST', `/instalaciones/autorizaciones/${id}`, { autorizada: true }), 'autorizar');
    const cambio = await a.app('PATCH', `/ordenes-servicio/${id}`, { idProducto: vB });
    expect(cambio.status).toBe(400);
  });

  it('[1.2] cerrar y cancelar al mismo tiempo: gana uno y el otro recibe 409', async () => {
    const o = await orden();
    const id = o.os[0].id;
    await altaListaParaCerrar(a, id, c.idClienteNext, nuevaPlaca(), nuevoEquipo());
    const [cierre, cancela] = await Promise.all([
      a.app('POST', `/ordenes-servicio/${id}/cerrar`),
      a.operacion('POST', `/ordenes-servicio/${id}/cancelar`, { claveMotivo: 'cancelada_por_cliente' }),
    ]);
    const det = ok(await a.operacion('GET', `/ordenes-servicio/${id}`), 'detalle').data[0];
    const exitos = [cierre, cancela].filter((r) => r.status < 300).length;
    expect(exitos).toBe(1);
    expect(det.estatus === 'cancelada' && det.idInstalacionResultado != null).toBe(false);
  });

  it('[1.2] dos decisiones de autorización a la vez: solo una se aplica', async () => {
    const v = await vehiculoConEquipo();
    const o = await orden();
    const id = o.os[0].id;
    ok(await a.app('POST', `/ordenes-servicio/${id}/iniciar`, { claveApp: a.nuevaClave() }), 'iniciar');
    ok(await a.app('PATCH', `/ordenes-servicio/${id}`, { idProducto: v }), 'vehículo');
    ok(await a.app('POST', `/ordenes-servicio/${id}/autorizacion`, {}), 'autorización');
    const [r1, r2] = await Promise.all([
      a.crm('POST', `/instalaciones/autorizaciones/${id}`, { autorizada: false }),
      a.operacion('POST', `/ordenes-servicio/${id}/autorizacion/decision`, { autorizada: true }),
    ]);
    const det = ok(await a.operacion('GET', `/ordenes-servicio/${id}`), 'detalle').data[0];
    expect([r1.status, r2.status].filter((s) => s < 300)).toHaveLength(1);
    expect(det.estatus === 'no_cumplida' && det.autorizacion === 'autorizada').toBe(false);
  });

  it('[1.3] el límite de 5 intentos del código aguanta intentos simultáneos', async () => {
    const vehiculo = await vehiculoConEquipo();
    void vehiculo;
    const inst = ok(await a.crm('GET', `/instalaciones/unidades/${c.idCliente}`), 'unidades')[0];
    const m = ok(await a.crm('POST', '/instalaciones/mantenimiento', { idCliente: c.idCliente, idInstalacionNext: inst.idInstalacion, tipo: 'revision' }), 'mantenimiento');
    const os = await agendar(a, m.id);
    const id = os[0].id;
    ok(await a.app('POST', `/ordenes-servicio/${id}/iniciar`, { claveApp: a.nuevaClave() }), 'iniciar');
    ok(await a.app('POST', `/ordenes-servicio/${id}/codigo`), 'código');
    const real = ok(await a.monitoreo('POST', `/ordenes-servicio/${id}/codigo/ver`), 'ver').data[0].codigo as string;
    const malos = Array.from({ length: 20 }, (_, i) => String((Number(real) + i + 1) % 1000000).padStart(6, '0'));
    const rs = await Promise.all(malos.map((codigo) => a.app('POST', `/ordenes-servicio/${id}/codigo/validar`, { codigo })));
    const evaluados = rs.filter((r) => /incorrecto/i.test(JSON.stringify(r.body))).length;
    expect(evaluados).toBeLessThanOrEqual(5);
    const final = await a.app('POST', `/ordenes-servicio/${id}/codigo/validar`, { codigo: real });
    expect(final.status).toBe(400);
  });

  it('[1.4] el cursor de cambios no se atasca con muchas órdenes en el mismo segundo', async () => {
    const r = ok(
      await e.integracion('POST', '/integracion/ordenes-servicio', {
        referenciaCrm: 'CUR-1',
        tipo: 'instalacion',
        idCliente: c.idClienteNext,
        unidades: 30,
        cita: new Date(Date.now() + 86400000).toISOString(),
        idTecnico: NEXT.TECNICO.id,
      }),
      'programar 30',
    );
    expect(r.data).toHaveLength(30);
    const vistos = new Set<number>();
    let q = 'limite=7';
    for (let i = 0; i < 60; i++) {
      const p = ok(await e.integracion('GET', `/integracion/ordenes-servicio/cambios?${q}`), 'cambios');
      p.data.forEach((o: any) => vistos.add(o.id));
      if (!p.hayMas) break;
      q = `limite=7&desde=${encodeURIComponent(p.hasta)}${p.despuesDe != null ? `&despuesDe=${p.despuesDe}` : ''}`;
    }
    for (const d of r.data) expect(vistos.has(d.id)).toBe(true);
  });

  it('[1.5] programar dos veces a la vez es idempotente; una referencia de otro cliente da 409', async () => {
    const cuerpo = {
      referenciaCrm: 'DUP-1',
      tipo: 'instalacion',
      idCliente: c.idClienteNext,
      unidades: 2,
      cita: new Date(Date.now() + 86400000).toISOString(),
      idTecnico: NEXT.TECNICO.id,
    };
    const [r1, r2] = await Promise.all([e.integracion('POST', '/integracion/ordenes-servicio', cuerpo), e.integracion('POST', '/integracion/ordenes-servicio', cuerpo)]);
    expect([r1.status, r2.status]).toEqual([201, 201]);
    expect(r1.body.data.map((d: any) => d.id).sort()).toEqual(r2.body.data.map((d: any) => d.id).sort());
    const otro = await clienteListo(e, a, 'OTR010101AA1', 0);
    const ajeno = await e.integracion('POST', '/integracion/ordenes-servicio', { ...cuerpo, idCliente: otro.idClienteNext });
    expect(ajeno.status).toBe(409);
  });

  it('[1.6] si Next está caído al cancelar en el CRM, se cancela en Next cuando vuelve', async () => {
    const o = await orden();
    e.proxy.modo = 'caido';
    ok(await a.crm('POST', `/instalaciones/${o.idOrden}/cancelar`, { motivo: 'El cliente desistió' }), 'cancelar');
    e.proxy.modo = 'normal';
    await a.sincronizarCrm();
    const det = ok(await a.operacion('GET', `/ordenes-servicio/${o.os[0].id}`), 'detalle').data[0];
    expect(det.estatus).toBe('cancelada');
  });

  it('[1.6] si Next está caído al mover la cita, la cita nueva llega cuando vuelve', async () => {
    const o = await orden();
    e.proxy.modo = 'caido';
    ok(await a.crm('PATCH', `/instalaciones/${o.idOrden}`, { cita: enDias(5, 16), idTecnicoNext: NEXT.TECNICO.id, lugar: 'Patio', forzar: true, motivo: 'Cambio de hora' }), 'mover');
    e.proxy.modo = 'normal';
    await a.sincronizarCrm();
    const det = ok(await a.operacion('GET', `/ordenes-servicio/${o.os[0].id}`), 'detalle').data[0];
    expect(new Date(det.cita).getUTCHours()).toBe(16);
  });

  it('[1.7][1.8] autorizar "con el corte" en un alta funciona; dos autorizaciones = dos cargos; cancelar los cancela', async () => {
    const v1 = await vehiculoConEquipo();
    const v2 = await vehiculoConEquipo();
    const o = await orden(2);
    const [x, y] = o.os.sort((p: any, q: any) => p.unidad - q.unidad).map((z: any) => z.id);
    for (const [id, v] of [[x, v1], [y, v2]]) {
      ok(await a.app('POST', `/ordenes-servicio/${id}/iniciar`, { claveApp: a.nuevaClave() }), 'iniciar');
      ok(await a.app('PATCH', `/ordenes-servicio/${id}`, { idProducto: v }), 'vehículo');
      ok(await a.app('POST', `/ordenes-servicio/${id}/autorizacion`, {}), 'autorización');
    }
    ok(await a.crm('POST', `/instalaciones/autorizaciones/${x}`, { autorizada: true, sobreprecio: 500, cobro: 'CORTE' }), 'autorizar CORTE');
    ok(await a.crm('POST', `/instalaciones/autorizaciones/${y}`, { autorizada: true, sobreprecio: 300, cobro: 'FECHA', vence: enDias(20).slice(0, 10) }), 'autorizar FECHA');
    const sobre = e.consulta('CRM', `SELECT Monto, Cobro, IdCargo FROM SobreprecioAutorizaciones WHERE IdOrden = ${o.idOrden} ORDER BY Monto`);
    expect(sobre.map((f) => [Number(f[0]), f[1]])).toEqual([[300, 'FECHA'], [500, 'CORTE']]);
    expect(sobre[0][2]).not.toBe('NULL');
    ok(await a.crm('POST', `/instalaciones/${o.idOrden}/cancelar`, { motivo: 'Desistió' }), 'cancelar');
    const cargos = e.consulta('CRM', `SELECT Estatus FROM Cargos WHERE IdOrdenInstalacion = ${o.idOrden}`);
    expect(cargos.every((f) => f[0] === 'CANCELADO')).toBe(true);
  });

  it('[1.10] reagendar justo después de una no cumplida no se revierte', async () => {
    const o = await orden();
    ok(await a.app('POST', `/ordenes-servicio/${o.os[0].id}/iniciar`, { claveApp: a.nuevaClave() }), 'iniciar');
    ok(await a.app('POST', `/ordenes-servicio/${o.os[0].id}/no-cumplida`, { claveMotivo: 'cliente_ausente' }), 'no cumplida');
    ok(await a.crm('PATCH', `/instalaciones/${o.idOrden}`, { cita: enDias(7), idTecnicoNext: NEXT.TECNICO.id, lugar: 'Patio', forzar: true, motivo: 'Reagendada' }), 'reagendar');
    await a.sincronizarCrm();
    await a.sincronizarCrm();
    const crm = await a.ordenCrm(o.idOrden);
    expect(crm.estatus).toBe('AGENDADA');
    expect(crm.ordenesApp.some((x: any) => x.estatus === 'programada')).toBe(true);
  });

  it('[1.11] una prueba pedida no queda colgada si la orden no se cumple; compartir no "cambia" la orden', async () => {
    const o = await orden();
    const id = o.os[0].id;
    ok(await a.app('POST', `/ordenes-servicio/${id}/iniciar`, { claveApp: a.nuevaClave() }), 'iniciar');
    ok(await a.app('POST', `/ordenes-servicio/${id}/pruebas/transmision/solicitar`), 'pedir');
    ok(await a.app('POST', `/ordenes-servicio/${id}/no-cumplida`, { claveMotivo: 'cliente_ausente' }), 'no cumplida');
    const pend = ok(await a.monitoreo('GET', '/ordenes-servicio/pruebas-pendientes'), 'pendientes').data;
    expect(pend.some((p: any) => p.id === id)).toBe(false);
    expect(e.consulta('Next', `SELECT Estatus FROM OrdenServicioPruebas WHERE IdOrdenServicio = ${id}`)[0][0]).not.toBe('solicitada');
    const antes = e.consulta('Next', `SELECT FechaActualizacion FROM OrdenesServicio WHERE Id = ${id}`)[0][0];
    await new Promise((r) => setTimeout(r, 1100));
    ok(await a.app('POST', `/ordenes-servicio/${id}/compartir`, {}), 'compartir');
    expect(e.consulta('Next', `SELECT FechaActualizacion FROM OrdenesServicio WHERE Id = ${id}`)[0][0]).toBe(antes);
  });
});

describe('Seguridad', () => {
  it('[2.1] una firma capturada no sirve para otra orden ni se puede repetir', async () => {
    const texto = JSON.stringify({ claveMotivo: 'cancelada_por_cliente' });
    const o1 = await orden();
    const o2 = await orden();
    const h = e.firmar('POST', `/api/integracion/ordenes-servicio/${o1.os[0].id}/cancelar`, texto);
    const otra = await e.enviarFirmado('POST', `/integracion/ordenes-servicio/${o2.os[0].id}/cancelar`, texto, h);
    expect(otra.status).toBe(401);
    const buena = await e.enviarFirmado('POST', `/integracion/ordenes-servicio/${o1.os[0].id}/cancelar`, texto, h);
    expect(buena.status).toBeLessThan(300);
    const repetida = await e.enviarFirmado('POST', `/integracion/ordenes-servicio/${o1.os[0].id}/cancelar`, texto, h);
    expect(repetida.status).toBe(401);
    const v1 = await e.enviarFirmado('POST', `/integracion/ordenes-servicio/${o2.os[0].id}/cancelar`, texto, e.firmar('POST', '', texto, 1));
    expect(v1.status).toBe(401);
  });

  it('[2.2] el código solo lo pide y valida el técnico asignado', async () => {
    const inst = ok(await a.crm('GET', `/instalaciones/unidades/${c.idCliente}`), 'unidades')[0];
    const m = ok(await a.crm('POST', '/instalaciones/mantenimiento', { idCliente: c.idCliente, idInstalacionNext: inst.idInstalacion, tipo: 'revision' }), 'mantenimiento');
    const os = await agendar(a, m.id);
    ok(await a.app('POST', `/ordenes-servicio/${os[0].id}/iniciar`, { claveApp: a.nuevaClave() }), 'iniciar');
    const admin = await a.operacion('POST', `/ordenes-servicio/${os[0].id}/codigo`);
    expect(admin.status).toBe(404);
  });

  it('[2.3] mandar un sobreprecio a cobranza exige permiso de cobranza', async () => {
    const sinCobranza = e.tokenCrm(['instalaciones.ver', 'instalaciones.editar'], 1, 2);
    const r = await e.llamar(e.crmUrl, 'POST', '/instalaciones/1/sobreprecio/cargo', sinCobranza, { cobro: 'FECHA', vence: enDias(10).slice(0, 10) });
    expect(r.status).toBe(403);
  });

  it('[2.4] el operador no cambia una prueba ya validada; el CRM no decide órdenes de Next', async () => {
    const o = await orden();
    const id = o.os[0].id;
    await altaListaParaCerrar(a, id, c.idClienteNext, nuevaPlaca(), nuevoEquipo());
    const cambio = await a.monitoreo('POST', `/ordenes-servicio/${id}/pruebas/transmision/validar`, { correcta: false });
    expect(cambio.status).toBe(409);

    const prog = ok(
      await a.operacion('POST', '/ordenes-servicio/programar', { tipo: 'instalacion', idCliente: c.idClienteNext, cita: new Date(Date.now() + 86400000).toISOString(), idTecnico: NEXT.TECNICO.id }),
      'programar desde Next',
    );
    const r = await e.integracion('POST', `/integracion/ordenes-servicio/${prog.data[0].id}/autorizacion/decision`, { autorizada: true });
    expect(r.status).toBe(404);
  });

  it('[2.5][2.7] monitoreo no envía PDFs; WhatsApp con 10 dígitos lleva la lada 52', async () => {
    const o = await orden();
    const id = o.os[0].id;
    await altaListaParaCerrar(a, id, c.idClienteNext, nuevaPlaca(), nuevoEquipo());
    ok(await a.app('POST', `/ordenes-servicio/${id}/cerrar`), 'cerrar');
    const mon = await a.monitoreo('POST', `/ordenes-servicio/${id}/enviar-correo`, { correos: ['x@y.mx'] });
    expect(mon.status).toBe(403);
    const w = ok(await a.app('POST', `/ordenes-servicio/${id}/compartir`, { telefono: '7771234567' }), 'compartir').data[0];
    expect(w.whatsapp).toMatch(/^https:\/\/wa\.me\/527771234567\?/);
  });
});
