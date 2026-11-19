import { Controller, Get, Param, ParseIntPipe, Query, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UsuarioAlcance } from 'src/common/tenant-filter/tenant-filter.service';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { FiltroReporteFlotaDto } from './dto/filtro-reporte-flota.dto';
import { ReporteFlotaService } from './reporte-flota.service';

function alcanceDe(req: { user: { userId: unknown; idCliente: unknown; rol: unknown } }): UsuarioAlcance {
  return { userId: Number(req.user.userId), idCliente: Number(req.user.idCliente), rol: Number(req.user.rol) };
}

@ApiTags('Reporte de flota')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('reporte-flota')
export class ReporteFlotaController {
  constructor(private readonly service: ReporteFlotaService) {}

  @Get()
  @ApiOperation({
    summary: 'Reporte de flota: resumen y vehículos en movimiento con texto para WhatsApp',
    description: [
      'Reemplaza la vista legacy "Monitoreo — Reporte de Vehículos". Mismo alcance que `GET /monitoreo/list` (1–5 y 8 todo, 6 su cliente e hijos, 7/9 las asignadas); solo vehículos (tipo de producto 1).',
      '',
      '`resumen`: total, enMovimiento, detenidas, sinReporte (episodio abierto de `monitoreo:sin-reporte`), sinPosicion.',
      '`situacion` de cada unidad: `movimiento` = última posición de hace `criterio.vigenciaMin` min o menos y a `criterio.velocidadKmh` km/h o más (la ignición no cuenta).',
      '',
      '`direccion` sale de la caché del back; si `direccionPendiente` es true se está buscando (1 por segundo): volver a pedir el listado en ~10 s o pedir la unidad con `GET /reporte-flota/:idInstalacion`.',
      '`mensaje`: texto listo para WhatsApp (negritas con `*`). `mapaUrl`: liga a Google Maps.',
      'Docs: `docs/front-next.md` §34.',
    ].join('\n'),
  })
  @ApiResponse({ status: 200, description: '{ generadoEn, criterio, resumen, unidades[] }' })
  async reporte(@Query() q: FiltroReporteFlotaDto, @Request() req) {
    return this.service.reporte(alcanceDe(req), q.situacion ?? 'movimiento');
  }

  @Get(':idInstalacion')
  @ApiOperation({
    summary: 'Una unidad del reporte de flota con su dirección resuelta',
    description:
      'Mismo ítem que `unidades[]`, esperando la dirección. Para "Copiar texto" / "Descargar imagen" de una tarjeta. Solo vehículos; fuera de alcance → 404.',
  })
  @ApiParam({ name: 'idInstalacion', type: Number })
  @ApiResponse({ status: 400, description: 'La instalación no es de un vehículo' })
  @ApiResponse({ status: 404, description: 'Instalación no encontrada o fuera de alcance' })
  async unidad(@Param('idInstalacion', ParseIntPipe) idInstalacion: number, @Request() req) {
    return this.service.unidad(alcanceDe(req), idInstalacion);
  }
}
