import { SelectQueryBuilder } from 'typeorm';
import { Instalaciones } from 'src/entities/Instalaciones';
import { Vehiculos } from 'src/entities/Vehiculos';
import { Activos } from 'src/entities/Activos';
import { Inmuebles } from 'src/entities/Inmuebles';
import { Personas } from 'src/entities/Personas';
import { PanelAlarma } from 'src/entities/PanelAlarma';
import { UltimoEventoAlarma } from 'src/entities/UltimoEventoAlarma';
import { CatMarcas } from 'src/entities/CatMarcas';
import { CatModelos } from 'src/entities/CatModelos';

/**
 * GPS: Instalación → Dispositivo → UltimaPosicion (IMEI).
 * Paneles: Instalación → Dispositivo → PanelAlarma + UltimoEventoAlarma (IdPanel).
 */
export function applyMonitoreoListJoins(
  qb: SelectQueryBuilder<Instalaciones>,
): void {
  qb.innerJoin('i.idCliente2', 'c')
    .innerJoin('i.idProducto2', 'p')
    .leftJoin('i.idDispositivo2', 'd')
    .leftJoin('d.idMarca2', 'marDisp')
    .leftJoin('d.idModelo2', 'modDisp')
    .leftJoin('d.ultimaPosicion', 'up')
    .leftJoin(
      PanelAlarma,
      'pa',
      'pa.idDispositivo = d.id AND pa.idCliente = d.idCliente',
    )
    .leftJoin(UltimoEventoAlarma, 'uea', 'uea.idPanel = d.id')
    .leftJoin(
      Vehiculos,
      'v',
      'v.idProducto = i.idProducto AND v.idCliente = i.idCliente',
    )
    .leftJoin(CatMarcas, 'marVeh', 'marVeh.id = v.idMarcaVehiculo')
    .leftJoin(CatModelos, 'modVeh', 'modVeh.id = v.idModeloVehiculo')
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
    );
}

export function applyMonitoreoListSelect(
  qb: SelectQueryBuilder<Instalaciones>,
): void {
  qb.select([
    'i.id AS idInstalacion',
    'i.idCliente AS idCliente',
    'p.idTipoProducto AS idTipoProducto',
    "CONCAT_WS(' ', c.nombre, c.apellidoPaterno, c.apellidoMaterno) AS nombreCompletoCliente",

    'v.placa AS placaVehiculo',
    'v.numeroEconomico AS ecoVehiculo',
    'marVeh.nombre AS marcaVehiculo',
    'modVeh.nombre AS modeloVehiculo',

    'd.imei AS imei',
    'd.eco AS ecoDispositivo',
    'd.numeroSerie AS numeroSerieDispositivo',
    'marDisp.nombre AS marcaDispositivo',
    'modDisp.nombre AS modeloDispositivo',

    'p.estatus AS estatusProducto',
    'pa.estatus AS estatusPanel',
    'pa.ultimoHeartbeat AS ultimoHeartbeatPanel',

    'a.descripcion AS descripcionActivo',
    'per.nombre AS nombrePersona',
    'inm.inmueble AS inmueble',
    'inm.lat AS latInmueble',
    'inm.lng AS lngInmueble',

    'up.lat AS latitud',
    'up.lng AS longitud',
    'up.velocidad AS velocidad',
    'up.ignicion AS ignicion',
    'up.combustible AS nivelCombustible',
    'up.gps AS gps',
    'up.estado AS ultimaPosicion',
    'up.fechaHora AS fechaHora',

    'uea.id AS ueaId',
    'uea.idEventoAlarma AS ueaIdEventoAlarma',
    'uea.codigoSia AS ueaCodigoSia',
    'uea.tipoEvento AS ueaTipoEvento',
    'uea.zona AS ueaZona',
    'uea.codigoUsuario AS ueaCodigoUsuario',
    'uea.nombreDispositivo AS ueaNombreDispositivo',
    'uea.severidad AS ueaSeveridad',
    'uea.recibidoEn AS ueaRecibidoEn',
    'uea.esRestauracion AS ueaEsRestauracion',
  ]);
}
