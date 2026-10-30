import { BadRequestException } from '@nestjs/common';
import { EnumEstatusInstalacion, EnumRoles } from 'src/common/estatus.enum';

/** Reglas puras del motor de activos (docs/motor-activos.md §1). */

export type TipoRecurso = 'dispositivo' | 'sim' | 'producto';

/** De dónde viene el movimiento. `api` = front o App por REST. */
export type OrigenMovimiento = 'api' | 'orden' | 'sistema';

/** Qué operación del motor lo generó (MovimientosRecurso.Accion). */
export type AccionMovimiento =
  | 'alta'
  | 'instalacion'
  | 'cambio'
  | 'baja'
  | 'reactivacion'
  | 'estatus'
  | 'traspaso';

/** Estatus de dispositivos y SIM (CatEstatusRecurso). */
export enum EstatusRecurso {
  INACTIVO = 0,
  DISPONIBLE = 1,
  INSTALADO = 2,
  POR_REVISAR = 3,
  LABORATORIO = 4,
  INSERVIBLE = 5,
}

export const NOMBRE_ESTATUS_RECURSO: Record<EstatusRecurso, string> = {
  [EstatusRecurso.INACTIVO]: 'inactivo',
  [EstatusRecurso.DISPONIBLE]: 'disponible',
  [EstatusRecurso.INSTALADO]: 'instalado',
  [EstatusRecurso.POR_REVISAR]: 'por revisar',
  [EstatusRecurso.LABORATORIO]: 'laboratorio',
  [EstatusRecurso.INSERVIBLE]: 'inservible',
};

/**
 * Cambios a mano de un dispositivo o SIM (`PATCH …/estatus/:id`). Instalar (→ 2)
 * y desinstalar (2 →) solo los hace una instalación. 1 → 3 manda a revisión un
 * equipo del almacén que se encontró dañado.
 */
export const TRANSICIONES_MANUALES: Readonly<Record<number, readonly number[]>> = {
  [EstatusRecurso.INACTIVO]: [EstatusRecurso.DISPONIBLE],
  [EstatusRecurso.DISPONIBLE]: [EstatusRecurso.INACTIVO, EstatusRecurso.POR_REVISAR],
  [EstatusRecurso.POR_REVISAR]: [
    EstatusRecurso.DISPONIBLE,
    EstatusRecurso.LABORATORIO,
    EstatusRecurso.INSERVIBLE,
    EstatusRecurso.INACTIVO,
  ],
  [EstatusRecurso.LABORATORIO]: [EstatusRecurso.DISPONIBLE, EstatusRecurso.INSERVIBLE],
  [EstatusRecurso.INSERVIBLE]: [],
};

/** A dónde puede ir un dispositivo o SIM que sale de una instalación. */
export const ESTATUS_SALIDA_INSTALACION: readonly number[] = [
  EstatusRecurso.POR_REVISAR,
  EstatusRecurso.LABORATORIO,
  EstatusRecurso.INSERVIBLE,
];

/** Inservible es terminal: solo SA y Dev lo corrigen, con motivo (error de captura). */
const ROLES_CORRIGEN_INSERVIBLE: readonly number[] = [EnumRoles.SA, EnumRoles.DEV];

const ARTICULO: Record<TipoRecurso, string> = {
  dispositivo: 'el dispositivo',
  sim: 'la SIM',
  producto: 'el producto',
};

function nombre(estatus: number): string {
  return NOMBRE_ESTATUS_RECURSO[estatus as EstatusRecurso] ?? String(estatus);
}

function lista(estatus: readonly number[]): string {
  return estatus.map((e) => `${e} (${nombre(e)})`).join(', ');
}

/**
 * Valida un cambio de estatus a mano. Producto conserva su escala actual hasta
 * la fase C (sin "asignado" a mano); dispositivo y SIM siguen la tabla de §1.
 */
export function assertTransicionManual(
  tipo: TipoRecurso,
  actual: number,
  nuevo: number,
  quien: { rol: number; motivo?: string | null },
): void {
  const recurso = ARTICULO[tipo];
  if (actual === nuevo) {
    throw new BadRequestException(`${capital(recurso)} ya está en estatus ${nuevo} (${nombre(nuevo)}).`);
  }
  if (nuevo === EstatusRecurso.INSTALADO) {
    throw new BadRequestException(
      `El estatus 2 de ${recurso} solo lo pone una instalación.`,
    );
  }
  if (actual === EstatusRecurso.INSTALADO) {
    throw new BadRequestException(
      `No es posible cambiar el estatus de ${recurso} porque está en una instalación activa; ` +
        'se cambia al dar de baja la instalación o cambiar el componente.',
    );
  }
  if (tipo === 'producto') {
    return;
  }
  if (actual === EstatusRecurso.INSERVIBLE) {
    if (!ROLES_CORRIGEN_INSERVIBLE.includes(quien.rol)) {
      throw new BadRequestException(
        `${capital(recurso)} es inservible (baja definitiva); solo administración del sistema lo corrige.`,
      );
    }
    if (!quien.motivo?.trim()) {
      throw new BadRequestException(
        `Corregir ${recurso} inservible requiere el motivo (error de captura).`,
      );
    }
    return;
  }
  const permitidos = TRANSICIONES_MANUALES[actual] ?? [];
  if (!permitidos.includes(nuevo)) {
    throw new BadRequestException(
      `${capital(recurso)} está en ${actual} (${nombre(actual)}) y no puede pasar a ${nuevo} (${nombre(nuevo)}). ` +
        `Permitidos: ${permitidos.length ? lista(permitidos) : 'ninguno'}.`,
    );
  }
}

/**
 * Estatus del componente que sale en un cambio. Dispositivo y SIM: 3, 4 o 5.
 * Producto (hasta la fase C): cualquiera menos 2.
 */
export function assertEstatusSalida(
  tipo: TipoRecurso,
  valor: number | undefined | null,
  campo: string,
): number {
  if (tipo === 'producto') {
    if (valor == null || !Number.isInteger(valor) || valor < 0 || valor > 5 || valor === 2) {
      throw new BadRequestException(
        `${campo} es obligatorio cuando el producto sale de la instalación: 0, 1, 3, 4 o 5.`,
      );
    }
    return valor;
  }
  if (valor == null || !ESTATUS_SALIDA_INSTALACION.includes(valor)) {
    throw new BadRequestException(
      `${campo} es obligatorio cuando ${ARTICULO[tipo]} sale de la instalación: ` +
        `${lista(ESTATUS_SALIDA_INSTALACION)}.`,
    );
  }
  return valor;
}

/**
 * A dónde van los componentes al dar de baja una instalación, según su motivo:
 * baja "inservible" (5) → el dispositivo es inservible; cualquier otra → por
 * revisar. La SIM siempre va a revisión. El producto vuelve a activo (1).
 */
export function estatusSalidaPorBaja(
  tipo: TipoRecurso,
  estatusInstalacion: number,
): number {
  if (tipo === 'producto') return 1;
  if (tipo === 'dispositivo' && estatusInstalacion === EnumEstatusInstalacion.INSERVIBLE) {
    return EstatusRecurso.INSERVIBLE;
  }
  return EstatusRecurso.POR_REVISAR;
}

function capital(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
