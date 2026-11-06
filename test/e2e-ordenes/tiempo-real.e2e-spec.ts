import { Actores, ok } from './actores';
import { clienteListo } from './comunes';
import { Entorno } from './entorno';

/**
 * Tiempo real en `/monitoreo` (docs/contratos.md §11.4) para lo que no tenía:
 * la bandeja "Sin transmisión" (`vigilancia:avisos`), el incidente de un
 * equipo o panel inservible que transmite (`incidente:inservible`) y el
 * estatus de los comandos de la consola de configuración
 * (`comando:actualizacion`). Se espían los emits del gateway; RabbitMQ está
 * apagado y los mensajes se entregan directo a los servicios de ingesta.
 */
const e = new Entorno();
let a: Actores;
let C: Awaited<ReturnType<typeof clienteListo>>;
const SA = { id: 91, rol: 1 };
let tokSa: string;
const s: Record<string, number> = {};
let imeiGps = '';
let n = 0;

type Emit = { evento: string; payload: any; audiencia?: unknown };
const emitidos: Emit[] = [];
const de = (evento: string) => emitidos.filter((x) => x.evento === evento).map((x) => x.payload);

const op = (metodo: string, ruta: string, cuerpo?: unknown) => a.operacion(metodo, ruta, cuerpo);
const sa = (metodo: string, ruta: string, cuerpo?: unknown) => e.llamar(e.nextUrl, metodo, ruta, tokSa, cuerpo);
const sql = (q: string) => e.mysql.sql('Next', q).trim();
// eslint-disable-next-line @typescript-eslint/no-require-imports
const servicio = (ruta: string, nombre: string) => e.servicioNext(require(ruta)[nombre]) as any;
const esperar = async (cond: () => boolean) => {
  for (let i = 0; i < 40 && !cond(); i++) await new Promise((r) => setTimeout(r, 100));
};
const evento = (
  cuentaSia: string,
  sia: { codigoSia: string; tipoEvento: string; severidad: number; esRestauracion?: boolean } = {
    codigoSia: 'BA',
    tipoEvento: 'BA',
    severidad: 1,
  },
) =>
  servicio('src/alarmas/alarmas-ingest.service', 'AlarmasIngestService').ingestEvento(
    {
      cuentaSia,
      codigoSia: sia.codigoSia,
      tipoEvento: sia.tipoEvento,
      tipoEventoEtiqueta: sia.tipoEvento,
      severidad: sia.severidad,
      esRestauracion: sia.esRestauracion ?? false,
      esHeartbeat: false,
      zona: 1,
      codigoUsuario: null,
      nombreDispositivo: null,
      particion: 1,
      seq: String(++n),
      recibidoEn: new Date().toISOString(),
      timestampPanel: null,
      ipOrigen: '10.0.0.1',
      frameCrudo: 'x',
      dataDescifrada: null,
      idDispositivo: null,
      idCliente: null,
      idempotencyKey: `e2e-tr-${n}-${Date.now()}`,
    },
    null,
    { origen: 'rabbitmq' },
  );
const heartbeat = (cuentaSia: string) =>
  servicio('src/alarmas/alarmas-ingest.service', 'AlarmasIngestService').ingestHeartbeat(
    { cuentaSia, idDispositivo: null, idCliente: null, ultimoHeartbeat: new Date().toISOString(), seq: String(++n), idempotencyKey: `e2e-tr-hb-${n}-${Date.now()}` },
    null,
    { origen: 'rabbitmq' },
  );
const incidentesPanel = () =>
  Number(sql(`SELECT COUNT(*) FROM Incidentes WHERE JSON_UNQUOTE(JSON_EXTRACT(DatosOrigen, '$.alerta')) = 'inservible_transmite' AND CAST(JSON_EXTRACT(DatosOrigen, '$.idDispositivo') AS SIGNED) = ${s.panel}`));

beforeAll(async () => {
  await e.iniciar();
  a = new Actores(e);
  C = await clienteListo(e, a, 'TRE010101AA1', 2);
  sql(
    `INSERT INTO Usuarios (Id, UserName, PasswordHash, EmailConfirmado, Nombre, IdRol, IdCliente, Estatus) VALUES
      (${SA.id}, 'sa-tr@e2e.local', 'x', 1, 'Super admin', 1, ${C.idClienteNext}, 1)`,
  );
  tokSa = e.tokenNext(SA, C.idClienteNext);

  // Espía de los emits del gateway (sin cliente Socket.IO en la batería).
  const { MonitoreoGateway } = require('src/monitoreo/monitoreo.gateway');
  const gw = e.servicioNext(MonitoreoGateway) as any;
  for (const [metodo, nombre] of [
    ['emitAvisosSinTransmision', 'vigilancia:avisos'],
    ['emitIncidenteInservible', 'incidente:inservible'],
    ['emitComando', 'comando:actualizacion'],
    ['emitConsolaIncidente', 'consola:incidente'],
  ]) {
    const original = gw[metodo].bind(gw);
    gw[metodo] = (payload: unknown, ...resto: unknown[]) => {
      emitidos.push({ evento: nombre, payload, audiencia: resto[0] });
      return original(payload, ...resto);
    };
  }

  // GPS instalado que dejó de transmitir hace 20 h.
  const eq = C.inventario[0];
  imeiGps = eq.imei;
  const veh = Number(ok(await op('POST', '/productos/vehiculos', { idCliente: C.idClienteNext, placa: 'TRE0001' }), 'vehículo').data.id);
  s.gps = Number(ok(await op('POST', '/instalaciones', { idCliente: C.idClienteNext, idProducto: veh, idDispositivo: eq.idDispositivo, idSim: eq.idSim }), 'instalar').data.id);
  sql(`UPDATE Instalaciones SET VigenteDesde = NOW() - INTERVAL 3 DAY WHERE Id = ${s.gps}`);
  sql(
    `INSERT INTO UltimaPosicion (Imei, Lat, Lng, FechaHora, Velocidad, Direccion, FHRegistro)
       VALUES (${imeiGps}, 18.9, -99.2, NOW() - INTERVAL 20 HOUR, 0, 0, NOW() - INTERVAL 20 HOUR)`,
  );

  // Panel dado por inservible (PanelAlarma.Estatus sigue al del equipo).
  // El catálogo sembrado puede no traer el tipo panel (2): en producción sí existe.
  sql(`INSERT IGNORE INTO CatTipoDispositivo (Id, Codigo, Nombre, Estatus, Clase) VALUES (2, 'PANEL', 'Panel de alarma', 1, 'PANEL')`);
  sql(`INSERT INTO Dispositivos (IdCliente, IdTipoDispositivo, NumeroSerie, Imei, Estatus) VALUES (NULL, 2, 'PNL-TRE-1', NULL, 5)`);
  s.panel = Number(sql(`SELECT Id FROM Dispositivos WHERE NumeroSerie = 'PNL-TRE-1'`));
  sql(`INSERT INTO PanelAlarma (IdDispositivo, CuentaSia, Nombre, Estatus) VALUES (${s.panel}, 'TRE901', 'Panel robado', 5)`);

  // Panel instalado y activo en el cliente (pánico → incidente en Consola).
  sql(`INSERT INTO Dispositivos (IdCliente, IdTipoDispositivo, NumeroSerie, Imei, Estatus) VALUES (${C.idClienteNext}, 2, 'PNL-TRE-2', NULL, 1)`);
  s.panelActivo = Number(sql(`SELECT Id FROM Dispositivos WHERE NumeroSerie = 'PNL-TRE-2'`));
  sql(`INSERT INTO PanelAlarma (IdDispositivo, CuentaSia, Nombre, Estatus) VALUES (${s.panelActivo}, 'TRE902', 'Panel oficina', 1)`);
  const inmueble = Number(ok(await op('POST', '/productos/vehiculos', { idCliente: C.idClienteNext, placa: 'TRE0P01' }), 'producto del panel').data.id);
  sql(`INSERT INTO Instalaciones (IdCliente, IdProducto, IdDispositivo, Estatus) VALUES (${C.idClienteNext}, ${inmueble}, ${s.panelActivo}, 1)`);
  s.instPanel = Number(sql(`SELECT Id FROM Instalaciones WHERE IdDispositivo = ${s.panelActivo} AND Estatus = 1`));
}, 240000);

afterAll(() => e.detener());

describe('Bandeja "Sin transmisión" en tiempo real', () => {
  it('la evaluación empuja los avisos nuevos con el ítem de la bandeja y el resumen por compañía', async () => {
    ok(await sa('POST', '/vigilancia-transmision/evaluar'), 'evaluar');
    const [ev] = de('vigilancia:avisos');
    expect(ev.motivo).toBe('evaluacion');
    expect(ev.avisos).toEqual([expect.objectContaining({ idInstalacion: s.gps, estatus: 'abierto', imei: imeiGps })]);
    expect(Array.isArray(ev.porProveedor)).toBe(true);
    s.aviso = ev.avisos[0].id;
  });

  it('atender lo empuja a los demás operadores', async () => {
    ok(await a.monitoreo('PATCH', `/vigilancia-transmision/avisos/${s.aviso}/atender`, { resultado: 'cliente_avisado' }), 'atender');
    const ev = de('vigilancia:avisos').at(-1);
    expect(ev).toMatchObject({ motivo: 'atencion', avisos: [expect.objectContaining({ id: s.aviso, estatus: 'atendido', resultado: 'cliente_avisado' })] });
  });

  it('si vuelve a transmitir, el cierre sale de la bandeja con su motivo', async () => {
    sql(`UPDATE UltimaPosicion SET FechaHora = NOW(), FHRegistro = NOW() WHERE Imei = ${imeiGps}`);
    await servicio('src/vigilancia-transmision/vigilancia-transmision.service', 'VigilanciaTransmisionService').cerrarResueltos();
    expect(de('vigilancia:avisos').at(-1)).toMatchObject({
      motivo: 'cierre',
      avisos: [{ id: s.aviso, idInstalacion: s.gps, estatus: 'cerrado', motivoCierre: 'transmitio', fechaCierre: expect.any(String) }],
    });
  });
});

describe('Panel inservible que transmite', () => {
  it('un evento abre un incidente en el cliente raíz, con el evento de origen, y se empuja a operación', async () => {
    await evento('TRE901');
    await esperar(() => incidentesPanel() === 1);
    expect(incidentesPanel()).toBe(1);
    const raiz = sql('SELECT Id FROM Clientes WHERE IdPadre IS NULL ORDER BY Id LIMIT 1');
    const fila = sql(
      `SELECT CONCAT(IdCliente, '|', TipoOrigen, '|', IdEventoAlarma IS NOT NULL, '|', JSON_UNQUOTE(JSON_EXTRACT(DatosOrigen, '$.cuentaSia')), '|', JSON_UNQUOTE(JSON_EXTRACT(DatosOrigen, '$.transmision')))
         FROM Incidentes WHERE CAST(JSON_EXTRACT(DatosOrigen, '$.idDispositivo') AS SIGNED) = ${s.panel}`,
    );
    expect(fila).toBe(`${raiz}|2|1|TRE901|evento`);
    // No es un panel sin alta: no va a huérfanos.
    expect(Number(sql(`SELECT COUNT(*) FROM TelemetryHuerfanos WHERE DeviceId = 'TRE901'`))).toBe(0);
    await esperar(() => de('incidente:inservible').length === 1);
    expect(de('incidente:inservible')).toEqual([expect.objectContaining({ tipo: 'panel', idDispositivo: s.panel, numeroSerie: 'PNL-TRE-1' })]);
  });

  it('otro evento o un heartbeat con el incidente abierto no abren otro', async () => {
    await evento('TRE901');
    await heartbeat('TRE901');
    await new Promise((r) => setTimeout(r, 800));
    expect(incidentesPanel()).toBe(1);
    expect(de('incidente:inservible')).toHaveLength(1);
  });

  it('un panel sin alta sigue yendo a huérfanos', async () => {
    await evento('TRE999');
    expect(Number(sql(`SELECT COUNT(*) FROM TelemetryHuerfanos WHERE DeviceId = 'TRE999'`))).toBeGreaterThan(0);
  });
});

describe('Pánico de un panel instalado', () => {
  const PANICO = { codigoSia: 'PA', tipoEvento: 'panico', severidad: 3 };
  const incidentes = () =>
    sql(
      `SELECT CONCAT(COUNT(*), '|', IFNULL(MAX(TipoOrigen), ''), '|', IFNULL(MAX(IdCliente), ''), '|', IFNULL(MAX(Descripcion), ''))
         FROM Incidentes WHERE TipoOrigen = 2 AND CAST(JSON_EXTRACT(DatosOrigen, '$.idPanel') AS SIGNED) = ${s.panelActivo}`,
    );
  const seguimientos = () =>
    Number(
      sql(
        `SELECT COUNT(*) FROM SeguimientoIncidentes si JOIN Incidentes i ON i.Id = si.IdIncidente
          WHERE i.TipoOrigen = 2 AND CAST(JSON_EXTRACT(i.DatosOrigen, '$.idPanel') AS SIGNED) = ${s.panelActivo}
            AND si.Medio = 'Alerta automática'`,
      ),
    );

  it('una alarma que no es pánico ni una restauración de pánico abren incidente', async () => {
    await evento('TRE902');
    await evento('TRE902', { codigoSia: 'PR', tipoEvento: 'restauracion_panico', severidad: 1, esRestauracion: true });
    await new Promise((r) => setTimeout(r, 800));
    expect(incidentes()).toBe('0|||');
    expect(de('consola:incidente')).toHaveLength(0);
  });

  it('el pánico abre un incidente con origen evento de alarma y lo empuja a la consola', async () => {
    await evento('TRE902', PANICO);
    await esperar(() => de('consola:incidente').length === 1);
    expect(incidentes()).toBe(`1|2|${C.idClienteNext}|Alerta automática: Pánico (panel de alarma)`);
    expect(de('consola:incidente')).toEqual([
      expect.objectContaining({ nuevo: true, tipoOrigen: 2, idInstalacion: s.instPanel, idPanel: s.panelActivo, tipoEvento: 'panico' }),
    ]);
  });

  it('otro pánico con el incidente abierto entra como seguimiento, sin abrir otro', async () => {
    await evento('TRE902', { codigoSia: 'PH', tipoEvento: 'panico_asalto', severidad: 3 });
    await esperar(() => de('consola:incidente').length === 2);
    expect(incidentes()).toMatch(/^1\|2\|/);
    expect(seguimientos()).toBe(1);
    expect(de('consola:incidente')[1]).toEqual(expect.objectContaining({ nuevo: false, tipoEvento: 'panico_asalto' }));
  });

  it('finalizado el incidente, el siguiente pánico abre uno nuevo', async () => {
    const id = Number(sql(`SELECT MAX(Id) FROM Incidentes WHERE TipoOrigen = 2 AND CAST(JSON_EXTRACT(DatosOrigen, '$.idPanel') AS SIGNED) = ${s.panelActivo}`));
    ok(await sa('PATCH', `/incidentes/${id}/finalizar`, { conclusion: 'Falsa alarma' }), 'finalizar');
    await evento('TRE902', PANICO);
    await esperar(() => de('consola:incidente').length === 3);
    expect(incidentes()).toMatch(/^2\|2\|/);
    expect(de('consola:incidente')[2]).toEqual(expect.objectContaining({ nuevo: true }));
  });
});

describe('Comandos de la consola de configuración', () => {
  it('cada confirmación del socket se empuja a la sala de la instalación con el ítem de GET …/comandos', async () => {
    sql(`INSERT IGNORE INTO CatTipoDispositivo (Id, Codigo, Nombre, Estatus, Clase) VALUES (7, 'RELOJ INTELIGENTE', 'Reloj inteligente', 1, 'RELOJ')`);
    sql(`UPDATE CatTipoDispositivo SET Clase = 'RELOJ' WHERE Id = 7`);
    const imei = String(865000000000000 + (Date.now() % 1e9));
    const reloj = Number(ok(await op('POST', '/dispositivos/relojes', { idCliente: C.idClienteNext, numeroSerie: imei.slice(-10), imei }), 'reloj').data.id);
    const persona = Number(ok(await op('POST', '/productos/vehiculos', { idCliente: C.idClienteNext, placa: 'TRE0002' }), 'producto').data.id);
    const inst = Number(ok(await op('POST', '/instalaciones', { idCliente: C.idClienteNext, idProducto: persona, idDispositivo: reloj }), 'instalar').data.id);
    const id = ok(await op('POST', `/instalaciones/${inst}/reloj/configuracion`, { sensibilidadCaida: 6 }), 'configurar').data.comandos[0];
    const acks = servicio('src/messaging/comandos/comandos-acks.consumer', 'ComandosAcksConsumer');
    await acks.aplicar({ kind: 'command_ack', protocol: 'fa100s', idComando: id, estado: 'recibido', deviceId: imei, at: new Date().toISOString() });
    await acks.aplicar({ kind: 'command_ack', protocol: 'fa100s', idComando: id, estado: 'enviado', deviceId: imei, at: new Date().toISOString() });
    // Un ack ignorado (retrocede) no se empuja.
    await acks.aplicar({ kind: 'command_ack', protocol: 'fa100s', idComando: id, estado: 'recibido', deviceId: imei, at: new Date().toISOString() });
    const ev = de('comando:actualizacion');
    expect(ev.map((x) => x.comando.estatus)).toEqual(['recibido', 'enviado']);
    expect(ev[1]).toMatchObject({ idInstalacion: inst, idDispositivo: reloj, comando: { id, tipo: 'LSSET', contenido: 'LSSET,6+6' } });
    // Reloj: lo ve también el cliente (6), igual que GET …/reloj/comandos.
    expect(emitidos.filter((x) => x.evento === 'comando:actualizacion').map((x) => x.audiencia)).toEqual(['operacion_y_cliente', 'operacion_y_cliente']);
  });
});
