import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  EstatusEnum,
  EstatusIncidente,
  TipoOrigenIncidente,
} from 'src/common/estatus.enum';
import { Clientes } from 'src/entities/Clientes';
import { nowMexicoCityAsUtcDate } from 'src/utils/datetime-mexico.util';
import { Instalaciones } from 'src/entities/Instalaciones';
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

/** `DatosOrigen.alerta` del incidente de un equipo inservible que transmite. */
export const ALERTA_INSERVIBLE = 'inservible_transmite';
/** Tras cerrar el incidente de un inservible, no se abre otro en 24 h. */
const ENFRIAMIENTO_INSERVIBLE_MS = 24 * 3_600_000;
/** Memoria del proceso: no se consulta en cada posición de un inservible ya atendido. */
const MEMORIA_INSERVIBLE_MS = 10 * 60_000;

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
  /** IMEI inservible con incidente vigente → hasta cuándo no se vuelve a consultar. */
  private readonly inservibleVisto = new Map<string, number>();

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

  /**
   * Cliente de la instalación activa del equipo (la posición acaba de llegar:
   * es de la vigencia actual). Sin instalación activa no hay incidente de
   * cliente: lo transmitido en almacén o taller es solo evidencia (§7).
   */
  private async idClientePorImei(imei: string): Promise<number | null> {
    const row = await this.dispositivosRepo
      .createQueryBuilder('d')
      .innerJoin(Instalaciones, 'i', 'i.idDispositivo = d.id AND i.estatus = :activa', {
        activa: EstatusEnum.ACTIVO,
      })
      .select('i.idCliente', 'idCliente')
      .where('d.imei = :imei', { imei })
      .getRawOne<{ idCliente: string | number }>();
    const idCliente = Number(row?.idCliente);
    return Number.isFinite(idCliente) && idCliente > 0 ? idCliente : null;
  }

  /**
   * Equipo inservible (estatus 5) que transmite: posible robo o vandalismo
   * (docs/motor-activos.md §7, decisión del 30/10). Un incidente abierto por
   * equipo, en el cliente raíz (la operación): lo atiende monitoreo, no el
   * cliente final; el cliente dueño del equipo queda en la descripción y en
   * DatosOrigen. Después de cerrado no se vuelve a abrir en 24 h aunque el
   * equipo siga transmitiendo. Un candado de MySQL por IMEI evita duplicados
   * entre instancias; una memoria corta evita consultar en cada posición.
   */
  async registrarInservibleTransmite(posicionId: number, imeiRaw: string): Promise<void> {
    const imei = imeiToString(imeiRaw);
    if (!imei || !Number.isFinite(posicionId) || posicionId < 1) return;
    const hasta = this.inservibleVisto.get(imei);
    if (hasta != null && hasta > Date.now()) return;
    const clave = `${imei}|${ALERTA_INSERVIBLE}`;
    if (this.enCurso.has(clave)) return;
    this.enCurso.add(clave);
    const qr = this.incidentesRepo.manager.connection.createQueryRunner();
    const candado = `inservible:${imei}`;
    try {
      await qr.connect();
      const [lock] = await qr.query('SELECT GET_LOCK(?, 5) AS l', [candado]);
      if (Number(lock?.l) !== 1) return;
      const m = qr.manager;

      const raiz = await m
        .createQueryBuilder(Clientes, 'c')
        .select('c.id', 'id')
        .where('c.idPadre IS NULL')
        .orderBy('c.id', 'ASC')
        .limit(1)
        .getRawOne<{ id: string | number }>();
      if (!raiz) {
        this.logger.warn(`[IncidenteAuto] sin cliente raíz: no se abre el incidente de inservible imei=${imei}`);
        return;
      }
      const idCliente = Number(raiz.id);

      // Abierto, o cerrado hace menos de 24 h: no se abre otro.
      const vigente = await m
        .createQueryBuilder(Incidentes, 'inc')
        .select('inc.id', 'id')
        .where('inc.idCliente = :idCliente', { idCliente })
        .andWhere('(inc.estatus = :abierto OR inc.fechaCierre > :desde)', {
          abierto: EstatusIncidente.ABIERTO,
          desde: new Date(nowMexicoCityAsUtcDate().getTime() - ENFRIAMIENTO_INSERVIBLE_MS),
        })
        .andWhere("JSON_UNQUOTE(JSON_EXTRACT(inc.DatosOrigen, '$.alerta')) = :alerta", { alerta: ALERTA_INSERVIBLE })
        .andWhere("JSON_UNQUOTE(JSON_EXTRACT(inc.DatosOrigen, '$.imei')) = :imei", { imei })
        .getRawOne<{ id: string | number }>();
      if (vigente) {
        this.inservibleVisto.set(imei, Date.now() + MEMORIA_INSERVIBLE_MS);
        return;
      }

      const [posicion, equipo] = await Promise.all([
        m.findOne(Posiciones, { where: { id: posicionId } }),
        m.findOne(Dispositivos, { where: { imei }, select: { id: true, idCliente: true, numeroSerie: true } }),
      ]);
      if (!posicion || !equipo) return;

      const saved = await m.save(
        m.create(Incidentes, {
          idCliente,
          tipoOrigen: TipoOrigenIncidente.POSICION,
          idPosicion: Number(posicion.id),
          idPosicionOrigen: Number(posicion.id),
          idEventoAlarma: null,
          idEventoAlarmaOrigen: null,
          datosOrigen: {
            ...snapshotPosicion(posicion),
            alerta: ALERTA_INSERVIBLE,
            idDispositivo: Number(equipo.id),
            idClienteDispositivo: equipo.idCliente != null ? Number(equipo.idCliente) : null,
          },
          idUsuario: null,
          descripcion:
            `Equipo inservible transmitiendo (posible robo o vandalismo): serie ${equipo.numeroSerie}, ` +
            `IMEI ${imei}, cliente del equipo ${equipo.idCliente ?? 'almacén'}.`,
          fechaInicio: posicion.fechaHora,
          fechaCierre: null,
          estatus: EstatusIncidente.ABIERTO,
        }),
      );
      this.inservibleVisto.set(imei, Date.now() + MEMORIA_INSERVIBLE_MS);
      this.logger.log(`[IncidenteAuto] inservible transmite imei=${imei} posicion=${posicionId} → Incidente=${saved.id}`);
    } catch (error) {
      this.logger.warn(
        `[IncidenteAuto] no se pudo crear el incidente de inservible imei=${imei}: ${(error as Error)?.message}`,
      );
    } finally {
      await qr.query('SELECT RELEASE_LOCK(?)', [candado]).catch(() => undefined);
      await qr.release();
      this.enCurso.delete(clave);
    }
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
      })
      // El de "inservible transmite" es otro incidente, no una alerta de consola.
      .andWhere("JSON_EXTRACT(inc.DatosOrigen, '$.alerta') IS NULL");
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
