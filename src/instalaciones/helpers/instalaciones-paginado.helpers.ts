import { BadRequestException } from '@nestjs/common';
import { SelectQueryBuilder } from 'typeorm';
import { Instalaciones } from 'src/entities/Instalaciones';
import { Productos } from 'src/entities/Productos';
import { Clientes } from 'src/entities/Clientes';
import { CatTipoProducto } from 'src/entities/CatTipoProducto';
import { Dispositivos } from 'src/entities/Dispositivos';
import { CatTipoDispositivo } from 'src/entities/CatTipoDispositivo';
import { CatMarcas } from 'src/entities/CatMarcas';
import { CatModelos } from 'src/entities/CatModelos';
import { PanelAlarma } from 'src/entities/PanelAlarma';
import { Sims } from 'src/entities/Sims';
import { CatTelefonia } from 'src/entities/CatTelefonia';
import { CatEstatusInstalacion } from 'src/entities/CatEstatusInstalacion';
import { Vehiculos } from 'src/entities/Vehiculos';
import { Activos } from 'src/entities/Activos';
import { Inmuebles } from 'src/entities/Inmuebles';
import { Personas } from 'src/entities/Personas';
import { CatTipoCombustible } from 'src/entities/CatTipoCombustible';
import {
  EnumTipoDispositivo,
  EnumTipoProducto,
} from 'src/common/estatus.enum';
import { num } from '../map-instalaciones.util';

function str(value: unknown): string | null {
  if (value == null || value === '') return null;
  const s = String(value).trim();
  return s === '' ? null : s;
}

/** Joins comunes a todos los tipos de producto. */
export function applyPaginadoBaseJoins(
  qb: SelectQueryBuilder<Instalaciones>,
): void {
  qb.innerJoin(
    Productos,
    'p',
    'p.id = i.idProducto AND p.idCliente = i.idCliente',
  )
    .innerJoin(Clientes, 'c', 'c.id = i.idCliente')
    .leftJoin(CatTipoProducto, 'tp', 'tp.id = p.idTipoProducto')
    .leftJoin(
      Dispositivos,
      'd',
      'd.id = i.idDispositivo AND d.idCliente = i.idCliente',
    )
    .leftJoin(CatTipoDispositivo, 'td', 'td.id = d.idTipoDispositivo')
    .leftJoin(CatMarcas, 'marDisp', 'marDisp.id = d.idMarca')
    .leftJoin(CatModelos, 'modDisp', 'modDisp.id = d.idModelo')
    .leftJoin(
      PanelAlarma,
      'pa',
      'pa.idDispositivo = d.id AND pa.idCliente = d.idCliente',
    )
    .leftJoin(Sims, 's', 's.id = i.idSim AND s.idCliente = i.idCliente')
    .leftJoin(CatTelefonia, 'tel', 'tel.id = s.idTelefonia')
    .leftJoin(CatEstatusInstalacion, 'ei', 'ei.id = i.estatusInstalacion');
}

/** Select de instalación + dispositivo + SIM (panel se mapea solo si tipo=2). */
export function applyPaginadoSelectBase(
  qb: SelectQueryBuilder<Instalaciones>,
): void {
  qb.select([
    'i.id AS id',
    'i.idCliente AS idCliente',
    "CONCAT_WS(' ', c.nombre, c.apellidoPaterno, c.apellidoMaterno) AS nombreCliente",
    'i.idProducto AS idProducto',
    'p.nombre AS nombreProducto',
    'p.estatus AS estatusProducto',
    'p.idTipoProducto AS idTipoProducto',
    'tp.nombre AS nombreTipoProducto',
    'tp.codigo AS codigoTipoProducto',

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

    'pa.cuentaSia AS cuentaSiaPanel',
    'pa.nombre AS nombrePanel',
    'pa.ip AS ipPanel',
    'pa.cifradoActivo AS cifradoActivoPanel',
    'pa.aesBits AS aesBitsPanel',
    'pa.ultimoHeartbeat AS ultimoHeartbeatPanel',
    'pa.estatus AS estatusPanel',

    'i.idSim AS idSim',
    's.imei AS imeiSim',
    's.numeroTelefono AS numeroTelefonoSim',
    'tel.nombreTelefonia AS nombreTelefoniaSim',

    'i.estatusInstalacion AS estatusInstalacion',
    'ei.codigo AS codigoEstatusInstalacion',
    'ei.nombre AS nombreEstatusInstalacion',
    'i.estatus AS estatus',
    'i.vigenteDesde AS vigenteDesde',
    'i.idUsuario AS idUsuario',
    'i.fechaCreacion AS fechaCreacion',
    'i.fechaActualizacion AS fechaActualizacion',
  ]);
}

const SELECT_VEHICULO: string[] = [
  'v.placa AS placaVehiculo',
  'v.numeroEconomico AS ecoVehiculo',
  'v.idMarcaVehiculo AS idMarcaVehiculo',
  'marVeh.nombre AS nombreMarcaVehiculo',
  'v.idModeloVehiculo AS idModeloVehiculo',
  'modVeh.nombre AS nombreModeloVehiculo',
  'v.anio AS anioVehiculo',
  'v.color AS colorVehiculo',
  'v.numeroSerie AS numeroSerieVehiculo',
  'v.foto AS fotoVehiculo',
  'v.fotoFrente AS fotoFrenteVehiculo',
  'v.tarjetaCirculacion AS tarjetaCirculacionVehiculo',
  'v.polizaSeguro AS polizaSeguroVehiculo',
  'v.permisoCarga AS permisoCargaVehiculo',
  'v.idCombustible AS idCombustibleVehiculo',
  'tc.nombre AS nombreCombustibleVehiculo',
  'v.km AS kmVehiculo',
  'v.capacidadLitros AS capacidadLitrosVehiculo',
];

const SELECT_ACTIVO: string[] = [
  'a.nombre AS nombreActivo',
  'a.descripcion AS descripcionActivo',
];

const SELECT_INMUEBLE: string[] = [
  'inm.inmueble AS inmueble',
  'inm.direccionFiscal AS direccionFiscalInmueble',
  'inm.nombreRepresentante AS nombreRepresentanteInmueble',
  'inm.telefonoRepresentante AS telefonoRepresentanteInmueble',
  'inm.correoRepresentante AS correoRepresentanteInmueble',
  'inm.lat AS latInmueble',
  'inm.lng AS lngInmueble',
];

const SELECT_PERSONA: string[] = [
  'per.nombre AS nombrePersona',
  'per.telefono AS telefonoPersona',
];

/** Joins + select extra según tipo de producto (filtro único → INNER). */
export function applyPaginadoPorTipoProducto(
  qb: SelectQueryBuilder<Instalaciones>,
  idTipoProducto: EnumTipoProducto,
): void {
  switch (idTipoProducto) {
    case EnumTipoProducto.VEHICULO:
      qb.innerJoin(
        Vehiculos,
        'v',
        'v.idProducto = i.idProducto AND v.idCliente = i.idCliente',
      )
        .leftJoin(CatMarcas, 'marVeh', 'marVeh.id = v.idMarcaVehiculo')
        .leftJoin(CatModelos, 'modVeh', 'modVeh.id = v.idModeloVehiculo')
        .leftJoin(CatTipoCombustible, 'tc', 'tc.id = v.idCombustible')
        .addSelect(SELECT_VEHICULO);
      break;
    case EnumTipoProducto.ACTIVO:
      qb.innerJoin(
        Activos,
        'a',
        'a.idProducto = i.idProducto AND a.idCliente = i.idCliente',
      ).addSelect(SELECT_ACTIVO);
      break;
    case EnumTipoProducto.INMUEBLE:
      qb.innerJoin(
        Inmuebles,
        'inm',
        'inm.idProducto = i.idProducto AND inm.idCliente = i.idCliente',
      ).addSelect(SELECT_INMUEBLE);
      break;
    case EnumTipoProducto.PERSONA:
      qb.innerJoin(
        Personas,
        'per',
        'per.idProducto = i.idProducto AND per.idCliente = i.idCliente',
      ).addSelect(SELECT_PERSONA);
      break;
    default:
      throw new BadRequestException(
        'idTipoProducto debe ser 1 (vehículo), 2 (activo), 3 (inmueble) o 4 (persona)',
      );
  }
}

/**
 * Sin filtro de tipo: LEFT JOIN de todos los detalles de producto
 * para poder mapear cada fila según `p.idTipoProducto`.
 */
export function applyPaginadoTodosTiposProducto(
  qb: SelectQueryBuilder<Instalaciones>,
): void {
  qb.leftJoin(
    Vehiculos,
    'v',
    'v.idProducto = i.idProducto AND v.idCliente = i.idCliente',
  )
    .leftJoin(CatMarcas, 'marVeh', 'marVeh.id = v.idMarcaVehiculo')
    .leftJoin(CatModelos, 'modVeh', 'modVeh.id = v.idModeloVehiculo')
    .leftJoin(CatTipoCombustible, 'tc', 'tc.id = v.idCombustible')
    .leftJoin(
      Activos,
      'a',
      'a.idProducto = i.idProducto AND a.idCliente = i.idCliente',
    )
    .leftJoin(
      Inmuebles,
      'inm',
      'inm.idProducto = i.idProducto AND inm.idCliente = i.idCliente',
    )
    .leftJoin(
      Personas,
      'per',
      'per.idProducto = i.idProducto AND per.idCliente = i.idCliente',
    )
    .addSelect([
      ...SELECT_VEHICULO,
      ...SELECT_ACTIVO,
      ...SELECT_INMUEBLE,
      ...SELECT_PERSONA,
    ]);
}

/** Bloque 1: instalación */
function mapBloqueInstalacion(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    estatusInstalacion: Number(row.estatusInstalacion),
    codigoEstatusInstalacion: str(row.codigoEstatusInstalacion),
    nombreEstatusInstalacion: str(row.nombreEstatusInstalacion),
    estatus: Number(row.estatus),
    vigenteDesde: row.vigenteDesde ?? null,
    idUsuario: num(row.idUsuario),
    fechaCreacion: row.fechaCreacion ?? null,
    fechaActualizacion: row.fechaActualizacion ?? null,
  };
}

/** Bloque 2: cliente */
function mapBloqueCliente(row: Record<string, unknown>) {
  return {
    idCliente: Number(row.idCliente),
    nombreCliente: str(row.nombreCliente),
  };
}

/** Bloque 3: producto base + detalle del tipo (juntos, sin intercalarse). */
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

/** Bloque 4: dispositivo; si tipo=2 añade panel justo después. */
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
  };

  if (
    idDispositivo != null &&
    idTipoDispositivo === EnumTipoDispositivo.PANEL_ALARMA
  ) {
    return {
      ...base,
      cuentaSiaPanel: str(row.cuentaSiaPanel),
      nombrePanel: str(row.nombrePanel),
      ipPanel: str(row.ipPanel),
      cifradoActivoPanel: num(row.cifradoActivoPanel),
      aesBitsPanel: num(row.aesBitsPanel),
      ultimoHeartbeatPanel: row.ultimoHeartbeatPanel ?? null,
      estatusPanel: num(row.estatusPanel),
    };
  }

  return base;
}

/** Bloque 5: SIM */
function mapBloqueSim(row: Record<string, unknown>) {
  return {
    idSim: num(row.idSim),
    imeiSim: str(row.imeiSim),
    numeroTelefonoSim: str(row.numeroTelefonoSim),
    nombreTelefoniaSim: str(row.nombreTelefoniaSim),
  };
}

/**
 * Orden fijo y coherente:
 * 1) instalación → 2) cliente → 3) producto+detalle → 4) dispositivo(+panel) → 5) SIM
 * Si no se pasa `idTipoProducto`, se toma de la fila (`p.idTipoProducto`).
 */
export function mapInstalacionPaginadaPlana(
  row: Record<string, unknown>,
  idTipoProducto?: EnumTipoProducto,
) {
  const tipo = (idTipoProducto ??
    Number(row.idTipoProducto)) as EnumTipoProducto;
  return {
    ...mapBloqueInstalacion(row),
    ...mapBloqueCliente(row),
    ...mapBloqueProducto(row, tipo),
    ...mapBloqueDispositivo(row),
    ...mapBloqueSim(row),
  };
}
