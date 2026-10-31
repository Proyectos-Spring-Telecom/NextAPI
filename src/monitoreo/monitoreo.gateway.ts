import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  ConsolaUltimaPosicionItem,
  MonitoreoService,
} from './monitoreo.service';
import { MonitoreoPosicionItem } from './monitoreo.mapper';
import { EnumRoles } from 'src/common/estatus.enum';

/**
 * Roles de operación (1–5): reciben lo que no es de una instalación del
 * cliente: la bandeja "Sin transmisión" y los incidentes de equipos
 * inservibles (van al cliente raíz). Mismos roles que la bandeja.
 */
const ROLES_OPERACION: readonly number[] = [EnumRoles.SA, EnumRoles.DEV, EnumRoles.ADMIN, EnumRoles.JEFE_MONITOREO, EnumRoles.MONITOREO];
const ROOM_OPERACION = 'operacion';

/** `vigilancia:avisos`: avisos de la bandeja que cambiaron (mismo ítem que `GET /vigilancia-transmision/avisos`). */
export interface AvisosSinTransmisionEvento {
  motivo: 'evaluacion' | 'cierre' | 'atencion';
  avisos: unknown[];
  /** Solo en `evaluacion`: el resumen por compañía telefónica de la bandeja. */
  porProveedor?: unknown[];
}

/** `incidente:inservible`: se abrió el incidente de un equipo o panel inservible que transmite. */
export interface IncidenteInservibleEvento {
  idIncidente: number;
  tipo: 'equipo' | 'panel';
  idDispositivo: number;
  numeroSerie: string | null;
  identificador: string;
  idClienteDispositivo: number | null;
  descripcion: string | null;
  fechaInicio: string;
}

/** `comando:actualizacion`: un comando de la instalación cambió de estatus (mismo ítem que `GET …/comandos`). */
export interface ComandoActualizacionEvento {
  idInstalacion: number;
  idDispositivo: number;
  comando: unknown;
}

/** Quién ve los comandos de una instalación, igual que su `GET …/comandos`. */
export type AudienciaComando = 'operacion' | 'operacion_y_cliente';

@WebSocketGateway({
  namespace: '/monitoreo',
  cors: { origin: '*' },
})
export class MonitoreoGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(MonitoreoGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly monitoreoService: MonitoreoService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const payload = this.verificarToken(client);
      const idUsuario = Number(payload.id);
      const idCliente = Number(payload.idCliente);
      const rol = Number(payload.rol);

      const ids = await this.monitoreoService.idsInstalacionesVisibles(
        idUsuario,
        idCliente,
        rol,
      );

      for (const id of ids) {
        await client.join(this.roomInstalacion(id));
      }
      if (ROLES_OPERACION.includes(rol)) {
        await client.join(ROOM_OPERACION);
      }
      // Comandos de configuración: solo quien puede verlos por HTTP (operación,
      // y el cliente 6 los del reloj). Los roles 7 y 9 no.
      const salaComandos = ROLES_OPERACION.includes(rol) ? 'op' : rol === EnumRoles.CLIENTE ? 'cliente' : null;
      if (salaComandos) {
        for (const id of ids) await client.join(`comandos-${salaComandos}:${id}`);
      }

      const listado = await this.monitoreoService.listado(
        idUsuario,
        idCliente,
        rol,
      );

      // Mismo shape que GET /monitoreo/list
      client.emit('conexion:lista', {
        idsInstalaciones: ids,
        posicion: listado.posicion,
        'puntos-interes': listado['puntos-interes'],
      });

      // Mismo shape que GET /monitoreo/consola
      const consola = await this.monitoreoService.consola(
        idUsuario,
        idCliente,
        rol,
      );
      client.emit('conexion:consola', {
        posicion: consola.posicion,
      });
    } catch (error) {
      this.logger.warn(
        `Socket rechazado: ${(error as Error)?.message ?? 'token inválido'}`,
      );
      client.disconnect(true);
    }
  }

  handleDisconnect(_client: Socket) {
    // rooms se limpian solos
  }

  /**
   * Emite el mismo ítem plano que GET /monitoreo/list (UltimaPosicion + rutas).
   * Evento: `monitoreo:actualizacion`
   */
  emitActualizacion(idInstalacion: number, payload: MonitoreoPosicionItem) {
    this.safeEmit(idInstalacion, 'monitoreo:actualizacion', payload);
  }

  /**
   * Emite el mismo ítem plano que GET /monitoreo/consola.
   * Evento: `consola:actualizacion`
   */
  emitConsolaActualizacion(
    idInstalacion: number,
    payload: ConsolaUltimaPosicionItem,
  ) {
    this.safeEmit(idInstalacion, 'consola:actualizacion', payload);
  }

  async notificarInstalacion(idInstalacion: number): Promise<void> {
    try {
      const item =
        await this.monitoreoService.obtenerPorInstalacion(idInstalacion);
      if (item) {
        this.emitActualizacion(idInstalacion, item);
      }
      const consola =
        await this.monitoreoService.obtenerConsolaPorInstalacion(idInstalacion);
      if (consola && consola.idInstalacion != null) {
        this.emitConsolaActualizacion(consola.idInstalacion, consola);
      }
    } catch (error) {
      this.logger.error(
        `Error notificando instalación ${idInstalacion}: ${(error as Error)?.message}`,
      );
    }
  }

  async notificarDispositivo(idDispositivo: number): Promise<void> {
    try {
      const item =
        await this.monitoreoService.obtenerPorDispositivo(idDispositivo);
      if (item) {
        this.emitActualizacion(item.idInstalacion, item);
      }
      const consola =
        await this.monitoreoService.obtenerConsolaPorDispositivo(idDispositivo);
      if (consola && consola.idInstalacion != null) {
        this.emitConsolaActualizacion(consola.idInstalacion, consola);
      }
    } catch (error) {
      this.logger.error(
        `Error notificando dispositivo ${idDispositivo}: ${(error as Error)?.message}`,
      );
    }
  }

  async notificarImei(imei: string): Promise<void> {
    try {
      const item = await this.monitoreoService.obtenerPorImei(imei);
      if (item) {
        this.emitActualizacion(item.idInstalacion, item);
      }
      const consola = await this.monitoreoService.obtenerConsolaPorImei(imei);
      if (consola && consola.idInstalacion != null) {
        this.emitConsolaActualizacion(consola.idInstalacion, consola);
      }
    } catch (error) {
      this.logger.error(
        `Error notificando imei ${imei}: ${(error as Error)?.message}`,
      );
    }
  }

  /** Evento: `vigilancia:avisos` (room de operación). */
  emitAvisosSinTransmision(evento: AvisosSinTransmisionEvento) {
    if (!evento.avisos.length) return;
    this.safeEmitRoom(ROOM_OPERACION, 'vigilancia:avisos', evento);
  }

  /** Evento: `incidente:inservible` (room de operación). */
  emitIncidenteInservible(evento: IncidenteInservibleEvento) {
    this.safeEmitRoom(ROOM_OPERACION, 'incidente:inservible', evento);
  }

  /**
   * Evento: `comando:actualizacion`. Solo a quien ve los comandos por HTTP:
   * operación (1–5) siempre; el cliente (6) solo si `audiencia` lo incluye
   * (reloj). El contenido y la lectura de parámetros no llegan a 7 ni 9.
   */
  emitComando(evento: ComandoActualizacionEvento, audiencia: AudienciaComando) {
    let destino = this.server?.to(`comandos-op:${evento.idInstalacion}`);
    if (audiencia === 'operacion_y_cliente') destino = destino?.to(`comandos-cliente:${evento.idInstalacion}`);
    try {
      destino?.emit('comando:actualizacion', evento);
    } catch (error) {
      this.logger.error(`Error emitiendo comando:actualizacion instalacion=${evento.idInstalacion}: ${(error as Error)?.message}`);
    }
  }

  private safeEmitRoom(room: string, event: string, payload: unknown) {
    try {
      this.server?.to(room).emit(event, payload);
    } catch (error) {
      this.logger.error(`Error emitiendo ${event} room=${room}: ${(error as Error)?.message}`);
    }
  }

  private roomInstalacion(idInstalacion: number): string {
    return `instalacion:${idInstalacion}`;
  }

  private safeEmit(idInstalacion: number, event: string, payload: unknown) {
    try {
      this.server
        ?.to(this.roomInstalacion(idInstalacion))
        .emit(event, payload);
    } catch (error) {
      this.logger.error(
        `Error emitiendo ${event} instalacion=${idInstalacion}: ${(error as Error)?.message}`,
      );
    }
  }

  private verificarToken(client: Socket): {
    id: number;
    rol: number;
    idCliente: number;
  } {
    const raw =
      client.handshake.auth?.token ??
      client.handshake.headers?.authorization ??
      client.handshake.query?.token;
    const token = String(raw ?? '')
      .replace(/^Bearer\s+/i, '')
      .trim();
    if (!token) {
      throw new Error('Falta token');
    }
    const payload = this.jwtService.verify(token) as {
      type?: string;
      id?: unknown;
      rol?: unknown;
      idCliente?: unknown;
    };
    if (payload?.type !== 'access') {
      throw new Error('Token de acceso inválido');
    }
    return {
      id: Number(payload.id),
      rol: Number(payload.rol),
      idCliente: Number(payload.idCliente),
    };
  }
}
