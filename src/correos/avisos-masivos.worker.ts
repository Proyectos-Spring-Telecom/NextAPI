import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { EstatusEnumBitcora } from 'src/common/ApiResponse';
import { EnumModulos } from 'src/common/estatus.enum';
import { mensajeHtml } from 'src/incidentes/incidentes.service';
import { MailService } from 'src/mail/mail.service';
import { nowMexicoCityMysql } from 'src/utils/datetime-mexico.util';

/**
 * Envía los avisos masivos pendientes, un lote (CCO) cada `AVISO_MASIVO_PAUSA_SEG`.
 *
 * La cuenta de Zoho es la misma de todo Next (alta de usuarios, órdenes de
 * servicio, reportes): si Zoho la frena por volumen, deja de mandar todo por
 * hasta una hora. Por eso va despacio y, si un lote falla, espera
 * `AVISO_MASIVO_ESPERA_ERROR_MIN` antes de reintentar (hasta 4 intentos por
 * lote). Todo queda en la base: un reinicio continúa donde se quedó.
 */
@Injectable()
export class AvisosMasivosWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AvisosMasivosWorker.name);
  private timer: NodeJS.Timeout | null = null;
  private trabajando = false;
  private esperarHasta = 0;
  private readonly pausaMs: number;
  private readonly esperaErrorMs: number;
  private readonly maxIntentos = 4;

  constructor(
    private readonly dataSource: DataSource,
    private readonly mail: MailService,
    private readonly bitacora: BitacoraLoggerService,
    config: ConfigService,
  ) {
    const n = (k: string, d: number) => {
      const v = Number(config.get(k));
      return Number.isFinite(v) && v > 0 ? v : d;
    };
    this.pausaMs = n('AVISO_MASIVO_PAUSA_SEG', 60) * 1000;
    this.esperaErrorMs = n('AVISO_MASIVO_ESPERA_ERROR_MIN', 15) * 60_000;
  }

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), this.pausaMs);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Manda el primer lote de un aviso recién creado sin esperar al siguiente ciclo. */
  despertar(): void {
    setImmediate(() => void this.tick());
  }

  minutosEstimados(total: number, lote: number): number {
    const lotes = Math.ceil(total / Math.max(1, lote));
    return Math.ceil(((lotes - 1) * this.pausaMs) / 60_000);
  }

  /** Un lote por llamada. Devuelve el id del aviso atendido (para pruebas). */
  async tick(): Promise<number | null> {
    if (this.trabajando || Date.now() < this.esperarHasta) return null;
    this.trabajando = true;
    try {
      const [aviso] = await this.dataSource.query(
        `SELECT Id AS id, IdUsuario AS idUsuario, Asunto AS asunto, Mensaje AS mensaje,
                AdjuntoNombre AS adjuntoNombre, AdjuntoTipo AS adjuntoTipo, Adjunto AS adjunto
           FROM AvisosMasivos WHERE Estatus = 'enviando' ORDER BY Id LIMIT 1`,
      );
      if (!aviso) return null;
      const id = Number(aviso.id);

      const [sig] = await this.dataSource.query(
        'SELECT MIN(Lote) AS lote FROM AvisosMasivosDestinatarios WHERE IdAviso = ? AND Estatus = 0',
        [id],
      );
      if (sig?.lote == null) {
        await this.terminar(id, Number(aviso.idUsuario));
        return id;
      }
      const lote = Number(sig.lote);
      const filas: Array<{ correo: string }> = await this.dataSource.query(
        'SELECT Correo AS correo FROM AvisosMasivosDestinatarios WHERE IdAviso = ? AND Lote = ? AND Estatus = 0',
        [id, lote],
      );

      try {
        await this.mail.enviar({
          para: [],
          cco: filas.map((f) => f.correo),
          asunto: aviso.asunto,
          html: `<p>${mensajeHtml(String(aviso.mensaje ?? ''))}</p>`,
          adjuntos:
            aviso.adjunto && aviso.adjuntoNombre
              ? [{ filename: aviso.adjuntoNombre, content: Buffer.from(aviso.adjunto), contentType: aviso.adjuntoTipo }]
              : undefined,
        });
        await this.dataSource.query(
          'UPDATE AvisosMasivosDestinatarios SET Estatus = 1, Intentos = Intentos + 1, FechaEnvio = ?, Error = NULL WHERE IdAviso = ? AND Lote = ? AND Estatus = 0',
          [nowMexicoCityMysql(), id, lote],
        );
      } catch (e) {
        const error = String((e as Error)?.message ?? 'Error al enviar').slice(0, 300);
        this.logger.warn(`Aviso ${id}, lote ${lote}: ${error}; reintento en ${this.esperaErrorMs / 60_000} min`);
        this.esperarHasta = Date.now() + this.esperaErrorMs;
        await this.dataSource.query(
          `UPDATE AvisosMasivosDestinatarios
              SET Intentos = Intentos + 1, Error = ?, Estatus = IF(Intentos >= ?, 2, 0)
            WHERE IdAviso = ? AND Lote = ? AND Estatus = 0`,
          [error, this.maxIntentos, id, lote],
        );
      }
      await this.contar(id);
      return id;
    } catch (e) {
      this.logger.error(`Aviso masivo: ${(e as Error)?.message}`);
      return null;
    } finally {
      this.trabajando = false;
    }
  }

  private async contar(id: number): Promise<void> {
    await this.dataSource.query(
      `UPDATE AvisosMasivos a SET
          Enviados = (SELECT COUNT(*) FROM AvisosMasivosDestinatarios d WHERE d.IdAviso = a.Id AND d.Estatus = 1),
          Fallidos = (SELECT COUNT(*) FROM AvisosMasivosDestinatarios d WHERE d.IdAviso = a.Id AND d.Estatus = 2)
        WHERE a.Id = ?`,
      [id],
    );
  }

  private async terminar(id: number, idUsuario: number): Promise<void> {
    await this.contar(id);
    await this.dataSource.query(
      "UPDATE AvisosMasivos SET Estatus = 'terminado', FechaFin = ?, Adjunto = NULL WHERE Id = ?",
      [nowMexicoCityMysql(), id],
    );
    const [a] = await this.dataSource.query('SELECT Total AS total, Enviados AS enviados, Fallidos AS fallidos FROM AvisosMasivos WHERE Id = ?', [id]);
    this.logger.log(`Aviso masivo ${id} terminado: ${a?.enviados}/${a?.total} enviados, ${a?.fallidos} fallidos`);
    await this.bitacora.logToBitacora(
      'Correos',
      `Aviso masivo ${id} terminado: ${a?.enviados} de ${a?.total} enviados`,
      'UPDATE',
      { idAviso: id, total: Number(a?.total), enviados: Number(a?.enviados), fallidos: Number(a?.fallidos) },
      idUsuario,
      EnumModulos.REPORTES,
      Number(a?.fallidos) > 0 ? EstatusEnumBitcora.ERROR : EstatusEnumBitcora.SUCCESS,
    );
  }
}
