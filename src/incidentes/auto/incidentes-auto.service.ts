import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import {
  EstatusEnum,
  EstatusIncidente,
  TipoOrigenIncidente,
} from 'src/common/estatus.enum';
import { Clientes } from 'src/entities/Clientes';
import { fechaPared, nowMexicoCityAsUtcDate } from 'src/utils/datetime-mexico.util';
import { EventoAlarma } from 'src/entities/EventoAlarma';
import { MonitoreoGateway } from 'src/monitoreo/monitoreo.gateway';
import { Instalaciones } from 'src/entities/Instalaciones';
import { imeiToString } from 'src/common/imei.util';
import { Dispositivos } from 'src/entities/Dispositivos';
import { Incidentes } from 'src/entities/Incidentes';
import { WebhooksClienteService } from 'src/webhooks-cliente/webhooks-cliente.service';
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

/** `TipoEvento` de springPanel que abren incidente: pánico (PA) y pánico asalto (PH). */
export const TIPOS_EVENTO_PANICO_PANEL = ['panico', 'panico_asalto'] as const;
const ETIQUETA_PANICO_PANEL: Record<string, string> = {
  panico: 'Pánico',
  panico_asalto: 'Pánico asalto',
};

/** Medio de los seguimientos que agrega el sistema (no un usuario). */
export const MEDIO_SEGUIMIENTO_ALERTA = 'Alerta automática';

/**
 * Alerta repetida dentro de esta ventana tras el último seguimiento automático
 * del incidente: no se agrega otro (6/11/2026: "Falta de energía" cada pocos
 * segundos llenó el incidente 16 con 61 seguimientos). El pánico no se agrupa;
 * mismo criterio que GATEWAY_ALARM_REPEAT_WINDOW_SEC de la TrackCam.
 */
export const VENTANA_ALERTA_REPETIDA_MS = 60_000;
const ESTADO_PANICO = 2;
import { snapshotEventoAlarma, snapshotPosicion } from '../map-datos-origen.util';

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
    @Optional() private readonly monitoreoGateway?: MonitoreoGateway,
    @Optional() private readonly webhooks?: WebhooksClienteService,
  ) {}

  /**
   * La alerta tenía una ubicación aproximada (WiFi o antena) y llegó su GPS
   * (alarm_location): la posición ya se corrigió; el incidente abierto que la
   * usa recibe un seguimiento con la ubicación precisa.
   */
  async ubicacionGpsDeAlerta(posicionId: number): Promise<void> {
    try {
      const fila = await this.incidentesRepo.findOne({
        select: { id: true },
        where: { idPosicion: posicionId, estatus: EstatusIncidente.ABIERTO },
      });
      const posicion = fila ? await this.posicionesRepo.findOne({ where: { id: posicionId } }) : null;
      if (!fila || !posicion) return;
      await this.seguimientosRepo.save(
        this.seguimientosRepo.create({
          idIncidente: Number(fila.id),
          idUsuario: null,
          fechaHora: posicion.fechaHora,
          actividad: seguimientoAlertaRepetida(posicion.estado, posicion.idEvento, posicion).replace(
            'Nueva alerta:',
            'Ubicación GPS de la alerta:',
          ),
          medio: MEDIO_SEGUIMIENTO_ALERTA,
        }),
      );
      void this.monitoreoGateway?.notificarImei(String(posicion.imei));
    } catch (error) {
      this.logger.warn(
        `[IncidenteAuto] no se pudo agregar la ubicación GPS posicion=${posicionId}: ${(error as Error)?.message}`,
      );
    }
  }

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
        // Alerta que llegó sin ubicación: la primera posición medida es la suya.
        const ligada = await this.incidentesRepo
          .createQueryBuilder()
          .update(Incidentes)
          .set({ idPosicion: Number(posicion.id), idPosicionOrigen: Number(posicion.id) })
          .where('id = :id AND idPosicion IS NULL', { id: abierto })
          .execute();
        if (
          !ligada.affected &&
          (await this.repetidaEnVentana(abierto, estado, posicion.fechaHora))
        ) {
          this.logger.debug(
            `[IncidenteAuto] imei=${imei} estado=${estado} posicion=${posicionId} → repetida en Incidente=${abierto}, sin seguimiento`,
          );
          return;
        }
        await this.seguimientosRepo.save(
          this.seguimientosRepo.create({
            idIncidente: abierto,
            idUsuario: null,
            fechaHora: posicion.fechaHora,
            actividad: ligada.affected
              ? seguimientoAlertaRepetida(estado, evento, posicion).replace(
                  'Nueva alerta:',
                  'Ubicación de la alerta:',
                )
              : seguimientoAlertaRepetida(estado, evento, posicion),
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
      // Aviso al sistema del cliente (bandeja con reintentos; nunca frena aquí).
      void this.webhooks?.encolar('alerta.abierta', idCliente, {
        idIncidente: Number(saved.id),
        descripcion: saved.descripcion,
        imei,
        estado,
        idEvento: idEvento ?? null,
        fechaHora: fechaPared(posicion.fechaHora),
        lat: posicion.lat,
        lng: posicion.lng,
      });
    } catch (error) {
      this.logger.warn(
        `[IncidenteAuto] no se pudo crear incidente imei=${imei} estado=${estado} posicion=${posicionId}: ${(error as Error)?.message}`,
      );
    } finally {
      this.enCurso.delete(clave);
    }
  }

  /**
   * Alerta de un equipo que llegó sin ubicación medida (SOS o caída de un reloj
   * sin GPS, WiFi ni antena; alarma de cámara sin GPS). Los sockets no mandan
   * la última posición ni coordenadas de relleno (regla 9 de springSocketKit),
   * así que no hay fila de Posiciones: el incidente se abre sin `IdPosicion`,
   * con la misma regla de uno abierto por IMEI + estado (+ evento propio), y
   * se avisa a Consola (`consola:incidente`, `sinUbicacion: true`). La
   * siguiente posición medida de esa alerta se liga a él en
   * `registrarDesdePosicion`.
   */
  async registrarSinUbicacion(params: {
    imei: string;
    estado: number;
    idEvento: number | null;
    fechaHora: Date;
    protocolo: string;
  }): Promise<void> {
    const { estado } = params;
    if (!esEstadoAlertaConsola(estado)) return;
    const imei = imeiToString(params.imei);
    if (!imei) return;
    const evento = eventoIncidente(params.idEvento);

    const clave = `${imei}|${estado}|${evento ?? ''}`;
    if (this.enCurso.has(clave)) return;
    this.enCurso.add(clave);

    try {
      const instalacion = await this.dispositivosRepo
        .createQueryBuilder('d')
        .innerJoin(Instalaciones, 'i', 'i.idDispositivo = d.id AND i.estatus = :activa', {
          activa: EstatusEnum.ACTIVO,
        })
        .select('i.idCliente', 'idCliente')
        .addSelect('i.id', 'idInstalacion')
        .where('d.imei = :imei', { imei })
        .getRawOne<{ idCliente: string | number; idInstalacion: string | number }>();
      const idCliente = Number(instalacion?.idCliente);
      const idInstalacion = Number(instalacion?.idInstalacion);
      if (!(idCliente > 0)) return;

      const etiqueta = descripcionAlertaAutomatica(estado, params.idEvento).replace(
        'Alerta automática: ',
        '',
      );
      const abierto = await this.buscarAbierto(idCliente, imei, estado, evento);
      let idIncidente: number;
      let descripcion: string | null = null;
      if (abierto != null) {
        if (await this.repetidaEnVentana(abierto, estado, params.fechaHora)) return;
        idIncidente = abierto;
        await this.seguimientosRepo.save(
          this.seguimientosRepo.create({
            idIncidente,
            idUsuario: null,
            fechaHora: params.fechaHora,
            actividad: `Nueva alerta: ${etiqueta} · sin ubicación`,
            medio: MEDIO_SEGUIMIENTO_ALERTA,
          }),
        );
      } else {
        const saved = await this.incidentesRepo.save(
          this.incidentesRepo.create({
            idCliente,
            tipoOrigen: TipoOrigenIncidente.POSICION,
            idPosicion: null,
            idPosicionOrigen: null,
            idEventoAlarma: null,
            idEventoAlarmaOrigen: null,
            // Mismas llaves que snapshotPosicion (buscarAbierto filtra por imei/estado/idEvento).
            datosOrigen: {
              id: null,
              imei,
              lat: null,
              lng: null,
              estado,
              idEvento: params.idEvento,
              fechaHora: params.fechaHora,
              sinUbicacion: true,
              protocolo: params.protocolo,
            },
            idUsuario: null,
            descripcion: `${descripcionAlertaAutomatica(estado, params.idEvento)} (sin ubicación)`,
            fechaInicio: params.fechaHora,
            fechaCierre: null,
            estatus: EstatusIncidente.ABIERTO,
          }),
        );
        idIncidente = Number(saved.id);
        descripcion = saved.descripcion;
        void this.webhooks?.encolar('alerta.abierta', idCliente, {
          idIncidente,
          descripcion,
          imei,
          estado,
          idEvento: params.idEvento,
          fechaHora: fechaPared(params.fechaHora),
          lat: null,
          lng: null,
        });
      }
      this.logger.log(
        `[IncidenteAuto] imei=${imei} estado=${estado} evento=${evento ?? '-'} sin ubicación → ${abierto == null ? 'Incidente' : 'seguimiento en Incidente'}=${idIncidente}`,
      );

      if (idInstalacion > 0) {
        this.monitoreoGateway?.emitConsolaIncidente({
          idIncidente,
          nuevo: abierto == null,
          tipoOrigen: TipoOrigenIncidente.POSICION,
          idEventoAlarma: null,
          idInstalacion,
          idPanel: null,
          idCliente,
          tipoEvento: 'sin_ubicacion',
          imei,
          estado,
          idEvento: params.idEvento,
          sinUbicacion: true,
          zona: null,
          nombreDispositivo: null,
          descripcion,
          fechaHora: fechaPared(params.fechaHora),
        });
      }
    } catch (error) {
      this.logger.warn(
        `[IncidenteAuto] no se pudo crear el incidente sin ubicación imei=${imei} estado=${estado}: ${(error as Error)?.message}`,
      );
    } finally {
      this.enCurso.delete(clave);
    }
  }

  /**
   * Pánico de un panel de alarma (SIA PA/PH): mismo trato que una alerta de
   * vehículo. Un incidente ABIERTO por panel con origen evento de alarma
   * (`tipoOrigen` 2); si ya hay uno, el pánico nuevo entra como seguimiento.
   * Lo llama el ingest de alarmas fuera de su transacción y sin esperar.
   */
  async registrarDesdeEventoAlarma(idEventoAlarma: number): Promise<void> {
    if (!Number.isFinite(idEventoAlarma) || idEventoAlarma < 1) return;
    let clave: string | null = null;
    try {
      const evento = await this.incidentesRepo.manager.findOne(EventoAlarma, {
        where: { id: idEventoAlarma },
      });
      if (!evento || Number(evento.esRestauracion) === 1) return;
      if (!(TIPOS_EVENTO_PANICO_PANEL as readonly string[]).includes(evento.tipoEvento)) return;
      const idPanel = Number(evento.idPanel);
      const idCliente = Number(evento.idCliente);
      // Sin panel o sin instalación activa (almacén): solo evidencia, sin incidente.
      if (!(idPanel > 0) || !(idCliente > 0)) return;

      clave = `panel:${idPanel}|panico`;
      if (this.enCurso.has(clave)) {
        clave = null;
        return;
      }
      this.enCurso.add(clave);

      const instalacion = await this.incidentesRepo.manager.findOne(Instalaciones, {
        where: { idDispositivo: idPanel, estatus: EstatusEnum.ACTIVO },
        select: { id: true },
      });
      const idInstalacion = Number(instalacion?.id);

      const etiqueta = ETIQUETA_PANICO_PANEL[evento.tipoEvento] ?? 'Pánico';
      const detalle = [
        evento.zona != null ? `zona ${evento.zona}` : null,
        evento.nombreDispositivo?.trim() || null,
        `evento ${evento.id}`,
      ]
        .filter(Boolean)
        .join(' · ');

      const abierto = await this.incidentesRepo
        .createQueryBuilder('inc')
        .select('inc.id', 'id')
        .where('inc.idCliente = :idCliente', { idCliente })
        .andWhere('inc.estatus = :abierto', { abierto: EstatusIncidente.ABIERTO })
        .andWhere('inc.tipoOrigen = :tipo', { tipo: TipoOrigenIncidente.EVENTO_ALARMA })
        .andWhere("CAST(JSON_EXTRACT(inc.DatosOrigen, '$.idPanel') AS SIGNED) = :idPanel", { idPanel })
        .andWhere("JSON_UNQUOTE(JSON_EXTRACT(inc.DatosOrigen, '$.tipoEvento')) IN (:...tipos)", {
          tipos: [...TIPOS_EVENTO_PANICO_PANEL],
        })
        .andWhere("JSON_EXTRACT(inc.DatosOrigen, '$.alerta') IS NULL")
        .orderBy('inc.id', 'DESC')
        .limit(1)
        .getRawOne<{ id: string | number }>();

      let idIncidente: number;
      let descripcion: string | null;
      const nuevo = abierto == null;
      if (abierto != null) {
        idIncidente = Number(abierto.id);
        descripcion = null;
        await this.seguimientosRepo.save(
          this.seguimientosRepo.create({
            idIncidente,
            idUsuario: null,
            fechaHora: evento.recibidoEn,
            actividad: `Nueva alerta: ${etiqueta} · ${detalle}`,
            medio: MEDIO_SEGUIMIENTO_ALERTA,
          }),
        );
      } else {
        const saved = await this.incidentesRepo.save(
          this.incidentesRepo.create({
            idCliente,
            tipoOrigen: TipoOrigenIncidente.EVENTO_ALARMA,
            idPosicion: null,
            idPosicionOrigen: null,
            idEventoAlarma: Number(evento.id),
            idEventoAlarmaOrigen: Number(evento.id),
            datosOrigen: snapshotEventoAlarma(evento),
            idUsuario: null,
            descripcion: `Alerta automática: ${etiqueta} (panel de alarma)`,
            fechaInicio: evento.recibidoEn,
            fechaCierre: null,
            estatus: EstatusIncidente.ABIERTO,
          }),
        );
        idIncidente = Number(saved.id);
        descripcion = saved.descripcion;
      }
      this.logger.log(
        `[IncidenteAuto] panel=${idPanel} ${evento.tipoEvento} evento=${evento.id} → ${nuevo ? 'Incidente' : 'seguimiento en Incidente'}=${idIncidente}`,
      );

      if (idInstalacion > 0) {
        this.monitoreoGateway?.emitConsolaIncidente({
          idIncidente,
          nuevo,
          tipoOrigen: TipoOrigenIncidente.EVENTO_ALARMA,
          idEventoAlarma: Number(evento.id),
          idInstalacion,
          idPanel,
          idCliente,
          tipoEvento: evento.tipoEvento,
          zona: evento.zona != null ? Number(evento.zona) : null,
          nombreDispositivo: evento.nombreDispositivo,
          descripcion,
          fechaHora: fechaPared(new Date(evento.recibidoEn)),
        });
      }
    } catch (error) {
      this.logger.warn(
        `[IncidenteAuto] no se pudo crear el incidente del pánico de panel evento=${idEventoAlarma}: ${(error as Error)?.message}`,
      );
    } finally {
      if (clave) this.enCurso.delete(clave);
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
   * equipo siga transmitiendo. Un candado de MySQL por equipo evita duplicados
   * entre instancias; una memoria corta evita consultar en cada transmisión.
   */
  async registrarInservibleTransmite(posicionId: number, imeiRaw: string): Promise<void> {
    const imei = imeiToString(imeiRaw);
    if (!imei || !Number.isFinite(posicionId) || posicionId < 1) return;
    await this.abrirInservible(`imei:${imei}`, async (m) => {
      const [posicion, equipo] = await Promise.all([
        m.findOne(Posiciones, { where: { id: posicionId } }),
        m.findOne(Dispositivos, { where: { imei }, select: { id: true, idCliente: true, numeroSerie: true } }),
      ]);
      if (!posicion || !equipo) return null;
      return {
        equipo,
        tipo: 'equipo',
        identificador: `IMEI ${imei}`,
        campos: {
          tipoOrigen: TipoOrigenIncidente.POSICION,
          idPosicion: Number(posicion.id),
          idPosicionOrigen: Number(posicion.id),
          idEventoAlarma: null,
          idEventoAlarmaOrigen: null,
          fechaInicio: posicion.fechaHora,
        },
        datosOrigen: snapshotPosicion(posicion),
      };
    });
  }

  /**
   * Panel inservible que transmite (evento SIA o heartbeat): mismo incidente
   * que un equipo con posición (§7). `idEventoAlarma` es el evento guardado;
   * un heartbeat no tiene evento (null).
   */
  async registrarPanelInservibleTransmite(params: {
    idDispositivo: number;
    cuentaSia: string;
    idEventoAlarma: number | null;
    recibidoEn: Date;
  }): Promise<void> {
    const { idDispositivo, cuentaSia, idEventoAlarma, recibidoEn } = params;
    if (!Number.isFinite(idDispositivo) || idDispositivo < 1) return;
    await this.abrirInservible(`panel:${idDispositivo}`, async (m) => {
      const [equipo, evento] = await Promise.all([
        m.findOne(Dispositivos, { where: { id: idDispositivo }, select: { id: true, idCliente: true, numeroSerie: true } }),
        idEventoAlarma != null ? m.findOne(EventoAlarma, { where: { id: idEventoAlarma } }) : Promise.resolve(null),
      ]);
      if (!equipo) return null;
      return {
        equipo,
        tipo: 'panel',
        identificador: `cuenta SIA ${cuentaSia}`,
        campos: {
          tipoOrigen: TipoOrigenIncidente.EVENTO_ALARMA,
          idPosicion: null,
          idPosicionOrigen: null,
          idEventoAlarma: evento ? Number(evento.id) : null,
          idEventoAlarmaOrigen: evento ? Number(evento.id) : null,
          fechaInicio: evento?.recibidoEn ?? recibidoEn,
        },
        datosOrigen: {
          ...(evento ? snapshotEventoAlarma(evento) : { recibidoEn }),
          cuentaSia,
          transmision: evento ? 'evento' : 'heartbeat',
        },
      };
    });
  }

  private async abrirInservible(
    clave: string,
    origen: (m: EntityManager) => Promise<{
      equipo: Pick<Dispositivos, 'id' | 'idCliente' | 'numeroSerie'>;
      tipo: 'equipo' | 'panel';
      identificador: string;
      campos: Pick<
        Incidentes,
        'tipoOrigen' | 'idPosicion' | 'idPosicionOrigen' | 'idEventoAlarma' | 'idEventoAlarmaOrigen' | 'fechaInicio'
      >;
      datosOrigen: Record<string, unknown>;
    } | null>,
  ): Promise<void> {
    const hasta = this.inservibleVisto.get(clave);
    if (hasta != null && hasta > Date.now()) return;
    const enCurso = `${clave}|${ALERTA_INSERVIBLE}`;
    if (this.enCurso.has(enCurso)) return;
    this.enCurso.add(enCurso);
    const qr = this.incidentesRepo.manager.connection.createQueryRunner();
    const candado = `inservible:${clave}`;
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
        this.logger.warn(`[IncidenteAuto] sin cliente raíz: no se abre el incidente de inservible ${clave}`);
        return;
      }
      const idCliente = Number(raiz.id);

      const datos = await origen(m);
      if (!datos) {
        // Sin posición o sin equipo: no se reintenta en cada transmisión.
        this.inservibleVisto.set(clave, Date.now() + MEMORIA_INSERVIBLE_MS);
        return;
      }
      const { equipo } = datos;

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
        .andWhere("CAST(JSON_EXTRACT(inc.DatosOrigen, '$.idDispositivo') AS SIGNED) = :idDispositivo", {
          idDispositivo: Number(equipo.id),
        })
        .getRawOne<{ id: string | number }>();
      if (vigente) {
        this.inservibleVisto.set(clave, Date.now() + MEMORIA_INSERVIBLE_MS);
        return;
      }

      const saved = await m.save(
        m.create(Incidentes, {
          idCliente,
          ...datos.campos,
          datosOrigen: {
            ...datos.datosOrigen,
            alerta: ALERTA_INSERVIBLE,
            idDispositivo: Number(equipo.id),
            idClienteDispositivo: equipo.idCliente != null ? Number(equipo.idCliente) : null,
          },
          idUsuario: null,
          descripcion:
            `${datos.tipo === 'panel' ? 'Panel' : 'Equipo'} inservible transmitiendo (posible robo o vandalismo): ` +
            `serie ${equipo.numeroSerie}, ${datos.identificador}, cliente del equipo ${equipo.idCliente ?? 'almacén'}.`,
          fechaCierre: null,
          estatus: EstatusIncidente.ABIERTO,
        }),
      );
      this.inservibleVisto.set(clave, Date.now() + MEMORIA_INSERVIBLE_MS);
      this.logger.log(`[IncidenteAuto] inservible transmite ${clave} → Incidente=${saved.id}`);
      this.monitoreoGateway?.emitIncidenteInservible({
        idIncidente: Number(saved.id),
        tipo: datos.tipo,
        idDispositivo: Number(equipo.id),
        numeroSerie: equipo.numeroSerie,
        identificador: datos.identificador,
        idClienteDispositivo: equipo.idCliente != null ? Number(equipo.idCliente) : null,
        descripcion: saved.descripcion,
        fechaInicio: fechaPared(new Date(saved.fechaInicio)),
      });
    } catch (error) {
      this.logger.warn(
        `[IncidenteAuto] no se pudo crear el incidente de inservible ${clave}: ${(error as Error)?.message}`,
      );
    } finally {
      await qr.query('SELECT RELEASE_LOCK(?)', [candado]).catch(() => undefined);
      await qr.release();
      this.enCurso.delete(enCurso);
    }
  }

  /**
   * ¿Hubo un seguimiento automático de este incidente a menos de
   * VENTANA_ALERTA_REPETIDA_MS de esta alerta? El pánico nunca se agrupa.
   */
  private async repetidaEnVentana(
    idIncidente: number,
    estado: number,
    fechaHora: Date | string,
  ): Promise<boolean> {
    if (estado === ESTADO_PANICO) return false;
    const fecha = new Date(fechaHora);
    if (!Number.isFinite(fecha.getTime())) return false;
    const desde = new Date(fecha.getTime() - VENTANA_ALERTA_REPETIDA_MS);
    const hasta = new Date(fecha.getTime() + VENTANA_ALERTA_REPETIDA_MS);
    const row = await this.seguimientosRepo
      .createQueryBuilder('s')
      .select('s.id', 'id')
      .where('s.idIncidente = :idIncidente', { idIncidente })
      .andWhere('s.medio = :medio', { medio: MEDIO_SEGUIMIENTO_ALERTA })
      .andWhere('s.fechaHora BETWEEN :desde AND :hasta', { desde, hasta })
      .limit(1)
      .getRawOne<{ id: string | number }>();
    return row != null;
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
