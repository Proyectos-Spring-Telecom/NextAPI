import { Actores, ok } from './actores';
import { Entorno, NEXT } from './entorno';

/** Fecha local 'YYYY-MM-DDTHH:mm' a N días, para la cita del CRM. */
export const enDias = (d: number, hora = 10) => {
  const f = new Date(Date.now() + d * 86400000);
  const p = (x: number) => String(x).padStart(2, '0');
  return `${f.getFullYear()}-${p(f.getMonth() + 1)}-${p(f.getDate())}T${p(hora)}:00`;
};

/** Cliente vendido en el CRM y dado de alta en Next, con inventario. */
export async function clienteListo(e: Entorno, a: Actores, rfc: string, equipos = 6) {
  const v = e.ventaCrm({ razonSocial: `Cliente ${rfc}`, rfc, unidades: 1 });
  const b = ok(await a.crm('GET', `/postventa/clientes/${v.idCliente}/alta-next`), 'borrador');
  const alta = ok(
    await a.crm('POST', `/postventa/clientes/${v.idCliente}/alta-next`, {
      ...b.alta,
      numerosEmergencia: [{ nombre: 'Contacto', telefono: '7771234567', prioridad: 1 }],
    }),
    'alta',
  );
  return { ...v, idClienteNext: Number(alta.idClienteNext), inventario: e.inventarioNext(Number(alta.idClienteNext), equipos) };
}

/** Agenda en el CRM una orden y devuelve las órdenes de la app que generó. */
export async function agendar(a: Actores, idOrden: number, tecnico: { id: number } = NEXT.TECNICO, token = a.tokenTecnico, dias = 1) {
  ok(await a.crm('PATCH', `/instalaciones/${idOrden}`, { cita: enDias(dias), idTecnicoNext: tecnico.id, lugar: 'Patio', forzar: true }), 'agendar');
  return (await a.agendaApp(token)).filter((o) => String(o.referenciaCrm).startsWith(`OI-${idOrden}`));
}

/** Alta lista para cerrar: iniciada, vehículo, checklist, archivos y pruebas validadas. */
export async function altaListaParaCerrar(a: Actores, idOs: number, idCliente: number, placa: string, equipo: { idDispositivo: number; idSim: number }) {
  ok(await a.app('POST', `/ordenes-servicio/${idOs}/iniciar`, { claveApp: a.nuevaClave() }), 'iniciar');
  const veh = ok(await a.app('POST', '/productos/vehiculos', { idCliente, placa }), 'vehículo');
  await a.checklist(idOs, { idProducto: Number(veh.data.id), idDispositivoNuevo: equipo.idDispositivo, idSimNuevo: equipo.idSim });
  for (const p of ['transmision', 'boton_panico', 'paro_motor']) {
    ok(await a.app('POST', `/ordenes-servicio/${idOs}/pruebas/${p}/solicitar`), `pedir ${p}`);
  }
  await a.validarPruebas(idOs);
  return Number(veh.data.id);
}
