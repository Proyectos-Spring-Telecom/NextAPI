import { join } from 'path';
import { Actores, ok } from './actores';
import { clienteListo } from './comunes';
import { Entorno } from './entorno';

/**
 * Motor de activos, fase D (docs/motor-activos.md §3 y §6): fecha real de
 * instalación y posiciones recortadas a la vigencia. Corren en orden: siguen a
 * un vehículo que cambia de equipo y al equipo que sale a otro vehículo.
 *
 * Línea de tiempo (10/10/2026):
 *   equipo A transmite desde las 10:00; la instalación se dio de alta a las 12:00
 *   (migrada) y se corrige a las 09:30; a las 14:00 se cambia por el equipo B;
 *   A sigue transmitiendo (15:00) en el taller y se instala en otro vehículo a las 16:00.
 */
const e = new Entorno();
let a: Actores;
let C: Awaited<ReturnType<typeof clienteListo>>;
const s: Record<string, number> = {};
const imei: Record<string, string> = {};

const op = (metodo: string, ruta: string, cuerpo?: unknown) => a.operacion(metodo, ruta, cuerpo);
const sql = (q: string) => e.mysql.sql('Next', q).trim();
const posicion = (im: string, fecha: string, lat = 18.9) =>
  sql(`INSERT INTO Posiciones (Imei, Lat, Lng, FechaHora, Velocidad, Direccion) VALUES (${im}, ${lat}, -99.2, '${fecha}', 40, 90)`);
const historico = async (idInst: number, desde = '2026-10-10 00:00:00', hasta = '2026-10-10 23:59:59') =>
  ok(
    await op('GET', `/monitoreo/${idInst}/historico?fechaInicio=${encodeURIComponent(desde)}&fechaFinal=${encodeURIComponent(hasta)}`),
    `histórico ${idInst}`,
  ) as { posiciones: Array<{ imei: string; fecha: string }> };
const horas = (r: { posiciones: Array<{ imei: string; fecha: string }> }) =>
  r.posiciones.map((p) => `${p.imei === imei.A ? 'A' : 'B'} ${String(p.fecha).slice(11, 16)}`).sort();

beforeAll(async () => {
  await e.iniciar();
  a = new Actores(e);
  C = await clienteListo(e, a, 'VIG010101AA1', 4);
  s.dispA = C.inventario[0].idDispositivo;
  s.dispB = C.inventario[1].idDispositivo;
  imei.A = C.inventario[0].imei;
  imei.B = C.inventario[1].imei;

  const veh = ok(await op('POST', '/productos/vehiculos', { idCliente: C.idClienteNext, placa: 'VIG0001' }), 'vehículo');
  s.veh = Number(veh.data.id);
  const inst = ok(
    await op('POST', '/instalaciones', { idCliente: C.idClienteNext, idProducto: s.veh, idDispositivo: s.dispA, idSim: C.inventario[0].idSim }),
    'instalar',
  );
  s.inst = Number(inst.data.id);
  // Alta en Next posterior a la instalación física (como las 74 migradas).
  sql(`UPDATE Instalaciones SET VigenteDesde = '2026-10-10 12:00:00' WHERE Id = ${s.inst}`);
  for (const h of ['10:00', '11:00', '12:30', '13:00']) posicion(imei.A, `2026-10-10 ${h}:00`);
}, 240000);

afterAll(() => e.detener());

describe('Recorte por vigencia', () => {
  it('el histórico no trae lo que el equipo transmitió antes de la instalación', async () => {
    expect(horas(await historico(s.inst))).toEqual(['A 12:30', 'A 13:00']);
  });
});

describe('Fecha real de instalación', () => {
  const corregir = (id: number, vigenteDesde: string, motivo = 'Fecha del CRM') =>
    op('PATCH', `/instalaciones/${id}/vigente-desde`, { vigenteDesde, motivo });

  it('solo hacia atrás, no futura y con motivo', async () => {
    expect((await corregir(s.inst, '2026-10-10 12:30:00')).status).toBe(400);
    expect((await corregir(s.inst, '2099-01-01 00:00:00')).status).toBe(400);
    const sinMotivo = await op('PATCH', `/instalaciones/${s.inst}/vigente-desde`, { vigenteDesde: '2026-10-10 09:30:00', motivo: '  ' });
    expect(sinMotivo.status).toBe(400);
    expect((await corregir(s.inst, '2026-02-30 09:30:00')).status).toBe(400);
  });

  it('solo roles 1–4: monitoreo (5) no la corrige', async () => {
    const r = await a.monitoreo('PATCH', `/instalaciones/${s.inst}/vigente-desde`, { vigenteDesde: '2026-10-10 09:30:00', motivo: 'x' });
    expect(r.status).toBe(403);
  });

  it('al corregirla aparecen los recorridos anteriores al alta y queda la evidencia', async () => {
    const r = ok(await corregir(s.inst, '2026-10-10 09:30'), 'corregir');
    expect(r.data).toMatchObject({ vigenteDesde: '2026-10-10 09:30:00', vigenteDesdeAnterior: '2026-10-10 12:00:00' });
    expect(horas(await historico(s.inst))).toEqual(['A 10:00', 'A 11:00', 'A 12:30', 'A 13:00']);
    expect(sql(`SELECT CONCAT(Campo, '|', ValorAnterior, '|', ValorNuevo, '|', Motivo, '|', Origen) FROM CorreccionesInstalacion WHERE IdInstalacion = ${s.inst}`)).toBe(
      'VigenteDesde|2026-10-10 12:00:00|2026-10-10 09:30:00|Fecha del CRM|api',
    );
  });
});

describe('Cambio de equipo y traslapes', () => {
  it('tras el cambio, el histórico de la unidad trae cada equipo solo en su tramo', async () => {
    const cambio = ok(
      await op('PATCH', `/instalaciones/${s.inst}`, {
        idDispositivo: s.dispB,
        estatusInstalacionAnterior: 3,
        estatusDispositivoAnterior: 3,
        comentario: 'Cambio de equipo',
      }),
      'cambio',
    );
    s.instVieja = s.inst;
    s.inst = Number(cambio.data.id);
    // El cambio fue a las 14:00 (la prueba corre hoy: se fija la hora).
    sql(`UPDATE HistoricoInstalaciones SET VigenteHasta = '2026-10-10 14:00:00' WHERE IdInstalacionOriginal = ${s.instVieja}`);
    sql(`UPDATE Instalaciones SET VigenteDesde = '2026-10-10 14:00:00' WHERE Id = ${s.inst}`);
    posicion(imei.B, '2026-10-10 14:30:00');
    posicion(imei.A, '2026-10-10 15:00:00'); // A en el taller: ya no es de esta unidad
    posicion(imei.B, '2026-10-10 15:30:00');
    expect(horas(await historico(s.inst))).toEqual(['A 10:00', 'A 11:00', 'A 12:30', 'A 13:00', 'B 14:30', 'B 15:30']);
  });

  it('el reporte de distancia da un recorrido por equipo y no cuenta lo del taller', async () => {
    const r = ok(
      await op('POST', '/reportes/distancia', { idCliente: C.idClienteNext, fechaInicio: '2026-10-10 00:00:00', fechaFinal: '2026-10-10 23:59:59' }),
      'distancia',
    );
    const recorridos = (r.data ?? r).recorridos ?? r.data?.recorridos ?? r.recorridos;
    const resumen = (recorridos as Array<{ imei: string; total: number }>).map((x) => `${x.imei === imei.A ? 'A' : 'B'}:${x.total}`).sort();
    expect(resumen).toEqual(['A:4', 'B:2']);
  });

  it('el equipo que salió, instalado en otro vehículo, no puede llevar su fecha a su periodo anterior', async () => {
    ok(await op('PATCH', `/dispositivos/estatus/${s.dispA}`, { estatus: 1 }), 'revisado');
    const veh2 = ok(await op('POST', '/productos/vehiculos', { idCliente: C.idClienteNext, placa: 'VIG0002' }), 'vehículo 2');
    const inst2 = ok(
      await op('POST', '/instalaciones', { idCliente: C.idClienteNext, idProducto: Number(veh2.data.id), idDispositivo: s.dispA, idSim: C.inventario[2].idSim }),
      'instalar 2',
    );
    s.inst2 = Number(inst2.data.id);
    sql(`UPDATE Instalaciones SET VigenteDesde = '2026-10-11 12:00:00' WHERE Id = ${s.inst2}`);

    const traslape = await op('PATCH', `/instalaciones/${s.inst2}/vigente-desde`, { vigenteDesde: '2026-10-10 13:00:00', motivo: 'x' });
    expect(traslape.status).toBe(400);
    expect(JSON.stringify(traslape.body)).toContain('Se traslapa con otro periodo del dispositivo');
    ok(await op('PATCH', `/instalaciones/${s.inst2}/vigente-desde`, { vigenteDesde: '2026-10-10 16:00:00', motivo: 'Fecha del CRM' }), 'corregir 2');
    expect(horas(await historico(s.inst2))).toEqual([]);
  });

  it('la última posición de otra vigencia no se muestra en monitoreo', async () => {
    // La última de A (15:00) es del taller, anterior a la instalación 2 (16:00).
    sql(
      `INSERT INTO UltimaPosicion (Imei, Lat, Lng, FechaHora, Velocidad, Direccion) VALUES (${imei.A}, 18.9, -99.2, '2026-10-10 15:00:00', 0, 0)
       ON DUPLICATE KEY UPDATE FechaHora = '2026-10-10 15:00:00'`,
    );
    const lista = ok(await op('GET', '/monitoreo/list'), 'monitoreo').posicion as Array<{ idInstalacion: number; fechaHora: string | null }>;
    expect(lista.find((x) => Number(x.idInstalacion) === s.inst2)?.fechaHora ?? null).toBeNull();
    posicion(imei.A, '2026-10-10 16:30:00');
    sql(`UPDATE UltimaPosicion SET FechaHora = '2026-10-10 16:30:00' WHERE Imei = ${imei.A}`);
    const despues = ok(await op('GET', '/monitoreo/list'), 'monitoreo').posicion as Array<{ idInstalacion: number; fechaHora: string | null }>;
    expect(despues.find((x) => Number(x.idInstalacion) === s.inst2)?.fechaHora).toContain('2026-10-10T16:30');
  });
});

describe('Consola e incidentes', () => {
  const idPos = (im: string, fecha: string) => Number(sql(`SELECT Id FROM Posiciones WHERE Imei = ${im} AND FechaHora = '${fecha}'`));

  it('las transmisiones del equipo solo traen las de su instalación actual', async () => {
    const r = ok(await op('POST', '/consola/transmisiones', { imei: imei.A, cantidad: 50 }), 'transmisiones');
    expect(r.data.map((x: { fechaHora: string }) => String(x.fechaHora).slice(0, 16).replace('T', ' '))).toEqual(['2026-10-10 16:30']);
  });

  it('un incidente no se levanta sobre una posición de cuando el equipo no estaba instalado', async () => {
    const taller = await op('POST', '/incidentes', { tipoOrigen: 1, idPosicion: idPos(imei.A, '2026-10-10 15:00:00') });
    expect(taller.status).toBe(400);
    expect(JSON.stringify(taller.body)).toContain('no estaba instalado');
    const enRuta = await op('POST', '/incidentes', { tipoOrigen: 1, idPosicion: idPos(imei.A, '2026-10-10 12:30:00') });
    expect(enRuta.status).toBeLessThan(300);
  });
});

describe('Saneamiento (deploy/sql/SaneamientoFaseD.sql)', () => {
  const script = join(__dirname, '../../deploy/sql/SaneamientoFaseD.sql');

  it('lleva a la primera posición solo las instalaciones sin otro periodo del equipo; es idempotente', async () => {
    const eq = C.inventario[3];
    const veh = ok(await op('POST', '/productos/vehiculos', { idCliente: C.idClienteNext, placa: 'VIG0003' }), 'vehículo 3');
    const inst = ok(
      await op('POST', '/instalaciones', { idCliente: C.idClienteNext, idProducto: Number(veh.data.id), idDispositivo: eq.idDispositivo, idSim: eq.idSim }),
      'instalar 3',
    );
    const id = Number(inst.data.id);
    sql(`UPDATE Instalaciones SET VigenteDesde = '2026-10-12 12:00:00' WHERE Id = ${id}`);
    posicion(eq.imei, '2026-10-12 11:50:00');
    posicion(eq.imei, '2026-10-12 12:10:00');

    // Baja anterior al motor: inactiva sin baja archivada (la fila se dio de baja el 13/10).
    const veh4 = ok(await op('POST', '/productos/vehiculos', { idCliente: C.idClienteNext, placa: 'VIG0004' }), 'vehículo 4');
    const eq4 = e.inventarioNext(C.idClienteNext, 1)[0];
    const inst4 = ok(
      await op('POST', '/instalaciones', { idCliente: C.idClienteNext, idProducto: Number(veh4.data.id), idDispositivo: eq4.idDispositivo, idSim: eq4.idSim }),
      'instalar 4',
    );
    s.legado = Number(inst4.data.id);
    s.vehLegado = Number(veh4.data.id);
    s.dispLegado = eq4.idDispositivo;
    s.simLegado = eq4.idSim;
    imei.legado = eq4.imei;
    sql(
      `UPDATE Instalaciones SET VigenteDesde = '2026-10-12 08:00:00', Estatus = 0, EstatusInstalacion = 0, FechaActualizacion = '2026-10-13 08:00:00' WHERE Id = ${s.legado}`,
    );
    posicion(eq4.imei, '2026-10-12 09:00:00');
    posicion(eq4.imei, '2026-10-14 09:00:00'); // ya dada de baja

    e.mysql.archivo('Next', script);
    e.mysql.archivo('Next', script);

    const desde = (i: number) => sql(`SELECT DATE_FORMAT(VigenteDesde, '%Y-%m-%d %H:%i') FROM Instalaciones WHERE Id = ${i}`);
    expect(desde(id)).toBe('2026-10-12 11:50');
    // El equipo A ya estuvo en otra instalación: su fecha no la toca el script.
    expect(desde(s.inst2)).toBe('2026-10-10 16:00');
    expect(sql(`SELECT CONCAT(COUNT(*), '|', MAX(Origen)) FROM CorreccionesInstalacion WHERE IdInstalacion = ${id}`)).toBe('1|sistema');
  });
});

describe('Baja anterior al motor', () => {
  it('el saneamiento archiva su periodo: lo transmitido después de la baja no es del cliente', async () => {
    expect(sql(`SELECT CONCAT(COUNT(*), '|', MAX(DATE_FORMAT(VigenteHasta, '%Y-%m-%d %H:%i'))) FROM HistoricoInstalaciones WHERE IdInstalacionOriginal = ${s.legado} AND Accion = 'Baja'`)).toBe(
      '1|2026-10-13 08:00',
    );
    // Dada de baja no tiene histórico de monitoreo; el reporte del cliente sí la incluye.
    const r = ok(
      await op('POST', '/reportes/distancia', { idCliente: C.idClienteNext, fechaInicio: '2026-10-12 00:00:00', fechaFinal: '2026-10-15 00:00:00' }),
      'distancia',
    );
    const recorridos = ((r.data ?? r).recorridos ?? r.recorridos) as Array<{ imei: string; total: number }>;
    expect(recorridos.find((x) => x.imei === imei.legado)?.total).toBe(1);
  });

  it('al reactivarla abre una versión nueva: el hueco de la baja no se ve', async () => {
    sql(`UPDATE Productos SET Estatus = 1 WHERE Id = ${s.vehLegado}; UPDATE Dispositivos SET Estatus = 1 WHERE Id = ${s.dispLegado}; UPDATE Sims SET Estatus = 1 WHERE Id = ${s.simLegado}`);
    ok(await op('PATCH', `/instalaciones/estatus/${s.legado}`, { estatusInstalacion: 1 }), 'reactivar');
    const r = await historico(s.legado, '2026-10-12 00:00:00', '2026-10-15 00:00:00');
    expect(r.posiciones.map((p) => String(p.fecha).slice(0, 16))).toEqual(['2026-10-12T09:00']);
  });
});
