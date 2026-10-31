import { Actores, ok } from './actores';
import { clienteListo } from './comunes';
import { Entorno } from './entorno';

/**
 * Motor de activos, fase F (docs/motor-activos.md §8.5): parámetros de la
 * TrackCam por el canal de comandos. RabbitMQ está apagado en la batería: los
 * comandos se quedan pendientes y las confirmaciones del gateway se entregan
 * directo al consumidor.
 */
const e = new Entorno();
let a: Actores;
let C: Awaited<ReturnType<typeof clienteListo>>;
const s: Record<string, number> = {};
let serie = '';

const op = (metodo: string, ruta: string, cuerpo?: unknown) => a.operacion(metodo, ruta, cuerpo);
const sql = (q: string) => e.mysql.sql('Next', q).trim();
const acks = () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ComandosAcksConsumer } = require('src/messaging/comandos/comandos-acks.consumer');
  return e.servicioNext(ComandosAcksConsumer) as { aplicar: (b: Record<string, unknown>) => Promise<string> };
};
const ack = (idComando: number, estado: string, extra: Record<string, unknown> = {}) =>
  acks().aplicar({ kind: 'command_ack', protocol: 'jt808', idComando, estado, deviceId: serie, at: new Date().toISOString(), ...extra });
const parametros = async () => ok(await op('GET', `/instalaciones/${s.inst}/trackcam/parametros`), 'parámetros').data;
const param = (d: { parametros: Array<{ nombre: string }> }, nombre: string) => d.parametros.find((p) => p.nombre === nombre);

beforeAll(async () => {
  await e.iniciar();
  a = new Actores(e);
  C = await clienteListo(e, a, 'TCC010101AA1', 2);
  sql(`INSERT IGNORE INTO CatTipoDispositivo (Id, Codigo, Nombre, Estatus, Clase) VALUES (5, 'TRACKCAM', 'TrackCam', 1, 'TRACKCAM')`);
  sql(`UPDATE CatTipoDispositivo SET Clase = 'TRACKCAM' WHERE Id = 5`);
  s.cam = C.inventario[0].idDispositivo;
  sql(`UPDATE Dispositivos SET IdTipoDispositivo = 5 WHERE Id = ${s.cam}`);
  serie = sql(`SELECT NumeroSerie FROM Dispositivos WHERE Id = ${s.cam}`);
  const veh = Number(ok(await op('POST', '/productos/vehiculos', { idCliente: C.idClienteNext, placa: 'TCC0001' }), 'vehículo').data.id);
  s.inst = Number(ok(await op('POST', '/instalaciones', { idCliente: C.idClienteNext, idProducto: veh, idDispositivo: s.cam }), 'instalar').data.id);
  // Una instalación que no es TrackCam, para el 400.
  const veh2 = Number(ok(await op('POST', '/productos/vehiculos', { idCliente: C.idClienteNext, placa: 'TCC0002' }), 'vehículo 2').data.id);
  s.gps = Number(ok(await op('POST', '/instalaciones', { idCliente: C.idClienteNext, idProducto: veh2, idDispositivo: C.inventario[1].idDispositivo }), 'gps').data.id);
}, 240000);

afterAll(() => e.detener());

describe('Parámetros de la TrackCam', () => {
  it('sin lecturas: el catálogo viene vacío de valores', async () => {
    const d = await parametros();
    expect(d.fechaLectura).toBeNull();
    expect(param(d, 'intervaloReporteSegundos')).toMatchObject({ id: '0x0029', min: 5, max: 3600, deseado: null, leido: null, pendiente: false });
  });

  it('PUT guarda lo deseado y arma un solo PARAMS; queda pendiente hasta que la cámara lo confirme', async () => {
    const r = ok(await op('PUT', `/instalaciones/${s.inst}/trackcam/parametros`, { velocidadMaximaKmh: 100, intervaloReporteSegundos: 30 }), 'PUT');
    expect(r.data.comandos).toHaveLength(1);
    s.cmd = r.data.comandos[0];
    expect(sql(`SELECT CONCAT(Protocolo, '|', Tipo, '|', Contenido, '|', Estatus) FROM ComandosDispositivo WHERE Id = ${s.cmd}`)).toBe(
      'jt808|PARAMS|PARAMS,0029=30,0055=100|pendiente',
    );
    const d = await parametros();
    expect(param(d, 'velocidadMaximaKmh')).toMatchObject({ deseado: 100, leido: null, pendiente: true });
    // Un segundo cambio conserva lo anterior.
    ok(await op('PUT', `/instalaciones/${s.inst}/trackcam/parametros`, { intervaloReposoSegundos: 900 }), 'PUT 2');
    expect(JSON.parse(sql(`SELECT Deseado FROM ParametrosTrackCam WHERE IdDispositivo = ${s.cam}`))).toEqual({
      '0x0029': 30,
      '0x0055': 100,
      '0x0027': 900,
    });
  });

  it('la confirmación del gateway trae la lectura: Resultado y Leido', async () => {
    expect(await ack(s.cmd, 'enviado')).toBe('aplicado');
    const leido = { '0x0029': 30, '0x0055': 100, '0x0027': 600, '0x0001': 30 };
    expect(await ack(s.cmd, 'confirmado', { resultado: { parametros: leido, leidoAt: '2026-10-31T06:00:00.000Z' } })).toBe('aplicado');
    expect(sql(`SELECT JSON_EXTRACT(Resultado, '$.parametros."0x0029"') FROM ComandosDispositivo WHERE Id = ${s.cmd}`)).toBe('30');
    const d = await parametros();
    expect(d.fechaLectura).toBe('2026-10-31 00:00:00');
    expect(param(d, 'velocidadMaximaKmh')).toMatchObject({ deseado: 100, leido: 100, pendiente: false });
    // Lo pedido en el segundo PUT aún no llega a la cámara.
    expect(param(d, 'intervaloReposoSegundos')).toMatchObject({ deseado: 900, leido: 600, pendiente: true });
    const lista = ok(await op('GET', `/instalaciones/${s.inst}/trackcam/comandos`), 'comandos').data;
    expect(lista.find((c: { id: number }) => c.id === s.cmd)).toMatchObject({ estatus: 'confirmado', tipo: 'PARAMS', resultado: { parametros: leido } });
  });

  it('una lectura más vieja no pisa la más nueva; un ack de otro equipo se ignora', async () => {
    const r = ok(await op('POST', `/instalaciones/${s.inst}/trackcam/parametros/leer`), 'leer');
    const id = r.data.comandos[0];
    expect(sql(`SELECT Contenido FROM ComandosDispositivo WHERE Id = ${id}`)).toBe('LEERPARAMS');
    expect(await ack(id, 'enviado', { deviceId: 'OTRA-CAMARA' })).toBe('ignorado');
    expect(await ack(id, 'enviado')).toBe('aplicado');
    expect(await ack(id, 'confirmado', { resultado: { parametros: { '0x0029': 999 }, leidoAt: '2026-10-30T06:00:00.000Z' } })).toBe('aplicado');
    const d = await parametros();
    expect(d.fechaLectura).toBe('2026-10-31 00:00:00');
    expect(param(d, 'intervaloReporteSegundos')!).toMatchObject({ leido: 30 });
  });

  it('un PARAMS fallido trae lo que quedó en la cámara y también actualiza Leido', async () => {
    const r = ok(await op('PUT', `/instalaciones/${s.inst}/trackcam/parametros`, { anguloGiroGrados: 15 }), 'PUT ángulo');
    const id = r.data.comandos[0];
    expect(await ack(id, 'enviado')).toBe('aplicado');
    const leido = { '0x0029': 30, '0x0030': 5 };
    expect(
      await ack(id, 'fallido', {
        detalle: 'La cámara aceptó pero guardó otro valor: 0x0030=5 (se pidió 15)',
        resultado: { parametros: leido, leidoAt: '2026-10-31T07:00:00.000Z' },
      }),
    ).toBe('aplicado');
    const d = await parametros();
    expect(d.fechaLectura).toBe('2026-10-31 01:00:00');
    expect(param(d, 'anguloGiroGrados')).toMatchObject({ deseado: 15, leido: 5, pendiente: true });
    expect(sql(`SELECT Estatus FROM ComandosDispositivo WHERE Id = ${id}`)).toBe('fallido');
  });

  it('valida rangos, campos y que la instalación sea TrackCam; monitoreo (5) también', async () => {
    expect((await op('PUT', `/instalaciones/${s.inst}/trackcam/parametros`, { intervaloReporteSegundos: 1 })).status).toBe(400);
    expect((await op('PUT', `/instalaciones/${s.inst}/trackcam/parametros`, {})).status).toBe(400);
    expect((await op('GET', `/instalaciones/${s.gps}/trackcam/parametros`)).status).toBe(400);
    expect((await a.monitoreo('GET', `/instalaciones/${s.inst}/trackcam/parametros`)).status).toBe(200);
  });
});
