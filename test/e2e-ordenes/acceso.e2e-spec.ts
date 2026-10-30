import { Actores, ok } from './actores';
import { clienteListo } from './comunes';
import { Entorno, NEXT } from './entorno';

/**
 * Quién ve qué (docs/diagnostico-modelo.md §3–§4). Cada prueba reproduce una
 * fuga encontrada en el diagnóstico del 30/10/2026 (F1–F5).
 *
 * Organización de prueba:
 *   Cliente A ── Cliente A1 (hijo)
 *   Cliente B
 * Usuarios: U6A (rol 6 de A: ve A y A1), U7A (rol 7 de A: solo la instalación
 * asignada), U9B (rol 9 de B: solo lo suyo asignado).
 */
const e = new Entorno();
let a: Actores;
let A: Awaited<ReturnType<typeof clienteListo>>;
let A1: Awaited<ReturnType<typeof clienteListo>>;
let B: Awaited<ReturnType<typeof clienteListo>>;
const U6A = { id: 70, rol: 6 };
const U7A = { id: 71, rol: 7 };
const U9B = { id: 72, rol: 9 };
const tok = {} as Record<'u6a' | 'u7a' | 'u9b', string>;
let instA: number; // asignada a U7A
let instA2: number; // del mismo cliente A, no asignada a U7A
let instB: number;
let dispLibreA: number;

const como = (token: string, metodo: string, ruta: string, cuerpo?: unknown) => e.llamar(e.nextUrl, metodo, ruta, token, cuerpo);

async function instalar(c: typeof A, i: number, placa: string): Promise<number> {
  const veh = ok(await a.operacion('POST', '/productos/vehiculos', { idCliente: c.idClienteNext, placa }), 'vehículo');
  const eq = c.inventario[i];
  const r = ok(
    await a.operacion('POST', '/instalaciones', { idCliente: c.idClienteNext, idProducto: Number(veh.data.id), idDispositivo: eq.idDispositivo, idSim: eq.idSim }),
    'instalación',
  );
  // Una posición del equipo, para que el histórico tenga qué mostrar.
  e.mysql.sql('Next', `INSERT INTO Posiciones (Imei, Lat, Lng, Estado, FechaHora, Velocidad, Direccion) VALUES (${eq.imei}, 18.95, -99.23, 0, NOW() - INTERVAL 5 MINUTE, 0, 0)`);
  return Number(r.data?.id ?? r.id);
}

beforeAll(async () => {
  await e.iniciar();
  a = new Actores(e);
  A = await clienteListo(e, a, 'ACA010101AA1', 4);
  A1 = await clienteListo(e, a, 'ACB010101AA1', 2);
  B = await clienteListo(e, a, 'ACC010101AA1', 3);
  e.mysql.sql('Next', `UPDATE Clientes SET IdPadre = ${A.idClienteNext} WHERE Id = ${A1.idClienteNext}`);
  e.mysql.sql(
    'Next',
    `INSERT INTO Usuarios (Id, UserName, PasswordHash, EmailConfirmado, Nombre, IdRol, IdCliente, Estatus) VALUES
      (${U6A.id}, 'u6a@e2e.local', 'x', 1, 'Cliente A', 6, ${A.idClienteNext}, 1),
      (${U7A.id}, 'u7a@e2e.local', 'x', 1, 'Operador A', 7, ${A.idClienteNext}, 1),
      (${U9B.id}, 'u9b@e2e.local', 'x', 1, 'Usuario B', 9, ${B.idClienteNext}, 1)`,
  );
  tok.u6a = e.tokenNext(U6A, A.idClienteNext);
  tok.u7a = e.tokenNext(U7A, A.idClienteNext);
  tok.u9b = e.tokenNext(U9B, B.idClienteNext);
  instA = await instalar(A, 0, 'ACC0001');
  instA2 = await instalar(A, 1, 'ACC0002');
  instB = await instalar(B, 0, 'ACC0003');
  dispLibreA = A.inventario[3].idDispositivo;
  e.mysql.sql('Next', `INSERT INTO UsuariosInstalaciones (IdUsuario, IdInstalacion, Estatus) VALUES (${U7A.id}, ${instA}, 1), (${U9B.id}, ${instB}, 1)`);
}, 240000);

afterAll(() => e.detener());

const historico = (token: string, id: number) =>
  como(token, 'GET', `/monitoreo/${id}/historico?fechaInicio=2000-01-01 00:00:00&fechaFinal=2100-01-01 00:00:00`);

describe('F1 clientes: sin escalada por el cliente padre', () => {
  it('un rol 6 no ve ni edita un cliente fuera de su árbol (404)', async () => {
    expect((await como(tok.u6a, 'GET', `/clientes/${B.idClienteNext}`)).status).toBe(404);
    expect((await como(tok.u6a, 'PATCH', `/clientes/${B.idClienteNext}`, { nombre: 'Tomado' })).status).toBe(404);
    expect((await como(tok.u6a, 'GET', `/clientes/${A1.idClienteNext}`)).status).toBe(200);
  });

  it('nadie fuera de administración cambia el padre; administración no puede crear un ciclo', async () => {
    expect((await como(tok.u6a, 'PATCH', `/clientes/${A.idClienteNext}`, { idPadre: B.idClienteNext })).status).toBe(403);
    expect((await a.operacion('PATCH', `/clientes/${A.idClienteNext}`, { idPadre: A1.idClienteNext })).status).toBe(403);
    expect((await a.operacion('PATCH', `/clientes/${A.idClienteNext}`, { idPadre: A.idClienteNext })).status).toBe(403);
    const padreB = e.consulta('Next', `SELECT IFNULL(IdPadre, 0) FROM Clientes WHERE Id = ${B.idClienteNext}`)[0][0];
    expect(Number(padreB)).not.toBe(A.idClienteNext);
  });
});

describe('F2 histórico de posiciones', () => {
  it('otro cliente no ve el recorrido (404)', async () => {
    expect((await historico(tok.u9b, instA)).status).toBe(404);
  });

  it('el rol 7 solo ve la instalación asignada; el rol 6 ve todo su árbol', async () => {
    expect((await historico(tok.u7a, instA)).status).toBe(200);
    expect((await historico(tok.u7a, instA2)).status).toBe(404);
    expect((await historico(tok.u6a, instA2)).status).toBe(200);
    expect((await historico(tok.u9b, instB)).status).toBe(200);
  });
});

describe('F3 foto y video a demanda', () => {
  it('no se piden sobre una instalación ajena (404 antes de tocar la cámara)', async () => {
    expect((await como(tok.u9b, 'POST', `/monitoreo/${instA}/foto`, {})).status).toBe(404);
    expect((await como(tok.u9b, 'POST', `/monitoreo/${instA}/video`, {})).status).toBe(404);
  });
});

describe('F4 dispositivos y estatus', () => {
  it('el detalle de un dispositivo ajeno es 404', async () => {
    expect((await como(tok.u9b, 'GET', `/dispositivos/${dispLibreA}`)).status).toBe(404);
  });

  it('no se cambia el estatus de un recurso ajeno, y "asignado" (2) solo lo pone una instalación', async () => {
    expect((await como(tok.u9b, 'PATCH', `/dispositivos/estatus/${dispLibreA}`, { estatus: 5 })).status).toBe(404);
    expect((await como(tok.u9b, 'PATCH', `/sims/estatus/${A.inventario[3].idSim}`, { estatus: 5 })).status).toBe(404);
    expect((await a.operacion('PATCH', `/dispositivos/estatus/${dispLibreA}`, { estatus: 2 })).status).toBe(400);
    expect(Number(e.consulta('Next', `SELECT Estatus FROM Dispositivos WHERE Id = ${dispLibreA}`)[0][0])).toBe(1);
  });
});

describe('F5 reportes: el rol 7/9 solo ve sus unidades asignadas', () => {
  const posiciones = (token: string, idCliente: number) =>
    como(token, 'POST', '/reportes/posiciones', { idCliente, fechaInicio: '2000-01-01 00:00:00', fechaFinal: '2100-01-01 00:00:00' });

  it('el operador de A ve solo las posiciones de su instalación asignada; el rol 6 las de todo el cliente', async () => {
    const operador = ok(await posiciones(tok.u7a, A.idClienteNext), 'reporte rol 7').data;
    const cliente = ok(await posiciones(tok.u6a, A.idClienteNext), 'reporte rol 6').data;
    expect(operador.total).toBe(1);
    expect(cliente.total).toBe(2);
  });

  it('otro cliente no puede pedir el reporte de A', async () => {
    const r = await posiciones(tok.u9b, A.idClienteNext);
    expect([403, 404]).toContain(r.status);
  });
});

describe('C1 usuarios: sin escalada de rol', () => {
  let n = 0;
  const alta = (token: string, idRol: number, idCliente: number) =>
    como(token, 'POST', '/usuarios', {
      userName: `nuevo${++n}@e2e.local`,
      passwordHash: 'Clave.123',
      nombre: 'Nuevo',
      apellidoPaterno: 'Usuario',
      idRol,
      idCliente,
      permisosIds: [],
    });

  it('un operador (7) o monitoreo (5) no crea usuarios; nadie crea un rol más alto que el suyo', async () => {
    expect((await alta(tok.u7a, 1, A.idClienteNext)).status).toBe(403);
    expect((await alta(a.tokenMonitoreo, 1, A.idClienteNext)).status).toBe(403);
    expect((await alta(a.tokenOperacion, 1, A.idClienteNext)).status).toBe(403); // admin (3) no crea SA
    expect(Number(e.consulta('Next', "SELECT COUNT(*) FROM Usuarios WHERE UserName LIKE 'nuevo%' AND IdRol < 3")[0][0])).toBe(0);
  });

  it('el cliente (6) solo crea usuarios 9 dentro de su árbol', async () => {
    expect((await alta(tok.u6a, 9, B.idClienteNext)).status).toBe(403);
    const r = ok(await alta(tok.u6a, 1, A1.idClienteNext), 'alta por rol 6');
    const id = Number(r.data?.id ?? r.id);
    expect(Number(e.consulta('Next', `SELECT IdRol FROM Usuarios WHERE Id = ${id}`)[0][0])).toBe(9);
  });

  it('nadie se sube el rol a sí mismo ni edita usuarios fuera de su alcance', async () => {
    expect((await como(tok.u7a, 'PATCH', `/usuarios/${U7A.id}`, { idRol: 1 })).status).toBe(403);
    expect(Number(e.consulta('Next', `SELECT IdRol FROM Usuarios WHERE Id = ${U7A.id}`)[0][0])).toBe(7);
    expect([403, 404]).toContain((await como(tok.u6a, 'PATCH', `/usuarios/${U9B.id}`, { nombre: 'Otro' })).status);
  });
});

describe('C2–C5 inventario: alcance en detalle, edición y alta', () => {
  let vehA1: number;
  beforeAll(async () => {
    vehA1 = Number(ok(await a.operacion('POST', '/productos/vehiculos', { idCliente: A1.idClienteNext, placa: 'ACCH001' }), 'vehículo de A1').data.id);
  });

  it('detalle de vehículo, reloj y SIM ajenos → 404', async () => {
    expect((await como(tok.u9b, 'GET', `/productos/vehiculos/${vehA1}`)).status).toBe(404);
    expect((await como(tok.u9b, 'GET', `/sims/${A.inventario[3].idSim}`)).status).toBe(404);
  });

  it('nadie edita un vehículo ajeno; el cliente padre sí edita el de su hijo', async () => {
    expect((await como(tok.u9b, 'PATCH', `/productos/vehiculos/${vehA1}`, { numeroEconomico: 'X' })).status).toBe(404);
    ok(await como(tok.u6a, 'PATCH', `/productos/vehiculos/${vehA1}`, { numeroEconomico: 'ECO-H1' }), 'rol 6 edita a su hijo');
    ok(await a.operacion('PATCH', `/productos/vehiculos/${vehA1}`, { color: 'Rojo' }), 'administración edita');
  });

  it('no se da de alta inventario en un cliente fuera del alcance (403)', async () => {
    expect((await como(tok.u9b, 'POST', '/productos/vehiculos', { idCliente: A.idClienteNext, placa: 'ACCX999' })).status).toBe(403);
    expect((await como(tok.u6a, 'POST', '/productos/vehiculos', { idCliente: B.idClienteNext, placa: 'ACCX998' })).status).toBe(403);
  });

  it('la jerarquía de un cliente ajeno no se lista', async () => {
    expect((await como(tok.u9b, 'GET', `/clientes/list/${A.idClienteNext}`)).status).toBe(404);
  });
});

describe('Sin cambios para quien sí debe ver', () => {
  it('administración y monitoreo siguen viendo todo', async () => {
    expect((await historico(a.tokenOperacion, instB)).status).toBe(200);
    expect((await historico(a.tokenMonitoreo, instA)).status).toBe(200);
    expect((await a.operacion('GET', `/clientes/${B.idClienteNext}`)).status).toBe(200);
    void NEXT;
  });
});
