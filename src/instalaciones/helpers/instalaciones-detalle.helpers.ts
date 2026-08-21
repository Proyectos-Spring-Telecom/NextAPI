import { SelectQueryBuilder } from 'typeorm';
import { Instalaciones } from 'src/entities/Instalaciones';
import { CatPlanesTelefonia } from 'src/entities/CatPlanesTelefonia';
import {
  EnumTipoDispositivo,
  EnumTipoProducto,
} from 'src/common/estatus.enum';
import { num } from '../map-instalaciones.util';
import {
  applyPaginadoBaseJoins,
  applyPaginadoPorTipoProducto,
} from './instalaciones-paginado.helpers';

function str(value: unknown): string | null {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

/** Joins base del paginado + plan de telefonía para detalle. */
export function applyDetalleJoins(qb: SelectQueryBuilder<Instalaciones>): void {
  applyPaginadoBaseJoins(qb);
  qb.leftJoin(CatPlanesTelefonia, 'plan', 'plan.id = s.idPlanTelefonia');
}

/**
 * Select completo: instalación, producto, dispositivo(+panel), SIM.
 * No omite campos de las tablas (excepto aesKey del panel).
 */
export function applyDetalleSelectBase(
  qb: SelectQueryBuilder<Instalaciones>,
): void {
  qb.select([
    // instalación
    'i.id AS id',
    'i.estatusInstalacion AS estatusInstalacion',
    'ei.codigo AS codigoEstatusInstalacion',
    'ei.nombre AS nombreEstatusInstalacion',
    'i.estatus AS estatus',
    'i.vigenteDesde AS vigenteDesde',
    'i.idHistoricoInstalacion AS idHistoricoInstalacion',
    'i.idUsuario AS idUsuario',
    'i.fechaCreacion AS fechaCreacion',
    'i.fechaActualizacion AS fechaActualizacion',
    'i.dispositivoActivo AS dispositivoActivo',
    'i.simActivo AS simActivo',

    // cliente
    'i.idCliente AS idCliente',
    "CONCAT_WS(' ', c.nombre, c.apellidoPaterno, c.apellidoMaterno) AS nombreCliente",

    // producto
    'i.idProducto AS idProducto',
    'p.nombre AS nombreProducto',
    'p.estatus AS estatusProducto',
    'p.idTipoProducto AS idTipoProducto',
    'tp.nombre AS nombreTipoProducto',
    'tp.codigo AS codigoTipoProducto',
    'p.fechaCreacion AS fechaCreacionProducto',
    'p.fechaActualizacion AS fechaActualizacionProducto',

    // dispositivo
    'i.idDispositivo AS idDispositivo',
    'd.numeroSerie AS numeroSerieDispositivo',
    'd.imei AS imeiDispositivo',
    'd.eco AS ecoDispositivo',
    'd.idTipoDispositivo AS idTipoDispositivo',
    'td.nombre AS nombreTipoDispositivo',
    'td.codigo AS codigoTipoDispositivo',
    'd.idMarca AS idMarcaDispositivo',
    'marDisp.nombre AS nombreMarcaDispositivo',
    'd.idModelo AS idModeloDispositivo',
    'modDisp.nombre AS nombreModeloDispositivo',
    'd.estatus AS estatusDispositivo',
    'd.fechaCreacion AS fechaCreacionDispositivo',
    'd.fechaActualizacion AS fechaActualizacionDispositivo',

    // panel (sin aesKey)
    'pa.cuentaSia AS cuentaSiaPanel',
    'pa.nombre AS nombrePanel',
    'pa.ip AS ipPanel',
    'pa.cifradoActivo AS cifradoActivoPanel',
    'pa.aesBits AS aesBitsPanel',
    'pa.ultimoHeartbeat AS ultimoHeartbeatPanel',
    'pa.estatus AS estatusPanel',
    'pa.fechaCreacion AS fechaCreacionPanel',
    'pa.fechaActualizacion AS fechaActualizacionPanel',

    // SIM completo
    'i.idSim AS idSim',
    's.imei AS imeiSim',
    's.numeroTelefono AS numeroTelefonoSim',
    's.idTelefonia AS idTelefoniaSim',
    'tel.nombreTelefonia AS nombreTelefoniaSim',
    's.idPlanTelefonia AS idPlanTelefoniaSim',
    'plan.descripcion AS descripcionPlanTelefoniaSim',
    's.notas AS notasSim',
    's.estatus AS estatusSim',
    's.fechaCreacion AS fechaCreacionSim',
    's.fechaActualizacion AS fechaActualizacionSim',
  ]);
}

/** Detalle de producto: reutiliza paginado y completa fotos de vehículo. */
export function applyDetallePorTipoProducto(
  qb: SelectQueryBuilder<Instalaciones>,
  idTipoProducto: EnumTipoProducto,
): void {
  applyPaginadoPorTipoProducto(qb, idTipoProducto);

  if (idTipoProducto === EnumTipoProducto.VEHICULO) {
    qb.addSelect([
      'v.fotoTrasera AS fotoTraseraVehiculo',
      'v.fotoDerecha AS fotoDerechaVehiculo',
      'v.fotoIzquierda AS fotoIzquierdaVehiculo',
      'v.fotoExtra AS fotoExtraVehiculo',
    ]);
  }
}

function mapBloqueInstalacion(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    estatusInstalacion: Number(row.estatusInstalacion),
    codigoEstatusInstalacion: str(row.codigoEstatusInstalacion),
    nombreEstatusInstalacion: str(row.nombreEstatusInstalacion),
    estatus: Number(row.estatus),
    vigenteDesde: row.vigenteDesde ?? null,
    idHistoricoInstalacion: num(row.idHistoricoInstalacion),
    idUsuario: num(row.idUsuario),
    fechaCreacion: row.fechaCreacion ?? null,
    fechaActualizacion: row.fechaActualizacion ?? null,
    dispositivoActivo: num(row.dispositivoActivo),
    simActivo: num(row.simActivo),
  };
}

function mapBloqueCliente(row: Record<string, unknown>) {
  return {
    idCliente: Number(row.idCliente),
    nombreCliente: str(row.nombreCliente),
  };
}

function mapBloqueProducto(
  row: Record<string, unknown>,
  idTipoProducto: EnumTipoProducto,
) {
  const base = {
    idProducto: Number(row.idProducto),
    nombreProducto: str(row.nombreProducto),
    estatusProducto: num(row.estatusProducto),
    idTipoProducto: Number(row.idTipoProducto),
    nombreTipoProducto: str(row.nombreTipoProducto),
    codigoTipoProducto: str(row.codigoTipoProducto),
    fechaCreacionProducto: row.fechaCreacionProducto ?? null,
    fechaActualizacionProducto: row.fechaActualizacionProducto ?? null,
  };

  switch (idTipoProducto) {
    case EnumTipoProducto.VEHICULO:
      return {
        ...base,
        placaVehiculo: str(row.placaVehiculo),
        ecoVehiculo: str(row.ecoVehiculo),
        idMarcaVehiculo: num(row.idMarcaVehiculo),
        nombreMarcaVehiculo: str(row.nombreMarcaVehiculo),
        idModeloVehiculo: num(row.idModeloVehiculo),
        nombreModeloVehiculo: str(row.nombreModeloVehiculo),
        anioVehiculo: num(row.anioVehiculo),
        colorVehiculo: str(row.colorVehiculo),
        numeroSerieVehiculo: str(row.numeroSerieVehiculo),
        fotoVehiculo: str(row.fotoVehiculo),
        fotoFrenteVehiculo: str(row.fotoFrenteVehiculo),
        fotoTraseraVehiculo: str(row.fotoTraseraVehiculo),
        fotoDerechaVehiculo: str(row.fotoDerechaVehiculo),
        fotoIzquierdaVehiculo: str(row.fotoIzquierdaVehiculo),
        fotoExtraVehiculo: str(row.fotoExtraVehiculo),
        tarjetaCirculacionVehiculo: str(row.tarjetaCirculacionVehiculo),
        polizaSeguroVehiculo: str(row.polizaSeguroVehiculo),
        permisoCargaVehiculo: str(row.permisoCargaVehiculo),
        idCombustibleVehiculo: num(row.idCombustibleVehiculo),
        nombreCombustibleVehiculo: str(row.nombreCombustibleVehiculo),
        kmVehiculo: num(row.kmVehiculo),
        capacidadLitrosVehiculo: num(row.capacidadLitrosVehiculo),
      };
    case EnumTipoProducto.ACTIVO:
      return {
        ...base,
        nombreActivo: str(row.nombreActivo),
        descripcionActivo: str(row.descripcionActivo),
      };
    case EnumTipoProducto.INMUEBLE:
      return {
        ...base,
        inmueble: str(row.inmueble),
        direccionFiscalInmueble: str(row.direccionFiscalInmueble),
        nombreRepresentanteInmueble: str(row.nombreRepresentanteInmueble),
        telefonoRepresentanteInmueble: str(row.telefonoRepresentanteInmueble),
        correoRepresentanteInmueble: str(row.correoRepresentanteInmueble),
        latInmueble: num(row.latInmueble),
        lngInmueble: num(row.lngInmueble),
      };
    case EnumTipoProducto.PERSONA:
      return {
        ...base,
        nombrePersona: str(row.nombrePersona),
        telefonoPersona: str(row.telefonoPersona),
      };
    default:
      return base;
  }
}

function mapBloqueDispositivo(row: Record<string, unknown>) {
  const idDispositivo = num(row.idDispositivo);
  const idTipoDispositivo = num(row.idTipoDispositivo);

  const base = {
    idDispositivo,
    numeroSerieDispositivo: str(row.numeroSerieDispositivo),
    imeiDispositivo: num(row.imeiDispositivo),
    ecoDispositivo: str(row.ecoDispositivo),
    idTipoDispositivo,
    nombreTipoDispositivo: str(row.nombreTipoDispositivo),
    codigoTipoDispositivo: str(row.codigoTipoDispositivo),
    idMarcaDispositivo: num(row.idMarcaDispositivo),
    nombreMarcaDispositivo: str(row.nombreMarcaDispositivo),
    idModeloDispositivo: num(row.idModeloDispositivo),
    nombreModeloDispositivo: str(row.nombreModeloDispositivo),
    estatusDispositivo: num(row.estatusDispositivo),
    fechaCreacionDispositivo: row.fechaCreacionDispositivo ?? null,
    fechaActualizacionDispositivo: row.fechaActualizacionDispositivo ?? null,
  };

  const incluirPanel =
    idDispositivo != null &&
    (idTipoDispositivo === EnumTipoDispositivo.PANEL_ALARMA ||
      row.cuentaSiaPanel != null ||
      row.nombrePanel != null);

  if (incluirPanel) {
    return {
      ...base,
      cuentaSiaPanel: str(row.cuentaSiaPanel),
      nombrePanel: str(row.nombrePanel),
      ipPanel: str(row.ipPanel),
      cifradoActivoPanel: num(row.cifradoActivoPanel),
      aesBitsPanel: num(row.aesBitsPanel),
      ultimoHeartbeatPanel: row.ultimoHeartbeatPanel ?? null,
      estatusPanel: num(row.estatusPanel),
      fechaCreacionPanel: row.fechaCreacionPanel ?? null,
      fechaActualizacionPanel: row.fechaActualizacionPanel ?? null,
    };
  }

  return base;
}

function mapBloqueSim(row: Record<string, unknown>) {
  return {
    idSim: num(row.idSim),
    imeiSim: str(row.imeiSim),
    numeroTelefonoSim: str(row.numeroTelefonoSim),
    idTelefoniaSim: num(row.idTelefoniaSim),
    nombreTelefoniaSim: str(row.nombreTelefoniaSim),
    idPlanTelefoniaSim: num(row.idPlanTelefoniaSim),
    descripcionPlanTelefoniaSim: str(row.descripcionPlanTelefoniaSim),
    notasSim: str(row.notasSim),
    estatusSim: num(row.estatusSim),
    fechaCreacionSim: row.fechaCreacionSim ?? null,
    fechaActualizacionSim: row.fechaActualizacionSim ?? null,
  };
}

/** Mismo orden que paginado, con todos los campos de detalle. */
export function mapInstalacionDetallePlana(
  row: Record<string, unknown>,
  idTipoProducto: EnumTipoProducto,
) {
  return {
    ...mapBloqueInstalacion(row),
    ...mapBloqueCliente(row),
    ...mapBloqueProducto(row, idTipoProducto),
    ...mapBloqueDispositivo(row),
    ...mapBloqueSim(row),
  };
}
