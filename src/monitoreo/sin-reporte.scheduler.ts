import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { EstatusEnum, EnumTipoProducto } from 'src/common/estatus.enum';
import { MonitoreoGateway } from './monitoreo.gateway';
import { MonitoreoService } from './monitoreo.service';
import { toIso } from './monitoreo.mapper';
import { decidir, UMBRALES_DEFECTO, umbralMinutos, type UmbralesSinReporte } from './sin-reporte.reglas';

const INTERVAL_MS = 60 * 1000;

interface Candidata {
  idInstalacion: number | string;
  idCliente: number | string;
  idTipoProducto: number | string;
  idTipoDispositivo: number | string | null;
  imei: string;
  fechaHora: Date | string;
  registro: Date | string;
  ignicion: number | null;
  estado: number | null;
  velocidad: number | null;
  intervalo: number | null;
  minutos: number | string;
}

interface Abierto {
  id: number | string;
  idInstalacion: number | string;
  imei: string;
  ultimoRegistro: Date | string;
  estatusInst: number | null;
  imeiActual: string | null;
  registro: Date | string | null;
  fechaHora: Date | string | null;
}

export type MotivoCierreSinReporte = 'reporto' | 'baja' | 'cambio';

/**
 * Cada minuto busca las instalaciones activas que dejaron de reportar más que
 * su umbral (`sin-reporte.reglas.ts`) y emite `monitoreo:sin-reporte` una vez
 * por episodio; cuando vuelven, `monitoreo:reporte-recuperado`. Los episodios
 * viven en `SinReporteEpisodios`: un reinicio no repite ni pierde avisos.
 *
 * El silencio se mide con `UltimaPosicion.FHRegistro` (llegada al servidor,
 * mismo reloj de MySQL que `NOW()`), no con la hora del equipo.
 *
 * Dos frenos contra la alerta falsa en masa:
 * - Si en toda la flota no ha llegado ninguna posición en
 *   `SIN_REPORTE_INGESTA_MAX_MIN`, la falla es de la ingesta (RabbitMQ,
 *   consumidores), no de las unidades: no se abre nada.
 * - Si en un minuto entran en falta más de `SIN_REPORTE_MASIVO_MAX`, se
 *   registran sin alerta individual y va un solo `monitoreo:sin-reporte-masivo`
 *   a operación (típicamente un socket caído).
 *
 * `SIN_REPORTE_ENABLED=false` lo apaga.
 */
@Injectable()
export class SinReporteScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SinReporteScheduler.name);
  private timer?: NodeJS.Timeout;
  private enCurso = false;
  private ingestaDetenida = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly gateway: MonitoreoGateway,
    private readonly monitoreo: MonitoreoService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (String(this.config.get('SIN_REPORTE_ENABLED') ?? 'true').toLowerCase() === 'false') {
      this.logger.log('Aviso de unidad sin reporte apagado (SIN_REPORTE_ENABLED=false)');
      return;
    }
    this.timer = setInterval(() => void this.tick(), INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.enCurso) return;
    this.enCurso = true;
    try {
      await this.cerrarRecuperados();
      await this.abrirNuevos();
    } catch (error) {
      this.logger.error(`Error al revisar unidades sin reporte: ${(error as Error)?.message}`);
    } finally {
      this.enCurso = false;
    }
  }

  umbrales(): UmbralesSinReporte {
    const n = (clave: string, defecto: number) => {
      const v = Number(this.config.get(clave));
      return Number.isFinite(v) && String(this.config.get(clave) ?? '') !== '' ? v : defecto;
    };
    return {
      vehiculoMin: n('SIN_REPORTE_VEHICULO_MIN', UMBRALES_DEFECTO.vehiculoMin),
      apagadoMin: n('SIN_REPORTE_APAGADO_MIN', UMBRALES_DEFECTO.apagadoMin),
      activoMin: n('SIN_REPORTE_ACTIVO_MIN', UMBRALES_DEFECTO.activoMin),
      relojMin: n('SIN_REPORTE_RELOJ_MIN', UMBRALES_DEFECTO.relojMin),
      telefonoMin: n('SIN_REPORTE_TELEFONO_MIN', UMBRALES_DEFECTO.telefonoMin),
    };
  }

  private num(clave: string, defecto: number): number {
    const v = Number(this.config.get(clave));
    return Number.isFinite(v) && v > 0 ? v : defecto;
  }

  /** Abre los episodios nuevos; devuelve las instalaciones avisadas. */
  async abrirNuevos(): Promise<number[]> {
    const c = this.umbrales();
    const positivos = [c.vehiculoMin, c.apagadoMin, c.activoMin, c.relojMin, c.telefonoMin].filter((x) => x > 0);
    if (!positivos.length) return [];

    const [frescura] = await this.dataSource.query(
      'SELECT TIMESTAMPDIFF(SECOND, MAX(FHRegistro), NOW()) AS seg FROM UltimaPosicion',
    );
    const maxIngesta = this.num('SIN_REPORTE_INGESTA_MAX_MIN', 5) * 60;
    if (frescura?.seg == null || Number(frescura.seg) > maxIngesta) {
      if (!this.ingestaDetenida) {
        this.logger.warn(`Ninguna posición en ${frescura?.seg ?? '?'} s en toda la flota: no se abren avisos de sin reporte (falla de ingesta)`);
      }
      this.ingestaDetenida = true;
      return [];
    }
    this.ingestaDetenida = false;

    const filas: Candidata[] = await this.dataSource.query(
      `SELECT i.Id AS idInstalacion, i.IdCliente AS idCliente, p.IdTipoProducto AS idTipoProducto,
              d.IdTipoDispositivo AS idTipoDispositivo, CAST(d.Imei AS CHAR) AS imei,
              up.FechaHora AS fechaHora, up.FHRegistro AS registro, up.Ignicion AS ignicion,
              up.Estado AS estado, up.Velocidad AS velocidad, rc.IntervaloReporteSegundos AS intervalo,
              TIMESTAMPDIFF(MINUTE, up.FHRegistro, NOW()) AS minutos
         FROM Instalaciones i
         JOIN Productos p ON p.Id = i.IdProducto
         JOIN Dispositivos d ON d.Id = i.IdDispositivo
         JOIN UltimaPosicion up ON up.Imei = d.Imei AND up.FechaHora >= i.VigenteDesde
         LEFT JOIN RelojConfig rc ON rc.IdDispositivo = d.Id
        WHERE i.Estatus = ?
          AND p.IdTipoProducto IN (?, ?, ?)
          AND up.FHRegistro IS NOT NULL
          AND up.FHRegistro <= NOW() - INTERVAL ? MINUTE
          AND NOT EXISTS (SELECT 1 FROM SinReporteEpisodios e WHERE e.IdInstalacion = i.Id AND e.Abierto = 1)`,
      [
        EstatusEnum.ACTIVO,
        EnumTipoProducto.VEHICULO,
        EnumTipoProducto.ACTIVO,
        EnumTipoProducto.PERSONA,
        Math.min(...positivos),
      ],
    );

    const margen = this.num('SIN_REPORTE_AVISO_MAX_MIN', 30);
    const nuevos: Array<{ f: Candidata; umbral: number; avisar: boolean }> = [];
    for (const f of filas) {
      const umbral = umbralMinutos(
        {
          idTipoProducto: Number(f.idTipoProducto),
          idTipoDispositivo: f.idTipoDispositivo != null ? Number(f.idTipoDispositivo) : null,
          ignicion: f.ignicion != null ? Number(f.ignicion) : null,
          estado: f.estado != null ? Number(f.estado) : null,
          velocidad: f.velocidad != null ? Number(f.velocidad) : null,
          intervaloRelojSeg: f.intervalo != null ? Number(f.intervalo) : null,
        },
        c,
      );
      const minutos = Number(f.minutos);
      if (!(umbral > 0) || minutos < umbral) continue;
      nuevos.push({ f, umbral, avisar: decidir(minutos, umbral, margen) === 'avisar' });
    }
    if (!nuevos.length) return [];

    const porAvisar = nuevos.filter((n) => n.avisar).length;
    const masivo = porAvisar > this.num('SIN_REPORTE_MASIVO_MAX', 25);
    if (masivo) for (const n of nuevos) n.avisar = false;

    const avisadas: number[] = [];
    const registradas: Candidata[] = [];
    for (const n of nuevos) {
      const r = await this.dataSource.query(
        `INSERT IGNORE INTO SinReporteEpisodios
           (IdInstalacion, IdCliente, Imei, UltimaFechaHora, UltimoRegistro, UmbralMin, Avisado)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [n.f.idInstalacion, n.f.idCliente, n.f.imei, n.f.fechaHora, n.f.registro, n.umbral, n.avisar ? 1 : 0],
      );
      if (!(Number(r?.affectedRows ?? 0) > 0)) continue;
      registradas.push(n.f);
      if (n.avisar) {
        avisadas.push(Number(n.f.idInstalacion));
        await this.avisar(n.f, n.umbral);
      }
    }

    if (masivo && registradas.length) {
      const porTipo = new Map<number | null, number>();
      for (const f of registradas) {
        const t = f.idTipoDispositivo != null ? Number(f.idTipoDispositivo) : null;
        porTipo.set(t, (porTipo.get(t) ?? 0) + 1);
      }
      this.gateway.emitSinReporteMasivo({
        total: registradas.length,
        porTipoDispositivo: [...porTipo.entries()].map(([idTipoDispositivo, total]) => ({ idTipoDispositivo, total })),
      });
      this.logger.warn(`Sin reporte masivo: ${registradas.length} unidades en un minuto; se registran sin alerta individual`);
    } else if (registradas.length) {
      this.logger.log(`Sin reporte: ${avisadas.length} avisadas, ${registradas.length - avisadas.length} registradas sin alerta`);
    }
    return avisadas;
  }

  private async avisar(f: Candidata, umbral: number): Promise<void> {
    const idInstalacion = Number(f.idInstalacion);
    const item = (await this.monitoreo.obtenerPorInstalacion(idInstalacion)) as Record<string, unknown> | null;
    if (!item) return;
    this.gateway.emitSinReporte(idInstalacion, {
      idInstalacion,
      idCliente: Number(f.idCliente),
      tipoProducto: Number(f.idTipoProducto),
      idTipoDispositivo: f.idTipoDispositivo != null ? Number(f.idTipoDispositivo) : null,
      cliente: (item.cliente as string | null) ?? null,
      placa: (item.placa as string | null) ?? null,
      economico: (item.economico as string | null) ?? null,
      nombre: ((item.persona ?? item.descripcion) as string | null) ?? null,
      imei: f.imei,
      ultimaPosicion: toIso(f.fechaHora),
      minutosSinReporte: Number(f.minutos),
      umbralMin: umbral,
      lat: (item.lat as number | null) ?? null,
      lng: (item.lng as number | null) ?? null,
    });
  }

  /** Cierra los episodios cuya unidad volvió a reportar, se dio de baja o cambió de equipo. */
  async cerrarRecuperados(): Promise<number[]> {
    const abiertos: Abierto[] = await this.dataSource.query(
      `SELECT e.Id AS id, e.IdInstalacion AS idInstalacion, CAST(e.Imei AS CHAR) AS imei,
              e.UltimoRegistro AS ultimoRegistro, i.Estatus AS estatusInst, CAST(d.Imei AS CHAR) AS imeiActual,
              up.FHRegistro AS registro, up.FechaHora AS fechaHora
         FROM SinReporteEpisodios e
         LEFT JOIN Instalaciones i ON i.Id = e.IdInstalacion
         LEFT JOIN Dispositivos d ON d.Id = i.IdDispositivo
         LEFT JOIN UltimaPosicion up ON up.Imei = e.Imei
        WHERE e.Abierto = 1`,
    );
    const cerrados: number[] = [];
    for (const a of abiertos) {
      const motivo = motivoCierre(a);
      if (!motivo) continue;
      const r = await this.dataSource.query(
        `UPDATE SinReporteEpisodios
            SET Abierto = NULL, CerradoEn = NOW(), MotivoCierre = ?, FechaHoraRecuperado = ?
          WHERE Id = ? AND Abierto = 1`,
        [motivo, motivo === 'reporto' ? a.fechaHora : null, a.id],
      );
      if (!(Number(r?.affectedRows ?? 0) > 0)) continue;
      const idInstalacion = Number(a.idInstalacion);
      cerrados.push(idInstalacion);
      this.gateway.emitReporteRecuperado(idInstalacion, {
        idInstalacion,
        fechaHora: motivo === 'reporto' ? toIso(a.fechaHora) : null,
        motivo,
      });
    }
    return cerrados;
  }
}

/** Por qué se cierra un episodio abierto; null si sigue en falta. */
export function motivoCierre(a: {
  imei: string;
  ultimoRegistro: Date | string;
  estatusInst: number | null;
  imeiActual: string | null;
  registro: Date | string | null;
}): MotivoCierreSinReporte | null {
  if (a.estatusInst == null || Number(a.estatusInst) !== EstatusEnum.ACTIVO) return 'baja';
  if (a.imeiActual == null || String(a.imeiActual) !== String(a.imei)) return 'cambio';
  if (a.registro != null && new Date(a.registro).getTime() > new Date(a.ultimoRegistro).getTime()) return 'reporto';
  return null;
}
