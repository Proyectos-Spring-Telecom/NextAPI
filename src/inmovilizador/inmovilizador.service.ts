import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { DataSource } from 'typeorm';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { EstatusEnumBitcora } from 'src/common/ApiResponse';
import { EnumModulos, EstatusEnum } from 'src/common/estatus.enum';
import {
  TenantFilterService,
  type UsuarioAlcance,
} from 'src/common/tenant-filter/tenant-filter.service';
import { ComandosService } from 'src/comandos/comandos.service';
import { nowMexicoCityAsUtcDate } from 'src/utils/datetime-mexico.util';
import {
  bloqueoParo,
  parseClasesInmovilizador,
  TIPO_COMANDO,
  type AccionInmovilizador,
} from './inmovilizador.util';

/** La confirmación vale esto después de la solicitud. */
const CONFIRMACION_MS = 2 * 60_000;

type Solicitud = {
  idUsuario: number;
  idInstalacion: number;
  accion: AccionInmovilizador;
  motivo: string;
  expira: number;
};

/**
 * Paro y reanudación de motor (docs/fis-fiber, ruta del back §3.10), en dos
 * pasos: `solicitar` revisa la seguridad y devuelve un código que vale 2 min;
 * `confirmar`, del mismo usuario, la vuelve a revisar y manda el comando por
 * la cola de su socket con vigencia corta (`INMOVILIZADOR_VIGENCIA_MIN`, 5):
 * un paro nunca se entrega horas después. Solo las clases de equipo con
 * relevador en `INMOVILIZADOR_CLASES`. Todo queda en bitácora.
 */
@Injectable()
export class InmovilizadorService {
  private readonly logger = new Logger(InmovilizadorService.name);
  private readonly solicitudes = new Map<string, Solicitud>();
  private readonly clases: Map<string, string>;
  private readonly velocidadMax: number;
  private readonly antiguedadMaxMin: number;
  private readonly vigenciaMs: number;

  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantFilter: TenantFilterService,
    private readonly comandos: ComandosService,
    private readonly bitacora: BitacoraLoggerService,
    config: ConfigService,
  ) {
    this.clases = parseClasesInmovilizador(config.get<string>('INMOVILIZADOR_CLASES'));
    this.velocidadMax = Number(config.get('INMOVILIZADOR_VELOCIDAD_MAX') ?? 5) || 5;
    this.antiguedadMaxMin =
      Number(config.get('INMOVILIZADOR_POSICION_MAX_MIN') ?? 5) || 5;
    this.vigenciaMs =
      (Number(config.get('INMOVILIZADOR_VIGENCIA_MIN') ?? 5) || 5) * 60_000;
  }

  async solicitar(
    alcance: UsuarioAlcance,
    idInstalacion: number,
    accion: AccionInmovilizador,
    motivo: string,
  ) {
    const u = await this.unidad(alcance, idInstalacion);
    const bloqueo = this.bloqueo(accion, u);
    await this.registrar(
      alcance,
      `Solicitud de ${accion} de motor ${u.placa ?? idInstalacion}`,
      'SOLICITUD',
      {
        idInstalacion,
        accion,
        motivo,
        velocidad: u.velocidad,
        fechaPosicion: u.fechaPosicion,
        bloqueo,
      },
      bloqueo ? EstatusEnumBitcora.ERROR : EstatusEnumBitcora.SUCCESS,
    );
    if (bloqueo) throw new ConflictException(bloqueo);

    this.limpiar();
    const codigo = randomBytes(16).toString('hex');
    const expira = Date.now() + CONFIRMACION_MS;
    this.solicitudes.set(codigo, {
      idUsuario: alcance.userId,
      idInstalacion,
      accion,
      motivo,
      expira,
    });
    return {
      data: {
        codigo,
        expiraEnSegundos: CONFIRMACION_MS / 1000,
        accion,
        idInstalacion,
        placa: u.placa,
        velocidad: u.velocidad,
        fechaPosicion: u.fechaPosicion,
        aviso:
          accion === 'paro'
            ? 'Confirma con POST /inmovilizador/confirmar. El comando vence si el equipo no lo recibe en pocos minutos.'
            : 'Confirma con POST /inmovilizador/confirmar.',
      },
    };
  }

  async confirmar(alcance: UsuarioAlcance, codigo: string) {
    this.limpiar();
    const s = this.solicitudes.get(codigo);
    if (!s) throw new NotFoundException('Código inválido o vencido: vuelve a solicitar');
    if (s.idUsuario !== alcance.userId)
      throw new ForbiddenException('Solo quien solicitó puede confirmar');
    this.solicitudes.delete(codigo);

    // La unidad pudo arrancar entre la solicitud y la confirmación.
    const u = await this.unidad(alcance, s.idInstalacion);
    const bloqueo = this.bloqueo(s.accion, u);
    if (bloqueo) {
      await this.registrar(
        alcance,
        `Confirmación de ${s.accion} de motor rechazada`,
        'CONFIRMACION',
        {
          idInstalacion: s.idInstalacion,
          accion: s.accion,
          bloqueo,
        },
        EstatusEnumBitcora.ERROR,
      );
      throw new ConflictException(bloqueo);
    }

    const ids = await this.comandos.encolar({
      idDispositivo: u.idDispositivo,
      protocolo: u.protocolo,
      comandos: [
        {
          tipo: TIPO_COMANDO[s.accion],
          contenido: JSON.stringify({ motivo: s.motivo, idUsuario: alcance.userId }),
        },
      ],
      idUsuario: alcance.userId,
      vigenciaMs: this.vigenciaMs,
    });
    await this.comandos.publicar(ids);
    await this.registrar(
      alcance,
      `${s.accion === 'paro' ? 'Paro' : 'Reanudación'} de motor enviado a ${u.placa ?? s.idInstalacion}`,
      'CONFIRMACION',
      {
        idInstalacion: s.idInstalacion,
        accion: s.accion,
        motivo: s.motivo,
        idComando: ids[0],
        protocolo: u.protocolo,
      },
      EstatusEnumBitcora.SUCCESS,
    );
    this.logger.warn(
      `[Inmovilizador] ${s.accion} instalacion=${s.idInstalacion} comando=${ids[0]} usuario=${alcance.userId}`,
    );
    return {
      data: {
        idComando: ids[0],
        accion: s.accion,
        idInstalacion: s.idInstalacion,
        estatus: 'pendiente',
        venceEnMinutos: this.vigenciaMs / 60_000,
      },
    };
  }

  /** Últimos 20 paros y reanudaciones de la unidad, con su estatus (pendiente → confirmado / vencido / fallido). */
  async historial(alcance: UsuarioAlcance, idInstalacion: number) {
    const inst = await this.tenantFilter.assertInstalacionVisible(alcance, idInstalacion);
    if (inst.idDispositivo == null) return { data: [] };
    const filas: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT Id AS id, Tipo AS tipo, Estatus AS estatus, Detalle AS detalle, IdUsuario AS idUsuario,
              DATE_FORMAT(FechaCreacion, '%Y-%m-%d %H:%i:%s') AS fechaCreacion,
              DATE_FORMAT(FechaConfirmado, '%Y-%m-%d %H:%i:%s') AS fechaConfirmado,
              DATE_FORMAT(VenceAt, '%Y-%m-%d %H:%i:%s') AS venceAt
         FROM ComandosDispositivo
        WHERE IdDispositivo = ? AND Tipo IN (?, ?)
        ORDER BY Id DESC LIMIT 20`,
      [inst.idDispositivo, TIPO_COMANDO.paro, TIPO_COMANDO.reanudar],
    );
    return { data: filas.map((f) => ({ ...f, id: Number(f.id) })) };
  }

  private bloqueo(
    accion: AccionInmovilizador,
    u: { velocidad: number | null; fechaPosicionMs: number | null },
  ) {
    return bloqueoParo({
      accion,
      velocidad: u.velocidad,
      fechaPosicionMs: u.fechaPosicionMs,
      ahoraMs: nowMexicoCityAsUtcDate().getTime(),
      velocidadMax: this.velocidadMax,
      antiguedadMaxMin: this.antiguedadMaxMin,
    });
  }

  /** Instalación activa, visible, de una clase con relevador; con su última posición. */
  private async unidad(alcance: UsuarioAlcance, idInstalacion: number) {
    await this.tenantFilter.assertInstalacionVisible(alcance, idInstalacion);
    const [fila]: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT i.Clase AS clase, i.IdDispositivo AS idDispositivo, i.Estatus AS estatus, v.Placa AS placa,
              u.Velocidad AS velocidad, DATE_FORMAT(u.FechaHora, '%Y-%m-%dT%H:%i:%s') AS fechaPosicion
         FROM Instalaciones i
         LEFT JOIN Dispositivos d ON d.Id = i.IdDispositivo
         LEFT JOIN Vehiculos v ON v.IdProducto = i.IdProducto AND v.IdCliente = i.IdCliente
         LEFT JOIN UltimaPosicion u ON u.Imei = d.Imei
        WHERE i.Id = ?`,
      [idInstalacion],
    );
    if (
      !fila ||
      Number(fila.estatus) !== EstatusEnum.ACTIVO ||
      fila.idDispositivo == null
    ) {
      throw new NotFoundException('Instalación no encontrada o sin equipo');
    }
    const protocolo = this.clases.get(String(fila.clase ?? '').toUpperCase());
    if (!protocolo) {
      throw new BadRequestException(
        'Esta unidad no tiene paro de motor habilitado (su equipo no tiene relevador de corte configurado)',
      );
    }
    const fechaPosicion = fila.fechaPosicion ? String(fila.fechaPosicion) : null;
    return {
      idDispositivo: Number(fila.idDispositivo),
      protocolo,
      placa: fila.placa ? String(fila.placa) : null,
      velocidad: fila.velocidad == null ? null : Number(fila.velocidad),
      fechaPosicion,
      fechaPosicionMs: fechaPosicion ? Date.parse(`${fechaPosicion}Z`) : null,
    };
  }

  private async registrar(
    alcance: UsuarioAlcance,
    descripcion: string,
    accion: string,
    query: Record<string, unknown>,
    estatus: string,
  ) {
    try {
      await this.bitacora.logToBitacora(
        'Inmovilizador',
        descripcion,
        accion,
        query,
        alcance.userId,
        EnumModulos.INSTALACIONES,
        estatus,
      );
    } catch (error) {
      this.logger.error(
        `[Inmovilizador] no se pudo escribir la bitácora: ${(error as Error)?.message}`,
      );
    }
  }

  private limpiar() {
    const ahora = Date.now();
    for (const [codigo, s] of this.solicitudes)
      if (s.expira < ahora) this.solicitudes.delete(codigo);
  }
}
