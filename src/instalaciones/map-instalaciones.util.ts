import { Instalaciones } from 'src/entities/Instalaciones';
import { HistoricoInstalaciones } from 'src/entities/HistoricoInstalaciones';

export function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function mapInstalacionPlana(entity: Instalaciones) {
  return {
    id: Number(entity.id),
    idCliente: Number(entity.idCliente),
    idProducto: Number(entity.idProducto),
    idDispositivo:
      entity.idDispositivo != null ? Number(entity.idDispositivo) : null,
    idSim: entity.idSim != null ? Number(entity.idSim) : null,
    estatusInstalacion: Number(entity.estatusInstalacion),
    idHistoricoInstalacion:
      entity.idHistoricoInstalacion != null
        ? Number(entity.idHistoricoInstalacion)
        : null,
    vigenteDesde: entity.vigenteDesde,
    idUsuario: entity.idUsuario != null ? Number(entity.idUsuario) : null,
    estatus: Number(entity.estatus),
    fechaCreacion: entity.fechaCreacion,
    fechaActualizacion: entity.fechaActualizacion,
  };
}

export function mapHistoricoPlano(entity: HistoricoInstalaciones) {
  return {
    id: Number(entity.id),
    idCliente: Number(entity.idCliente),
    idProducto: Number(entity.idProducto),
    idDispositivo:
      entity.idDispositivo != null ? Number(entity.idDispositivo) : null,
    idSim: entity.idSim != null ? Number(entity.idSim) : null,
    estatusInstalacion: Number(entity.estatusInstalacion),
    idInstalacionOriginal:
      entity.idInstalacionOriginal != null
        ? Number(entity.idInstalacionOriginal)
        : null,
    vigenteDesde: entity.vigenteDesde,
    vigenteHasta: entity.vigenteHasta,
    idHistoricoInstalacion:
      entity.idHistoricoInstalacion != null
        ? Number(entity.idHistoricoInstalacion)
        : null,
    idUsuario: entity.idUsuario != null ? Number(entity.idUsuario) : null,
    accion: entity.accion,
    comentario: entity.comentario,
    fhArchivado: entity.fhArchivado,
  };
}
