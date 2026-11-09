import { Controller, Get, Param, ParseIntPipe, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { EnumRoles } from 'src/common/estatus.enum';
import { TelefonosAppService } from './telefonos-app.service';

const ADMINISTRACION = [EnumRoles.SA, EnumRoles.DEV, EnumRoles.ADMIN];
const OPERACION = [...ADMINISTRACION, EnumRoles.JEFE_MONITOREO, EnumRoles.MONITOREO];

@ApiTags('Teléfono: app de rastreo')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dispositivos/:id/telefono-app')
export class TelefonosAppController {
  constructor(private readonly telefonos: TelefonosAppService) {}

  @Get()
  @Roles(...OPERACION)
  @ApiOperation({
    summary: 'Estado de la app en el teléfono',
    description: '`estado` (pendiente | activo | baja), `ultimoAt`, `modelo`, `appVersion`, `intervaloSeg`. `data: null` si nunca se dio de alta. Roles 1–5.',
  })
  @ApiParam({ name: 'id', description: 'Dispositivo tipo Teléfono (4) con cliente' })
  estado(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.telefonos.estado(req.user, id);
  }

  @Post('codigo-alta')
  @Roles(...OPERACION)
  @ApiOperation({
    summary: 'Generar el código de alta de la app',
    description:
      'Código de 8 caracteres (`ABCD-EF23`), un solo uso, vence en 24 h; se teclea en la app. Anula el anterior y, al canjearlo en otro ' +
      'aparato, el anterior deja de reportar. Si el dispositivo no tiene IMEI se le asigna uno (`99…`). Roles 1–5.',
  })
  @ApiParam({ name: 'id', description: 'Dispositivo tipo Teléfono (4) con cliente' })
  @ApiResponse({ status: 200, description: '`data.codigo`, `data.venceAt`, `data.imei`' })
  @ApiResponse({ status: 502, description: 'springTrackPhone no respondió' })
  codigo(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.telefonos.codigoAlta(req.user, id);
  }

  @Post('baja')
  @Roles(...ADMINISTRACION)
  @ApiOperation({ summary: 'Dar de baja la app del teléfono', description: 'El token del teléfono deja de valer al momento. Roles 1–3.' })
  @ApiParam({ name: 'id', description: 'Dispositivo tipo Teléfono (4) con cliente' })
  baja(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.telefonos.baja(req.user, id);
  }
}
