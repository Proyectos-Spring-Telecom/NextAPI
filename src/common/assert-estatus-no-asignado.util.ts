import { BadRequestException } from '@nestjs/common';
import { EnumEstatusProductoDispositivo } from './estatus.enum';

/**
 * Impide cambiar el estatus de un componente ya asignado a una instalación (estatus = 2).
 */
export function assertEstatusNoAsignado(
  estatusActual: number,
  nombreComponente: 'producto' | 'dispositivo' | 'SIM',
): void {
  if (Number(estatusActual) === EnumEstatusProductoDispositivo.ASIGNADO) {
    throw new BadRequestException(
      `No es posible actualizar el estatus del ${nombreComponente} porque se encuentra asignado a una instalación.`,
    );
  }
}

/**
 * Cambio de estatus a mano de un componente: no si está asignado (2) y tampoco
 * a 2, que solo lo pone una instalación (si no, queda "asignado" sin instalación).
 */
export function assertCambioEstatus(
  estatusActual: number,
  estatusNuevo: number,
  nombreComponente: 'producto' | 'dispositivo' | 'SIM',
): void {
  assertEstatusNoAsignado(estatusActual, nombreComponente);
  if (Number(estatusNuevo) === EnumEstatusProductoDispositivo.ASIGNADO) {
    throw new BadRequestException(
      `El estatus "asignado" del ${nombreComponente} solo lo pone una instalación.`,
    );
  }
}
