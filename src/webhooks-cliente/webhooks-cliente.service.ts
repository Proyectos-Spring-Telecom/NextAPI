import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { lookup } from 'dns/promises';
import { firstValueFrom } from 'rxjs';
import { DataSource } from 'typeorm';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { EstatusEnumBitcora } from 'src/common/ApiResponse';
import { EnumModulos } from 'src/common/estatus.enum';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';
import { nowMexicoCityMysql } from 'src/utils/datetime-mexico.util';
import {
  EVENTOS_WEBHOOK,
  MAX_INTENTOS_WEBHOOK,
  esIpPublica,
  esperaMinutos,
  firmar,
  generarSecreto,
  validarUrlWebhook,
  type EventoWebhook,
} from './webhooks-cliente.util';

type Usuario = { idClienteToken: number; rol: number; idUsuario: number };

const INTERVALO_MS = 15_000;
const LOTE = 50;
const TIMEOUT_MS = 10_000;
const CACHE_MS = 60_000;
const RETENCION_DIAS = 30;

/**
 * Webhooks por cliente (docs/fis-fiber, ruta del back §3.6). `encolar` nunca
 * lanza ni espera la red: deja el envío en `EnviosWebhook` y el despachador lo
 * manda cada 15 s, firmado, con reintentos crecientes hasta 10 intentos. Una
 * suscripción de un cliente recibe los eventos de él y de sus hijos.
 * `WEBHOOKS_CLIENTE_ENABLED=false` apaga el despachador (los envíos se quedan
 * pendientes).
 */
@Injectable()
export class WebhooksClienteService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WebhooksClienteService.name);
  private readonly suscripciones = new Map<
    number,
    { ids: Array<{ id: number; eventos: string[] }>; hasta: number }
  >();
  private timer?: NodeJS.Timeout;
  private enCurso = false;
  private ultimaLimpieza = 0;

  constructor(
    private readonly dataSource: DataSource,
    private readonly http: HttpService,
    private readonly tenantFilter: TenantFilterService,
    private readonly bitacora: BitacoraLoggerService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (
      String(this.config.get('WEBHOOKS_CLIENTE_ENABLED') ?? 'true').toLowerCase() ===
      'false'
    ) {
      this.logger.log('Webhooks de cliente apagados (WEBHOOKS_CLIENTE_ENABLED=false)');
      return;
    }
    this.timer = setInterval(() => void this.despachar(), INTERVALO_MS);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  /** Deja el evento en la bandeja de cada suscripción del cliente o de sus padres. */
  async encolar(
    evento: EventoWebhook,
    idCliente: number | null | undefined,
    data: Record<string, unknown>,
  ): Promise<void> {
    try {
      if (idCliente == null || !(Number(idCliente) > 0)) return;
      const destinos = (await this.suscripcionesDe(Number(idCliente))).filter((s) =>
        s.eventos.includes(evento),
      );
      for (const s of destinos)
        await this.insertarEnvio(s.id, evento, Number(idCliente), data);
    } catch (error) {
      this.logger.warn(
        `[Webhooks] no se pudo encolar ${evento} cliente=${idCliente}: ${(error as Error)?.message}`,
      );
    }
  }

  private async suscripcionesDe(idCliente: number) {
    const ahora = Date.now();
    const enCache = this.suscripciones.get(idCliente);
    if (enCache && enCache.hasta > ahora) return enCache.ids;
    const familia = await this.tenantFilter.getClienteAncestrosIds(idCliente);
    const filas: Array<{ id: string; eventos: string }> = familia.length
      ? await this.dataSource.query(
          'SELECT Id AS id, Eventos AS eventos FROM SuscripcionesWebhook WHERE Estatus = 1 AND IdCliente IN (?)',
          [familia],
        )
      : [];
    const ids = filas.map((f) => ({
      id: Number(f.id),
      eventos: String(f.eventos).split(','),
    }));
    if (this.suscripciones.size > 5000) this.suscripciones.clear();
    this.suscripciones.set(idCliente, { ids, hasta: ahora + CACHE_MS });
    return ids;
  }

  private async insertarEnvio(
    idSuscripcion: number,
    evento: string,
    idCliente: number,
    data: Record<string, unknown>,
  ) {
    const ahora = nowMexicoCityMysql();
    const cuerpo = JSON.stringify({
      evento,
      fecha: ahora.replace(' ', 'T'),
      idCliente,
      data,
    });
    await this.dataSource.query(
      `INSERT INTO EnviosWebhook (IdSuscripcion, Evento, Cuerpo, ProximoIntento, FechaCreacion)
       VALUES (?, ?, ?, ?, ?)`,
      [idSuscripcion, evento, cuerpo, ahora, ahora],
    );
  }

  /** Manda los envíos pendientes cuyo turno ya llegó. */
  async despachar(): Promise<void> {
    if (this.enCurso) return;
    this.enCurso = true;
    try {
      const pendientes: Array<Record<string, unknown>> = await this.dataSource.query(
        `SELECT e.Id AS id, e.Evento AS evento, e.Cuerpo AS cuerpo, e.Intentos AS intentos,
                s.Url AS url, s.Secreto AS secreto, s.Estatus AS estatus
           FROM EnviosWebhook e
           JOIN SuscripcionesWebhook s ON s.Id = e.IdSuscripcion
          WHERE e.Estatus = 'pendiente' AND e.ProximoIntento <= ?
          ORDER BY e.Id
          LIMIT ${LOTE}`,
        [nowMexicoCityMysql()],
      );
      for (const p of pendientes) {
        if (Number(p.estatus) !== 1) {
          await this.cerrar(Number(p.id), 'fallido', null, 'Suscripción revocada');
          continue;
        }
        await this.enviar(p);
      }
      await this.limpiar();
    } catch (error) {
      this.logger.error(`[Webhooks] error al despachar: ${(error as Error)?.message}`);
    } finally {
      this.enCurso = false;
    }
  }

  private async enviar(p: Record<string, unknown>): Promise<void> {
    const id = Number(p.id);
    const url = String(p.url);
    const cuerpo = String(p.cuerpo);
    let codigo: number | null = null;
    let error: string | null = null;
    try {
      await this.assertDestinoPublico(url);
      const timestamp = String(Math.floor(Date.now() / 1000));
      const r = await firstValueFrom(
        this.http.post(url, cuerpo, {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Next-Webhooks/1.0',
            'X-Next-Evento': String(p.evento),
            'X-Next-Envio': String(id),
            'X-Next-Timestamp': timestamp,
            'X-Next-Firma': `sha256=${firmar(String(p.secreto), timestamp, cuerpo)}`,
          },
          timeout: TIMEOUT_MS,
          maxRedirects: 0,
          // Se manda el texto exacto que se firmó.
          transformRequest: [(d: unknown) => d],
          validateStatus: () => true,
        }),
      );
      codigo = r.status;
      if (r.status >= 200 && r.status < 300) {
        await this.cerrar(id, 'enviado', codigo, null);
        return;
      }
      error = `HTTP ${r.status}`;
    } catch (e) {
      error = (e as Error)?.message ?? 'Error desconocido';
    }
    const intentos = Number(p.intentos) + 1;
    if (intentos >= MAX_INTENTOS_WEBHOOK) {
      await this.dataSource.query('UPDATE EnviosWebhook SET Intentos = ? WHERE Id = ?', [
        intentos,
        id,
      ]);
      await this.cerrar(id, 'fallido', codigo, error);
      this.logger.warn(
        `[Webhooks] envío ${id} fallido tras ${intentos} intentos: ${error}`,
      );
      return;
    }
    await this.dataSource.query(
      `UPDATE EnviosWebhook
          SET Intentos = ?, CodigoHttp = ?, UltimoError = ?,
              ProximoIntento = DATE_ADD(?, INTERVAL ? MINUTE)
        WHERE Id = ?`,
      [
        intentos,
        codigo,
        error?.slice(0, 500) ?? null,
        nowMexicoCityMysql(),
        esperaMinutos(intentos),
        id,
      ],
    );
  }

  private async cerrar(
    id: number,
    estatus: 'enviado' | 'fallido',
    codigo: number | null,
    error: string | null,
  ) {
    await this.dataSource.query(
      'UPDATE EnviosWebhook SET Estatus = ?, CodigoHttp = ?, UltimoError = ?, FechaEnvio = ? WHERE Id = ?',
      [estatus, codigo, error?.slice(0, 500) ?? null, nowMexicoCityMysql(), id],
    );
  }

  /** El host debe resolver solo a IPs públicas (evita que se use para llegar a la red interna). */
  private async assertDestinoPublico(url: string): Promise<void> {
    const invalida = validarUrlWebhook(url);
    if (invalida) throw new Error(invalida);
    const host = new URL(url).hostname.replace(/^\[|\]$/g, '');
    const ips = await lookup(host, { all: true });
    if (!ips.length || ips.some((ip) => !esIpPublica(ip.address))) {
      throw new Error('El destino resuelve a una IP no pública');
    }
  }

  /** Una vez por hora borra los envíos exitosos de más de 30 días. */
  private async limpiar(): Promise<void> {
    if (Date.now() - this.ultimaLimpieza < 3_600_000) return;
    this.ultimaLimpieza = Date.now();
    await this.dataSource.query(
      `DELETE FROM EnviosWebhook WHERE Estatus = 'enviado' AND FechaCreacion < DATE_SUB(?, INTERVAL ${RETENCION_DIAS} DAY) LIMIT 5000`,
      [nowMexicoCityMysql()],
    );
  }

  // ---- Administración (SA, Dev, Admin) ----

  async crear(
    dto: { idCliente: number; nombre: string; url: string; eventos: string[] },
    usuario: Usuario,
  ) {
    await this.assertClienteEnAlcance(dto.idCliente, usuario);
    const invalida = validarUrlWebhook(dto.url);
    if (invalida) throw new BadRequestException(invalida);
    const eventos = [...new Set(dto.eventos)];
    const desconocidos = eventos.filter(
      (e) => !(EVENTOS_WEBHOOK as readonly string[]).includes(e),
    );
    if (desconocidos.length)
      throw new BadRequestException(`Eventos desconocidos: ${desconocidos.join(', ')}`);
    const secreto = generarSecreto();
    const ahora = nowMexicoCityMysql();
    const r = await this.dataSource.query(
      `INSERT INTO SuscripcionesWebhook (IdCliente, Nombre, Url, Secreto, Eventos, IdUsuario, FechaCreacion)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        dto.idCliente,
        dto.nombre.trim(),
        dto.url,
        secreto,
        eventos.join(','),
        usuario.idUsuario,
        ahora,
      ],
    );
    const id = Number(r?.insertId);
    this.suscripciones.clear();
    await this.bitacora.logToBitacora(
      'WebhooksCliente',
      `Webhook ${id} creado para el cliente ${dto.idCliente} (${dto.nombre.trim()}).`,
      'CREATE',
      { id, idCliente: dto.idCliente, nombre: dto.nombre.trim(), url: dto.url, eventos },
      usuario.idUsuario,
      EnumModulos.CLIENTES,
      EstatusEnumBitcora.SUCCESS,
    );
    return {
      data: {
        id,
        idCliente: dto.idCliente,
        nombre: dto.nombre.trim(),
        url: dto.url,
        eventos,
        secreto,
        aviso:
          'Guarda el secreto ahora: no se vuelve a mostrar. Sirve para verificar X-Next-Firma.',
      },
    };
  }

  async listar(idCliente: number | undefined, usuario: Usuario) {
    if (idCliente != null) await this.assertClienteEnAlcance(idCliente, usuario);
    const scope = await this.tenantFilter.idsClientePermitidos(
      usuario.rol,
      usuario.idClienteToken,
    );
    const filas: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT s.Id AS id, s.IdCliente AS idCliente, s.Nombre AS nombre, s.Url AS url, s.Eventos AS eventos,
              DATE_FORMAT(s.FechaCreacion, '%Y-%m-%d %H:%i:%s') AS fechaCreacion,
              DATE_FORMAT(s.FechaRevocacion, '%Y-%m-%d %H:%i:%s') AS fechaRevocacion, s.Estatus AS estatus,
              (SELECT COUNT(*) FROM EnviosWebhook e WHERE e.IdSuscripcion = s.Id AND e.Estatus = 'pendiente') AS pendientes,
              (SELECT COUNT(*) FROM EnviosWebhook e WHERE e.IdSuscripcion = s.Id AND e.Estatus = 'fallido') AS fallidos
         FROM SuscripcionesWebhook s
        WHERE ${idCliente != null ? 's.IdCliente = ?' : '1 = 1'}
        ORDER BY s.Id DESC`,
      idCliente != null ? [idCliente] : [],
    );
    return {
      data: filas
        .filter((f) =>
          this.tenantFilter.clienteVisibleEnScope(scope, Number(f.idCliente)),
        )
        .map((f) => ({
          ...f,
          id: Number(f.id),
          idCliente: Number(f.idCliente),
          eventos: String(f.eventos).split(','),
          activa: Number(f.estatus) === 1,
          pendientes: Number(f.pendientes),
          fallidos: Number(f.fallidos),
        })),
    };
  }

  async revocar(id: number, usuario: Usuario) {
    const s = await this.suscripcion(id, usuario);
    await this.dataSource.query(
      'UPDATE SuscripcionesWebhook SET Estatus = 0, FechaRevocacion = ? WHERE Id = ? AND Estatus = 1',
      [nowMexicoCityMysql(), id],
    );
    this.suscripciones.clear();
    await this.bitacora.logToBitacora(
      'WebhooksCliente',
      `Webhook ${id} revocado.`,
      'UPDATE',
      { id, idCliente: s.idCliente },
      usuario.idUsuario,
      EnumModulos.CLIENTES,
      EstatusEnumBitcora.SUCCESS,
    );
    return { data: { id, revocada: true } };
  }

  /** Últimos 50 envíos de una suscripción (soporte). */
  async envios(id: number, usuario: Usuario) {
    await this.suscripcion(id, usuario);
    const filas: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT Id AS id, Evento AS evento, Estatus AS estatus, Intentos AS intentos, CodigoHttp AS codigoHttp,
              UltimoError AS ultimoError, DATE_FORMAT(FechaCreacion, '%Y-%m-%d %H:%i:%s') AS fechaCreacion,
              DATE_FORMAT(FechaEnvio, '%Y-%m-%d %H:%i:%s') AS fechaEnvio,
              DATE_FORMAT(ProximoIntento, '%Y-%m-%d %H:%i:%s') AS proximoIntento
         FROM EnviosWebhook WHERE IdSuscripcion = ? ORDER BY Id DESC LIMIT 50`,
      [id],
    );
    return {
      data: filas.map((f) => ({ ...f, id: Number(f.id), intentos: Number(f.intentos) })),
    };
  }

  /** Encola un evento `prueba` solo para esta suscripción. */
  async probar(id: number, usuario: Usuario) {
    const s = await this.suscripcion(id, usuario);
    if (!s.activa) throw new BadRequestException('La suscripción está revocada');
    await this.insertarEnvio(id, 'prueba', s.idCliente, {
      mensaje: 'Prueba de webhook de Next',
    });
    return { data: { id, encolado: true } };
  }

  private async suscripcion(id: number, usuario: Usuario) {
    const [s]: Array<{ idCliente: number; estatus: number }> =
      await this.dataSource.query(
        'SELECT IdCliente AS idCliente, Estatus AS estatus FROM SuscripcionesWebhook WHERE Id = ?',
        [id],
      );
    if (!s) throw new NotFoundException('Suscripción no encontrada');
    await this.assertClienteEnAlcance(Number(s.idCliente), usuario);
    return { idCliente: Number(s.idCliente), activa: Number(s.estatus) === 1 };
  }

  private async assertClienteEnAlcance(
    idCliente: number,
    usuario: Usuario,
  ): Promise<void> {
    const scope = await this.tenantFilter.idsClientePermitidos(
      usuario.rol,
      usuario.idClienteToken,
    );
    if (!this.tenantFilter.clienteVisibleEnScope(scope, idCliente)) {
      throw new ForbiddenException('El cliente no es de tu alcance');
    }
  }
}
