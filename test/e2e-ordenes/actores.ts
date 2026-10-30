import { randomUUID } from 'crypto';
import { Entorno, NEXT, Respuesta } from './entorno';

/** Permisos del usuario de Operaciones en el CRM (gerente de operaciones + administradora). */
const PERMISOS_CRM = [
  'instalaciones.ver',
  'instalaciones.editar',
  'postventa.ver',
  'postventa.editar',
  'instaladores.ver',
  'instaladores.pagar',
  'cobranza.ver',
  'cobranza.editar',
];

/** PNG de 1×1 para fotos y firmas. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

export class ErrorDeLlamada extends Error {
  constructor(
    readonly respuesta: Respuesta,
    contexto: string,
  ) {
    super(`${contexto} → ${respuesta.status}: ${JSON.stringify(respuesta.body).slice(0, 600)}`);
  }
}

/** Exige un estatus HTTP y devuelve el cuerpo. */
export function ok<T = any>(r: Respuesta<T>, contexto: string, esperado: number | number[] = [200, 201]): T {
  const lista = Array.isArray(esperado) ? esperado : [esperado];
  if (!lista.includes(r.status)) throw new ErrorDeLlamada(r, contexto);
  return r.body;
}

/** Los actores de la operación real, cada uno con su sesión y solo sus endpoints. */
export class Actores {
  readonly tokenCrm: string;
  readonly tokenTecnico: string;
  readonly tokenTecnico2: string;
  readonly tokenMonitoreo: string;
  readonly tokenOperacion: string;

  constructor(private readonly e: Entorno) {
    this.tokenCrm = e.tokenCrm(PERMISOS_CRM, 1, 2);
    this.tokenTecnico = e.tokenNext(NEXT.TECNICO);
    this.tokenTecnico2 = e.tokenNext(NEXT.TECNICO_2);
    this.tokenMonitoreo = e.tokenNext(NEXT.MONITOREO);
    this.tokenOperacion = e.tokenNext(NEXT.ADMIN);
  }

  // --------------------------------------------------------------------- CRM
  crm<T = any>(metodo: string, ruta: string, cuerpo?: unknown) {
    return this.e.llamar<T>(this.e.crmUrl, metodo, ruta, this.tokenCrm, cuerpo);
  }

  /** Espera la sincronización del CRM con Next (la lista la hace en segundo plano). */
  async sincronizarCrm() {
    return ok(await this.crm('POST', '/instalaciones/sincronizar'), 'sincronizar CRM');
  }

  /** Orden del CRM tal como la ve la pantalla de Instalaciones, después de sincronizar con Next. */
  async ordenCrm(id: number, estatus?: string) {
    await this.sincronizarCrm();
    const lista = ok(await this.crm('GET', `/instalaciones${estatus ? `?estatus=${estatus}` : ''}`), 'listar instalaciones');
    const todas = [
      ...(lista.ordenes ?? []),
      ...(estatus ? [] : ok(await this.crm('GET', '/instalaciones?estatus=INSTALADA'), 'instaladas').ordenes),
      ...(estatus ? [] : ok(await this.crm('GET', '/instalaciones?estatus=CANCELADA'), 'canceladas').ordenes),
    ];
    const o = todas.find((x: { id: number }) => x.id === id);
    if (!o) throw new Error(`La orden ${id} no aparece en el CRM`);
    return o;
  }

  // --------------------------------------------------------------------- App
  app<T = any>(metodo: string, ruta: string, cuerpo?: unknown, token = this.tokenTecnico) {
    return this.e.llamar<T>(this.e.nextUrl, metodo, ruta, token, cuerpo);
  }

  async agendaApp(token = this.tokenTecnico) {
    return ok(await this.app('GET', '/ordenes-servicio/paginado/1/50?estatus=programada', undefined, token), 'agenda de la app').data as any[];
  }

  async subirArchivo(id: number, clave: string, token = this.tokenTecnico) {
    const fd = new FormData();
    fd.append('file', new Blob([PNG], { type: 'image/png' }), `${clave}.png`);
    const r = await fetch(`${this.e.nextUrl}/ordenes-servicio/${id}/archivos/${clave}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    const body = await r.json().catch(() => null);
    return ok({ status: r.status, body }, `subir ${clave}`);
  }

  /** Checklist completo como lo llena el técnico (sin la sección de pruebas, que valida el operador). */
  async checklist(id: number, extra: Record<string, unknown> = {}, conPruebas = false, token = this.tokenTecnico) {
    const cat = ok(await this.app('GET', '/ordenes-servicio/catalogo', undefined, token), 'catálogo').data[0];
    const respuestas: Array<{ seccion: string; clave: string; valor: boolean }> = [];
    for (const seccion of ['vehiculo_cuenta_con', 'funcionamiento_vehiculo', 'fallas_equipo', ...(conPruebas ? ['pruebas'] : [])]) {
      for (const o of cat.secciones[seccion] ?? []) {
        respuestas.push({
          seccion,
          clave: o.clave,
          valor: seccion === 'fallas_equipo' ? false : seccion === 'pruebas' ? false : true,
        });
      }
    }
    ok(
      await this.app(
        'PATCH',
        `/ordenes-servicio/${id}`,
        { idMonitorista: NEXT.MONITOREO.id, fechaCaptura: new Date().toISOString(), lat: 18.95, lng: -99.23, respuestas, ...extra },
        token,
      ),
      'checklist',
    );
    for (const clave of ['tablero_inicio', 'tablero_final', 'firma_cliente', 'firma_tecnico']) {
      await this.subirArchivo(id, clave, token);
    }
  }

  nuevaClave(): string {
    return randomUUID();
  }

  // ------------------------------------------------------------- Monitoreo
  monitoreo<T = any>(metodo: string, ruta: string, cuerpo?: unknown) {
    return this.e.llamar<T>(this.e.nextUrl, metodo, ruta, this.tokenMonitoreo, cuerpo);
  }

  /** El operador valida (como correctas) todas las pruebas pendientes de una orden. */
  async validarPruebas(id: number) {
    const pendientes = ok(await this.monitoreo('GET', '/ordenes-servicio/pruebas-pendientes'), 'pruebas pendientes').data as any[];
    const deLaOrden = pendientes.filter((p) => p.id === id);
    for (const p of deLaOrden) {
      ok(await this.monitoreo('POST', `/ordenes-servicio/${id}/pruebas/${p.prueba}/validar`, { correcta: true }), `validar ${p.prueba}`);
    }
    return deLaOrden.map((p) => p.prueba as string);
  }

  // ------------------------------------------------------------- Operación
  operacion<T = any>(metodo: string, ruta: string, cuerpo?: unknown) {
    return this.e.llamar<T>(this.e.nextUrl, metodo, ruta, this.tokenOperacion, cuerpo);
  }
}
