/**
 * Reglas puras de la orden de servicio (sin BD): tipos, secciones y qué falta
 * para poder cerrarla. Docs: docs/contratos.md §14.1.
 */

export const TIPOS_SERVICIO = [
  'instalacion',
  'revision',
  'c_sim',
  'c_equipo',
  'desinstalacion',
] as const;
export type TipoServicio = (typeof TIPOS_SERVICIO)[number];

/** Secciones de casillas sí/no; fotos y firmas son archivos. */
export const SECCIONES_RESPUESTA = [
  'vehiculo_cuenta_con',
  'funcionamiento_vehiculo',
  'fallas_equipo',
  'pruebas',
] as const;
export const SECCIONES_ARCHIVO = ['fotos', 'firmas'] as const;

/**
 * programada (CRM u operación) → borrador (el técnico la inició) → cerrada |
 * no_cumplida; cancelada antes de iniciar o por operación. Ver
 * docs/ordenes-servicio.md §12.7.
 */
export const ESTATUS_ORDEN = {
  PROGRAMADA: 'programada',
  BORRADOR: 'borrador',
  CERRADA: 'cerrada',
  NO_CUMPLIDA: 'no_cumplida',
  CANCELADA: 'cancelada',
} as const;

/** Quién programó la orden: el CRM por API o la operación desde el front. */
export const ORIGEN_ORDEN = { CRM: 'crm', NEXT: 'next' } as const;

/** Autorización de desinstalar un equipo existente antes de un alta (§12.6). */
export const AUTORIZACION = {
  PENDIENTE: 'pendiente',
  AUTORIZADA: 'autorizada',
  RECHAZADA: 'rechazada',
} as const;

/** Quién aplica un motivo de no cumplida o cancelación (columna `Quien`). */
export const ACTOR_MOTIVO = { TECNICO: 'tecnico', OPERACION: 'operacion', CRM: 'crm' } as const;
export type ActorMotivo = (typeof ACTOR_MOTIVO)[keyof typeof ACTOR_MOTIVO];

/** Motivo con el que se cierra sola una orden cuya desinstalación se rechazó. */
export const MOTIVO_SIN_AUTORIZACION = 'sin_autorizacion_desinstalacion';

/** Código de verificación de mantenimientos (§12.5). */
export const CODIGO = { DIGITOS: 6, VIGENCIA_MIN: 15, INTENTOS: 5 } as const;

/** Desinstalación: la instalación queda inactiva (0) o inservible (5). */
export const ESTATUS_BAJA_PERMITIDOS = [0, 5] as const;

export interface OpcionCatalogo {
  seccion: string;
  clave: string;
  obligatorio: number;
}

export interface OrdenParaCierre {
  tipoServicio: string;
  idInstalacion: number | null;
  idProducto: number | null;
  idDispositivoNuevo: number | null;
  idSimNuevo: number | null;
  estatusSalienteAnterior: number | null;
  estatusInstalacionBaja: number | null;
  idMonitorista: number | null;
  observaciones: string | null;
  /** Etapa 2: solo las órdenes programadas (con origen) exigen el código. */
  origen?: string | null;
  codigoValidado?: boolean;
  autorizacion?: string | null;
}

export function esTipoServicio(value: unknown): value is TipoServicio {
  return TIPOS_SERVICIO.includes(value as TipoServicio);
}

/** Alta: la instalación nace al cerrar. Los demás tipos atienden una existente. */
export function requiereInstalacionExistente(tipo: TipoServicio): boolean {
  return tipo !== 'instalacion';
}

/** Mantenimientos: atienden un vehículo con equipo y piden código de verificación. */
export function esMantenimiento(tipo: string): boolean {
  return esTipoServicio(tipo) && tipo !== 'instalacion';
}

/**
 * En campo el técnico confirma o corrige el tipo programado, pero no cruza
 * entre alta y mantenimiento: eso es otro trabajo y lo programa operación.
 */
export function cambioDeTipoPermitido(programado: string, real: string): boolean {
  return programado === real || (esMantenimiento(programado) && esMantenimiento(real));
}

export interface MotivoCatalogo {
  clave: string;
  resultado: string;
  quien: string;
  estatus: number;
}

/** El motivo existe, está activo, lleva a ese resultado y ese actor lo puede usar. */
export function motivoPermitido(
  motivo: MotivoCatalogo | null | undefined,
  resultado: 'no_cumplida' | 'cancelada',
  actor: ActorMotivo,
): string | null {
  if (!motivo || Number(motivo.estatus) !== 1) return 'El motivo no existe o no está activo';
  const resultados = motivo.resultado.split(',').map((r) => r.trim());
  if (!resultados.includes(resultado)) {
    return `El motivo ${motivo.clave} no aplica a una orden ${resultado}`;
  }
  const actores = motivo.quien.split(',').map((q) => q.trim());
  if (!actores.includes(actor)) {
    return `El motivo ${motivo.clave} no lo puede aplicar ${actor}`;
  }
  return null;
}

/** Estado del código de verificación a una hora dada. */
export function estadoCodigo(
  o: { codigo: string | null; codigoExpira: Date | null; codigoIntentos: number | null },
  ahora: Date,
): 'sin_codigo' | 'vigente' | 'vencido' | 'agotado' {
  if (!o.codigo || !o.codigoExpira) return 'sin_codigo';
  if (Number(o.codigoIntentos ?? 0) >= CODIGO.INTENTOS) return 'agotado';
  return o.codigoExpira.getTime() > ahora.getTime() ? 'vigente' : 'vencido';
}

/**
 * Lista de lo que falta para cerrar (vacía = se puede cerrar). Mensajes en
 * español para mostrarlos tal cual en la app.
 */
export function faltantesParaCerrar(
  orden: OrdenParaCierre,
  respuestas: Array<{ seccion: string; clave: string; valor: number }>,
  archivos: Array<{ clave: string }>,
  catalogo: OpcionCatalogo[],
): string[] {
  const faltan: string[] = [];
  const tipo = orden.tipoServicio as TipoServicio;

  // Cada casilla del catálogo debe tener respuesta (sí o no): así se distingue
  // "no tiene / no pasó" de "no se revisó".
  const respondidas = new Set(respuestas.map((r) => `${r.seccion}:${r.clave}`));
  for (const seccion of SECCIONES_RESPUESTA) {
    const sinRespuesta = catalogo
      .filter((o) => o.seccion === seccion)
      .filter((o) => !respondidas.has(`${seccion}:${o.clave}`))
      .map((o) => o.clave);
    if (sinRespuesta.length) {
      faltan.push(`Sin respuesta en ${seccion}: ${sinRespuesta.join(', ')}`);
    }
  }

  const valor = (seccion: string, clave: string) =>
    respuestas.find((r) => r.seccion === seccion && r.clave === clave)?.valor;

  if (valor('fallas_equipo', 'otro') === 1 && !orden.observaciones?.trim()) {
    faltan.push('La falla "Otro" requiere describirla en observaciones');
  }

  // Al menos una prueba correcta, salvo en desinstalación (ya no hay equipo).
  if (
    tipo !== 'desinstalacion' &&
    !respuestas.some((r) => r.seccion === 'pruebas' && r.valor === 1)
  ) {
    faltan.push('Al menos una prueba debe resultar correcta');
  }

  const subidos = new Set(archivos.map((a) => a.clave));
  const archivosFaltantes = catalogo
    .filter((o) => (SECCIONES_ARCHIVO as readonly string[]).includes(o.seccion))
    .filter((o) => o.obligatorio === 1 && !subidos.has(o.clave))
    .map((o) => o.clave);
  if (archivosFaltantes.length) {
    faltan.push(`Faltan archivos: ${archivosFaltantes.join(', ')}`);
  }

  if (orden.idMonitorista == null) {
    faltan.push('Falta el monitorista');
  }

  switch (tipo) {
    case 'instalacion':
      if (orden.idProducto == null) faltan.push('Falta el vehículo (idProducto)');
      if (orden.idDispositivoNuevo == null)
        faltan.push('Falta el equipo a instalar (idDispositivoNuevo)');
      break;
    case 'c_equipo':
      if (orden.idDispositivoNuevo == null)
        faltan.push('Falta el equipo nuevo (idDispositivoNuevo)');
      if (orden.estatusSalienteAnterior == null)
        faltan.push('Falta el estatus del equipo que sale (estatusSalienteAnterior)');
      break;
    case 'c_sim':
      if (orden.idSimNuevo == null) faltan.push('Falta la SIM nueva (idSimNuevo)');
      if (orden.estatusSalienteAnterior == null)
        faltan.push('Falta el estatus de la SIM que sale (estatusSalienteAnterior)');
      break;
    case 'desinstalacion':
      if (
        orden.estatusInstalacionBaja == null ||
        !(ESTATUS_BAJA_PERMITIDOS as readonly number[]).includes(
          orden.estatusInstalacionBaja,
        )
      ) {
        faltan.push('Falta el estatus de la baja (estatusInstalacionBaja: 0 o 5)');
      }
      break;
  }
  if (requiereInstalacionExistente(tipo) && orden.idInstalacion == null) {
    faltan.push('Falta la instalación atendida (idInstalacion)');
  }
  // Las órdenes que la app crea sola (sin origen, etapa 1) no piden código
  // mientras la app migra a programada + iniciar.
  if (orden.origen && esMantenimiento(tipo) && !orden.codigoValidado) {
    faltan.push('Falta validar el código de verificación con el operador');
  }
  if (orden.autorizacion === AUTORIZACION.PENDIENTE) {
    faltan.push('La desinstalación del equipo existente está pendiente de autorización');
  }
  return faltan;
}

export function folioDe(id: number): string {
  return `OS-${String(id).padStart(6, '0')}`;
}
