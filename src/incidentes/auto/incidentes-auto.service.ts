import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EstatusIncidente,
  TipoOrigenIncidente,
} from 'src/common/estatus.enum';
import { imeiToString } from 'src/common/imei.util';
import { Dispositivos } from 'src/entities/Dispositivos';
import { Incidentes } from 'src/entities/Incidentes';
import { Posiciones } from 'src/entities/Posiciones';
import { SeguimientoIncidentes } from 'src/entities/SeguimientoIncidentes';
import {
  descripcionAlertaAutomatica,
  esEstadoAlertaConsola,
  eventoIncidente,
  seguimientoAlertaRepetida,
} from '../incidentes-alerta.util';

/** Medio de los seguimientos que agrega el sistema (no un usuario). */
export const MEDIO_SEGUIMIENTO_ALERTA = 'Alerta automática';
import { snapshotPosicion } from '../map-datos-origen.util';

/**
 * Alta automática de incidentes cuando una unidad entra en alerta.
 *
 * Lo llama el ingest de posiciones FUERA de su transacción y sin esperar:
 * cualquier error aquí se registra en log y nunca afecta la llegada de datos.
 *
 * Regla: un incidente ABIERTO por IMEI + estado de alerta (+ IdEvento si es
 * de EVENTOS_INCIDENTE_PROPIO: SOS y caída no se bloquean entre sí). Si ya
 * hay uno abierto para esa misma alerta no se duplica: la alerta nueva se
 * agrega como seguimiento (MEDIO_SEGUIMIENTO_ALERTA) para que el monitorista
 * la vea. El siguiente incidente se crea cuando se finaliza el reporte.
 */
@Injectable()
export class IncidentesAutoService {
  private readonly logger = new Logger(IncidentesAutoService.name);
  /** Evita dobles altas si llegan dos posiciones de la misma alerta a la vez. */
  private readonly enCurso = new Set<string>();

  constructor(
    @InjectRepository(Incidentes)
    private readonly incidentesRepo: Repository<Incidentes>,
    @InjectRepository(Posiciones)
    private readonly posicionesRepo: Repository<Posiciones>,
    @InjectRepository(Dispositivos)
    private readonly dispositivosRepo: Repository<Dispositivos>,
    @InjectRepository(SeguimientoIncidentes)
    private readonly seguimientosRepo: Repository<SeguimientoIncidentes>,
  ) {}

  async registrarDesdePosicion(
    posicionId: number,
    imeiRaw: string,
    estado: number,
    idEvento?: number | null,
  ): Promise<void> {
    if (!esEstadoAlertaConsola(estado)) return;
    const imei = imeiToString(imeiRaw);
    if (!imei || !Number.isFinite(posicionId) || posicionId < 1) return;
    const evento = eventoIncidente(idEvento);

    const clave = `${imei}|${estado}|${evento ?? ''}`;
    if (this.enCurso.has(clave)) return;
    this.enCurso.add(clave);

    try {
      const idCliente = await this.idClientePorImei(imei);
      if (idCliente == null) return;

      const abierto = await this.buscarAbierto(idCliente, imei, estado, evento);

      const posicion = await this.posicionesRepo.findOne({
        where: { id: posicionId },
      });
      if (!posicion) return;

      if (abierto != null) {
        await this.seguimientosRepo.save(
          this.seguimientosRepo.create({
            idIncidente: abierto,
            idUsuario: null,
            fechaHora: posicion.fechaHora,
            actividad: seguimientoAlertaRepetida(estado, evento, posicion),
            medio: MEDIO_SEGUIMIENTO_ALERTA,
          }),
        );
        this.logger.log(
          `[IncidenteAuto] imei=${imei} estado=${estado} evento=${evento ?? '-'} posicion=${posicionId} → seguimiento en Incidente=${abierto} (ya abierto)`,
        );
        return;
      }

      const entity = this.incidentesRepo.create({
        idCliente,
        tipoOrigen: TipoOrigenIncidente.POSICION,
        idPosicion: Number(posicion.id),
        idPosicionOrigen: Number(posicion.id),
        idEventoAlarma: null,
        idEventoAlarmaOrigen: null,
        datosOrigen: snapshotPosicion(posicion),
        idUsuario: null,
        descripcion: descripcionAlertaAutomatica(estado, evento),
        fechaInicio: posicion.fechaHora,
        fechaCierre: null,
        estatus: EstatusIncidente.ABIERTO,
      });
      const saved = await this.incidentesRepo.save(entity);

      this.logger.log(
        `[IncidenteAuto] imei=${imei} estado=${estado} evento=${evento ?? '-'} posicion=${posicionId} → Incidente=${saved.id}`,
      );
    } catch (error) {
      this.logger.warn(
        `[IncidenteAuto] no se pudo crear incidente imei=${imei} estado=${estado} posicion=${posicionId}: ${(error as Error)?.message}`,
      );
    } finally {
      this.enCurso.delete(clave);
    }
  }

  /** Mismo criterio que el alta manual (IncidentesService.idClienteDesdeImei). */
  private async idClientePorImei(imei: string): Promise<number | null> {
    const row = await this.dispositivosRepo
      .createQueryBuilder('d')
      .select('d.idCliente', 'idCliente')
      .where('CAST(d.imei AS CHAR) = :imei', { imei })
      .getRawOne<{ idCliente: string | number }>();
    const idCliente = Number(row?.idCliente);
    return Number.isFinite(idCliente) && idCliente > 0 ? idCliente : null;
  }

  /** Id del incidente abierto más reciente de esta alerta, o null. */
  private async buscarAbierto(
    idCliente: number,
    imei: string,
    estado: number,
    evento: number | null,
  ): Promise<number | null> {
    const query = this.incidentesRepo
      .createQueryBuilder('inc')
      .select('inc.id', 'id')
      .where('inc.idCliente = :idCliente', { idCliente })
      .andWhere('inc.estatus = :abierto', {
        abierto: EstatusIncidente.ABIERTO,
      })
      .andWhere('inc.tipoOrigen = :tipo', {
        tipo: TipoOrigenIncidente.POSICION,
      })
      .andWhere(
        "JSON_UNQUOTE(JSON_EXTRACT(inc.DatosOrigen, '$.imei')) = :imei",
        { imei },
      )
      .andWhere("CAST(JSON_EXTRACT(inc.DatosOrigen, '$.estado') AS SIGNED) = :estado", {
        estado,
      });
    if (evento != null) {
      query.andWhere(
        "CAST(JSON_EXTRACT(inc.DatosOrigen, '$.idEvento') AS SIGNED) = :evento",
        { evento },
      );
    }
    const row = await query
      .orderBy('inc.id', 'DESC')
      .limit(1)
      .getRawOne<{ id: string | number }>();
    const id = Number(row?.id);
    return Number.isFinite(id) && id > 0 ? id : null;
  }
}
