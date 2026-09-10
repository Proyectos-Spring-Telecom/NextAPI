import { Instalaciones } from 'src/entities/Instalaciones';
import { HistoricoInstalaciones } from 'src/entities/HistoricoInstalaciones';
import { Dispositivos } from 'src/entities/Dispositivos';
import { Productos } from 'src/entities/Productos';
import { Sims } from 'src/entities/Sims';
import { nombreCliente, nombreUsuario } from 'src/productos/map-relaciones.util';

export const RELACIONES_INSTALACION_HISTORICO = [
  'idCliente2',
  'idUsuario2',
] as const;

/** Relaciones para GET historico/:id (producto / dispositivo / SIM enriquecidos). */
export const RELACIONES_INSTALACION_HISTORICO_DETALLE = [
  'idCliente2',
  'idUsuario2',
  'idProducto2',
  'idProducto2.idTipoProducto2',
  'idDispositivo2',
  'idDispositivo2.idTipoDispositivo2',
  'idDispositivo2.idMarca2',
  'idDispositivo2.idModelo2',
  'idSim2',
] as const;

export function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function str(value: unknown): string | null {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

/** Campos planos producto + dispositivo + SIM (sin ids ni anidados). */
export function mapContextoProductoDispositivoSim(args: {
  producto?: Productos | null;
  dispositivo?: Dispositivos | null;
  sim?: Sims | null;
}) {
  const p = args.producto ?? null;
  const d = args.dispositivo ?? null;
  const s = args.sim ?? null;
  return {
    nombreTipoProducto: str(p?.idTipoProducto2?.nombre),
    nombreProducto: str(p?.nombre),
    nombreTipoDispositivo: str(d?.idTipoDispositivo2?.nombre),
    numeroSerie: str(d?.numeroSerie),
    imei: d?.imei != null ? String(d.imei) : null,
    nombreMarca: str(d?.idMarca2?.nombre),
    nombreModelo: str(d?.idModelo2?.nombre),
    imeiSim: str(s?.imei),
    numeroTelefonico: str(s?.numeroTelefono),
  };
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
    nombreCliente: nombreCliente(entity.idCliente2),
    nombreUsuario: nombreUsuario(entity.idUsuario2),
    estatus: Number(entity.estatus),
    fechaCreacion: entity.fechaCreacion,
    fechaActualizacion: entity.fechaActualizacion,
  };
}

/** Vigente en GET historico/:id — sin idProducto/idDispositivo/idSim. */
export function mapInstalacionHistoricoVigente(entity: Instalaciones) {
  return {
    id: Number(entity.id),
    idCliente: Number(entity.idCliente),
    estatusInstalacion: Number(entity.estatusInstalacion),
    idHistoricoInstalacion:
      entity.idHistoricoInstalacion != null
        ? Number(entity.idHistoricoInstalacion)
        : null,
    vigenteDesde: entity.vigenteDesde,
    idUsuario: entity.idUsuario != null ? Number(entity.idUsuario) : null,
    nombreCliente: nombreCliente(entity.idCliente2),
    nombreUsuario: nombreUsuario(entity.idUsuario2),
    estatus: Number(entity.estatus),
    fechaCreacion: entity.fechaCreacion,
    fechaActualizacion: entity.fechaActualizacion,
    ...mapContextoProductoDispositivoSim({
      producto: entity.idProducto2,
      dispositivo: entity.idDispositivo2,
      sim: entity.idSim2,
    }),
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
    nombreCliente: nombreCliente(entity.idCliente2),
    nombreUsuario: nombreUsuario(entity.idUsuario2),
    accion: entity.accion,
    comentario: entity.comentario,
    fhArchivado: entity.fhArchivado,
  };
}

/** Eslabón de cadena en GET historico/:id — sin idProducto/idDispositivo/idSim. */
export function mapHistoricoDetallePlano(entity: HistoricoInstalaciones) {
  return {
    id: Number(entity.id),
    idCliente: Number(entity.idCliente),
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
    nombreCliente: nombreCliente(entity.idCliente2),
    nombreUsuario: nombreUsuario(entity.idUsuario2),
    accion: entity.accion,
    comentario: entity.comentario,
    fhArchivado: entity.fhArchivado,
    ...mapContextoProductoDispositivoSim({
      producto: entity.idProducto2,
      dispositivo: entity.idDispositivo2,
      sim: entity.idSim2,
    }),
  };
}
