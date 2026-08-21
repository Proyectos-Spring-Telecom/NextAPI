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
