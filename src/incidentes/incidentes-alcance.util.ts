import { FindOptionsWhere, Raw } from 'typeorm';
import { TipoOrigenIncidente } from 'src/common/estatus.enum';
import { Incidentes } from 'src/entities/Incidentes';

/**
 * Alcance por asignación (F5) de un rol 7/9: equipos de sus instalaciones
 * asignadas en `UsuariosInstalaciones` (vigentes).
 *
 * `Incidentes` no tiene `IdInstalacion`; se relaciona con la unidad por su
 * origen:
 * - POSICION → IMEI del snapshot `DatosOrigen.imei` (el mismo que usa
 *   `imeiIncidente` para pintar la unidad; `IdPosicion` puede quedar en NULL
 *   y `Posiciones` es enorme para unir).
 * - EVENTO_ALARMA → `IdEventoAlarmaOrigen` → `EventoAlarma.IdPanel`
 *   (= `PanelAlarma.IdDispositivo` = `Instalaciones.IdDispositivo`).
 *
 * Supuesto: la unidad se resuelve por el equipo que hoy está en la
 * instalación asignada. Un incidente viejo de un equipo que ya se cambió de
 * instalación lo ve quien tenga asignada la instalación actual del equipo.
 */
export type AlcanceAsignacionIncidentes = {
  /** IMEIs (texto) de los equipos de las instalaciones asignadas. */
  imeis: string[];
  /** `Dispositivos.Id` de esos equipos (paneles incluidos). */
  idsDispositivo: number[];
};

/**
 * Ramas (OR) del `where` de TypeORM que limitan `base` a los incidentes de
 * las unidades asignadas. Respeta un `tipoOrigen` ya filtrado en `base`.
 * `[]` = no ve ningún incidente.
 */
export function whereIncidentesAsignados(
  base: FindOptionsWhere<Incidentes>,
  alcance: AlcanceAsignacionIncidentes,
): FindOptionsWhere<Incidentes>[] {
  const tipo = base.tipoOrigen != null ? Number(base.tipoOrigen) : null;
  const ramas: FindOptionsWhere<Incidentes>[] = [];

  if (
    alcance.imeis.length &&
    (tipo == null || tipo === TipoOrigenIncidente.POSICION)
  ) {
    ramas.push({
      ...base,
      tipoOrigen: TipoOrigenIncidente.POSICION,
      datosOrigen: Raw(
        (col) =>
          `JSON_UNQUOTE(JSON_EXTRACT(${col}, '$.imei')) IN (:...imeisAsignados)`,
        { imeisAsignados: alcance.imeis },
      ),
    } as FindOptionsWhere<Incidentes>);
  }

  if (
    alcance.idsDispositivo.length &&
    (tipo == null || tipo === TipoOrigenIncidente.EVENTO_ALARMA)
  ) {
    ramas.push({
      ...base,
      tipoOrigen: TipoOrigenIncidente.EVENTO_ALARMA,
      idEventoAlarmaOrigen: Raw(
        (col) =>
          `${col} IN (SELECT ea.Id FROM EventoAlarma ea WHERE ea.IdPanel IN (:...panelesAsignados))`,
        { panelesAsignados: alcance.idsDispositivo },
      ),
    });
  }

  return ramas;
}

/**
 * ¿El origen (posición / evento) pertenece a una unidad asignada? Para validar
 * el alta de un incidente por un rol 7/9. Usa el snapshot de `resolverOrigen`.
 */
export function origenVisiblePorAsignacion(
  tipoOrigen: number,
  datosOrigen: Record<string, unknown>,
  alcance: AlcanceAsignacionIncidentes,
): boolean {
  if (Number(tipoOrigen) === TipoOrigenIncidente.POSICION) {
    const imei = datosOrigen?.imei == null ? '' : String(datosOrigen.imei).trim();
    return imei !== '' && alcance.imeis.includes(imei);
  }
  if (Number(tipoOrigen) === TipoOrigenIncidente.EVENTO_ALARMA) {
    const idPanel = Number(datosOrigen?.idPanel);
    return Number.isFinite(idPanel) && alcance.idsDispositivo.includes(idPanel);
  }
  return false;
}
