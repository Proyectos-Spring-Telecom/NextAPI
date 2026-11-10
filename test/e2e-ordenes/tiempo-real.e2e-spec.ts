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

describe('Alerta de un equipo sin ubicación medida', () => {
  // Regla 9 de springSocketKit (6/11/2026): sin GPS, WiFi ni antena el socket
  // no manda coordenadas; la alarma abre su incidente sin ubicación.
  const { EnumCatEventos } = require('src/common/cat-eventos.enum');
  const SOS = Number(EnumCatEventos.HELP_ME);
  const imei = String(866000000000000 + (Date.now() % 1e9));
  const hex = () => require('crypto').randomBytes(32).toString('hex');
  const fa100s = () => servicio('src/messaging/fa100s/fa100s-ingest.service', 'Fa100sIngestService');
  const sinUbicacion = () => de('consola:incidente').filter((x) => x.sinUbicacion);
  const incidente = () =>
    sql(
      `SELECT CONCAT(COUNT(*), '|', IFNULL(MAX(TipoOrigen), ''), '|', IFNULL(MAX(IdPosicion), 'NULL'), '|', IFNULL(MAX(Descripcion), ''))
         FROM Incidentes WHERE JSON_UNQUOTE(JSON_EXTRACT(DatosOrigen, '$.imei')) = '${imei}'`,
    );
  const alarma = (kind: 'alarm' | 'alarm_location', lat: number | null, fechaHora: string, extra: Record<string, unknown> = {}) =>
    fa100s().handleEnvelope(
      {
        eventId: hex(),
        protocol: 'fa100s',
        kind,
        deviceId: imei,
        receivedAt: new Date().toISOString(),
        payload: {
          Imei: imei, Lat: lat, Lng: lat == null ? null : -99.19, Estado: 2, FechaHora: fechaHora,
          Velocidad: 0, IdEvento: SOS, Alarma1: 16, Bateria: 90,
          positionValid: lat != null, FuentePosicion: lat == null ? null : 0, RadioM: null, ...extra,
        },
      },
      'fa100s.alarm.sos',
    );
  let inst = 0;

  beforeAll(async () => {
    sql(`INSERT IGNORE INTO CatTipoDispositivo (Id, Codigo, Nombre, Estatus, Clase) VALUES (7, 'RELOJ INTELIGENTE', 'Reloj inteligente', 1, 'RELOJ')`);
    sql(`UPDATE CatTipoDispositivo SET Clase = 'RELOJ' WHERE Id = 7`);
    const reloj = Number(ok(await op('POST', '/dispositivos/relojes', { idCliente: C.idClienteNext, numeroSerie: imei.slice(-10), imei }), 'reloj').data.id);
    const persona = Number(ok(await op('POST', '/productos/vehiculos', { idCliente: C.idClienteNext, placa: 'TRE0S01' }), 'producto').data.id);
    inst = Number(ok(await op('POST', '/instalaciones', { idCliente: C.idClienteNext, idProducto: persona, idDispositivo: reloj }), 'instalar').data.id);
  });

  it('un SOS sin coordenadas abre un incidente sin posición y lo empuja a la consola', async () => {
    await alarma('alarm', null, '2026-11-06 17:35:59');
    await esperar(() => sinUbicacion().length === 1);
    expect(incidente()).toMatch(/^1\|1\|NULL\|Alerta automática: .+ \(sin ubicación\)$/);
    expect(Number(sql(`SELECT COUNT(*) FROM Posiciones WHERE Imei = '${imei}'`))).toBe(0);
    expect(sinUbicacion()[0]).toEqual(
      expect.objectContaining({ nuevo: true, tipoOrigen: 1, idInstalacion: inst, imei, estado: 2, idEvento: SOS, tipoEvento: 'sin_ubicacion', idPanel: null }),
    );
  });

  it('otro SOS sin coordenadas entra como seguimiento del mismo incidente', async () => {
    await alarma('alarm', null, '2026-11-06 17:37:00');
    await esperar(() => sinUbicacion().length === 2);
    expect(incidente()).toMatch(/^1\|1\|NULL\|/);
    expect(sinUbicacion()[1]).toEqual(expect.objectContaining({ nuevo: false }));
    expect(sql(`SELECT si.Actividad FROM SeguimientoIncidentes si JOIN Incidentes i ON i.Id = si.IdIncidente WHERE JSON_UNQUOTE(JSON_EXTRACT(i.DatosOrigen, '$.imei')) = '${imei}' ORDER BY si.Id DESC LIMIT 1`)).toMatch(/· sin ubicación$/);
  });

  it('la ubicación posterior por antena se liga al incidente; un GPS dentro de la ventana la reemplaza', async () => {
    // 10/11: caída del cliente sin GPS; la trama siguiente traía antenas (±1.1 km).
    const alarmEventId = hex();
    await alarma('alarm_location', 19.428975, '2026-11-06 17:35:59', { alarmEventId, FuentePosicion: 2, RadioM: 1110, positionValid: false });
    await esperar(() => incidente().split('|')[2] !== 'NULL');
    const idPosicion = Number(sql(`SELECT MAX(Id) FROM Posiciones WHERE Imei = '${imei}'`));
    expect(sql(`SELECT CONCAT(FuentePosicion, '|', RadioM) FROM Posiciones WHERE Id = ${idPosicion}`)).toBe('2|1110');
    expect(incidente()).toMatch(new RegExp(`^1\\|1\\|${idPosicion}\\|`));
    expect(sql(`SELECT si.Actividad FROM SeguimientoIncidentes si JOIN Incidentes i ON i.Id = si.IdIncidente WHERE JSON_UNQUOTE(JSON_EXTRACT(i.DatosOrigen, '$.imei')) = '${imei}' ORDER BY si.Id DESC LIMIT 1`)).toMatch(/^Ubicación de la alerta: .+ubicación 19\.428975, -99\.190000 \(aproximada por antena, ±1110 m\)/);

    await alarma('alarm_location', 19.4282, '2026-11-06 17:35:59', { alarmEventId });
    await esperar(() => sql(`SELECT FuentePosicion FROM Posiciones WHERE Id = ${idPosicion}`) === '0');
    expect(Number(sql(`SELECT COUNT(*) FROM Posiciones WHERE Imei = '${imei}'`))).toBe(1);
    expect(sql(`SELECT CONCAT(Lat, '|', IFNULL(RadioM, 'NULL')) FROM Posiciones WHERE Id = ${idPosicion}`)).toBe('19.4282|NULL');
    expect(incidente()).toMatch(new RegExp(`^1\\|1\\|${idPosicion}\\|`));
    await esperar(() => /^Ubicación GPS de la alerta:/.test(sql(`SELECT si.Actividad FROM SeguimientoIncidentes si JOIN Incidentes i ON i.Id = si.IdIncidente WHERE JSON_UNQUOTE(JSON_EXTRACT(i.DatosOrigen, '$.imei')) = '${imei}' ORDER BY si.Id DESC LIMIT 1`)));
    expect(sql(`SELECT si.Actividad FROM SeguimientoIncidentes si JOIN Incidentes i ON i.Id = si.IdIncidente WHERE JSON_UNQUOTE(JSON_EXTRACT(i.DatosOrigen, '$.imei')) = '${imei}' ORDER BY si.Id DESC LIMIT 1`)).toMatch(/^Ubicación GPS de la alerta: .+ubicación 19\.428200, -99\.190000 · posición/);
  });

  it('una posición de cámara sin GPS no va a Posiciones; su foto sí se guarda, y sin instalación no abre incidente', async () => {
    const serie = `CAM${Date.now() % 1e9}`;
    const imeiCam = String(867000000000000 + (Date.now() % 1e9));
    // El catálogo sembrado puede no traer TrackCam (5): en producción sí existe.
    sql(`INSERT IGNORE INTO CatTipoDispositivo (Id, Codigo, Nombre, Estatus, Clase) VALUES (5, 'TRACKCAM', 'Trackcam', 1, 'TRACKCAM')`);
    sql(`INSERT INTO Dispositivos (IdCliente, IdTipoDispositivo, NumeroSerie, Imei, Estatus) VALUES (${C.idClienteNext}, 5, '${serie}', '${imeiCam}', 1)`);
    const jt808 = servicio('src/messaging/jt808/jt808-ingest.service', 'Jt808IngestService');
    const r = await jt808.handleEnvelope(
      {
        eventId: hex(), protocol: 'jt808', kind: 'position', deviceId: serie, receivedAt: new Date().toISOString(),
        payload: { Imei: null, Lat: null, Lng: null, Estado: 2, FechaHora: '2026-11-06 18:00:00', Velocidad: 0, Direccion: 0, IdEvento: SOS, Foto1: 'https://springtelecom.mx/trackcam/fotos/e2e.jpg' },
      },
      'jt808.position',
    );
    expect(r).toEqual({ audited: true });
    expect(Number(sql(`SELECT COUNT(*) FROM Posiciones WHERE Imei = '${imeiCam}'`))).toBe(0);
    expect(Number(sql(`SELECT COUNT(*) FROM Fotos WHERE Imei = '${imeiCam}'`))).toBe(1);
    await new Promise((res) => setTimeout(res, 500));
    expect(Number(sql(`SELECT COUNT(*) FROM Incidentes WHERE JSON_UNQUOTE(JSON_EXTRACT(DatosOrigen, '$.imei')) = '${imeiCam}'`))).toBe(0);
  });
});

describe('GPS de flota (jimi): tiempo detenido, alertas repetidas y sin GPS', () => {
  const { EnumCatEventos } = require('src/common/cat-eventos.enum');
  const imei = String(357000000000000 + (Date.now() % 1e9));
  const hex = () => require('crypto').randomBytes(32).toString('hex');
  const jimi = () => servicio('src/messaging/jimi/jimi-ingest.service', 'JimiIngestService');
  const posicion = (fechaHora: string, extra: Record<string, unknown>) =>
    jimi().handleEnvelope(
      {
        eventId: hex(), protocol: 'jimi', kind: 'position', deviceId: imei, receivedAt: new Date().toISOString(),
        payload: {
          Imei: imei, Lat: 18.89024, Lng: -99.126663, Estado: 0, FechaHora: fechaHora, Velocidad: 0, Direccion: 0,
          Odometro: null, Ignicion: 1, Alarma1: null, Alarma2: null, Energia: null, IdEvento: Number(EnumCatEventos.TRANSMISION),
          IdFoto: null, Bateria: null, Alimentacion: null, GPS: null, GSM: null, Movimiento: 1, Combustible: null, ...extra,
        },
      },
      'jimi.position',
    );
  const estadoEn = (fechaHora: string) =>
    Number(sql(`SELECT Estado FROM Posiciones WHERE Imei = '${imei}' AND FechaHora = '${fechaHora}' ORDER BY Id DESC LIMIT 1`));
  const seguimientos = () =>
    Number(sql(`SELECT COUNT(*) FROM SeguimientoIncidentes si JOIN Incidentes i ON i.Id = si.IdIncidente WHERE JSON_UNQUOTE(JSON_EXTRACT(i.DatosOrigen, '$.imei')) = '${imei}'`));

  beforeAll(async () => {
    sql(`INSERT IGNORE INTO CatTipoDispositivo (Id, Codigo, Nombre, Estatus, Clase) VALUES (6, 'TRACKGAS', 'TrackGas', 1, 'AVL')`);
    sql(`INSERT INTO Dispositivos (IdCliente, IdTipoDispositivo, NumeroSerie, Imei, Estatus) VALUES (${C.idClienteNext}, 6, 'GPS${imei.slice(-9)}', '${imei}', 1)`);
    const idDispositivo = Number(sql(`SELECT Id FROM Dispositivos WHERE Imei = '${imei}'`));
    const vehiculo = Number(ok(await op('POST', '/productos/vehiculos', { idCliente: C.idClienteNext, placa: 'TRE0J41' }), 'producto').data.id);
    ok(await op('POST', '/instalaciones', { idCliente: C.idClienteNext, idProducto: vehiculo, idDispositivo }), 'instalar');
  });

  it('unidad 41 (6/11): llegar a 800 m sin reporte con velocidad reinicia el tiempo detenido', async () => {
    await posicion('2026-11-06 20:59:41', { Velocidad: 70, Estado: 1, Movimiento: 2 });
    await posicion('2026-11-06 21:01:03', { IdEvento: Number(EnumCatEventos.IGNICION_ON) });
    await posicion('2026-11-06 21:01:29', { Ignicion: 0, IdEvento: Number(EnumCatEventos.IGNICION_OFF) });
    await posicion('2026-11-06 21:28:55', { IdEvento: Number(EnumCatEventos.IGNICION_ON) });
    await posicion('2026-11-06 21:33:48', { Lat: 18.8948, Lng: -99.133087 });
    expect(estadoEn('2026-11-06 21:33:48')).toBe(0);
    await posicion('2026-11-06 22:04:00', { Lat: 18.8948, Lng: -99.133087 });
    expect(estadoEn('2026-11-06 22:04:00')).toBe(4);
  });

  it('con el motor apagado también cuenta (10/11, LORD 021), y 3 km/h estando parada es detenida', async () => {
    await posicion('2026-11-06 22:05:00', { Lat: 18.8948, Lng: -99.133087, Ignicion: 0, IdEvento: Number(EnumCatEventos.IGNICION_OFF) });
    expect(estadoEn('2026-11-06 22:05:00')).toBe(4);
    await posicion('2026-11-06 23:05:00', { Lat: 18.8948, Lng: -99.133087, Ignicion: 0, Velocidad: 3 });
    expect(estadoEn('2026-11-06 23:05:00')).toBe(6);
  });

  it('una unidad que nunca se ha movido cuenta desde su primera posición', async () => {
    const otro = String(Number(imei) + 1);
    sql(`INSERT INTO Dispositivos (IdCliente, IdTipoDispositivo, NumeroSerie, Imei, Estatus) VALUES (${C.idClienteNext}, 6, 'GPS${otro.slice(-9)}', '${otro}', 1)`);
    const idDispositivo = Number(sql(`SELECT Id FROM Dispositivos WHERE Imei = '${otro}'`));
    const vehiculo = Number(ok(await op('POST', '/productos/vehiculos', { idCliente: C.idClienteNext, placa: 'TRE0J42' }), 'producto').data.id);
    ok(await op('POST', '/instalaciones', { idCliente: C.idClienteNext, idProducto: vehiculo, idDispositivo }), 'instalar');
    const quieta = (fechaHora: string) =>
      jimi().handleEnvelope(
        {
          eventId: hex(), protocol: 'jimi', kind: 'position', deviceId: otro, receivedAt: new Date().toISOString(),
          payload: {
            Imei: otro, Lat: 18.9, Lng: -99.2, Estado: 0, FechaHora: fechaHora, Velocidad: 0, Direccion: 0, Odometro: null,
            Ignicion: 0, Alarma1: null, Alarma2: null, Energia: null, IdEvento: Number(EnumCatEventos.TRANSMISION), IdFoto: null,
            Bateria: null, Alimentacion: null, GPS: null, GSM: null, Movimiento: 1, Combustible: null,
          },
        },
        'jimi.position',
      );
    await quieta('2026-11-06 08:00:00');
    await quieta('2026-11-06 09:05:00');
    expect(Number(sql(`SELECT Estado FROM Posiciones WHERE Imei = '${otro}' AND FechaHora = '2026-11-06 09:05:00'`))).toBe(5);
  });

  it('el proceso de cada minuto avanza el color sin esperar posiciones y nunca toca una alerta', async () => {
    const tiempo = () => servicio('src/monitoreo/tiempo-detenido.scheduler', 'TiempoDetenidoScheduler');
    const ultima = () => sql(`SELECT CONCAT(Estado, '|', IFNULL(DetenidoDesde, 'NULL')) FROM UltimaPosicion WHERE Imei = '${imei}'`);
    const mx = (t: string) => new Date(`${t}Z`); // hora de pared de México, como nowMexicoCityAsUtcDate
    await posicion('2026-11-06 23:20:00', { Velocidad: 50, Estado: 1, Movimiento: 2 });
    expect(ultima()).toBe('1|NULL');
    await posicion('2026-11-06 23:30:00', {});
    expect(ultima()).toBe('0|2026-11-06 23:30:00');
    expect(await tiempo().recalcular(mx('2026-11-06T23:59:00'))).not.toContain(imei);
    expect(await tiempo().recalcular(mx('2026-11-07T00:00:00'))).toContain(imei);
    expect(ultima()).toBe('4|2026-11-06 23:30:00');
    await tiempo().recalcular(mx('2026-11-07T01:01:00'));
    expect(ultima()).toBe('6|2026-11-06 23:30:00');
    expect(estadoEn('2026-11-06 23:30:00')).toBe(0); // el histórico conserva su estado
    expect(await tiempo().recalcular(mx('2026-11-07T01:30:00'))).not.toContain(imei);

    await posicion('2026-11-07 01:31:00', { Velocidad: 40, Estado: 1, Movimiento: 2 });
    expect(ultima()).toBe('1|NULL');
    await posicion('2026-11-07 01:35:00', { IdEvento: Number(EnumCatEventos.HELP_ME), Estado: 2 });
    expect(ultima()).toBe('2|NULL');
    await tiempo().recalcular(mx('2026-11-07T05:00:00'));
    expect(ultima()).toBe('2|NULL');
  });

  it('la misma alerta repetida en menos de 60 s no agrega otro seguimiento', async () => {
    // Como la unidad 41: cada "Falta de energía" llega junto a una posición normal.
    const circulando = { Velocidad: 40, Estado: 1, Movimiento: 2 };
    const energia = { ...circulando, IdEvento: Number(EnumCatEventos.ENERGY_ALARM), Alarma1: 2 };
    const alerta = async (fechaHora: string) => {
      await posicion(fechaHora, energia);
      await posicion(fechaHora, circulando);
    };
    await alerta('2026-11-07 08:00:00');
    await esperar(() => Number(sql(`SELECT COUNT(*) FROM Incidentes WHERE JSON_UNQUOTE(JSON_EXTRACT(DatosOrigen, '$.imei')) = '${imei}'`)) === 1);
    await alerta('2026-11-07 08:05:00');
    await esperar(() => seguimientos() === 1);
    expect(seguimientos()).toBe(1);
    await alerta('2026-11-07 08:05:15');
    await new Promise((res) => setTimeout(res, 500));
    expect(seguimientos()).toBe(1);
    await alerta('2026-11-07 08:07:00');
    await esperar(() => seguimientos() === 2);
    expect(seguimientos()).toBe(2);
  });

  it('una posición sin GPS (Lat/Lng null) no va a Posiciones', async () => {
    const antes = Number(sql(`SELECT COUNT(*) FROM Posiciones WHERE Imei = '${imei}'`));
    const r = await posicion('2026-11-07 09:00:00', { Lat: null, Lng: null });
    expect(r).toEqual({ audited: true });
    expect(Number(sql(`SELECT COUNT(*) FROM Posiciones WHERE Imei = '${imei}'`))).toBe(antes);
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
