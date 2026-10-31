import { Actores, ok } from './actores';
import { clienteListo } from './comunes';
import { Entorno } from './entorno';

/**
 * Motor de activos, fase F (docs/motor-activos.md §8): comandos de Next al
 * reloj FA100S. RabbitMQ está apagado en la batería: los comandos se quedan
 * pendientes (Next los reintenta) y las confirmaciones del socket se entregan
 * directo al consumidor.
 */
const e = new Entorno();
let a: Actores;
let C: Awaited<ReturnType<typeof clienteListo>>;
const s: Record<string, number> = {};
let imei = '';

const op = (metodo: string, ruta: string, cuerpo?: unknown) => a.operacion(metodo, ruta, cuerpo);
const sql = (q: string) => e.mysql.sql('Next', q).trim();
const comandos = () =>
  sql(`SELECT GROUP_CONCAT(CONCAT(Tipo, '=', Contenido, '=', Estatus) ORDER BY Id SEPARATOR ';') FROM ComandosDispositivo WHERE IdDispositivo = ${s.reloj}`);
const acks = () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ComandosAcksConsumer } = require('src/messaging/comandos/comandos-acks.consumer');
  return e.servicioNext(ComandosAcksConsumer) as { aplicar: (b: Record<string, unknown>) => Promise<string> };
};

beforeAll(async () => {
  await e.iniciar();
  a = new Actores(e);
  C = await clienteListo(e, a, 'REL010101AA1', 1);
  sql(`INSERT IGNORE INTO CatTipoDispositivo (Id, Codigo, Nombre, Estatus, Clase) VALUES (7, 'RELOJ INTELIGENTE', 'Reloj inteligente', 1, 'RELOJ')`);
  sql(`UPDATE CatTipoDispositivo SET Clase = 'RELOJ' WHERE Id = 7`);
  imei = String(864000000000000 + (Date.now() % 1e9));
  const r = ok(
    await op('POST', '/dispositivos/relojes', { idCliente: C.idClienteNext, numeroSerie: imei.slice(-10), imei }),
    'alta reloj',
  );
  s.reloj = Number(r.data.id);
  s.persona = Number(ok(await op('POST', '/productos/vehiculos', { idCliente: C.idClienteNext, placa: 'REL0001' }), 'producto').data.id);
  s.inst = Number(ok(await op('POST', '/instalaciones', { idCliente: C.idClienteNext, idProducto: s.persona, idDispositivo: s.reloj }), 'instalar').data.id);
  // Una instalación que no es reloj, para el 400.
  s.gpsVeh = Number(ok(await op('POST', '/productos/vehiculos', { idCliente: C.idClienteNext, placa: 'REL0002' }), 'vehículo').data.id);
  s.gps = Number(
    ok(await op('POST', '/instalaciones', { idCliente: C.idClienteNext, idProducto: s.gpsVeh, idDispositivo: C.inventario[0].idDispositivo }), 'gps').data.id,
  );
}, 240000);

afterAll(() => e.detener());

describe('Números de emergencia', () => {
  it('se guardan en la persona y se arman los comandos SOS, CENTER y la agenda en tres bloques', async () => {
    const r = ok(
      await op('PUT', `/instalaciones/${s.inst}/reloj/numeros-emergencia`, {
        sos: ['777 123 4567', '7779876543'],
        centro: '7770001111',
        agenda: [{ nombre: 'Ana', telefono: '5551112222' }],
      }),
      'números',
    );
    expect(r.data.comandos).toHaveLength(5);
    const lista = comandos().split(';');
    expect(lista.map((c) => c.split('=')[0])).toEqual(['SOS', 'CENTER', 'PHB', 'PHB2', 'PHB3']);
    expect(lista[0]).toBe('SOS=SOS,7771234567,7779876543,=pendiente');
    expect(lista[2]).toBe('PHB=PHB,5551112222,0041006E0061=pendiente');
    // Sin RabbitMQ: quedan pendientes con el motivo.
    expect(sql(`SELECT MAX(Detalle) FROM ComandosDispositivo WHERE IdDispositivo = ${s.reloj}`)).toContain('Sin publicar');
    const guardado = ok(await op('GET', `/instalaciones/${s.inst}/reloj/numeros-emergencia`), 'leer').data;
    expect(guardado).toMatchObject({ sos: ['7771234567', '7779876543'], centro: '7770001111', agenda: [{ nombre: 'Ana', telefono: '5551112222' }] });
  });

  it('el lugar de cada SOS se conserva: un hueco se queda como hueco', async () => {
    ok(await op('PUT', `/instalaciones/${s.inst}/reloj/numeros-emergencia`, { sos: ['', '7775556666'] }), 'SOS con hueco');
    expect(ok(await op('GET', `/instalaciones/${s.inst}/reloj/numeros-emergencia`), 'leer').data.sos).toEqual(['', '7775556666']);
    expect(sql(`SELECT Contenido FROM ComandosDispositivo WHERE IdDispositivo = ${s.reloj} ORDER BY Id DESC LIMIT 1`)).toBe('SOS,,7775556666,');
  });

  it('valida teléfonos, cantidad y que la instalación sea de un reloj', async () => {
    expect((await op('PUT', `/instalaciones/${s.inst}/reloj/numeros-emergencia`, { sos: ['abc'] })).status).toBe(400);
    expect((await op('PUT', `/instalaciones/${s.inst}/reloj/numeros-emergencia`, { sos: ['1', '2', '3', '4'] })).status).toBe(400);
    expect((await op('PUT', `/instalaciones/${s.gps}/reloj/numeros-emergencia`, { sos: ['7771234567'] })).status).toBe(400);
  });
});

describe('Confirmaciones del socket', () => {
  it('avanzan el estatus y nunca lo regresan; un ack de otro equipo se ignora', async () => {
    const id = Number(sql(`SELECT MIN(Id) FROM ComandosDispositivo WHERE IdDispositivo = ${s.reloj}`));
    const ack = (estado: string, deviceId = imei) =>
      acks().aplicar({ kind: 'command_ack', protocol: 'fa100s', idComando: id, estado, deviceId, at: new Date().toISOString() });
    expect(await ack('recibido')).toBe('aplicado');
    expect(await ack('confirmado', '999999999999999')).toBe('ignorado');
    expect(await ack('enviado')).toBe('aplicado');
    expect(await ack('confirmado')).toBe('aplicado');
    expect(await ack('recibido')).toBe('ignorado');
    expect(sql(`SELECT CONCAT(Estatus, '|', FechaConfirmado IS NOT NULL) FROM ComandosDispositivo WHERE Id = ${id}`)).toBe('confirmado|1');
    const lista = ok(await op('GET', `/instalaciones/${s.inst}/reloj/comandos`), 'comandos').data;
    expect(lista.find((c: { id: number }) => c.id === id)).toMatchObject({ estatus: 'confirmado', tipo: 'SOS' });
  });
});

describe('Configuración', () => {
  it('solo lo enviado se guarda y se manda', async () => {
    const r = ok(await op('POST', `/instalaciones/${s.inst}/reloj/configuracion`, { sensibilidadCaida: 6 }), 'sensibilidad');
    expect(r.data.comandos).toHaveLength(1);
    expect(sql(`SELECT Contenido FROM ComandosDispositivo WHERE Id = ${r.data.comandos[0]}`)).toBe('LSSET,6+6');
    expect(sql(`SELECT SensibilidadCaida FROM RelojConfig WHERE IdDispositivo = ${s.reloj}`)).toBe('6');
    const caida = ok(await op('POST', `/instalaciones/${s.inst}/reloj/configuracion`, { llamadaPorCaida: false }), 'caída');
    expect(sql(`SELECT Contenido FROM ComandosDispositivo WHERE Id = ${caida.data.comandos[0]}`)).toMatch(/^FALLDOWN,[01],0$/);
    expect((await op('POST', `/instalaciones/${s.inst}/reloj/configuracion`, {})).status).toBe(400);
  });
});
