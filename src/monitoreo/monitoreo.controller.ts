import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MonitoreoService } from './monitoreo.service';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Monitoreo')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('monitoreo')
export class MonitoreoController {
  constructor(private readonly monitoreoService: MonitoreoService) {}

  @Get('list')
  @ApiOperation({
    summary: 'Listado de instalaciones con última posición GPS',
    description: [
      'Devuelve instalaciones activas con telemetría (`UltimaPosicion`) y campos según tipo de producto.',
      'No requiere `idCliente` en la ruta; el alcance se resuelve por rol del token.',
      '',
      '**SA, Dev, Admin, JefeMonitoreo, Monitoreo, Técnico (1–5, 8):** todas las instalaciones activas.',
      '**Cliente (6):** instalaciones de su cliente y descendientes (`spGetClientes`).',
      '**Operador (7) y Usuario (9):** solo instalaciones asignadas en `UsuariosInstalaciones` (activas).',
      '',
      'Cada elemento de `posicion` incluye solo los campos del tipo:',
      '- **Vehículo (1):** cliente, placa, económico, marca, modelo, ignición, velocidad, fechaHora, nivelCombustible, lat, lng.',
      '- **Activo (2):** cliente, imei, descripcion, economico, numeroSerie, estatus, gps, modelo, marca, fechaHora, ultimaPosicion, lat, lng.',
      '- **Inmueble / panel (3):** cliente, imei, inmueble, economico, numeroSerie, estatus, modelo, marca, lat, lng, ultimoHeartbeat, fechaHora (último evento), ultimoEventoAlarma (`UltimoEventoAlarma`; no usa `UltimaPosicion`).',
      '- **Persona / teléfono (4):** cliente, imei, persona, economico, numeroSerie, estatus, gps, modelo, marca, fechaHora, ultimaPosicion, lat, lng.',
      '',
      '**Socket.IO** namespace `/monitoreo`:',
      '- Conexión con JWT (`auth.token`).',
      '- `conexion:lista` → `{ idsInstalaciones: number[] }` según rol.',
      '- `monitoreo:actualizacion` → mismo shape que un ítem de `posicion[]`.',
      '',
      'Respuesta: `{ posicion: [...] }` (sin wrapper `data`).',
    ].join('\n'),
  })
  @ApiResponse({ status: 200, description: 'Listado obtenido correctamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 500, description: 'Error interno' })
  async findList(@Request() req) {
    return this.monitoreoService.listado(
      Number(req.user.userId),
      Number(req.user.idCliente),
      Number(req.user.rol),
    );
  }
}
