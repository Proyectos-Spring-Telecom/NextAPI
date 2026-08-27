import { Sims } from 'src/entities/Sims';
import { nombreCliente } from 'src/productos/map-relaciones.util';

export const RELACIONES_SIM_LISTADO = [
  'idCliente2',
  'idTelefonia2',
  'idPlanTelefonia2',
] as const;

export function mapSimPlano(item: Sims) {
  const cliente = item.idCliente2;
  const telefonia = item.idTelefonia2;
  const plan = item.idPlanTelefonia2;

  return {
    id: Number(item.id),
    imei: item.imei,
    numeroTelefono: item.numeroTelefono,
    idTelefonia: Number(item.idTelefonia),
    nombreTelefonia: telefonia?.nombreTelefonia ?? null,
    idPlanTelefonia: Number(item.idPlanTelefonia),
    descripcionPlanTelefonia: plan?.descripcion ?? null,
    datosPlanTelefonia: plan?.datos ?? null,
    costoMensualPlanTelefonia: plan?.costoMensual ?? null,
    idCliente: Number(item.idCliente),
    nombreCliente: nombreCliente(cliente),
    notas: item.notas,
    fechaCreacion: item.fechaCreacion,
    fechaActualizacion: item.fechaActualizacion,
    estatus: Number(item.estatus),
  };
}
