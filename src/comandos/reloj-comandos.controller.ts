import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { EnumRoles } from 'src/common/estatus.enum';
import { RelojComandosService } from './reloj-comandos.service';
import { NumerosEmergenciaRelojDto } from './dto/numeros-emergencia.dto';
import { ConfiguracionRelojDto } from './dto/configuracion-reloj.dto';

const OPERACION = [EnumRoles.SA, EnumRoles.DEV, EnumRoles.ADMIN, EnumRoles.JEFE_MONITOREO, EnumRoles.MONITOREO];

@ApiTags('Reloj: comandos')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('instalaciones/:id/reloj')
export class RelojComandosController {
  constructor(private readonly reloj: RelojComandosService) {}

  @Get('numeros-emergencia')
  @Roles(...OPERACION, EnumRoles.CLIENTE)
  @ApiOperation({ summary: 'Números de emergencia del reloj', description: 'De la persona de la instalación (sirven aunque cambie el reloj): `sos` (hasta 3), `centro` y `agenda` (hasta 15).' })
  @ApiParam({ name: 'id', description: 'Instalación activa de clase RELOJ' })
  obtener(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.reloj.obtenerNumeros(req.user, id);
  }

  @Put('numeros-emergencia')
  @Roles(...OPERACION, EnumRoles.CLIENTE)
  @ApiOperation({
    summary: 'Guardar y mandar los números de emergencia al reloj',
    description:
      'Reemplaza lo enviado (`sos`, `centro`, `agenda`; lo que no se envía no cambia) y lo manda al reloj: `SOS`, `CENTER` y la agenda en ' +
      '`PHB`/`PHB2`/`PHB3`. Si el reloj está desconectado, el socket lo entrega al reconectar. El estatus de cada comando se ve en ' +
      '`GET …/reloj/comandos` (pendiente → publicado → recibido → enviado → confirmado). Roles 1–6, en su alcance.',
  })
  @ApiParam({ name: 'id', description: 'Instalación activa de clase RELOJ' })
  @ApiBody({ type: NumerosEmergenciaRelojDto })
  @ApiResponse({ status: 200, description: '`data.comandos` = ids de los comandos creados' })
  @ApiResponse({ status: 400, description: 'Teléfono o nombre inválido, más de 3 SOS o de 15 contactos, instalación que no es reloj' })
  guardar(@Param('id', ParseIntPipe) id: number, @Body() dto: NumerosEmergenciaRelojDto, @Request() req) {
    return this.reloj.guardarNumeros(req.user, id, dto);
  }

  @Post('configuracion')
  @Roles(...OPERACION)
  @ApiOperation({
    summary: 'Guardar y mandar la configuración al reloj',
    description:
      'Solo los campos enviados: intervalo (`UPLOAD`), caída (`FALLDOWN`: detección y llamada) y sensibilidad (`LSSET`, 1–6; mayor = menos ' +
      'sensible). Se guardan en `RelojConfig` y se mandan al reloj. Nada se manda solo al desplegar ni al instalar. Roles 1–5.',
  })
  @ApiParam({ name: 'id', description: 'Instalación activa de clase RELOJ' })
  @ApiBody({ type: ConfiguracionRelojDto })
  aplicar(@Param('id', ParseIntPipe) id: number, @Body() dto: ConfiguracionRelojDto, @Request() req) {
    return this.reloj.aplicarConfiguracion(req.user, id, dto);
  }

  @Get('comandos')
  @Roles(...OPERACION, EnumRoles.CLIENTE)
  @ApiOperation({ summary: 'Comandos enviados al reloj y su estatus', description: 'Los últimos 100, más reciente primero.' })
  @ApiParam({ name: 'id', description: 'Instalación activa de clase RELOJ' })
  comandos(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.reloj.listarComandos(req.user, id);
  }
}
