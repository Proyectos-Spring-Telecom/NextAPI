import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { InjectRepository } from '@nestjs/typeorm';
import { Server, Socket } from 'socket.io';
import { In, Repository } from 'typeorm';
import { PanelAlarma } from 'src/entities/PanelAlarma';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';

@WebSocketGateway({
  namespace: '/alarmas',
  cors: { origin: '*' },
})
export class AlarmasGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(AlarmasGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly tenantFilter: TenantFilterService,
    @InjectRepository(PanelAlarma)
    private readonly panelRepo: Repository<PanelAlarma>,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const payload = this.verificarToken(client);
      const scope = await this.tenantFilter.idsClientePermitidos(
        Number(payload.rol),
        Number(payload.idCliente),
      );
      const ids = await this.idsPanelesVisibles(scope);
      for (const id of ids) {
        await client.join(`panel:${id}`);
      }
      client.emit('conexion:lista', { idsPaneles: ids });
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

  emitEventoNuevo(idPanel: number, payload: unknown) {
    this.safeEmit(idPanel, 'evento:nuevo', payload);
  }

  emitHeartbeat(idPanel: number, ultimoHeartbeat: Date | string) {
    this.safeEmit(idPanel, 'panel:heartbeat', {
      idPanel: Number(idPanel),
      ultimoHeartbeat:
        ultimoHeartbeat instanceof Date
          ? ultimoHeartbeat
          : new Date(ultimoHeartbeat),
    });
  }

  emitEstado(idPanel: number, online: boolean) {
    this.safeEmit(idPanel, 'panel:estado', {
      idPanel: Number(idPanel),
      online,
    });
  }

  private safeEmit(idPanel: number, event: string, payload: unknown) {
    try {
      this.server?.to(`panel:${idPanel}`).emit(event, payload);
    } catch (error) {
      this.logger.error(
        `Error emitiendo ${event} panel=${idPanel}: ${(error as Error)?.message}`,
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

  private async idsPanelesVisibles(
    scope: 'all' | number[],
  ): Promise<number[]> {
    const where: { estatus: number; idCliente?: ReturnType<typeof In> | number } =
      { estatus: 1 };
    if (scope !== 'all') {
      if (scope.length === 0) {
        return [];
      }
      where.idCliente = scope.length === 1 ? scope[0] : In(scope);
    }
    const paneles = await this.panelRepo.find({
      where,
      select: ['idDispositivo'],
    });
    return paneles.map((p) => Number(p.idDispositivo));
  }
}
