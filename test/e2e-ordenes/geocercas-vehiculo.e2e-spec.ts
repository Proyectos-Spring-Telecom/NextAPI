import { Actores, ok } from './actores';
import { clienteListo } from './comunes';
import { Entorno } from './entorno';

/**
 * Geocercas del cliente para varios vehículos (5/11/2026): la geocerca es del
 * cliente y se liga a uno o varios vehículos (`ProductosGeocerca`); un vehículo
 * tiene una o varias. Monitoreo debe asignarla a un cliente; un acceso del
 * cliente la deja en su cliente. Un vehículo de un cliente hijo puede usar las
 * del padre. La liga es al vehículo, no a la instalación: un cambio de equipo
 * no la pierde y sigue marcando la salida (Estado 8) y en el reporte.
 */
const e = new Entorno();
let a: Actores;
let C: Awaited<ReturnType<typeof clienteListo>>;
const s: Record<string, number> = {};
let n = 0;

const op = (metodo: string, ruta: string, cuerpo?: unknown) => a.operacion(metodo, ruta, cuerpo);
const como = (token: string, metodo: string, ruta: string, cuerpo?: unknown) => e.llamar(e.nextUrl, metodo, ruta, token, cuerpo);
let H: Awaited<ReturnType<typeof clienteListo>>;
let tok9 = '';
const sql = (q: string) => e.mysql.sql('Next', q).trim();
/** Caja alrededor de (18.90, -99.20). */
const ZONA = {
  type: 'Polygon',
  coordinates: [[[-99.21, 18.89], [-99.19, 18.89], [-99.19, 18.91], [-99.21, 18.91], [-99.21, 18.89]]],
};
const transmitir = (numeroSerie: string, fecha: string, lat: number) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Jt808IngestService } = require('src/messaging/jt808/jt808-ingest.service');
  const ingesta = e.servicioNext(Jt808IngestService) as { handleEnvelope: (env: unknown, rk: string) => Promise<unknown> };
  return ingesta.handleEnvelope(
    {
      eventId: `e2e-geocerca-${++n}-${Date.now()}`,
      protocol: 'jt808',
      kind: 'position',
      deviceId: numeroSerie,
      receivedAt: new Date().toISOString(),
      payload: { Lat: lat, Lng: -99.2, Estado: 0, FechaHora: fecha, Velocidad: 40, Direccion: 90 },
    },
    'jt808.position',
  );
};
/** Hora de pared a `min` minutos de la VigenteDesde de la instalación. */
const minutoDe = (idInst: number, min: number) =>
  sql(`SELECT DATE_FORMAT(VigenteDesde + INTERVAL ${min} MINUTE, '%Y-%m-%d %H:%i:%s') FROM Instalaciones WHERE Id = ${idInst}`);

beforeAll(async () => {
  await e.iniciar();
  a = new Actores(e);
  C = await clienteListo(e, a, 'GEO010101AA1', 2);
  // H es cliente hijo de C.
  H = await clienteListo(e, a, 'GEH010101AA1', 1);
  sql(`UPDATE Clientes SET IdPadre = ${C.idClienteNext} WHERE Id = ${H.idClienteNext}`);
  e.mysql.sql(
    'Next',
    `INSERT INTO Usuarios (Id, UserName, PasswordHash, EmailConfirmado, Nombre, IdRol, IdCliente, Estatus) VALUES
      (85, 'usu-geo@e2e.local', 'x', 1, 'Usuario', 9, ${C.idClienteNext}, 1)`,
  );
  tok9 = e.tokenNext({ id: 85, rol: 9 }, C.idClienteNext);
  s.veh = Number(ok(await op('POST', '/productos/vehiculos', { idCliente: C.idClienteNext, placa: 'GEO0001' }), 'vehículo').data.id);
  s.veh2 = Number(ok(await op('POST', '/productos/vehiculos', { idCliente: C.idClienteNext, placa: 'GEO0002' }), 'vehículo 2').data.id);
  s.vehHijo = Number(ok(await op('POST', '/productos/vehiculos', { idCliente: H.idClienteNext, placa: 'GEH0001' }), 'vehículo hijo').data.id);
  const inst = ok(
    await op('POST', '/instalaciones', { idCliente: C.idClienteNext, idProducto: s.veh, idDispositivo: C.inventario[0].idDispositivo, idSim: C.inventario[0].idSim }),
    'instalar',
  );
  s.inst = Number(inst.data.id);
}, 240000);

afterAll(() => e.detener());

describe('Geocerca del cliente para varios vehículos', () => {
  it('monitoreo debe asignarla a un cliente', async () => {
    expect((await op('POST', '/geocercas', { idsProducto: [s.veh], nombre: 'Sin cliente', geocerca: ZONA })).status).toBe(400);
  });

  it('una geocerca para varios vehículos (también los del cliente hijo), sin usuarios', async () => {
    const g = ok(
      await op('POST', '/geocercas', { idCliente: C.idClienteNext, idsProducto: [s.veh, s.veh2, s.vehHijo], nombre: 'Patio', geocerca: ZONA }),
      'geocerca',
    );
    s.geo = Number(g.data.id);
    const det = ok(await op('GET', `/geocercas/${s.geo}`), 'detalle').data;
    expect([...det.idsProducto].sort()).toEqual([s.veh, s.veh2, s.vehHijo].sort());
    expect(det.vehiculos.find((v: { idProducto: number }) => v.idProducto === s.veh)).toMatchObject({ placa: 'GEO0001', idInstalacion: s.inst });
  });

  it('un vehículo de otro cliente no se puede ligar', async () => {
    const otro = await clienteListo(e, a, 'GEX010101AA1', 1);
    const vehOtro = Number(ok(await op('POST', '/productos/vehiculos', { idCliente: otro.idClienteNext, placa: 'GEX0001' }), 'otro').data.id);
    expect((await op('PATCH', `/geocercas/${s.geo}`, { idsProducto: [s.veh, vehOtro] })).status).toBe(400);
  });

  it('un vehículo con varias geocercas; el usuario del cliente crea la suya sin indicar cliente', async () => {
    const g2 = ok(await como(tok9, 'POST', '/geocercas', { idsProducto: [s.veh], nombre: 'Patio 2', geocerca: ZONA }), 'geocerca del usuario');
    expect(sql(`SELECT IdCliente FROM Geocercas WHERE Id = ${Number(g2.data.id)}`)).toBe(String(C.idClienteNext));
    const delVehiculo = ok(await op('GET', `/geocercas/list?idProducto=${s.veh}`), 'del vehículo').data.map((g: { id: number }) => g.id);
    expect(delVehiculo.sort()).toEqual([s.geo, Number(g2.data.id)].sort());
    // Con idInstalacion (obsoleto) liga el vehículo de esa instalación.
    const vieja = ok(await op('POST', '/geocercas', { idCliente: C.idClienteNext, idInstalacion: s.inst, nombre: 'Patio 3', geocerca: ZONA }), 'obsoleta');
    expect(sql(`SELECT GROUP_CONCAT(IdProducto) FROM ProductosGeocerca WHERE IdGeocerca = ${Number(vieja.data.id)} AND Estatus = 1`)).toBe(String(s.veh));
  });

  it('editar la lista quita los vehículos que ya no van', async () => {
    ok(await op('PATCH', `/geocercas/${s.geo}`, { idsProducto: [s.veh, s.vehHijo] }), 'editar');
    expect(ok(await op('GET', `/geocercas/${s.geo}`), 'detalle').data.idsProducto.sort()).toEqual([s.veh, s.vehHijo].sort());
  });

  it('sobrevive al cambio de equipo y sigue marcando la salida (Estado 8) con el equipo nuevo', async () => {
    const cambio = ok(
      await op('PATCH', `/instalaciones/${s.inst}`, {
        idDispositivo: C.inventario[1].idDispositivo,
        estatusInstalacionAnterior: 3,
        estatusDispositivoAnterior: 3,
        comentario: 'Cambio de equipo',
      }),
      'cambio',
    );
    s.instNueva = Number(cambio.data.id);
    expect(sql(`SELECT COUNT(*) FROM Geocercas WHERE Id = ${s.geo} AND Estatus = 1`)).toBe('1');
    const vehiculo = ok(await op('GET', `/geocercas/${s.geo}`), 'detalle').data.vehiculos.find((v: { idProducto: number }) => v.idProducto === s.veh);
    expect(vehiculo).toMatchObject({ idInstalacion: s.instNueva });

    const serie = `S${C.inventario[1].imei}`;
    await transmitir(serie, minutoDe(s.instNueva, 1), 18.9); // dentro
    await transmitir(serie, minutoDe(s.instNueva, 2), 19.5); // fuera
    expect(sql(`SELECT GROUP_CONCAT(Estado ORDER BY FechaHora) FROM Posiciones WHERE Imei = ${C.inventario[1].imei}`)).toBe('0,8');
  });

  it('el reporte de salidas de la instalación la sigue evaluando', async () => {
    const r = ok(
      await op('POST', '/reportes/salidas-geocerca-instalacion', {
        idInstalacion: s.instNueva,
        fechaInicio: minutoDe(s.instNueva, -60),
        fechaFinal: minutoDe(s.instNueva, 24 * 60),
      }),
      'salidas',
    );
    const data = r.data ?? r;
    expect(data.resumen.geocercasEvaluadas).toBeGreaterThanOrEqual(1);
    expect(data.resumen.totalSalidas).toBeGreaterThanOrEqual(1);
  });
});
