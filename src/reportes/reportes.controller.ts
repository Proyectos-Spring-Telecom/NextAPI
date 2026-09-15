import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { PasoPorPoiDto } from './dto/paso-por-poi.dto';
import { ReportesService } from './reportes.service';

@ApiTags('Reportes')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('reportes')
export class ReportesController {
  constructor(private readonly service: ReportesService) {}

  @Post('paso-por-poi')
  @ApiOperation({
    summary: 'Dispositivos que pasaron por un punto de interés',
    description: [
      'Cuenta **dispositivos distintos** (instalaciones) con al menos una posición',
      'dentro del radio del POI (`PuntosInteres.RadioMetros`) en el periodo indicado.',
      '',
      '**Body:**',
      '- `idCliente` + `idPuntoInteres` (obligatorios; el POI debe ser del cliente).',
      '- `fechaInicio` / `fechaFinal` (inclusive, hora de pared como `Posiciones.FechaHora`).',
      '- `idsInstalacion` opcional (1..N). Si se omite → todas las instalaciones **activas**',
      '  del cliente con dispositivo e IMEI.',
      '',
      '**Exclusiones:** tipo panel de alarma (`idTipoDispositivo = 2`).',
      '',
      '**Alcance:** `idCliente` debe estar visible según el rol del token.',
    ].join('\n'),
  })
  @ApiBody({ type: PasoPorPoiDto })
  @ApiOkResponse({
    description: 'Reporte generado (`data.totalDispositivos` + detalle)',
  })
  @ApiBadRequestResponse({
    description: 'Fechas inválidas / POI de otro cliente / instalaciones ajenas',
  })
  @ApiForbiddenResponse({ description: 'Cliente fuera de alcance' })
  @ApiNotFoundResponse({ description: 'Punto de interés no encontrado' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async pasoPorPuntoInteres(@Body() dto: PasoPorPoiDto, @Request() req) {
    return this.service.pasoPorPuntoInteres(
      dto,
      Number(req.user.idCliente),
      Number(req.user.rol),
    );
  }
}
