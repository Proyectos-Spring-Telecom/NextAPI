import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { MonitoreoGateway } from 'src/monitoreo/monitoreo.gateway';
import { ConfigService } from '@nestjs/config';
import { DataSource, In } from 'typeorm';
import { AvisosSinTransmision } from 'src/entities/AvisosSinTransmision';
import { EvaluacionesTransmision } from 'src/entities/EvaluacionesTransmision';
import { VigilanciaTransmisionTipo } from 'src/entities/VigilanciaTransmisionTipo';
import { EnumTipoDispositivo } from 'src/common/estatus.enum';
import { fechaPared, fechaParedComoDate, nowMexicoCityAsUtcDate } from 'src/utils/datetime-mexico.util';
import { AtenderAvisoDto } from './dto/atender-aviso.dto';
import {
  agruparPorProveedor,
  diaDe,
  ESTATUS_AVISO_VIVO,
  type EstatusAviso,
  horasSinTransmitir,
  type MotivoCierreAviso,
  PROVEEDOR_MIN_DEFECTO,
  type ResumenProveedor,
  umbralHoras,
} from './vigilancia-transmision.reglas';

/**
 * Última transmisión de cada instalación activa EN SU VIGENCIA (fase D): la
 * de antes de `VigenteDesde` es de otra instalación. GPS, TrackCam y relojes:
 * `UltimaPosicion.FHRegistro` (llegada al servidor; si falta, `FechaHora`).
 * Paneles: `PanelAlarma.UltimoHeartbeat`.
 */
const SQL_ULTIMA = `
  CASE
    WHEN d.IdTipoDispositivo = ${EnumTipoDispositivo.PANEL_ALARMA} THEN
      IF(pa.UltimoHeartbeat >= i.VigenteDesde, pa.UltimoHeartbeat, NULL)
    ELSE IF(up.FechaHora >= i.VigenteDesde, COALESCE(up.FHRegistro, up.FechaHora), NULL)
  END`;

const SQL_INSTALACIONES_ACTIVAS = `
  SELECT i.Id AS idInstalacion, i.IdCliente AS idCliente, i.IdDispositivo AS idDispositivo,
         d.IdTipoDispositivo AS idTipoDispositivo, i.IdSim AS idSim, s.IdTelefonia AS idTelefonia,
         ${SQL_ULTIMA} AS ultima
    FROM Instalaciones i
    JOIN Dispositivos d ON d.Id = i.IdDispositivo
    LEFT JOIN Sims s ON s.Id = i.IdSim
    LEFT JOIN UltimaPosicion up ON up.Imei = d.Imei
    LEFT JOIN PanelAlarma pa ON pa.IdDispositivo = d.Id
   WHERE i.Estatus = 1`;

/** Datos de pantalla de una instalación (cliente, vehículo, equipo, SIM). */
const SQL_CONTEXTO = `
  CONCAT_WS(' ', c.Nombre, c.ApellidoPaterno, c.ApellidoMaterno) AS cliente,
  v.Placa AS placa, v.NumeroEconomico AS economico,
  CAST(d.Imei AS CHAR) AS imei, d.NumeroSerie AS numeroSerie, td.Nombre AS tipoDispositivo,
  s.NumeroTelefono AS numeroSim, ct.NombreTelefonia AS telefonia`;

const SQL_JOINS_CONTEXTO = `
  LEFT JOIN Clientes c ON c.Id = X.IdCliente
  LEFT JOIN Dispositivos d ON d.Id = X.IdDispositivo
  LEFT JOIN CatTipoDispositivo td ON td.Id = d.IdTipoDispositivo
  LEFT JOIN Sims s ON s.Id = X.IdSim
  LEFT JOIN CatTelefonia ct ON ct.Id = s.IdTelefonia`;

interface Candidata {
  idInstalacion: number;
  idCliente: number;
  idDispositivo: number;
  idTipoDispositivo: number;
  idSim: number | null;
  idTelefonia: number | null;
  ultima: Date | null;
}

export interface ResultadoEvaluacion {
  fecha: string;
  evaluadas: number;
  avisos: number;
  nuevos: number;
  pausadas: number;
  sinPrimeraTransmision: number;
  cerrados: number;
}

const n = (v: unknown): number | null => (v == null || v === '' ? null : Number(v));
const f = (v: unknown): string | null => (v == null ? null : fechaPared(new Date(v as string | Date)));

/** Minutos tras los que una evaluación del día que no terminó se puede retomar. */
const LEASE_MIN = 15;

/**
 * Un aviso en "taller" cuya fecha de regreso ya pasó y el equipo sigue sin
 * transmitir vuelve a abierto: monitoreo debe verlo otra vez.
 */
function reabrirSiTermino(aviso: AvisosSinTransmision, ahora: Date): Partial<AvisosSinTransmision> {
  const regreso = aviso.fechaRegreso ? new Date(aviso.fechaRegreso).getTime() : null;
  if (aviso.resultado === 'taller' && regreso != null && regreso <= ahora.getTime()) {
    return { estatus: 'abierto', resultado: null, fechaRegreso: null };
  }
  return {};
}

/**
 * Vigilancia de transmisión (docs/motor-activos.md §7b): todo equipo instalado
 * debe transmitir. Una vez al día (9:00–11:00, hora de México) busca las
 * instalaciones activas que llevan más del umbral de su tipo sin transmitir y
 * deja un aviso en la bandeja de monitoreo. Los avisos se cierran solos cuando
 * el equipo vuelve a transmitir o la instalación deja de estar activa.
 */
@Injectable()
export class VigilanciaTransmisionService {
  private readonly logger = new Logger(VigilanciaTransmisionService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    @Optional() private readonly gateway?: MonitoreoGateway,
  ) {}

  /**
   * Tiempo real (`vigilancia:avisos` en `/monitoreo`, room de operación): los
   * avisos que cambiaron, con el mismo ítem que la bandeja. Nunca falla la
   * operación que lo llama.
   */
  private async notificar(motivo: 'evaluacion' | 'atencion', ids: readonly number[]): Promise<void> {
    if (!this.gateway || !ids.length) return;
    try {
      const vivos = await this.listar({});
      const cambiados = new Set(ids);
      this.gateway.emitAvisosSinTransmision({
        motivo,
        avisos: vivos.data.filter((a) => cambiados.has(a.id)),
        ...(motivo === 'evaluacion' ? { porProveedor: vivos.porProveedor } : {}),
      });
    } catch (error) {
      this.logger.warn(`[Vigilancia] no se pudo notificar ${motivo}: ${(error as Error)?.message}`);
    }
  }

  private proveedorMinimo(): number {
    return Number(this.config.get('VIGILANCIA_PROVEEDOR_MIN') ?? PROVEEDOR_MIN_DEFECTO) || PROVEEDOR_MIN_DEFECTO;
  }

  private async candidatas(): Promise<Candidata[]> {
    const filas: Array<Record<string, unknown>> = await this.dataSource.query(SQL_INSTALACIONES_ACTIVAS);
    return filas.map((r) => ({
      idInstalacion: Number(r.idInstalacion),
      idCliente: Number(r.idCliente),
      idDispositivo: Number(r.idDispositivo),
      idTipoDispositivo: Number(r.idTipoDispositivo),
      idSim: n(r.idSim),
      idTelefonia: n(r.idTelefonia),
      ultima: r.ultima ? new Date(r.ultima as string | Date) : null,
    }));
  }

  /**
   * Evalúa todas las instalaciones activas. Una vez por día: la fila de
   * EvaluacionesTransmision se inserta antes. Si ya existe y terminó, `sistema`
   * no hace nada (null) y `api` responde 409 salvo `forzar`. Si existe sin
   * terminar (una corrida que falló o un reinicio a media evaluación) y su
   * arranque tiene más de 15 min (LEASE_MIN), se retoma: la ventana de 9 a 11 reintenta.
   */
  async evaluar(opciones: { origen: 'sistema' | 'api'; idUsuario?: number | null; forzar?: boolean }): Promise<ResultadoEvaluacion | null> {
    const ahora = nowMexicoCityAsUtcDate();
    const dia = diaDe(ahora);
    const repoEval = this.dataSource.getRepository(EvaluacionesTransmision);
    try {
      await repoEval.insert({ fecha: dia, inicio: ahora, origen: opciones.origen, idUsuario: opciones.idUsuario ?? null });
    } catch (error) {
      if ((error as { code?: string })?.code !== 'ER_DUP_ENTRY') throw error;
      const datos = { inicio: ahora, fin: null, origen: opciones.origen, idUsuario: opciones.idUsuario ?? null };
      const qb = repoEval.createQueryBuilder().update().set(datos).where('fecha = :dia', { dia });
      if (!opciones.forzar) {
        // Solo una corrida inconclusa y vieja: otra instancia puede estar evaluando ahora.
        qb.andWhere('fin IS NULL AND inicio < :limite', { limite: new Date(ahora.getTime() - LEASE_MIN * 60_000) });
      }
      const tomada = await qb.execute();
      if (!tomada.affected) {
        if (opciones.origen === 'sistema') return null;
        throw new ConflictException(`La vigilancia de transmisión ya se evaluó hoy (${dia}). Envíe forzar: true para repetirla.`);
      }
    }

    const cerrados = await this.cerrarResueltos();
    const porTipo = new Map(
      (await this.dataSource.getRepository(VigilanciaTransmisionTipo).find()).map((t) => [Number(t.idTipoDispositivo), Number(t.horasSinTransmitir)]),
    );
    const candidatas = await this.candidatas();
    const repoAvisos = this.dataSource.getRepository(AvisosSinTransmision);
    const vivos = new Map(
      (await repoAvisos.find({ where: { estatus: In([...ESTATUS_AVISO_VIVO]) } })).map((a) => [Number(a.idInstalacion), a]),
    );
    const pausadas = await this.instalacionesEnTaller(ahora);

    const tocados: number[] = [];
    const r: ResultadoEvaluacion = { fecha: dia, evaluadas: candidatas.length, avisos: 0, nuevos: 0, pausadas: 0, sinPrimeraTransmision: 0, cerrados };
    for (const c of candidatas) {
      if (!c.ultima) {
        r.sinPrimeraTransmision += 1;
        continue;
      }
      const horas = horasSinTransmitir(c.ultima, ahora);
      if (horas < umbralHoras(c.idTipoDispositivo, porTipo)) continue;
      if (pausadas.has(c.idInstalacion)) {
        r.pausadas += 1;
        continue;
      }
      const datos = {
        idCliente: c.idCliente,
        idDispositivo: c.idDispositivo,
        idTipoDispositivo: c.idTipoDispositivo,
        idSim: c.idSim,
        idTelefonia: c.idTelefonia,
        fechaEvaluacion: dia,
        ultimaTransmision: c.ultima,
        horasSinTransmitir: horas,
      };
      const vivo = vivos.get(c.idInstalacion);
      if (vivo) {
        await repoAvisos.update({ id: vivo.id }, { ...datos, ...reabrirSiTermino(vivo, ahora) });
        tocados.push(Number(vivo.id));
      } else {
        try {
          const nuevo = await repoAvisos.insert({
            ...datos,
            idInstalacion: c.idInstalacion,
            estatus: 'abierto',
            fechaPrimeraEvaluacion: dia,
            fechaCreacion: ahora,
          });
          tocados.push(Number(nuevo.identifiers[0].id));
          r.nuevos += 1;
        } catch (error) {
          // Otra evaluación (forzada, otra instancia) lo abrió en medio: UQ_AvisosSinTx_Vivo.
          if ((error as { code?: string })?.code !== 'ER_DUP_ENTRY') throw error;
          await repoAvisos.update({ idInstalacion: c.idInstalacion, estatus: In([...ESTATUS_AVISO_VIVO]) }, datos);
          const ganador = await repoAvisos.findOne({ where: { idInstalacion: c.idInstalacion, estatus: In([...ESTATUS_AVISO_VIVO]) } });
          if (ganador) tocados.push(Number(ganador.id));
        }
      }
      r.avisos += 1;
    }

    await repoEval.update({ fecha: dia }, { fin: nowMexicoCityAsUtcDate(), avisos: r.avisos, cerrados });
    this.logger.log(
      `[Vigilancia] ${dia} (${opciones.origen}): ${r.evaluadas} instalaciones, ${r.avisos} avisos (${r.nuevos} nuevos), ` +
        `${r.pausadas} en taller, ${r.sinPrimeraTransmision} sin primera transmisión, ${cerrados} cerrados`,
    );
    await this.notificar('evaluacion', tocados);
    return r;
  }

  /** Instalaciones cuyo aviso más reciente es "taller" con regreso futuro: se pausa su vigilancia. */
  private async instalacionesEnTaller(ahora: Date): Promise<Set<number>> {
    const filas: Array<{ idInstalacion: unknown; resultado: string | null; fechaRegreso: unknown }> = await this.dataSource.query(
      `SELECT a.IdInstalacion AS idInstalacion, a.Resultado AS resultado, a.FechaRegreso AS fechaRegreso
         FROM AvisosSinTransmision a
         JOIN (SELECT IdInstalacion, MAX(Id) AS Id FROM AvisosSinTransmision GROUP BY IdInstalacion) u ON u.Id = a.Id
        WHERE a.Resultado = 'taller' AND a.FechaRegreso > ?`,
      [ahora],
    );
    return new Set(filas.map((x) => Number(x.idInstalacion)));
  }

  /**
   * Cierra los avisos vivos cuya instalación volvió a transmitir después de la
   * última transmisión del aviso, o que ya no está activa (baja, o la versión
   * se reemplazó en un cambio de componente). Corre en cada tick del scheduler.
   */
  async cerrarResueltos(): Promise<number> {
    const ahora = nowMexicoCityAsUtcDate();
    const filas: Array<{ id: unknown; idInstalacion: unknown; ultimaAviso: unknown; estatusInst: unknown; existe: unknown; ultima: unknown }> = await this.dataSource.query(
      `SELECT a.Id AS id, a.IdInstalacion AS idInstalacion, a.UltimaTransmision AS ultimaAviso, i.Estatus AS estatusInst, i.Id AS existe, ${SQL_ULTIMA} AS ultima
         FROM AvisosSinTransmision a
         LEFT JOIN Instalaciones i ON i.Id = a.IdInstalacion
         LEFT JOIN Dispositivos d ON d.Id = i.IdDispositivo
         LEFT JOIN UltimaPosicion up ON up.Imei = d.Imei
         LEFT JOIN PanelAlarma pa ON pa.IdDispositivo = d.Id
        WHERE a.Estatus IN ('abierto', 'atendido')`,
    );
    const repo = this.dataSource.getRepository(AvisosSinTransmision);
    let cerrados = 0;
    const cerradosEvento: Array<{ id: number; idInstalacion: number; estatus: 'cerrado'; motivoCierre: MotivoCierreAviso; fechaCierre: string }> = [];
    for (const x of filas) {
      let motivo: MotivoCierreAviso | null = null;
      if (x.existe == null) motivo = 'cambio';
      else if (Number(x.estatusInst) !== 1) motivo = 'baja';
      else if (x.ultima && new Date(x.ultima as string | Date).getTime() > new Date(x.ultimaAviso as string | Date).getTime()) motivo = 'transmitio';
      if (!motivo) continue;
      const r = await repo.update(
        { id: Number(x.id), estatus: In([...ESTATUS_AVISO_VIVO]) },
        { estatus: 'cerrado', motivoCierre: motivo, fechaCierre: ahora },
      );
      cerrados += r.affected ?? 0;
      if (r.affected) {
        cerradosEvento.push({ id: Number(x.id), idInstalacion: Number(x.idInstalacion), estatus: 'cerrado', motivoCierre: motivo, fechaCierre: fechaPared(ahora) });
      }
    }
    // El aviso cerrado sale de la bandeja: basta su id y por qué.
    if (cerradosEvento.length) this.gateway?.emitAvisosSinTransmision({ motivo: 'cierre', avisos: cerradosEvento });
    return cerrados;
  }

  /** Bandeja: avisos (por defecto los vivos) con su contexto y el resumen por compañía. */
  async listar(filtro: { estatus?: EstatusAviso; fecha?: string }) {
    const condiciones: string[] = [];
    const params: unknown[] = [];
    if (filtro.estatus) {
      condiciones.push('X.Estatus = ?');
      params.push(filtro.estatus);
      if (filtro.estatus === 'cerrado' && !filtro.fecha) {
        // El histórico crece sin fin: sin fecha, los cerrados de los últimos 30 días.
        condiciones.push('X.FechaCierre >= ?');
        params.push(new Date(nowMexicoCityAsUtcDate().getTime() - 30 * 86_400_000));
      }
    } else {
      condiciones.push(`X.Estatus IN ('abierto', 'atendido')`);
    }
    if (filtro.fecha) {
      condiciones.push('X.FechaEvaluacion = ?');
      params.push(filtro.fecha);
    }
    const filas: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT X.Id AS id, X.IdInstalacion AS idInstalacion, X.IdCliente AS idCliente, X.IdDispositivo AS idDispositivo,
              X.IdTipoDispositivo AS idTipoDispositivo, X.IdSim AS idSim, X.IdTelefonia AS idTelefonia,
              DATE_FORMAT(X.FechaEvaluacion, '%Y-%m-%d') AS fechaEvaluacion,
              DATE_FORMAT(X.FechaPrimeraEvaluacion, '%Y-%m-%d') AS fechaPrimeraEvaluacion, X.UltimaTransmision AS ultimaTransmision,
              X.HorasSinTransmitir AS horasSinTransmitir, X.Estatus AS estatus, X.Resultado AS resultado,
              X.Comentario AS comentario, X.FechaRegreso AS fechaRegreso, X.IdUsuarioAtiende AS idUsuarioAtiende,
              X.FechaAtencion AS fechaAtencion, X.FechaCierre AS fechaCierre, X.MotivoCierre AS motivoCierre,
              ${SQL_CONTEXTO}
         FROM AvisosSinTransmision X
         LEFT JOIN Instalaciones i ON i.Id = X.IdInstalacion
         LEFT JOIN Vehiculos v ON v.IdProducto = i.IdProducto AND v.IdCliente = i.IdCliente
         ${SQL_JOINS_CONTEXTO.replace('LEFT JOIN CatTelefonia ct ON ct.Id = s.IdTelefonia', 'LEFT JOIN CatTelefonia ct ON ct.Id = X.IdTelefonia')}
        WHERE ${condiciones.join(' AND ')}
        ORDER BY X.FechaEvaluacion DESC, X.HorasSinTransmitir DESC, X.Id`,
      params,
    );
    // Posible falla del proveedor: varios equipos de la misma compañía que dejaron de
    // transmitir en la misma evaluación (no los que llevan semanas sin transmitir).
    const porProveedor = agruparPorProveedor(
      filas.map((r) => ({ fechaEvaluacion: String(r.fechaPrimeraEvaluacion), idTelefonia: n(r.idTelefonia), telefonia: (r.telefonia as string) ?? null })),
      this.proveedorMinimo(),
    );
    const falla = new Set(porProveedor.filter((g) => g.posibleFallaProveedor).map((g) => `${g.fechaEvaluacion}|${g.idTelefonia}`));
    return {
      data: filas.map((r) => ({
        id: Number(r.id),
        idInstalacion: Number(r.idInstalacion),
        idCliente: Number(r.idCliente),
        cliente: (r.cliente as string) || null,
        placa: (r.placa as string) ?? null,
        economico: (r.economico as string) ?? null,
        idDispositivo: Number(r.idDispositivo),
        imei: (r.imei as string) ?? null,
        numeroSerie: (r.numeroSerie as string) ?? null,
        idTipoDispositivo: Number(r.idTipoDispositivo),
        tipoDispositivo: (r.tipoDispositivo as string) ?? null,
        idSim: n(r.idSim),
        numeroSim: (r.numeroSim as string) ?? null,
        idTelefonia: n(r.idTelefonia),
        telefonia: (r.telefonia as string) ?? null,
        fechaEvaluacion: String(r.fechaEvaluacion),
        ultimaTransmision: f(r.ultimaTransmision),
        horasSinTransmitir: Number(r.horasSinTransmitir),
        estatus: r.estatus as EstatusAviso,
        resultado: (r.resultado as string) ?? null,
        comentario: (r.comentario as string) ?? null,
        fechaRegreso: f(r.fechaRegreso),
        idUsuarioAtiende: n(r.idUsuarioAtiende),
        fechaAtencion: f(r.fechaAtencion),
        fechaCierre: f(r.fechaCierre),
        motivoCierre: (r.motivoCierre as string) ?? null,
        fechaPrimeraEvaluacion: String(r.fechaPrimeraEvaluacion),
        posibleFallaProveedor: falla.has(`${r.fechaPrimeraEvaluacion}|${n(r.idTelefonia)}`),
      })),
      porProveedor: porProveedor as ResumenProveedor[],
    };
  }

  /** Instalaciones activas sin ninguna transmisión en su vigencia: no generan avisos hasta revisarlas. */
  async sinPrimeraTransmision() {
    const filas: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT X.Id AS idInstalacion, X.IdCliente AS idCliente, X.IdDispositivo AS idDispositivo, X.IdSim AS idSim,
              d.IdTipoDispositivo AS idTipoDispositivo, X.VigenteDesde AS vigenteDesde, ${SQL_CONTEXTO}
         FROM Instalaciones X
         LEFT JOIN Vehiculos v ON v.IdProducto = X.IdProducto AND v.IdCliente = X.IdCliente
         ${SQL_JOINS_CONTEXTO}
         LEFT JOIN UltimaPosicion up ON up.Imei = d.Imei
         LEFT JOIN PanelAlarma pa ON pa.IdDispositivo = d.Id
         JOIN Instalaciones i ON i.Id = X.Id
        WHERE X.Estatus = 1 AND X.IdDispositivo IS NOT NULL AND (${SQL_ULTIMA}) IS NULL
        ORDER BY X.VigenteDesde, X.Id`,
    );
    return {
      data: filas.map((r) => ({
        idInstalacion: Number(r.idInstalacion),
        idCliente: Number(r.idCliente),
        cliente: (r.cliente as string) || null,
        placa: (r.placa as string) ?? null,
        economico: (r.economico as string) ?? null,
        idDispositivo: Number(r.idDispositivo),
        imei: (r.imei as string) ?? null,
        numeroSerie: (r.numeroSerie as string) ?? null,
        idTipoDispositivo: n(r.idTipoDispositivo),
        tipoDispositivo: (r.tipoDispositivo as string) ?? null,
        idSim: n(r.idSim),
        numeroSim: (r.numeroSim as string) ?? null,
        telefonia: (r.telefonia as string) ?? null,
        vigenteDesde: f(r.vigenteDesde),
      })),
    };
  }

  /** Monitoreo registra el resultado. "taller" pausa la vigilancia de la instalación hasta `fechaRegreso`. */
  async atender(id: number, dto: AtenderAvisoDto, idUsuario: number) {
    const repo = this.dataSource.getRepository(AvisosSinTransmision);
    const aviso = await repo.findOne({ where: { id } });
    if (!aviso) throw new NotFoundException('Aviso no encontrado');
    if (aviso.estatus === 'cerrado') {
      throw new BadRequestException('El aviso ya está cerrado: el equipo volvió a transmitir o la instalación ya no está activa.');
    }
    const ahora = nowMexicoCityAsUtcDate();
    let fechaRegreso: Date | null = null;
    if (dto.resultado === 'taller') {
      if (!dto.fechaRegreso) throw new BadRequestException('Para "taller" indique fechaRegreso (hora de México).');
      fechaRegreso = fechaParedComoDate(dto.fechaRegreso);
      if (fechaRegreso.getTime() <= ahora.getTime()) throw new BadRequestException('fechaRegreso debe ser futura.');
    }
    // Condicional a seguir vivo: el cierre automático pudo ganarle entre la lectura y aquí.
    const actualizado = await repo.update(
      { id, estatus: In([...ESTATUS_AVISO_VIVO]) },
      {
        estatus: 'atendido',
        resultado: dto.resultado,
        comentario: dto.comentario?.trim() || null,
        fechaRegreso,
        idUsuarioAtiende: idUsuario,
        fechaAtencion: ahora,
      },
    );
    if (!actualizado.affected) {
      throw new ConflictException('El aviso se cerró mientras se atendía: el equipo volvió a transmitir o la instalación ya no está activa.');
    }
    // Los demás operadores ven que alguien ya lo atendió.
    await this.notificar('atencion', [id]);
    return {
      status: 'success',
      message: 'Aviso atendido.',
      data: { id, estatus: 'atendido', resultado: dto.resultado, fechaRegreso: fechaRegreso ? fechaPared(fechaRegreso) : null },
    };
  }
}
