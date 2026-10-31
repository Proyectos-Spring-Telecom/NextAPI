import { Actores, ok } from './actores';
import { clienteListo } from './comunes';
import { Entorno } from './entorno';

/**
 * Motor de activos, fase E (docs/motor-activos.md §7b): vigilancia de
 * transmisión. El scheduler está apagado en la batería
 * (VIGILANCIA_TRANSMISION_ENABLED=false); se evalúa con el endpoint manual.
 *
 * Unidades (todas instaladas hace 3 días, SIM de Telcel salvo la del reloj):
 *   A, D, E: GPS sin transmitir desde hace 20, 15 y 14 h → aviso (12 h);
 *   R: reloj sin transmitir desde hace 20 h → sin aviso (24 h);
 *   N: GPS que nunca ha transmitido → "sin primera transmisión";
 *   V: GPS que transmitió hace 1 h → sin aviso.
 */
const e = new Entorno();
let a: Actores;
let C: Awaited<ReturnType<typeof clienteListo>>;
const SA = { id: 81, rol: 1 };
const CLIENTE = { id: 82, rol: 6 };
let tokSa: string;
let tokCliente: string;
const inst: Record<string, number> = {};
const imei: Record<string, string> = {};

const op = (metodo: string, ruta: string, cuerpo?: unknown) => a.operacion(metodo, ruta, cuerpo);
const sa = (metodo: string, ruta: string, cuerpo?: unknown) => e.llamar(e.nextUrl, metodo, ruta, tokSa, cuerpo);
const sql = (q: string) => e.mysql.sql('Next', q).trim();
const transmitio = (im: string, horasAtras: number) =>
  sql(
    `INSERT INTO UltimaPosicion (Imei, Lat, Lng, FechaHora, Velocidad, Direccion, FHRegistro)
       VALUES (${im}, 18.9, -99.2, NOW() - INTERVAL ${horasAtras} HOUR, 0, 0, NOW() - INTERVAL ${horasAtras} HOUR)
     ON DUPLICATE KEY UPDATE FechaHora = VALUES(FechaHora), FHRegistro = VALUES(FHRegistro)`,
  );
const avisos = async (q = '') => ok(await op('GET', `/vigilancia-transmision/avisos${q}`), 'avisos') as { data: any[]; porProveedor: any[] };

beforeAll(async () => {
  await e.iniciar();
  a = new Actores(e);
  C = await clienteListo(e, a, 'VTX010101AA1', 6);
  e.mysql.sql(
    'Next',
    `INSERT INTO Usuarios (Id, UserName, PasswordHash, EmailConfirmado, Nombre, IdRol, IdCliente, Estatus) VALUES
      (${SA.id}, 'sa-vtx@e2e.local', 'x', 1, 'Super admin', 1, ${C.idClienteNext}, 1),
      (${CLIENTE.id}, 'cli-vtx@e2e.local', 'x', 1, 'Cliente', 6, ${C.idClienteNext}, 1)`,
  );
  // El catálogo sembrado no trae el tipo reloj (7), que en producción sí existe.
  sql(`INSERT IGNORE INTO CatTipoDispositivo (Id, Codigo, Nombre, Estatus) VALUES (7, 'RELOJ INTELIGENTE', 'Reloj inteligente', 1)`);
  tokSa = e.tokenNext(SA, C.idClienteNext);
  tokCliente = e.tokenNext(CLIENTE, C.idClienteNext);

  const unidades = ['A', 'D', 'E', 'R', 'N', 'V'];
  for (const [i, u] of unidades.entries()) {
    const eq = C.inventario[i];
    imei[u] = eq.imei;
    if (u === 'R') sql(`UPDATE Dispositivos SET IdTipoDispositivo = 7 WHERE Id = ${eq.idDispositivo}`);
    const veh = ok(await op('POST', '/productos/vehiculos', { idCliente: C.idClienteNext, placa: `VTX000${i}` }), `vehículo ${u}`);
    const r = ok(
      await op('POST', '/instalaciones', { idCliente: C.idClienteNext, idProducto: Number(veh.data.id), idDispositivo: eq.idDispositivo, idSim: eq.idSim }),
      `instalar ${u}`,
    );
    inst[u] = Number(r.data.id);
    sql(`UPDATE Instalaciones SET VigenteDesde = NOW() - INTERVAL 3 DAY WHERE Id = ${inst[u]}`);
    sql(`UPDATE Sims SET IdTelefonia = 1 WHERE Id = ${eq.idSim}`);
  }
  transmitio(imei.A, 20);
  transmitio(imei.D, 15);
  transmitio(imei.E, 14);
  transmitio(imei.R, 20);
  transmitio(imei.V, 1);
}, 240000);

afterAll(() => e.detener());

describe('Evaluación diaria', () => {
  it('solo SA/Dev la corren a mano; el cliente no ve la bandeja', async () => {
    expect((await op('POST', '/vigilancia-transmision/evaluar')).status).toBe(403); // rol 3
    expect((await e.llamar(e.nextUrl, 'GET', '/vigilancia-transmision/avisos', tokCliente)).status).toBe(403);
  });

  it('avisa a los equipos pasados de su umbral; el reloj tiene 24 h', async () => {
    const r = ok(await sa('POST', '/vigilancia-transmision/evaluar'), 'evaluar');
    expect(r.data).toMatchObject({ avisos: 3, nuevos: 3, sinPrimeraTransmision: 1 });
    const b = await avisos();
    expect(b.data.map((x) => x.idInstalacion).sort()).toEqual([inst.A, inst.D, inst.E].sort());
    const avisoA = b.data.find((x) => x.idInstalacion === inst.A);
    expect(avisoA).toMatchObject({ estatus: 'abierto', horasSinTransmitir: 20, telefonia: 'Telcel', imei: imei.A, placa: 'VTX0000' });
  });

  it('tres SIM de la misma compañía en la misma evaluación: posible falla del proveedor', async () => {
    const b = await avisos();
    expect(b.data.every((x) => x.posibleFallaProveedor)).toBe(true);
    expect(b.porProveedor).toEqual([expect.objectContaining({ idTelefonia: 1, telefonia: 'Telcel', avisos: 3, posibleFallaProveedor: true })]);
  });

  it('el que nunca transmitió va a su lista y no genera aviso', async () => {
    const r = ok(await op('GET', '/vigilancia-transmision/sin-primera-transmision'), 'sin primera');
    expect(r.data.map((x: { idInstalacion: number }) => x.idInstalacion)).toEqual([inst.N]);
  });

  it('una segunda evaluación el mismo día → 409; con forzar se repite sin duplicar avisos', async () => {
    expect((await sa('POST', '/vigilancia-transmision/evaluar')).status).toBe(409);
    const r = ok(await sa('POST', '/vigilancia-transmision/evaluar', { forzar: true }), 'forzar');
    expect(r.data).toMatchObject({ avisos: 3, nuevos: 0 });
    expect((await avisos()).data).toHaveLength(3);
  });

  it('una evaluación del día que no terminó (falla o reinicio) se retoma pasados 15 min', async () => {
    sql(`UPDATE EvaluacionesTransmision SET Fin = NULL, Inicio = NOW() - INTERVAL 5 MINUTE`);
    expect((await sa('POST', '/vigilancia-transmision/evaluar')).status).toBe(409); // otra instancia puede seguir en ella
    sql(`UPDATE EvaluacionesTransmision SET Fin = NULL, Inicio = NOW() - INTERVAL 20 MINUTE`);
    ok(await sa('POST', '/vigilancia-transmision/evaluar'), 'retomar');
    expect((await sa('POST', '/vigilancia-transmision/evaluar')).status).toBe(409);
  });
});

describe('Atención y cierre', () => {
  const idAviso = async (u: string) => (await avisos('?estatus=abierto')).data.find((x) => x.idInstalacion === inst[u])?.id as number;

  it('monitoreo registra "taller" con fecha de regreso futura y la vigilancia se pausa', async () => {
    const id = await idAviso('A');
    expect((await a.monitoreo('PATCH', `/vigilancia-transmision/avisos/${id}/atender`, { resultado: 'taller' })).status).toBe(400);
    expect((await a.monitoreo('PATCH', `/vigilancia-transmision/avisos/${id}/atender`, { resultado: 'taller', fechaRegreso: '2000-01-01 00:00:00' })).status).toBe(400);
    ok(await a.monitoreo('PATCH', `/vigilancia-transmision/avisos/${id}/atender`, { resultado: 'taller', fechaRegreso: '2099-01-01 09:00:00', comentario: 'Unidad en servicio' }), 'atender');
    const r = ok(await sa('POST', '/vigilancia-transmision/evaluar', { forzar: true }), 'forzar');
    expect(r.data).toMatchObject({ avisos: 2, pausadas: 1 });
    expect((await avisos('?estatus=atendido')).data[0]).toMatchObject({ id, resultado: 'taller', fechaRegreso: '2099-01-01 09:00:00', idUsuarioAtiende: 15 });
  });

  it('pasada la fecha de regreso del taller, si sigue sin transmitir vuelve a abierto', async () => {
    const id = (await avisos('?estatus=atendido')).data.find((x) => x.idInstalacion === inst.A)?.id;
    sql(`UPDATE AvisosSinTransmision SET FechaRegreso = NOW() - INTERVAL 1 HOUR WHERE Id = ${id}`);
    ok(await sa('POST', '/vigilancia-transmision/evaluar', { forzar: true }), 'forzar');
    expect((await avisos('?estatus=abierto')).data.find((x) => x.id === id)).toMatchObject({ resultado: null, fechaRegreso: null });
  });

  it('si vuelve a transmitir, el aviso se cierra solo', async () => {
    transmitio(imei.D, 0);
    ok(await sa('POST', '/vigilancia-transmision/evaluar', { forzar: true }), 'forzar');
    const cerrados = (await avisos('?estatus=cerrado')).data;
    expect(cerrados).toEqual([expect.objectContaining({ idInstalacion: inst.D, motivoCierre: 'transmitio' })]);
  });

  it('dar de baja la instalación cierra su aviso', async () => {
    ok(await op('PATCH', `/instalaciones/estatus/${inst.E}`, { estatusInstalacion: 0 }), 'baja');
    ok(await sa('POST', '/vigilancia-transmision/evaluar', { forzar: true }), 'forzar');
    const cerrado = (await avisos('?estatus=cerrado')).data.find((x) => x.idInstalacion === inst.E);
    expect(cerrado).toMatchObject({ motivoCierre: 'baja' });
    expect((await a.monitoreo('PATCH', `/vigilancia-transmision/avisos/${cerrado.id}/atender`, { resultado: 'otro' })).status).toBe(400);
  });
});
