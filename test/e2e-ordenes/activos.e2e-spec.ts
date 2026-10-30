import { Actores, ok } from './actores';
import { agendar, altaListaParaCerrar, clienteListo } from './comunes';
import { Entorno } from './entorno';

/**
 * Motor de activos, fase A (docs/motor-activos.md §1, §4, §5): estatus con
 * transiciones, historial de vida (MovimientosRecurso) y baja archivada.
 * Las pruebas corren en orden: siguen al mismo equipo por su ciclo de vida.
 */
const e = new Entorno();
let a: Actores;
let C: Awaited<ReturnType<typeof clienteListo>>;
const SA = { id: 80, rol: 1 };
let tokSa: string;
const s: Record<string, number> = {};

const op = (metodo: string, ruta: string, cuerpo?: unknown) => a.operacion(metodo, ruta, cuerpo);
const estatus = (tabla: 'Dispositivos' | 'Sims' | 'Productos', id: number) =>
  Number(e.mysql.sql('Next', `SELECT Estatus FROM ${tabla} WHERE Id = ${id}`).trim());
const historial = async (recurso: 'dispositivos' | 'sims' | 'productos', id: number) =>
  ok(await op('GET', `/${recurso}/${id}/historial`), `historial ${recurso} ${id}`).data as Array<Record<string, any>>;

beforeAll(async () => {
  await e.iniciar();
  a = new Actores(e);
  C = await clienteListo(e, a, 'MAC010101AA1', 5);
  e.mysql.sql(
    'Next',
    `INSERT INTO Usuarios (Id, UserName, PasswordHash, EmailConfirmado, Nombre, IdRol, IdCliente, Estatus) VALUES
      (${SA.id}, 'sa@e2e.local', 'x', 1, 'Super admin', 1, ${C.idClienteNext}, 1)`,
  );
  tokSa = e.tokenNext(SA, C.idClienteNext);
}, 240000);

afterAll(() => e.detener());

describe('Catálogo y alta', () => {
  it('GET /estatus-recurso trae los 6 estatus con sus transiciones a mano', async () => {
    const cat = ok(await op('GET', '/estatus-recurso'), 'catálogo');
    expect(cat.data.map((x: any) => x.codigo)).toEqual(['INACTIVO', 'DISPONIBLE', 'INSTALADO', 'POR_REVISAR', 'LABORATORIO', 'INSERVIBLE']);
    expect(cat.data[3].transicionesManuales).toEqual([1, 4, 5, 0]);
    expect(cat.salidaDeInstalacion).toEqual([3, 4, 5]);
  });

  it('el alta de una SIM por la API deja su primer movimiento', async () => {
    const sim = ok(await op('POST', '/sims', { idCliente: C.idClienteNext, idTelefonia: 1, idPlanTelefonia: 1, numeroTelefono: '7770000001' }), 'alta SIM');
    s.simNueva = Number(sim.data.id);
    const h = await historial('sims', s.simNueva);
    expect(h).toEqual([expect.objectContaining({ accion: 'alta', estatusAnterior: null, estatusNuevo: 1, idClienteNuevo: C.idClienteNext, origen: 'api' })]);
  });
});

describe('Ciclo de vida de un equipo', () => {
  it('instalar: producto, equipo y SIM pasan a 2 y cada uno registra el movimiento con la instalación', async () => {
    const veh = ok(await op('POST', '/productos/vehiculos', { idCliente: C.idClienteNext, placa: 'MOT0001' }), 'vehículo');
    s.veh = Number(veh.data.id);
    s.disp = C.inventario[0].idDispositivo;
    s.sim = C.inventario[0].idSim;
    const inst = ok(await op('POST', '/instalaciones', { idCliente: C.idClienteNext, idProducto: s.veh, idDispositivo: s.disp, idSim: s.sim }), 'instalar');
    s.inst = Number(inst.data.id);
    expect([estatus('Productos', s.veh), estatus('Dispositivos', s.disp), estatus('Sims', s.sim)]).toEqual([2, 2, 2]);
    const h = await historial('dispositivos', s.disp);
    expect(h[0]).toMatchObject({ accion: 'instalacion', estatusAnterior: 1, estatusNuevo: 2, idInstalacion: s.inst, origen: 'api' });
    expect((await historial('productos', s.veh)).map((x) => x.accion)).toEqual(['instalacion', 'alta']);
  });

  it('un equipo instalado no cambia de estatus a mano; tampoco se pone 2 a mano', async () => {
    const r = await op('PATCH', `/dispositivos/estatus/${s.disp}`, { estatus: 3 });
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).toContain('instalación activa');
    const libre = C.inventario[4].idDispositivo;
    expect((await op('PATCH', `/dispositivos/estatus/${libre}`, { estatus: 2 })).status).toBe(400);
  });

  it('cambio de equipo: el que sale no puede volver directo a disponible; a laboratorio sí', async () => {
    const nuevo = C.inventario[1].idDispositivo;
    const directo = await op('PATCH', `/instalaciones/${s.inst}`, {
      idDispositivo: nuevo,
      estatusInstalacionAnterior: 3,
      estatusDispositivoAnterior: 1,
    });
    expect(directo.status).toBe(400);
    expect(JSON.stringify(directo.body)).toContain('3 (por revisar)');
    expect(estatus('Dispositivos', nuevo)).toBe(1); // nada cambió

    const cambio = ok(
      await op('PATCH', `/instalaciones/${s.inst}`, {
        idDispositivo: nuevo,
        estatusInstalacionAnterior: 3,
        estatusDispositivoAnterior: 4,
        comentario: 'Falla de GPS',
      }),
      'cambio',
    );
    s.inst = Number(cambio.data.id);
    expect(estatus('Dispositivos', s.disp)).toBe(4);
    expect(estatus('Dispositivos', nuevo)).toBe(2);
    expect((await historial('dispositivos', s.disp))[0]).toMatchObject({
      accion: 'cambio',
      estatusAnterior: 2,
      estatusNuevo: 4,
      idInstalacion: s.inst,
      motivo: 'Falla de GPS',
    });
    s.dispViejo = s.disp;
    s.disp = nuevo;
  });

  it('laboratorio: no regresa a revisión; se rehabilita a disponible', async () => {
    expect((await op('PATCH', `/dispositivos/estatus/${s.dispViejo}`, { estatus: 3 })).status).toBe(400);
    ok(await op('PATCH', `/dispositivos/estatus/${s.dispViejo}`, { estatus: 1, motivo: 'Reparado' }), 'rehabilitar');
    expect((await historial('dispositivos', s.dispViejo))[0]).toMatchObject({ accion: 'estatus', estatusAnterior: 4, estatusNuevo: 1, motivo: 'Reparado' });
  });

  it('baja: archiva el periodo; equipo y SIM a revisión, producto a activo', async () => {
    ok(await op('PATCH', `/instalaciones/estatus/${s.inst}`, { estatusInstalacion: 0, comentario: 'Cliente canceló' }), 'baja');
    expect([estatus('Productos', s.veh), estatus('Dispositivos', s.disp), estatus('Sims', s.sim)]).toEqual([1, 3, 3]);
    const hist = e.mysql
      .sql('Next', `SELECT Accion, EstatusInstalacion, VigenteHasta IS NOT NULL FROM HistoricoInstalaciones WHERE IdInstalacionOriginal = ${s.inst}`)
      .trim();
    expect(hist).toBe('Baja\t0\t1');
    const detalle = ok(await op('GET', `/instalaciones/historico/${s.inst}`), 'histórico');
    expect(detalle.data.historico[0]).toMatchObject({ accion: 'Baja' });
    expect((await op('PATCH', `/instalaciones/estatus/${s.inst}`, { estatusInstalacion: 0 })).status).toBe(400);
  });

  it('el reporte de la instalación dada de baja ya no tiene un tramo abierto', async () => {
    const r = ok(
      await op('POST', '/reportes/salidas-geocerca-instalacion', {
        idInstalacion: s.inst,
        fechaInicio: '2000-01-01 00:00:00',
        fechaFinal: '2100-01-01 00:00:00',
      }),
      'reporte',
    );
    expect(r.data?.dispositivosEnPeriodo ?? r.dispositivosEnPeriodo).toEqual(
      expect.arrayContaining([expect.objectContaining({ idDispositivo: s.disp })]),
    );
    for (const t of r.data?.dispositivosEnPeriodo ?? r.dispositivosEnPeriodo) {
      expect(t.vigenteHasta).not.toBeNull();
    }
  });

  it('reactivar exige revisar antes los componentes; luego abre una versión nueva', async () => {
    const antes = await op('PATCH', `/instalaciones/estatus/${s.inst}`, { estatusInstalacion: 1 });
    expect(antes.status).toBe(400);
    ok(await op('PATCH', `/dispositivos/estatus/${s.disp}`, { estatus: 1 }), 'revisar equipo');
    ok(await op('PATCH', `/sims/estatus/${s.sim}`, { estatus: 1 }), 'revisar SIM');
    ok(await op('PATCH', `/instalaciones/estatus/${s.inst}`, { estatusInstalacion: 1 }), 'reactivar');
    expect([estatus('Productos', s.veh), estatus('Dispositivos', s.disp), estatus('Sims', s.sim)]).toEqual([2, 2, 2]);
    const eslabon = e.mysql
      .sql(
        'Next',
        `SELECT i.IdHistoricoInstalacion = h.Id, i.VigenteDesde >= h.VigenteHasta FROM Instalaciones i
           JOIN HistoricoInstalaciones h ON h.IdInstalacionOriginal = i.Id AND h.Accion = 'Baja' WHERE i.Id = ${s.inst}`,
      )
      .trim();
    expect(eslabon).toBe('1\t1');
    expect((await historial('dispositivos', s.disp)).map((x) => x.accion).slice(0, 4)).toEqual(['reactivacion', 'estatus', 'baja', 'cambio']);
  });

  it('baja por inservible: el equipo queda inservible; solo SA lo corrige, con motivo', async () => {
    ok(await op('PATCH', `/instalaciones/estatus/${s.inst}`, { estatusInstalacion: 5, comentario: 'Vandalismo' }), 'baja 5');
    expect(estatus('Dispositivos', s.disp)).toBe(5);
    expect(estatus('Sims', s.sim)).toBe(3);
    expect((await op('PATCH', `/dispositivos/estatus/${s.disp}`, { estatus: 1 })).status).toBe(400);
    const sa = (cuerpo: unknown) => e.llamar(e.nextUrl, 'PATCH', `/dispositivos/estatus/${s.disp}`, tokSa, cuerpo);
    expect((await sa({ estatus: 3 })).status).toBe(400);
    ok(await sa({ estatus: 3, motivo: 'Capturado por error: el equipo está bien' }), 'corrección SA');
    expect(estatus('Dispositivos', s.disp)).toBe(3);
  });

  it('una baja como inactiva se corrige a inservible: el equipo por revisar pasa a 5', async () => {
    const veh = ok(await op('POST', '/productos/vehiculos', { idCliente: C.idClienteNext, placa: 'MOT0005' }), 'vehículo');
    const eq = C.inventario[4];
    const inst = Number(
      ok(await op('POST', '/instalaciones', { idCliente: C.idClienteNext, idProducto: Number(veh.data.id), idDispositivo: eq.idDispositivo }), 'instalar').data.id,
    );
    ok(await op('PATCH', `/instalaciones/estatus/${inst}`, { estatusInstalacion: 0 }), 'baja 0');
    expect(estatus('Dispositivos', eq.idDispositivo)).toBe(3);
    ok(await op('PATCH', `/instalaciones/estatus/${inst}`, { estatusInstalacion: 5, comentario: 'Se encontró dañado' }), 'corregir a 5');
    expect(estatus('Dispositivos', eq.idDispositivo)).toBe(5);
    const h = e.mysql.sql('Next', `SELECT EstatusInstalacion FROM HistoricoInstalaciones WHERE IdInstalacionOriginal = ${inst} AND Accion = 'Baja'`).trim();
    expect(h).toBe('5');
  });
});

describe('Integridad', () => {
  it('dos instalaciones del mismo equipo al mismo tiempo: solo una pasa', async () => {
    const eq = C.inventario[2];
    const vehs = await Promise.all(
      ['MOT0002', 'MOT0003'].map(async (placa) =>
        Number(ok(await op('POST', '/productos/vehiculos', { idCliente: C.idClienteNext, placa }), placa).data.id),
      ),
    );
    const r = await Promise.all(
      vehs.map((idProducto) => op('POST', '/instalaciones', { idCliente: C.idClienteNext, idProducto, idDispositivo: eq.idDispositivo })),
    );
    expect(r.map((x) => x.status).sort()).toEqual([201, expect.any(Number)].sort());
    expect(r.filter((x) => x.status === 201)).toHaveLength(1);
    expect(r.find((x) => x.status !== 201)!.status).toBeGreaterThanOrEqual(400);
    const activas = e.mysql.sql('Next', `SELECT COUNT(*) FROM Instalaciones WHERE IdDispositivo = ${eq.idDispositivo} AND Estatus = 1`).trim();
    expect(activas).toBe('1');
    const movs = e.mysql
      .sql('Next', `SELECT COUNT(*) FROM MovimientosRecurso WHERE TipoRecurso = 'dispositivo' AND IdRecurso = ${eq.idDispositivo} AND Accion = 'instalacion'`)
      .trim();
    expect(movs).toBe('1');
  });

  it('una SIM que no está en almacén no cambia de cliente', async () => {
    expect(estatus('Sims', s.sim)).toBe(3);
    const r = await op('PATCH', `/sims/${s.sim}`, { idCliente: 1 });
    expect(r.status).toBe(400);
    expect(JSON.stringify(r.body)).toContain('disponible (1) o inactiva (0)');
  });

  it('el historial cruza clientes: un rol 6 no lo ve (403)', async () => {
    const r = await e.llamar(e.nextUrl, 'GET', `/dispositivos/${s.disp}/historial`, e.tokenNext({ id: 70, rol: 6 }, C.idClienteNext));
    expect(r.status).toBe(403);
  });

  it('el cierre de una orden deja el movimiento con origen "orden" y su id', async () => {
    const os = await agendar(a, C.idOrden);
    const eq = C.inventario[3];
    await altaListaParaCerrar(a, os[0].id, C.idClienteNext, 'MOT0004', eq);
    ok(await a.app('POST', `/ordenes-servicio/${os[0].id}/cerrar`), 'cerrar');
    expect((await historial('dispositivos', eq.idDispositivo))[0]).toMatchObject({
      accion: 'instalacion',
      origen: 'orden',
      idOrdenServicio: Number(os[0].id),
    });
  });
});
