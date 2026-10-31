import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { EnumRoles } from 'src/common/estatus.enum';
import { TrackCamComandosService } from './trackcam-comandos.service';
import { ParametrosTrackCamDto } from './dto/parametros-trackcam.dto';

const OPERACION = [EnumRoles.SA, EnumRoles.DEV, EnumRoles.ADMIN, EnumRoles.JEFE_MONITOREO, EnumRoles.MONITOREO];

@ApiTags('TrackCam: comandos')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('instalaciones/:id/trackcam')
@Roles(...OPERACION)
export class TrackCamComandosController {
  constructor(private readonly trackcam: TrackCamComandosService) {}

  @Get('parametros')
  @ApiOperation({
    summary: 'Parámetros de la TrackCam',
    description:
      'Por parámetro: catálogo (`etiqueta`, `unidad`, `min`, `max`), lo pedido desde Next (`deseado`) y lo que la cámara tiene según su ' +
      'última lectura (`leido`, `fechaLectura`). `pendiente` = pedido y la cámara aún tiene otro valor. Roles 1–5.',
  })
  @ApiParam({ name: 'id', description: 'Instalación activa de clase TRACKCAM' })
  obtener(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.trackcam.obtener(req.user, id);
  }

  @Put('parametros')
  @ApiOperation({
    summary: 'Guardar y mandar parámetros a la TrackCam',
    description:
      'Solo los campos enviados: se guardan como deseados y van en un solo comando `PARAMS`. El gateway los escribe (0x8103), los relee ' +
      '(0x8104) y confirma solo si la cámara los guardó; si no, el comando queda `fallido` con el motivo. Si la cámara está desconectada, ' +
      'el gateway lo entrega al reconectar. Heartbeat, servidor, APN y alarmas con foto no se cambian aquí (los mantiene el gateway). Roles 1–5.',
  })
  @ApiParam({ name: 'id', description: 'Instalación activa de clase TRACKCAM' })
  @ApiBody({ type: ParametrosTrackCamDto })
  @ApiResponse({ status: 200, description: '`data.comandos` = id del comando creado' })
  @ApiResponse({ status: 400, description: 'Ningún campo, valor fuera de rango o instalación que no es TrackCam' })
  aplicar(@Param('id', ParseIntPipe) id: number, @Body() dto: ParametrosTrackCamDto, @Request() req) {
    return this.trackcam.aplicar(req.user, id, dto);
  }

  @Post('parametros/leer')
  @ApiOperation({
    summary: 'Leer los parámetros de la cámara',
    description: 'Manda `LEERPARAMS`; al confirmarse, `GET …/trackcam/parametros` trae la lectura nueva (`fechaLectura`). Roles 1–5.',
  })
  @ApiParam({ name: 'id', description: 'Instalación activa de clase TRACKCAM' })
  leer(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.trackcam.leer(req.user, id);
  }

  @Get('comandos')
  @ApiOperation({ summary: 'Comandos enviados a la TrackCam y su estatus', description: 'Los últimos 100, más reciente primero. Roles 1–5.' })
  @ApiParam({ name: 'id', description: 'Instalación activa de clase TRACKCAM' })
  comandos(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.trackcam.listarComandos(req.user, id);
  }
}
