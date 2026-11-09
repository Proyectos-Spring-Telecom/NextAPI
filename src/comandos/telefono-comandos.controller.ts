import { Body, Controller, Get, Param, ParseIntPipe, Post, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { EnumRoles } from 'src/common/estatus.enum';
import { TelefonoComandosService } from './telefono-comandos.service';
import { ComandoTelefonoDto } from './dto/comando-telefono.dto';

const OPERACION = [EnumRoles.SA, EnumRoles.DEV, EnumRoles.ADMIN, EnumRoles.JEFE_MONITOREO, EnumRoles.MONITOREO];

@ApiTags('Teléfono: comandos')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('instalaciones/:id/telefono')
export class TelefonoComandosController {
  constructor(private readonly telefono: TelefonoComandosService) {}

  @Post('comandos')
  @Roles(...OPERACION)
  @ApiOperation({
    summary: 'Mandar un comando a la app del teléfono',
    description:
      '`INTERVALO` (intervaloSeg 30–3600), `UBICAR` (fix de GPS en ese momento), `ESTADO` (permisos, batería, versión en el resultado) o ' +
      '`SMS` (pin y/o numeros del respaldo por SMS). Llega en la respuesta del siguiente reporte del teléfono. Roles 1–5.',
  })
  @ApiParam({ name: 'id', description: 'Instalación activa de un dispositivo tipo Teléfono (4)' })
  @ApiBody({ type: ComandoTelefonoDto })
  @ApiResponse({ status: 200, description: '`data.comandos` = id del comando creado' })
  enviar(@Param('id', ParseIntPipe) id: number, @Body() dto: ComandoTelefonoDto, @Request() req) {
    return this.telefono.enviar(req.user, id, dto);
  }

  @Get('comandos')
  @Roles(...OPERACION)
  @ApiOperation({ summary: 'Comandos enviados al teléfono y su estatus', description: 'Los últimos 100, más reciente primero.' })
  @ApiParam({ name: 'id', description: 'Instalación activa de un dispositivo tipo Teléfono (4)' })
  comandos(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.telefono.listarComandos(req.user, id);
  }
}
