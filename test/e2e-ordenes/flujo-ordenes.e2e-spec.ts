import { Actores, ok } from './actores';
import { Entorno, NEXT } from './entorno';
import { Narrador } from './narrador';

/**
 * Batería de punta a punta del flujo de órdenes de servicio: CRM ↔ NextAPI ↔
 * App del técnico ↔ monitoreo. Cada `it` es un tramo del recorrido y depende
 * del anterior (corren en orden). El reporte narrado queda en reportes/.
 */
const e = new Entorno();
const n = new Narrador();
let a: Actores;

beforeAll(async () => {
  await e.iniciar();
  a = new Actores(e);
}, 240000);

afterAll(async () => {
  const ruta = n.escribir('Flujo de órdenes de servicio');
  console.log(`Reporte: ${ruta}`);
  await e.detener();
});

/** Fecha local 'YYYY-MM-DDTHH:mm' a N días, para la cita del CRM. */
const enDias = (d: number, hora = 10) => {
  const f = new Date(Date.now() + d * 86400000);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}T${p(hora)}:00`;
};

/** El técnico hace en campo un alta completa: inicia, vehículo, checklist, pruebas con el operador y cierre. */
async function altaEnCampo(idOrden: number, placa: string, equipo: { idDispositivo: number; idSim: number }, idCliente: number) {
  ok(await a.app('POST', `/ordenes-servicio/${idOrden}/iniciar`, { claveApp: a.nuevaClave() }), 'iniciar');
  const veh = ok(await a.app('POST', '/productos/vehiculos', { idCliente, placa, numeroEconomico: `ECO-${placa.slice(-3)}` }), 'alta de vehículo');
  await a.checklist(idOrden, { idProducto: Number(veh.data.id), idDispositivoNuevo: equipo.idDispositivo, idSimNuevo: equipo.idSim });
  for (const p of ['transmision', 'boton_panico', 'paro_motor']) {
    ok(await a.app('POST', `/ordenes-servicio/${idOrden}/pruebas/${p}/solicitar`, { observaciones: 'Listo' }), `pedir ${p}`);
  }
  const validadas = await a.validarPruebas(idOrden);
  const cierre = ok(await a.app('POST', `/ordenes-servicio/${idOrden}/cerrar`), 'cerrar');
  return { idProducto: Number(veh.data.id), validadas, idInstalacion: cierre.data.idInstalacionResultado as number };
}

describe('1. Instalación de 2 unidades: de la venta al cobro y al pago del técnico', () => {
  const s: Record<string, any> = {};

  it('la venta ganada da de alta al cliente en Next desde el CRM', async () => {
    n.escenario(
      'Instalación de 2 unidades: de la venta al cobro y al pago del técnico',
      'Una venta de 2 GPS. El cliente se da de alta en Next desde el CRM, se agenda, el técnico instala una unidad, la otra no se puede (cliente ausente), se reagenda y se termina. Al final el servicio queda activo y al técnico se le paga lo hecho y la visita en falso.',
    );
    Object.assign(s, e.ventaCrm({ razonSocial: 'Transportes Uno', rfc: 'TUN010101AB1', unidades: 2 }));
    n.paso('Sistema', 'Se gana la venta: el CRM tiene al cliente, la orden de instalación de 2 unidades y el servicio "por instalar"', `Orden ${s.idOrden}`);

    const borrador = ok(await a.crm('GET', `/postventa/clientes/${s.idCliente}/alta-next`), 'borrador alta');
    expect(borrador.alta).toMatchObject({ tipoPersona: 2, rfc: 'TUN010101AB1' });
    const alta = ok(
      await a.crm('POST', `/postventa/clientes/${s.idCliente}/alta-next`, {
        ...borrador.alta,
        nombre: 'Transportes Uno SA de CV',
        numerosEmergencia: [{ nombre: 'Laura Pérez', telefono: '7771234567', prioridad: 1 }],
      }),
      'alta en Next',
    );
    s.idClienteNext = alta.idClienteNext;
    const enNext = ok(await e.integracion('GET', `/integracion/clientes/${s.idClienteNext}`), 'cliente en Next');
    expect(enNext.rfc).toBe('TUN010101AB1');
    n.paso('CRM', 'Formaliza: "Dar de alta en Next" con los datos definitivos y un contacto de emergencia', `Cliente #${s.idClienteNext} en Next, ligado al CRM`);

    s.equipos = e.inventarioNext(s.idClienteNext, 3);
    n.paso('Operación', 'Asigna al cliente 3 equipos y 3 SIM del almacén', s.equipos.map((x: any) => x.imei).join(', '));
  });

  it('al agendar, la App del técnico recibe una orden por unidad', async () => {
    ok(
      await a.crm('PATCH', `/instalaciones/${s.idOrden}`, { cita: enDias(1), duracionMin: 120, idTecnicoNext: NEXT.TECNICO.id, lugar: 'Patio de Transportes Uno' }),
      'agendar',
    );
    const agenda = await a.agendaApp();
    const mias = agenda.filter((o) => o.referenciaCrm === `OI-${s.idOrden}`);
    expect(mias).toHaveLength(2);
    expect(mias.map((o) => o.unidad).sort()).toEqual([1, 2]);
    s.os = mias.sort((x, y) => x.unidad - y.unidad).map((o) => o.id);
    n.paso('CRM', 'Agenda la orden: mañana 10:00, 2 h, técnico Juan, en el patio del cliente', 'Orden agendada');
    n.paso('App', 'El técnico abre su agenda', `2 órdenes programadas (${mias.map((o) => o.folio).join(', ')}), una por unidad`);

    const crm = await a.ordenCrm(s.idOrden);
    expect(crm.ordenesApp.map((x: any) => x.estatus)).toEqual(['programada', 'programada']);
    n.paso('CRM', 'Ve el estado de cada unidad en la app', '2 × Programada');
  });

  it('unidad 1: instalada con checklist, fotos, firmas y pruebas validadas por el operador', async () => {
    // En una orden programada el técnico no puede marcar las pruebas él mismo.
    ok(await a.app('POST', `/ordenes-servicio/${s.os[0]}/iniciar`, { claveApp: a.nuevaClave() }), 'iniciar');
    const intento = await a.app('PATCH', `/ordenes-servicio/${s.os[0]}`, { respuestas: [{ seccion: 'pruebas', clave: 'transmision', valor: true }] });
    expect(intento.status).toBe(400);
    n.paso('App', 'Inicia la unidad 1 e intenta marcar él mismo la prueba de transmisión', 'Rechazado: las pruebas las valida el operador');

    const veh = ok(await a.app('POST', '/productos/vehiculos', { idCliente: s.idClienteNext, placa: 'TUN0001', numeroEconomico: 'ECO-001' }), 'vehículo');
    s.producto1 = Number(veh.data.id);
    await a.checklist(s.os[0], { idProducto: s.producto1, idDispositivoNuevo: s.equipos[0].idDispositivo, idSimNuevo: s.equipos[0].idSim });
    n.paso('App', 'Da de alta el vehículo TUN0001, elige equipo y SIM, llena el checklist y sube fotos de tablero y firmas', 'Guardado');

    const antes = ok(await a.app('GET', `/ordenes-servicio/${s.os[0]}`), 'detalle').data[0];
    expect(antes.faltantesParaCerrar.join(' ')).toContain('Sin respuesta en pruebas');
    for (const p of ['transmision', 'boton_panico', 'paro_motor']) {
      ok(await a.app('POST', `/ordenes-servicio/${s.os[0]}/pruebas/${p}/solicitar`, { observaciones: 'Listo' }), `pedir ${p}`);
    }
    n.paso('App', 'Pide al operador verificar transmisión, pánico y paro de motor', '3 pruebas solicitadas');
    const pendientes = ok(await a.monitoreo('GET', '/ordenes-servicio/pruebas-pendientes'), 'pendientes').data;
    expect(pendientes.filter((p: any) => p.id === s.os[0])).toHaveLength(3);
    const validadas = await a.validarPruebas(s.os[0]);
    n.paso('Monitoreo', 'Ve las 3 pruebas en su pantalla, verifica en el monitoreo y las da por correctas (el paro lo ejecuta con su herramienta)', validadas.join(', '));

    const cierre = ok(await a.app('POST', `/ordenes-servicio/${s.os[0]}/cerrar`), 'cerrar');
    s.instalacion1 = cierre.data.idInstalacionResultado;
    const det = ok(await a.app('GET', `/ordenes-servicio/${s.os[0]}`), 'detalle').data[0];
    expect(det.estatus).toBe('cerrada');
    expect(det.pruebas.every((p: any) => p.estatus === 'correcta' && p.nombreValido)).toBe(true);
    n.paso('App', 'Cierra la orden', `Cerrada; instalación #${s.instalacion1} activa en Next`);

    const crm = await a.ordenCrm(s.idOrden);
    expect(crm.instaladasApp).toBe(1);
    expect(crm.estatus).toBe('AGENDADA');
    n.paso('CRM', 'Sincroniza con Next', '1 de 2 unidades instaladas; la orden sigue agendada');
  });

  it('el PDF de la orden se comparte por WhatsApp y por correo', async () => {
    const pdf = await fetch(`${e.nextUrl}/ordenes-servicio/${s.os[0]}/pdf`, { headers: { Authorization: `Bearer ${a.tokenTecnico}` } });
    const buf = Buffer.from(await pdf.arrayBuffer());
    expect(pdf.status).toBe(200);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    const comp = ok(await a.app('POST', `/ordenes-servicio/${s.os[0]}/compartir`, { telefono: '527771234567' }), 'compartir').data[0];
    expect(comp.whatsapp).toMatch(/^https:\/\/wa\.me\/527771234567\?text=/);
    ok(await a.app('POST', `/ordenes-servicio/${s.os[0]}/enviar-correo`, { correos: ['laura@cliente.mx'] }), 'correo');
    expect(e.correo.enviados.at(-1)?.adjuntos?.[0].filename).toMatch(/^OS-\d{6}\.pdf$/);
    n.paso('App', 'Comparte la orden con el cliente: PDF por WhatsApp y por correo', `PDF de ${(buf.length / 1024).toFixed(0)} KB; enlace de 7 días y correo con adjunto`);
  });

  it('unidad 2: el cliente no estaba (no cumplida); la orden regresa a por agendar', async () => {
    ok(await a.app('POST', `/ordenes-servicio/${s.os[1]}/iniciar`, { claveApp: a.nuevaClave() }), 'iniciar');
    const motivos = ok(await a.app('GET', '/ordenes-servicio/motivos'), 'motivos').data;
    expect(motivos.find((m: any) => m.clave === 'cliente_ausente')?.cobrable).toBe(true);
    ok(await a.app('POST', `/ordenes-servicio/${s.os[1]}/no-cumplida`, { claveMotivo: 'cliente_ausente' }), 'no cumplida');
    n.paso('App', 'Llega a la unidad 2 y el vehículo no está: la marca "no cumplida" por cliente ausente', 'No cumplida, cobrable (el técnico sí fue)');

    const crm = await a.ordenCrm(s.idOrden);
    expect(crm.estatus).toBe('POR_AGENDAR');
    expect(crm.ordenesApp.map((x: any) => x.estatus).sort()).toEqual(['cerrada', 'no_cumplida']);
    n.paso('CRM', 'Sincroniza', 'La orden regresa a "por agendar": 1 de 2 hecha, 1 no cumplida (cliente_ausente)');
  });

  it('al reagendar solo se manda la unidad que falta, y al cerrarla la orden queda instalada', async () => {
    ok(
      await a.crm('PATCH', `/instalaciones/${s.idOrden}`, { cita: enDias(3), idTecnicoNext: NEXT.TECNICO.id, lugar: 'Patio de Transportes Uno', motivo: 'El cliente no estaba' }),
      'reagendar',
    );
    const nuevas = (await a.agendaApp()).filter((o) => o.referenciaCrm === `OI-${s.idOrden}-2`);
    expect(nuevas).toHaveLength(1);
    n.paso('CRM', 'Reagenda la orden con su motivo', `Llega a la app solo 1 orden nueva (${nuevas[0].folio}, referencia OI-${s.idOrden}-2)`);

    const r = await altaEnCampo(nuevas[0].id, 'TUN0002', s.equipos[1], s.idClienteNext);
    s.producto2 = r.idProducto;
    n.paso('App', 'Instala la unidad 2 (vehículo TUN0002) y el operador valida sus pruebas', `Cerrada; instalación #${r.idInstalacion}`);

    const crm = await a.ordenCrm(s.idOrden);
    expect(crm.estatus).toBe('INSTALADA');
    const servicio = e.consulta('CRM', `SELECT Estatus, FechaInicio IS NOT NULL FROM ServiciosContratados WHERE Id = ${s.idServicio}`)[0];
    expect(servicio[0]).toBe('ACTIVO');
    n.paso('CRM', 'Sincroniza', 'Orden INSTALADA; el servicio "Monitoreo y plataforma" queda ACTIVO y empieza a cobrarse');

    const unidades = ok(await a.crm('GET', `/instalaciones/unidades/${s.idCliente}`), 'unidades');
    expect(unidades.map((u: any) => u.placa).sort()).toEqual(['TUN0001', 'TUN0002']);
    expect(unidades.every((u: any) => /^OS-\d{6}$/.test(u.ordenFolio))).toBe(true);
    n.paso('CRM', 'Revisa las unidades del cliente', '2 unidades activas; su fecha de instalación viene de la orden de la app (no se corrige a mano)');
  });

  it('al técnico se le paga lo instalado y la visita en falso, cada uno con su tarifa', async () => {
    const hoy = new Date().toISOString().slice(0, 10);
    ok(await a.crm('POST', '/instaladores/tarifas', { tipo: 'instalacion', monto: 400, vigenteDesde: '2026-01-01' }), 'tarifa');
    const sin = ok(await a.crm('GET', '/instaladores/por-pagar'), 'por pagar').tecnicos.find((t: any) => t.idTecnico === NEXT.TECNICO.id);
    expect(sin.sinTarifa).toBe(1);
    n.paso('CRM', 'Administración fija la tarifa de instalación ($400) y revisa lo que se le debe a Juan', '2 instalaciones a $400 y 1 visita en falso "sin tarifa"');

    ok(await a.crm('POST', '/instaladores/tarifas', { tipo: 'instalacion', modalidad: 'NO_CUMPLIDA', monto: 150, vigenteDesde: '2026-01-01' }), 'tarifa en falso');
    const deuda = ok(await a.crm('GET', '/instaladores/por-pagar'), 'por pagar').tecnicos.find((t: any) => t.idTecnico === NEXT.TECNICO.id);
    expect(deuda.servicios).toHaveLength(3);
    expect(deuda.total).toBe(950);
    n.paso('CRM', 'Fija la tarifa de visita en falso de instalación ($150)', 'Por pagar a Juan: $950 (2 × $400 + 1 × $150)');

    const pago = ok(
      await a.crm('POST', '/instaladores/pagos', { idTecnico: NEXT.TECNICO.id, ids: deuda.servicios.map((x: any) => x.id), fecha: hoy, formaPago: 'TRANSFERENCIA' }),
      'pago',
    );
    expect(pago.total).toBe(950);
    n.paso('CRM', 'Registra el pago por transferencia', `Pago de $${pago.total} por ${pago.servicios} servicios`);
  });
});

/** Estado compartido entre escenarios: el cliente y sus unidades del escenario 1. */
const cliente: Record<string, any> = {};

describe('2. Mantenimiento: una revisión que termina en cambio de equipo, con código', () => {
  const s: Record<string, any> = {};

  it('el CRM levanta la revisión de una unidad y la agenda', async () => {
    n.escenario(
      'Mantenimiento: una revisión que termina en cambio de equipo, con código de verificación',
      'El cliente reporta que una unidad no transmite. El CRM levanta una revisión de esa unidad; en campo el técnico encuentra el equipo dañado y la convierte en cambio de equipo. Antes de tocar el vehículo confirma con un código que le dicta el operador que es el correcto.',
    );
    const venta = e.consulta('CRM', "SELECT Id, IdClienteNext FROM Clientes WHERE Rfc = 'TUN010101AB1'")[0];
    Object.assign(cliente, { idCliente: Number(venta[0]), idClienteNext: Number(venta[1]) });
    const unidades = ok(await a.crm('GET', `/instalaciones/unidades/${cliente.idCliente}`), 'unidades');
    const u = unidades.find((x: any) => x.placa === 'TUN0001');
    s.idInstalacion = u.idInstalacion;
    const orden = ok(
      await a.crm('POST', '/instalaciones/mantenimiento', {
        idCliente: cliente.idCliente,
        idInstalacionNext: u.idInstalacion,
        tipo: 'revision',
        notas: 'No reporta posición desde ayer',
      }),
      'mantenimiento',
    );
    s.idOrden = orden.id;
    expect(orden).toMatchObject({ tipoServicio: 'revision', vehiculo: 'TUN0001 · ECO-001', estatus: 'POR_AGENDAR' });
    n.paso('CRM', 'Levanta "Nuevo mantenimiento": revisión de TUN0001, "no reporta posición desde ayer"', `Orden ${orden.id} por agendar`);

    ok(await a.crm('PATCH', `/instalaciones/${s.idOrden}`, { cita: enDias(2), idTecnicoNext: NEXT.TECNICO.id, lugar: 'Patio de Transportes Uno' }), 'agendar');
    const os = (await a.agendaApp()).find((o) => o.referenciaCrm === `OI-${s.idOrden}`);
    expect(os).toMatchObject({ tipoServicio: 'revision', idInstalacionProgramada: s.idInstalacion });
    s.os = os.id;
    n.paso('App', 'Recibe la revisión con el vehículo programado', `${os.folio}: revisión de la instalación #${s.idInstalacion}`);
  });

  it('en campo la convierte en cambio de equipo y no puede cerrar sin código', async () => {
    ok(await a.app('POST', `/ordenes-servicio/${s.os}/iniciar`, { claveApp: a.nuevaClave(), tipoServicio: 'c_equipo' }), 'iniciar');
    const nuevo = e.inventarioNext(cliente.idClienteNext, 1)[0];
    s.nuevo = nuevo;
    await a.checklist(s.os, { idDispositivoNuevo: nuevo.idDispositivo, estatusSalienteAnterior: 4 });
    n.paso('App', 'Encuentra el equipo mojado: inicia como "cambio de equipo", elige el equipo nuevo y manda el viejo a mantenimiento', 'Tipo programado: revisión · tipo real: cambio de equipo');

    const intento = await a.app('POST', `/ordenes-servicio/${s.os}/cerrar`);
    expect(intento.status).toBe(400);
    expect(JSON.stringify(intento.body)).toContain('código de verificación');
    n.paso('App', 'Intenta cerrar', 'Rechazado: falta validar el código de verificación con el operador (y las pruebas)');
  });

  it('el operador en turno le dicta el código y confirma el vehículo', async () => {
    ok(await a.app('POST', `/ordenes-servicio/${s.os}/codigo`), 'pedir código');
    const pendientes = ok(await a.monitoreo('GET', '/ordenes-servicio/codigos-pendientes'), 'códigos').data;
    const p = pendientes.find((x: any) => x.id === s.os);
    expect(p).toMatchObject({ placa: 'TUN0001', cliente: expect.stringContaining('Transportes Uno') });
    expect(p.codigo).toBeUndefined();
    n.paso('App', 'Pide el código', 'Aparece en la pantalla del operador en turno con cliente, placa TUN0001 y técnico');

    const visto = ok(await a.monitoreo('POST', `/ordenes-servicio/${s.os}/codigo/ver`), 'ver código').data[0];
    expect(visto.codigo).toMatch(/^\d{6}$/);
    n.paso('Monitoreo', 'Abre el código para dictarlo (queda registrado quién lo vio)', 'Código de 6 dígitos, vence en 15 minutos');

    const malo = visto.codigo === '000000' ? '000001' : '000000';
    const error = await a.app('POST', `/ordenes-servicio/${s.os}/codigo/validar`, { codigo: malo });
    expect(error.status).toBe(400);
    expect(JSON.stringify(error.body)).toContain('quedan 4 intentos');
    ok(await a.app('POST', `/ordenes-servicio/${s.os}/codigo/validar`, { codigo: visto.codigo }), 'validar');
    n.paso('App', 'Captura mal el código una vez y luego bien', 'Primero "incorrecto, quedan 4 intentos"; después "vehículo confirmado"');
  });

  it('con las pruebas validadas cierra; Next archiva la versión anterior y el CRM la da por realizada', async () => {
    for (const pr of ['transmision', 'boton_panico']) {
      ok(await a.app('POST', `/ordenes-servicio/${s.os}/pruebas/${pr}/solicitar`), `pedir ${pr}`);
    }
    await a.validarPruebas(s.os);
    // paro_motor queda sin pedir: también debe tener respuesta (la pone el operador si se pide).
    const det = ok(await a.app('GET', `/ordenes-servicio/${s.os}`), 'detalle').data[0];
    expect(det.faltantesParaCerrar.join(' ')).toContain('paro_motor');
    ok(await a.app('POST', `/ordenes-servicio/${s.os}/pruebas/paro_motor/solicitar`), 'pedir paro');
    await a.validarPruebas(s.os);
    const cierre = ok(await a.app('POST', `/ordenes-servicio/${s.os}/cerrar`), 'cerrar');
    s.idNueva = cierre.data.idInstalacionResultado;
    expect(s.idNueva).not.toBe(s.idInstalacion);
    const det2 = ok(await a.app('GET', `/ordenes-servicio/${s.os}`), 'detalle').data[0];
    expect(det2).toMatchObject({ tipoDistinto: true, tipoProgramado: 'revision', tipoServicio: 'c_equipo', codigoValidado: true });
    const hist = e.consulta('Next', `SELECT Accion FROM HistoricoInstalaciones WHERE IdInstalacionOriginal = ${s.idInstalacion} OR Id = ${det2.idHistoricoInstalacion ?? 0}`);
    expect(hist.length).toBeGreaterThan(0);
    n.paso('App', 'Pide las pruebas (cada una debe validarla el operador) y cierra', `Instalación #${s.idInstalacion} archivada en el histórico; nueva versión #${s.idNueva} con el equipo ${s.nuevo.imei}`);

    const crm = await a.ordenCrm(s.idOrden);
    expect(crm.estatus).toBe('INSTALADA');
    const u = ok(await a.crm('GET', `/instalaciones/unidades/${cliente.idCliente}`), 'unidades').find((x: any) => x.placa === 'TUN0001');
    expect(u).toMatchObject({ idInstalacion: s.idNueva, ordenFolio: det2.folio });
    n.paso('CRM', 'Sincroniza', `Mantenimiento realizado; TUN0001 ahora es la instalación #${s.idNueva} y su fecha viene de ${det2.folio}`);
  });

  it('el cambio de equipo se paga con su tarifa', async () => {
    const antes = ok(await a.crm('GET', '/instaladores/por-pagar'), 'por pagar').tecnicos.find((t: any) => t.idTecnico === NEXT.TECNICO.id);
    expect(antes.servicios).toHaveLength(1);
    expect(antes.sinTarifa).toBe(1);
    ok(await a.crm('POST', '/instaladores/tarifas', { tipo: 'c_equipo', monto: 300, vigenteDesde: '2026-01-01' }), 'tarifa');
    const deuda = ok(await a.crm('GET', '/instaladores/por-pagar'), 'por pagar').tecnicos.find((t: any) => t.idTecnico === NEXT.TECNICO.id);
    expect(deuda.total).toBe(300);
    n.paso('CRM', 'Revisa lo que se le debe a Juan y fija la tarifa de cambio de equipo', 'Por pagar: 1 cambio de equipo, $300 (se paga como lo que se hizo, no como lo programado)');
  });
});

describe('3. Instalación sobre un vehículo que ya trae equipo: rechazo y luego autorización con sobreprecio', () => {
  const s: Record<string, any> = {};

  it('el técnico encuentra equipo y pide autorización; la orden no se puede cerrar', async () => {
    n.escenario(
      'Instalación sobre un vehículo que ya trae equipo: rechazo y autorización con sobreprecio',
      'Al instalar, el técnico encuentra otro equipo en el vehículo. Quitarlo tiene un sobreprecio que se negocia con el cliente en el CRM. La primera vez el cliente no acepta (visita no cumplida, se le paga al técnico); después acepta y el sobreprecio entra a cobranza con la fecha negociada.',
    );
    Object.assign(s, e.nuevaOrdenCrm(cliente.idCliente, 1));
    ok(await a.crm('PATCH', `/instalaciones/${s.idOrden}`, { cita: enDias(4), idTecnicoNext: NEXT.TECNICO.id, lugar: 'Patio de Transportes Uno' }), 'agendar');
    s.os = (await a.agendaApp()).find((o) => o.referenciaCrm === `OI-${s.idOrden}`).id;
    n.paso('CRM', 'Agenda una nueva instalación de 1 unidad para el cliente', `Orden ${s.idOrden}`);

    const producto2 = Number(e.consulta('Next', "SELECT IdProducto FROM Vehiculos WHERE Placa = 'TUN0002'")[0][0]);
    s.producto = producto2;
    ok(await a.app('POST', `/ordenes-servicio/${s.os}/iniciar`, { claveApp: a.nuevaClave() }), 'iniciar');
    ok(await a.app('PATCH', `/ordenes-servicio/${s.os}`, { idProducto: producto2 }), 'vehículo');
    await a.subirArchivo(s.os, 'equipo_existente');
    ok(await a.app('POST', `/ordenes-servicio/${s.os}/autorizacion`, { observaciones: 'Trae un GPS de otra marca bajo el tablero' }), 'autorización');
    n.paso('App', 'El vehículo (TUN0002) ya trae un GPS: toma foto y pide autorización para quitarlo', 'Autorización pendiente; la orden no se puede cerrar');
  });

  it('el cliente no acepta el sobreprecio: no cumplida y regresa a por agendar', async () => {
    const pend = ok(await a.crm('GET', '/instalaciones/autorizaciones'), 'autorizaciones');
    const p = pend.pendientes.find((x: any) => x.id === s.os);
    expect(p).toMatchObject({ placa: 'TUN0002', idOrdenCrm: s.idOrden });
    n.paso('CRM', 'Ve la autorización pendiente en "Instalaciones → Autorizaciones"', `Orden ${s.idOrden}, TUN0002, "Trae un GPS de otra marca bajo el tablero"`);

    ok(await a.crm('POST', `/instalaciones/autorizaciones/${s.os}`, { autorizada: false, observaciones: 'El cliente no acepta el costo' }), 'rechazar');
    const det = ok(await a.app('GET', `/ordenes-servicio/${s.os}`), 'detalle').data[0];
    expect(det).toMatchObject({ estatus: 'no_cumplida', claveMotivo: 'sin_autorizacion_desinstalacion', cobrable: true, origenAutorizacion: 'crm' });
    const crm = await a.ordenCrm(s.idOrden);
    expect(crm.estatus).toBe('POR_AGENDAR');
    n.paso('CRM', 'El cliente no acepta el costo: rechaza', 'En la app la orden queda no cumplida y cobrable; en el CRM la orden regresa a por agendar');
  });

  it('después acepta: se autoriza con sobreprecio, entra a cobranza y se instala quitando el equipo anterior', async () => {
    ok(await a.crm('PATCH', `/instalaciones/${s.idOrden}`, { cita: enDias(6), idTecnicoNext: NEXT.TECNICO.id, lugar: 'Patio de Transportes Uno', motivo: 'Cliente aceptó el costo' }), 'reagendar');
    s.os2 = (await a.agendaApp()).find((o) => o.referenciaCrm === `OI-${s.idOrden}-2`).id;
    ok(await a.app('POST', `/ordenes-servicio/${s.os2}/iniciar`, { claveApp: a.nuevaClave() }), 'iniciar');
    ok(await a.app('PATCH', `/ordenes-servicio/${s.os2}`, { idProducto: s.producto }), 'vehículo');
    ok(await a.app('POST', `/ordenes-servicio/${s.os2}/autorizacion`, { observaciones: 'Mismo equipo de otra marca' }), 'autorización');

    const vence = enDias(15).slice(0, 10);
    ok(await a.crm('POST', `/instalaciones/autorizaciones/${s.os2}`, { autorizada: true, sobreprecio: 850, cobro: 'FECHA', vence }), 'autorizar');
    const orden = await a.ordenCrm(s.idOrden);
    expect(orden.sobreprecio).toBe(850);
    expect(orden.idCargoSobreprecio).toBeGreaterThan(0);
    const cargos = ok(await a.crm('GET', `/cobranza?idCliente=${cliente.idCliente}`), 'cobranza');
    const lista = Array.isArray(cargos) ? cargos : (cargos.cargos ?? cargos.data ?? []);
    const cargo = lista.find((c: any) => c.id === orden.idCargoSobreprecio);
    expect(cargo).toMatchObject({ tipo: 'UNICO', subtotal: 850, total: 986, vence, estatus: 'PENDIENTE' });
    n.paso('CRM', `Se reagenda; el cliente acepta $850 + IVA y se autoriza con cobro en fecha negociada (${vence})`, `Cargo único de $986 en cobranza, ligado a la orden ${s.idOrden}`);

    const equipo = e.inventarioNext(cliente.idClienteNext, 1)[0];
    await a.checklist(s.os2, { idProducto: s.producto, idDispositivoNuevo: equipo.idDispositivo, idSimNuevo: equipo.idSim });
    for (const pr of ['transmision', 'boton_panico', 'paro_motor']) {
      ok(await a.app('POST', `/ordenes-servicio/${s.os2}/pruebas/${pr}/solicitar`), `pedir ${pr}`);
    }
    await a.validarPruebas(s.os2);
    const cierre = ok(await a.app('POST', `/ordenes-servicio/${s.os2}/cerrar`), 'cerrar');
    const det = ok(await a.app('GET', `/ordenes-servicio/${s.os2}`), 'detalle').data[0];
    expect(det.idInstalacionRetirada).toBeGreaterThan(0);
    n.paso('App', 'Quita el equipo anterior, instala el nuevo y cierra con las pruebas validadas', `En la misma operación: baja de la instalación #${det.idInstalacionRetirada} y alta #${cierre.data.idInstalacionResultado}`);

    expect((await a.ordenCrm(s.idOrden)).estatus).toBe('INSTALADA');
    n.paso('CRM', 'Sincroniza', 'Orden INSTALADA');
  });

  it('al técnico se le paga la visita rechazada como visita en falso', async () => {
    const deuda = ok(await a.crm('GET', '/instaladores/por-pagar'), 'por pagar').tecnicos.find((t: any) => t.idTecnico === NEXT.TECNICO.id);
    const etiquetas = deuda.servicios.map((x: any) => x.nombreTipo);
    expect(etiquetas.some((t: string) => t.includes('no cumplida: sin_autorizacion_desinstalacion'))).toBe(true);
    expect(deuda.total).toBe(300 + 150 + 400);
    n.paso('CRM', 'Revisa lo que se le debe a Juan', 'Cambio de equipo $300 + visita en falso $150 (no autorizaron) + instalación $400 = $850');
  });
});

describe('4. Cancelaciones: antes y después de que el técnico empiece', () => {
  it('cancelar en el CRM una orden aún programada la cancela en la app', async () => {
    n.escenario(
      'Cancelaciones: antes y después de que el técnico empiece',
      'Si la orden sigue programada, cancelarla en el CRM la cancela en la app. Si el técnico ya empezó, el CRM no puede cancelarla: queda anotado y la cierra operación en Next con su motivo.',
    );
    const o = e.nuevaOrdenCrm(cliente.idCliente, 1);
    ok(await a.crm('PATCH', `/instalaciones/${o.idOrden}`, { cita: enDias(8), idTecnicoNext: NEXT.TECNICO_2.id, lugar: 'Oficina' }), 'agendar');
    const os = (await a.agendaApp(a.tokenTecnico2)).find((x) => x.referenciaCrm === `OI-${o.idOrden}`);
    const intento = await a.app('POST', `/ordenes-servicio/${os.id}/cancelar`, {}, a.tokenTecnico2);
    expect(intento.status).toBe(403);
    n.paso('App', 'El técnico intenta cancelar una orden programada', 'Rechazado: solo operación o el CRM la cancelan');

    ok(await a.crm('POST', `/instalaciones/${o.idOrden}/cancelar`, { motivo: 'El cliente desistió' }), 'cancelar');
    const det = ok(await a.operacion('GET', `/ordenes-servicio/${os.id}`), 'detalle').data[0];
    expect(det).toMatchObject({ estatus: 'cancelada', claveMotivo: 'otro' });
    n.paso('CRM', 'Cancela la orden ("el cliente desistió")', `En la app ${os.folio} queda cancelada con el motivo`);
  });

  it('si el técnico ya empezó, el CRM no la cancela; la cierra operación en Next', async () => {
    const o = e.nuevaOrdenCrm(cliente.idCliente, 1);
    ok(await a.crm('PATCH', `/instalaciones/${o.idOrden}`, { cita: enDias(9), idTecnicoNext: NEXT.TECNICO_2.id, lugar: 'Oficina' }), 'agendar');
    const os = (await a.agendaApp(a.tokenTecnico2)).find((x) => x.referenciaCrm === `OI-${o.idOrden}`);
    ok(await a.app('POST', `/ordenes-servicio/${os.id}/iniciar`, { claveApp: a.nuevaClave() }, a.tokenTecnico2), 'iniciar');
    ok(await a.crm('POST', `/instalaciones/${o.idOrden}/cancelar`, { motivo: 'El cliente desistió' }), 'cancelar');
    const bit = e.consulta('CRM', `SELECT Descripcion FROM Bitacora WHERE Accion = 'INSTALACION_NEXT_ERROR' ORDER BY Id DESC LIMIT 1`)[0]?.[0] ?? '';
    expect(bit).toContain(`${os.folio} ya la inició el técnico`);
    expect(ok(await a.operacion('GET', `/ordenes-servicio/${os.id}`), 'detalle').data[0].estatus).toBe('borrador');
    n.paso('CRM', 'Cancela una orden que el técnico ya inició', `La del CRM se cancela; en Next ${os.folio} sigue en curso y queda anotado en la bitácora para operación`);

    ok(await a.operacion('POST', `/ordenes-servicio/${os.id}/cancelar`, { claveMotivo: 'cancelada_por_cliente' }), 'cancelar en Next');
    expect(ok(await a.operacion('GET', `/ordenes-servicio/${os.id}`), 'detalle').data[0].estatus).toBe('cancelada');
    n.paso('Operación', 'Cancela en Next con motivo "cancelada por el cliente"', `${os.folio} cancelada`);
  });
});
