import { BadRequestException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isEmail } from 'class-validator';
import { DataSource } from 'typeorm';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { EstatusEnumBitcora } from 'src/common/ApiResponse';
import { EnumModulos, idsRolesVisiblesEnListado } from 'src/common/estatus.enum';
import { TenantFilterService, UsuarioAlcance } from 'src/common/tenant-filter/tenant-filter.service';
import { correosDeReporte, mensajeHtml } from 'src/incidentes/incidentes.service';
import { MailService } from 'src/mail/mail.service';
import { nowMexicoCityMysql } from 'src/utils/datetime-mexico.util';
import { AvisosMasivosWorker } from './avisos-masivos.worker';
import { asuntoFinal, enLotes, idsDeTexto, mensajeFinal, validarAdjunto } from './correos.reglas';

export interface EnviarCorreoLibreInput {
  correos: string;
  asunto?: string;
  mensaje?: string;
  origen: string;
  idReferencia?: number;
}

export interface AvisoMasivoInput {
  idUsuarios: string;
  asunto?: string;
  mensaje?: string;
}

export interface LimitesAvisoMasivo {
  /** Usuarios elegidos por aviso. */
  max: number;
  /** Destinatarios por correo (CCO). */
  lote: number;
  /** Avisos por usuario en una hora. */
  porHora: number;
}

@Injectable()
export class CorreosService {
  readonly limites: LimitesAvisoMasivo;

  constructor(
    private readonly mail: MailService,
    private readonly dataSource: DataSource,
    private readonly tenantFilter: TenantFilterService,
    private readonly bitacora: BitacoraLoggerService,
    private readonly worker: AvisosMasivosWorker,
    config: ConfigService,
  ) {
    const n = (k: string, d: number) => {
      const v = Number(config.get(k));
      return Number.isFinite(v) && v > 0 ? Math.floor(v) : d;
    };
    this.limites = {
      max: n('AVISO_MASIVO_MAX', 300),
      lote: Math.min(n('AVISO_MASIVO_LOTE', 50), 150), // Zoho: 150 destinatarios externos por correo
      porHora: n('AVISO_MASIVO_POR_HORA', 2),
    };
  }

  /** `POST /correos/enviar`: 1 a 5 correos escritos a mano; con más de uno, en CCO. */
  async enviarLibre(file: Express.Multer.File | undefined, dto: EnviarCorreoLibreInput, idUsuario: number) {
    const correos = correosDeReporte(dto.correos);
    const adjunto = validarAdjunto(file);
    const asunto = asuntoFinal(dto.asunto);
    const mensaje = mensajeFinal(dto.mensaje, !!adjunto);

    await this.mail.enviar({
      para: correos.length === 1 ? correos : [],
      cco: correos.length > 1 ? correos : undefined,
      asunto,
      html: `<p>${mensajeHtml(mensaje)}</p>`,
      adjuntos: adjunto ? [adjunto] : undefined,
    });

    await this.bitacora.logToBitacora(
      'Correos',
      `Correo enviado a ${correos.join(', ')} (${dto.origen})`,
      'CREATE',
      { correos, asunto, origen: dto.origen, idReferencia: dto.idReferencia ?? null, adjunto: adjunto?.filename ?? null },
      idUsuario,
      EnumModulos.REPORTES,
      EstatusEnumBitcora.SUCCESS,
    );
    return {
      status: 'success',
      message: 'Correo enviado',
      data: { correos, adjunto: adjunto?.filename ?? null },
    };
  }

  /**
   * `POST /correos/aviso-masivo`: registra el aviso y sus destinatarios y
   * responde enseguida; `AvisosMasivosWorker` lo manda por lotes en CCO.
   */
  async avisoMasivo(file: Express.Multer.File | undefined, dto: AvisoMasivoInput, alcance: UsuarioAlcance) {
    const ids = idsDeTexto(dto.idUsuarios);
    if (ids.length > this.limites.max) {
      throw new BadRequestException(`Máximo ${this.limites.max} usuarios por aviso`);
    }
    const adjunto = validarAdjunto(file);
    const asunto = asuntoFinal(dto.asunto);
    const mensaje = mensajeFinal(dto.mensaje, !!adjunto);

    const [{ recientes }] = await this.dataSource.query(
      'SELECT COUNT(*) AS recientes FROM AvisosMasivos WHERE IdUsuario = ? AND FechaCreacion >= ? - INTERVAL 1 HOUR',
      [alcance.userId, nowMexicoCityMysql()],
    );
    if (Number(recientes) >= this.limites.porHora) {
      throw new HttpException(
        `Ya enviaste ${this.limites.porHora} avisos en la última hora; espera antes de mandar otro`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const destinatarios = await this.destinatariosVisibles(ids, alcance);
    if (!destinatarios.length) throw new BadRequestException('Ninguno de los usuarios elegidos tiene correo');
    const omitidos = ids.length - destinatarios.length;

    const idAviso = await this.dataSource.transaction(async (m) => {
      const r = await m.query(
        `INSERT INTO AvisosMasivos (IdUsuario, Asunto, Mensaje, AdjuntoNombre, AdjuntoTipo, Adjunto, Total, Omitidos, Estatus, FechaCreacion)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'enviando', ?)`,
        [
          alcance.userId,
          asunto,
          mensaje,
          adjunto?.filename ?? null,
          adjunto?.contentType ?? null,
          adjunto?.content ?? null,
          destinatarios.length,
          omitidos,
          nowMexicoCityMysql(),
        ],
      );
      const id = Number(r.insertId);
      const filas = enLotes(destinatarios, this.limites.lote).flatMap((lote, i) =>
        lote.map((d) => [id, d.id, d.correo, i + 1]),
      );
      for (const bloque of enLotes(filas, 500)) {
        await m.query(
          `INSERT INTO AvisosMasivosDestinatarios (IdAviso, IdUsuario, Correo, Lote) VALUES ${bloque.map(() => '(?, ?, ?, ?)').join(', ')}`,
          bloque.flat(),
        );
      }
      return id;
    });

    await this.bitacora.logToBitacora(
      'Correos',
      `Aviso masivo ${idAviso}: ${destinatarios.length} destinatarios`,
      'CREATE',
      { idAviso, asunto, total: destinatarios.length, omitidos, adjunto: adjunto?.filename ?? null },
      alcance.userId,
      EnumModulos.REPORTES,
      EstatusEnumBitcora.SUCCESS,
    );
    this.worker.despertar();

    return {
      status: 'success',
      message: 'Aviso en proceso de envío',
      data: {
        idEnvio: idAviso,
        total: destinatarios.length,
        omitidos,
        lotes: Math.ceil(destinatarios.length / this.limites.lote),
        minutosEstimados: this.worker.minutosEstimados(destinatarios.length, this.limites.lote),
      },
    };
  }

  /** Avance de un aviso (el que lo mandó o roles 1–3). */
  async estadoAviso(idAviso: number, alcance: UsuarioAlcance) {
    const [a] = await this.dataSource.query(
      `SELECT Id AS idEnvio, IdUsuario AS idUsuario, Asunto AS asunto, AdjuntoNombre AS adjunto, Total AS total,
              Omitidos AS omitidos, Enviados AS enviados, Fallidos AS fallidos, Estatus AS estatus,
              FechaCreacion AS fechaCreacion, FechaFin AS fechaFin
         FROM AvisosMasivos WHERE Id = ?`,
      [idAviso],
    );
    if (!a || (Number(a.idUsuario) !== alcance.userId && alcance.rol > 3)) {
      throw new HttpException('Aviso no encontrado', HttpStatus.NOT_FOUND);
    }
    const fallidos = await this.dataSource.query(
      'SELECT IdUsuario AS idUsuario, Correo AS correo, Error AS error FROM AvisosMasivosDestinatarios WHERE IdAviso = ? AND Estatus = 2',
      [idAviso],
    );
    const num = (x: unknown) => Number(x);
    return {
      ...a,
      idEnvio: num(a.idEnvio),
      idUsuario: num(a.idUsuario),
      total: num(a.total),
      omitidos: num(a.omitidos),
      enviados: num(a.enviados),
      fallidos: num(a.fallidos),
      pendientes: num(a.total) - num(a.enviados) - num(a.fallidos),
      detalleFallidos: fallidos.map((f: { idUsuario: unknown; correo: string; error: string | null }) => ({
        idUsuario: num(f.idUsuario),
        correo: f.correo,
        error: f.error,
      })),
    };
  }

  /**
   * Usuarios activos de `ids` que quien envía puede ver (mismo filtro que
   * `GET /usuarios/list`), con un correo válido en `UserName` y sin repetir correo.
   */
  private async destinatariosVisibles(ids: number[], alcance: UsuarioAlcance): Promise<Array<{ id: number; correo: string }>> {
    const tenant = await this.tenantFilter.build(alcance.rol, alcance.idCliente, 'u', 'IdCliente');
    if (tenant.sinAcceso) return [];
    const roles = idsRolesVisiblesEnListado(alcance.rol);
    if (roles !== 'all' && !roles.length) return [];
    const rolesSql = roles === 'all' ? '' : ` AND u.IdRol IN (${roles.map(() => '?').join(', ')})`;
    const filas: Array<{ id: string; correo: string }> = await this.dataSource.query(
      `SELECT u.Id AS id, u.UserName AS correo FROM Usuarios u
        WHERE u.Estatus = 1 AND u.Id IN (${ids.map(() => '?').join(', ')}) ${tenant.sql} ${rolesSql}
        ORDER BY u.Id`,
      [...ids, ...tenant.params, ...(roles === 'all' ? [] : roles)],
    );
    const vistos = new Set<string>();
    const out: Array<{ id: number; correo: string }> = [];
    for (const f of filas) {
      const correo = String(f.correo ?? '').trim().toLowerCase();
      if (!isEmail(correo) || correo.length > 100 || vistos.has(correo)) continue;
      vistos.add(correo);
      out.push({ id: Number(f.id), correo });
    }
    return out;
  }
}
