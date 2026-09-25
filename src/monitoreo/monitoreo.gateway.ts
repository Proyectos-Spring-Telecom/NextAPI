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
