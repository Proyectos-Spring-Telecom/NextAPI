import { Actores, ok } from './actores';
import { clienteListo } from './comunes';
import { Entorno } from './entorno';

/**
 * CRM ↔ Next con varios equipos por vehículo (fase C): el CRM cuenta según lo
 * que cubre cada contrato (CubreClases / CuentaPor) y la fecha real de
 * instalación se guarda solo en Next (VigenteDesde) desde el CRM.
 *
 * Cliente: vehículo 1 con GPS y TrackCam, vehículo 2 solo con GPS.
 */
const e = new Entorno();
let a: Actores;
let C: Awaited<ReturnType<typeof clienteListo>>;
const s: Record<string, number> = {};

const op = (metodo: string, ruta: string, cuerpo?: unknown) => a.operacion(metodo, ruta, cuerpo);
const sql = (q: string) => e.mysql.sql('Next', q).trim();
const sqlCrm = (q: string) => e.mysql.sql('CRM', q).trim();
const contrato = (unidades: number, cubreClases: string | null, cuentaPor: string | null) =>
  sqlCrm(
    `UPDATE ServiciosContratados SET Estatus = 'ACTIVO', Unidades = ${unidades},
       CubreClases = ${cubreClases === null ? 'NULL' : `'${cubreClases}'`}, CuentaPor = ${cuentaPor === null ? 'NULL' : `'${cuentaPor}'`}
     WHERE Id = ${C.idServicio}`,
  );
const sinContrato = async () =>
  (ok(await a.crm('GET', '/postventa/resumen'), 'resumen').sinContrato as Array<{ idCliente: number | null; cubre: string; diferencia: number }>)
    .filter((f) => f.idCliente === C.idCliente)
    .map((f) => `${f.cubre}: ${f.diferencia}`);

beforeAll(async () => {
  await e.iniciar();
  a = new Actores(e);
  C = await clienteListo(e, a, 'COB010101AA1', 4);
  sql(`INSERT IGNORE INTO CatTipoDispositivo (Id, Codigo, Nombre, Estatus, Clase) VALUES (5, 'TRACKCAM', 'TrackCam', 1, 'TRACKCAM')`);
  sql(`UPDATE CatTipoDispositivo SET Clase = 'TRACKCAM' WHERE Id = 5`);
  sql(`UPDATE Dispositivos SET IdTipoDispositivo = 5 WHERE Id = ${C.inventario[1].idDispositivo}`);
  const vehiculo = async (placa: string) =>
    Number(ok(await op('POST', '/productos/vehiculos', { idCliente: C.idClienteNext, placa }), placa).data.id);
  const instalar = async (idProducto: number, i: number) =>
    Number(
      ok(
        await op('POST', '/instalaciones', {
          idCliente: C.idClienteNext,
          idProducto,
          idDispositivo: C.inventario[i].idDispositivo,
          idSim: C.inventario[i].idSim,
        }),
        `instalar ${i}`,
      ).data.id,
    );
  s.veh1 = await vehiculo('COB0001');
  s.veh2 = await vehiculo('COB0002');
  s.gps1 = await instalar(s.veh1, 0);
  s.cam1 = await instalar(s.veh1, 1);
  s.gps2 = await instalar(s.veh2, 2);
}, 240000);

afterAll(() => e.detener());

describe('Next: resumen de equipos por vehículo y clase', () => {
  it('una fila por equipo activo, con su vehículo y clase', async () => {
    const r = ok(await e.integracion('GET', '/integracion/unidades/resumen'), 'resumen') as Array<{ idClienteNext: number; idProducto: number; clase: string }>;
    const suyos = r.filter((x) => x.idClienteNext === C.idClienteNext).map((x) => `${x.idProducto === s.veh1 ? 'v1' : 'v2'}:${x.clase}`);
    expect(suyos.sort()).toEqual(['v1:AVL', 'v1:TRACKCAM', 'v2:AVL']);
    const unidades = ok(await e.integracion('GET', `/integracion/unidades?clientes=${C.idClienteNext}`), 'unidades') as Array<{ idInstalacion: number; idProducto: number; clase: string }>;
    expect(unidades.find((u) => u.idInstalacion === s.cam1)).toMatchObject({ idProducto: s.veh1, clase: 'TRACKCAM' });
  });
});

describe('CRM: unidades sin contrato según lo que cubre el contrato', () => {
  it('sin clasificar cuenta vehículos: GPS y cámara del mismo vehículo son una unidad', async () => {
    contrato(2, null, null);
    expect(await sinContrato()).toEqual([]);
  });

  it('solo GPS: la cámara sale sin contrato', async () => {
    contrato(2, 'AVL', null);
    expect(await sinContrato()).toEqual(['Sin contrato: TrackCam: 1']);
  });

  it('GPS y TrackCam por equipo: tres equipos contra dos contratados', async () => {
    contrato(2, 'AVL,TRACKCAM', 'EQUIPO');
    expect(await sinContrato()).toEqual(['GPS + TrackCam · por equipo: 1']);
    const ficha = ok(await a.crm('GET', `/postventa/clientes/${C.idCliente}`), 'ficha');
    expect(ficha.cuadre).toEqual([expect.objectContaining({ cubre: 'GPS + TrackCam · por equipo', enNext: 3, contratadas: 2, diferencia: 1 })]);
    expect(ficha.unidades.map((u: { clase: string }) => u.clase).sort()).toEqual(['AVL', 'AVL', 'TRACKCAM']);
    expect(ficha.servicios[0]).toMatchObject({ cubreClases: 'AVL,TRACKCAM', cuentaPor: 'EQUIPO', cobertura: 'GPS + TrackCam · por equipo' });
  });

  it('editar el contrato desde el CRM valida y normaliza la cobertura', async () => {
    const actual = ok(await a.crm('GET', `/postventa/clientes/${C.idCliente}`), 'ficha').servicios[0];
    const base = {
      idCliente: C.idCliente,
      concepto: actual.concepto,
      unidades: 2,
      precioUnitario: actual.precioUnitario,
      base: actual.base,
      periodoMeses: actual.periodoMeses,
      moneda: actual.moneda,
    };
    expect((await a.crm('PUT', `/postventa/servicios/${C.idServicio}`, { ...base, cubreClases: 'GPS' })).status).toBe(400);
    const r = ok(await a.crm('PUT', `/postventa/servicios/${C.idServicio}`, { ...base, cubreClases: 'trackcam, avl', cuentaPor: 'VEHICULO' }), 'editar');
    expect(r.servicio).toMatchObject({ cubreClases: 'AVL,TRACKCAM', cuentaPor: 'VEHICULO' });
    expect(await sinContrato()).toEqual([]);
  });
});

describe('Fecha real de instalación: del CRM a Next', () => {
  beforeAll(() => sql(`UPDATE Instalaciones SET VigenteDesde = '2026-10-20 12:00:00' WHERE Id IN (${s.gps1}, ${s.cam1}, ${s.gps2})`));

  it('se guarda en Next (00:00 del día) con evidencia de origen crm', async () => {
    const r = ok(await a.crm('PUT', `/postventa/clientes/${C.idCliente}/fecha-real`, { fecha: '2026-10-18', idInstalacion: s.gps1, motivo: 'Contrato firmado' }), 'fecha real');
    expect(r.fechaReal).toEqual({ aplicadas: 1, sinCambio: 0, rechazadas: [] });
    expect(sql(`SELECT DATE_FORMAT(VigenteDesde, '%Y-%m-%d %H:%i:%s') FROM Instalaciones WHERE Id = ${s.gps1}`)).toBe('2026-10-18 00:00:00');
    expect(sql(`SELECT CONCAT(Origen, '|', Motivo) FROM CorreccionesInstalacion WHERE IdInstalacion = ${s.gps1}`)).toMatch(/^crm\|CRM \(.+\): Contrato firmado$/);
    expect(r.unidades.find((u: { idInstalacion: number }) => u.idInstalacion === s.gps1).instalada).toBe('2026-10-18');
  });

  it('el mismo día no cambia; hacia adelante Next la rechaza con su motivo', async () => {
    const igual = ok(await a.crm('PUT', `/postventa/clientes/${C.idCliente}/fecha-real`, { fecha: '2026-10-18', idInstalacion: s.gps1 }), 'mismo día');
    expect(igual.fechaReal).toMatchObject({ aplicadas: 0, sinCambio: 1 });
    const adelante = await a.crm('PUT', `/postventa/clientes/${C.idCliente}/fecha-real`, { fecha: '2026-10-25', idInstalacion: s.gps1 });
    expect(adelante.status).toBe(400);
    expect(JSON.stringify(adelante.body)).toContain('solo se corrige hacia atrás');
  });

  it('para todas: aplica las que puede y reporta las que Next rechaza', async () => {
    // La cámara ya tiene en Next una fecha anterior: llevarla al 10 sería hacia adelante.
    sql(`UPDATE Instalaciones SET VigenteDesde = '2026-10-05 00:00:00' WHERE Id = ${s.cam1}`);
    const r = ok(await a.crm('PUT', `/postventa/clientes/${C.idCliente}/fecha-real`, { fecha: '2026-10-10' }), 'para todas');
    expect(r.fechaReal.aplicadas).toBe(2);
    expect(r.fechaReal.rechazadas).toEqual([expect.objectContaining({ idInstalacion: s.cam1, motivo: expect.stringContaining('solo se corrige hacia atrás') })]);
  });

  it('tras un cambio de SIM la fecha es la del equipo y se corrige en su primera versión', async () => {
    const cambio = ok(
      await op('PATCH', `/instalaciones/${s.gps2}`, {
        idSim: C.inventario[3].idSim,
        estatusInstalacionAnterior: 3,
        estatusSimAnterior: 3,
        comentario: 'Cambio de SIM',
      }),
      'cambio de SIM',
    );
    s.gps2b = Number(cambio.data.id);
    expect(s.gps2b).not.toBe(s.gps2);
    const unidad = async () =>
      (ok(await a.crm('GET', `/postventa/clientes/${C.idCliente}`), 'ficha').unidades as Array<{ idInstalacion: number; instalada: string }>).find(
        (u) => u.idInstalacion === s.gps2b,
      )!;
    // La versión nueva empieza hoy, pero el equipo está en el vehículo desde el 10.
    expect((await unidad()).instalada).toBe('2026-10-10');
    const r = ok(await a.crm('PUT', `/postventa/clientes/${C.idCliente}/fecha-real`, { fecha: '2026-10-02', idInstalacion: s.gps2b }), 'fecha tras SIM');
    expect(r.fechaReal).toMatchObject({ aplicadas: 1, rechazadas: [] });
    expect(sql(`SELECT DATE_FORMAT(VigenteDesde, '%Y-%m-%d %H:%i') FROM HistoricoInstalaciones WHERE IdInstalacionOriginal = ${s.gps2} ORDER BY Id DESC LIMIT 1`)).toBe('2026-10-02 00:00');
    expect(sql(`SELECT Campo FROM CorreccionesInstalacion WHERE IdInstalacion = ${s.gps2b}`)).toBe('VigenteDesdeEquipo');
    expect((await unidad()).instalada).toBe('2026-10-02');
  });

  it('Next no acepta la fecha de una instalación de otro cliente', async () => {
    const r = await e.integracion('PATCH', `/integracion/instalaciones/${s.gps1}/fecha-instalacion`, {
      idClienteNext: C.idClienteNext + 1000,
      fecha: '2026-10-01',
      motivo: 'x',
    });
    expect(r.status).toBe(404);
  });
});
