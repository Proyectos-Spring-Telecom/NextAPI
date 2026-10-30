import { OrdenesServicio } from 'src/entities/OrdenesServicio';

const n = (v: number | null | undefined) => (v == null ? null : Number(v));

/**
 * Orden para las respuestas del API. Nunca incluye el código de verificación
 * (lo ve solo el operador con POST /:id/codigo/ver).
 */
export function mapOrden(o: OrdenesServicio) {
  return {
    id: Number(o.id),
    folio: o.folio,
    tipoServicio: o.tipoServicio,
    estatus: o.estatus,
    idCliente: Number(o.idCliente),
    idInstalacion: n(o.idInstalacion),
    idInstalacionResultado: n(o.idInstalacionResultado),
    idHistoricoInstalacion: n(o.idHistoricoInstalacion),
    idProducto: n(o.idProducto),
    idDispositivoNuevo: n(o.idDispositivoNuevo),
    idSimNuevo: n(o.idSimNuevo),
    estatusSalienteAnterior: n(o.estatusSalienteAnterior),
    estatusInstalacionBaja: n(o.estatusInstalacionBaja),
    idTecnico: Number(o.idTecnico),
    idMonitorista: n(o.idMonitorista),
    fechaCaptura: o.fechaCaptura,
    lat: o.lat,
    lng: o.lng,
    observaciones: o.observaciones,
    fechaCreacion: o.fechaCreacion,
    fechaCierre: o.fechaCierre,
    // Etapa 2
    origen: o.origen ?? null,
    referenciaCrm: o.referenciaCrm ?? null,
    unidad: n(o.unidad),
    unidadesTotal: n(o.unidadesTotal),
    idOrdenOrigen: n(o.idOrdenOrigen),
    tipoProgramado: o.tipoProgramado ?? null,
    idInstalacionProgramada: n(o.idInstalacionProgramada),
    tipoDistinto: o.tipoProgramado != null && o.tipoProgramado !== o.tipoServicio,
    vehiculoDistinto:
      o.idInstalacionProgramada != null &&
      o.idInstalacion != null &&
      Number(o.idInstalacionProgramada) !== Number(o.idInstalacion),
    cita: o.cita ?? null,
    citaFin: o.citaFin ?? null,
    nombreProgramo: o.nombreProgramo ?? null,
    fechaInicio: o.fechaInicio ?? null,
    codigoValidado: o.fechaCodigoValidado != null,
    fechaCodigoValidado: o.fechaCodigoValidado ?? null,
    idUsuarioCodigo: n(o.idUsuarioCodigo),
    autorizacion: o.autorizacion ?? null,
    nombreAutorizo: o.nombreAutorizo ?? null,
    fechaAutorizacion: o.fechaAutorizacion ?? null,
    origenAutorizacion: o.origenAutorizacion ?? null,
    idInstalacionRetirada: n(o.idInstalacionRetirada),
    claveMotivo: o.claveMotivo ?? null,
    cobrable: o.cobrable == null ? null : Number(o.cobrable) === 1,
    fechaActualizacion: o.fechaActualizacion,
  };
}
