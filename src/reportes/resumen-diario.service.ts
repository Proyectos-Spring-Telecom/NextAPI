import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { nowMexicoCityAsUtcDate } from 'src/utils/datetime-mexico.util';
import {
  diasDelPeriodo,
  fechaDeMs,
  jornadasDelPeriodo,
  type JornadaDia,
} from './helpers/jornada.helpers';
import { ReportesService } from './reportes.service';

const INTERVAL_MS = 10 * 60 * 1000;
const PRIMER_TICK_MS = 2 * 60 * 1000;
const LOTE_INSTALACIONES = 50;
const MS_DIA = 86_400_000;

/** Fila de `ResumenDiarioUnidad` (deploy/sql/ResumenDiarioUnidad.sql). */
export type FilaResumenDiario = {
  idInstalacion: number;
  fecha: string;
  idProducto: number | null;
  km: number;
  horasMotor: number;
};

/**
 * Llena `ResumenDiarioUnidad` con la jornada de cada día completo, para que el
 * odómetro y las horas de motor acumulados no recorran meses de posiciones.
 * Cada 10 min busca el día faltante más reciente entre ayer y
 * `RESUMEN_DIARIO_DIAS_ATRAS` (60) días atrás y lo calcula para todas las
 * instalaciones, en lotes. Así ayer se llena poco después de medianoche y el
 * histórico se completa solo, un día por vuelta. El día en curso no se guarda.
 * `RESUMEN_DIARIO_ENABLED=false` lo apaga.
 */
@Injectable()
export class ResumenDiarioService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ResumenDiarioService.name);
  private timer?: NodeJS.Timeout;
  private inicial?: NodeJS.Timeout;
  private enCurso = false;

  constructor(
    private readonly dataSource: DataSource,
    private readonly reportes: ReportesService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (
      String(this.config.get('RESUMEN_DIARIO_ENABLED') ?? 'true').toLowerCase() ===
      'false'
    ) {
      this.logger.log('Resumen diario apagado (RESUMEN_DIARIO_ENABLED=false)');
      return;
    }
    this.inicial = setTimeout(() => void this.tick(), PRIMER_TICK_MS);
    this.timer = setInterval(() => void this.tick(), INTERVAL_MS);
  }

  onModuleDestroy() {
    if (this.inicial) clearTimeout(this.inicial);
    if (this.timer) clearInterval(this.timer);
  }

  private async tick() {
    if (this.enCurso) return;
    this.enCurso = true;
    try {
      const dia = await this.diaFaltante();
      if (dia) {
        const filas = await this.calcularDia(dia);
        this.logger.log(`Resumen diario ${dia}: ${filas} unidades`);
      }
    } catch (error) {
      this.logger.error(`Error en el resumen diario: ${(error as Error)?.message}`);
    } finally {
      this.enCurso = false;
    }
  }

  /** Día completo más reciente sin resumen, o null si están todos. */
  async diaFaltante(ahora: Date = nowMexicoCityAsUtcDate()): Promise<string | null> {
    const atras = Math.max(
      1,
      Number(this.config.get('RESUMEN_DIARIO_DIAS_ATRAS') ?? 60) || 60,
    );
    const hoyMs = Date.parse(`${ahora.toISOString().slice(0, 10)}T00:00:00Z`);
    const ayer = fechaDeMs(hoyMs - MS_DIA).slice(0, 10);
    const desde = fechaDeMs(hoyMs - atras * MS_DIA).slice(0, 10);
    const hechos: Array<{ fecha: string }> = await this.dataSource.query(
      `SELECT DISTINCT DATE_FORMAT(Fecha, '%Y-%m-%d') AS fecha
         FROM ResumenDiarioUnidad
        WHERE Fecha BETWEEN ? AND ?`,
      [desde, ayer],
    );
    const listos = new Set(hechos.map((h) => h.fecha));
    const dias = diasDelPeriodo(desde, ayer).reverse();
    return dias.find((d) => !listos.has(d)) ?? null;
  }

  /** Calcula y guarda (upsert) el resumen de un día para todas las instalaciones. */
  async calcularDia(dia: string): Promise<number> {
    const ids = await this.reportes.idsInstalacionSistema();
    let total = 0;
    for (let i = 0; i < ids.length; i += LOTE_INSTALACIONES) {
      const unidades = await this.reportes.posicionesOperacionSistema(
        ids.slice(i, i + LOTE_INSTALACIONES),
        `${dia} 00:00:00`,
        `${dia} 23:59:59`,
      );
      const filas = unidades.map((u) => ({
        idInstalacion: u.idInstalacion,
        idProducto: u.idProducto,
        jornada: jornadasDelPeriodo(u.puntos, [dia])[0],
      }));
      await this.guardar(filas);
      total += filas.length;
    }
    return total;
  }

  private async guardar(
    filas: Array<{
      idInstalacion: number;
      idProducto: number | null;
      jornada: JornadaDia;
    }>,
  ): Promise<void> {
    if (!filas.length) return;
    const fecha = (v: string | null) => (v ? v.replace('T', ' ') : null);
    const valores = filas.map(({ idInstalacion, idProducto, jornada: j }) => [
      idInstalacion,
      j.fecha,
      idProducto,
      fecha(j.primerEncendido),
      fecha(j.ultimoApagado),
      fecha(j.primerMovimiento),
      fecha(j.ultimoMovimiento),
      j.km,
      j.horasMotor,
      j.tiempos.movimientoMin,
      j.tiempos.detenidoEncendidoMin,
      j.tiempos.apagadoMin,
      j.tiempos.detenidoMin,
      j.tiempos.sinDatosMin,
      j.velocidadMax,
      j.ciclosMotor,
      j.excesosVelocidad,
      j.posiciones,
      j.reportaIgnicion ? 1 : 0,
    ]);
    const columnas = [
      'IdInstalacion',
      'Fecha',
      'IdProducto',
      'PrimerEncendido',
      'UltimoApagado',
      'PrimerMovimiento',
      'UltimoMovimiento',
      'Km',
      'HorasMotor',
      'MovimientoMin',
      'DetenidoEncendidoMin',
      'ApagadoMin',
      'DetenidoMin',
      'SinDatosMin',
      'VelocidadMax',
      'CiclosMotor',
      'ExcesosVelocidad',
      'Posiciones',
      'ReportaIgnicion',
    ];
    const actualizar = columnas
      .slice(2)
      .map((c) => `${c} = VALUES(${c})`)
      .concat('FechaCalculo = VALUES(FechaCalculo)')
      .join(', ');
    const marcas = `(${columnas.map(() => '?').join(', ')}, ?)`;
    const calculo = fechaDeMs(nowMexicoCityAsUtcDate().getTime()).replace('T', ' ');
    await this.dataSource.query(
      `INSERT INTO ResumenDiarioUnidad (${columnas.join(', ')}, FechaCalculo)
       VALUES ${valores.map(() => marcas).join(', ')}
       ON DUPLICATE KEY UPDATE ${actualizar}`,
      valores.flatMap((v) => [...v, calculo]),
    );
  }

  /** Km y horas de motor por producto y día ya guardados (odómetro y contadores). */
  async porProducto(
    idsProducto: number[],
    desde: string,
    hasta: string,
  ): Promise<FilaResumenDiario[]> {
    const productos = [
      ...new Set(idsProducto.filter((x) => Number.isFinite(x) && x > 0)),
    ];
    if (!productos.length) return [];
    const filas: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT IdInstalacion AS idInstalacion, DATE_FORMAT(Fecha, '%Y-%m-%d') AS fecha,
              IdProducto AS idProducto, Km AS km, HorasMotor AS horasMotor
         FROM ResumenDiarioUnidad
        WHERE IdProducto IN (?) AND Fecha BETWEEN ? AND ?
        ORDER BY Fecha`,
      [productos, desde, hasta],
    );
    return filas.map((f) => ({
      idInstalacion: Number(f.idInstalacion),
      fecha: String(f.fecha),
      idProducto: f.idProducto == null ? null : Number(f.idProducto),
      km: Number(f.km) || 0,
      horasMotor: Number(f.horasMotor) || 0,
    }));
  }
}
