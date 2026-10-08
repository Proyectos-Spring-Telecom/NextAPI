import { Controller, Get, Request, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { DashboardService } from './dashboard.service';
import { DashboardResponse } from './dashboard.types';
import { DashboardResponseDto } from './dto/dashboard-response.dto';

@ApiTags('Dashboard')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) { }

  @Get()
  @ApiOperation({
    summary: 'Dashboard de inicio · centro de mando',
    description: [
      'Totales generales del sistema y gráficas generales, calculados en vivo. Sin parámetros:',
      'rol, cliente y usuario salen del token. Fechas en hora de pared de México.',
      '',
      'Alcance de instalaciones igual a `GET /monitoreo/list`: roles 1–5 y 8 global,',
      'Cliente (6) su jerarquía, Operador (7) y Usuario (9) solo instalaciones asignadas.',
      '',
      '**Respuesta plana (sin wrapper `data`).** Todos los arreglos siempre presentes;',
      'arreglo vacío = no aplica para el rol o sin datos.',
      '',
      '| Arreglo | Roles |',
      '|---|---|',
      '| alcance, hero, totales (según renglón), unidadesAhora, alertasPorDia, productosPorTipo, ultimasInstalaciones | todos |',
      '| dispositivosPorTipo, inventario | 1–6, 8 |',
      '| unidadesPorCliente | 1–6, 8 (vacío si el alcance tiene un solo cliente) |',
      '',
      'Renglones de `totales`: clientes (1–6, 8), usuarios (1–6), unidadesGps (todos),',
      'dispositivos (1–6, 8), sims (1–6, 8), geocercas (todos), puntosInteres (todos), operadores (1–6).',
      '',
      'Caché en memoria por alcance: respuesta 60 s; `alertasPorDia` 5 min.',
    ].join('\n'),
  })
  @ApiOkResponse({
    description: 'Dashboard obtenido correctamente',
    type: DashboardResponseDto,
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  @ApiInternalServerErrorResponse({ description: 'Error interno' })
  async obtener(@Request() req): Promise<DashboardResponse> {
    return this.dashboardService.obtener(
      Number(req.user.userId),
      Number(req.user.idCliente),
      Number(req.user.rol),
    );
  }
}
