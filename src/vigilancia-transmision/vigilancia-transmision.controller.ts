import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { EnumRoles } from 'src/common/estatus.enum';
import { VigilanciaTransmisionService } from './vigilancia-transmision.service';
import { AtenderAvisoDto } from './dto/atender-aviso.dto';
import { FiltroAvisosDto } from './dto/filtro-avisos.dto';
import { EvaluarTransmisionDto } from './dto/evaluar.dto';

/** Monitoreo y administración (roles 1–5); no se notifica directo al cliente. */
const ROLES_MONITOREO = [EnumRoles.SA, EnumRoles.DEV, EnumRoles.ADMIN, EnumRoles.JEFE_MONITOREO, EnumRoles.MONITOREO];

const AVISO_EXAMPLE = {
  id: 12,
  idInstalacion: 1000123,
  idCliente: 20,
  cliente: 'Transportes del Sur',
  placa: 'ABC1234',
  economico: 'U-15',
  idDispositivo: 1000088,
  imei: '866000000000001',
  numeroSerie: 'S866000000000001',
  idTipoDispositivo: 1,
  tipoDispositivo: 'GPS',
  idSim: 301,
  numeroSim: '7771234567',
  idTelefonia: 1,
  telefonia: 'Telcel',
  fechaEvaluacion: '2026-10-31',
  ultimaTransmision: '2026-10-30 18:42:10',
  horasSinTransmitir: 15,
  estatus: 'abierto',
  resultado: null,
  comentario: null,
  fechaRegreso: null,
  idUsuarioAtiende: null,
  fechaAtencion: null,
  fechaCierre: null,
  motivoCierre: null,
  posibleFallaProveedor: true,
};

@ApiTags('Vigilancia de transmisión')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('vigilancia-transmision')
export class VigilanciaTransmisionController {
  constructor(private readonly service: VigilanciaTransmisionService) {}

  @Get('avisos')
  @Roles(...ROLES_MONITOREO)
  @ApiOperation({
    summary: 'Bandeja "Sin transmisión"',
    description:
      'Avisos de instalaciones activas que llevan más del umbral de su tipo de equipo sin transmitir (relojes 24 h, los demás 12 h). ' +
      'Se generan una vez al día entre las 9:00 y las 11:00 (hora de México); un aviso vivo por instalación, que se actualiza en cada evaluación ' +
      'y se cierra solo si el equipo vuelve a transmitir (`motivoCierre: transmitio`), la instalación se da de baja (`baja`) o la versión se reemplaza en un cambio (`cambio`). ' +
      'Sin `estatus`: los vivos (abierto y atendido). `porProveedor` agrupa por evaluación y compañía telefónica; ' +
      '`posibleFallaProveedor` = varias SIM de la misma compañía sin transmitir en la misma evaluación (`VIGILANCIA_PROVEEDOR_MIN`, 3 por defecto). Roles 1–5.',
  })
  @ApiOkResponse({
    schema: {
      example: {
        data: [AVISO_EXAMPLE],
        porProveedor: [{ fechaEvaluacion: '2026-10-31', idTelefonia: 1, telefonia: 'Telcel', avisos: 4, posibleFallaProveedor: true }],
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Solo roles 1–5' })
  avisos(@Query() filtro: FiltroAvisosDto) {
    return this.service.listar(filtro);
  }

  @Get('sin-primera-transmision')
  @Roles(...ROLES_MONITOREO)
  @ApiOperation({
    summary: 'Instalaciones activas que nunca han transmitido en su vigencia',
    description:
      'No generan avisos diarios hasta que operación las revise (pueden ser instalaciones legadas que aún reportan a otro sistema). ' +
      'Solo cuenta lo transmitido desde `VigenteDesde`. Roles 1–5.',
  })
  @ApiOkResponse({
    schema: {
      example: {
        data: [{ idInstalacion: 1000200, idCliente: 31, cliente: 'Cliente', placa: 'XYZ9876', economico: null, idDispositivo: 1000183, imei: '866000000000002', numeroSerie: 'S2', idTipoDispositivo: 1, tipoDispositivo: 'GPS', idSim: 12, numeroSim: '7770000000', telefonia: 'Telcel', vigenteDesde: '2026-10-05 16:22:00' }],
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Solo roles 1–5' })
  sinPrimeraTransmision() {
    return this.service.sinPrimeraTransmision();
  }

  @Patch('avisos/:id/atender')
  @Roles(...ROLES_MONITOREO)
  @ApiOperation({
    summary: 'Registrar el resultado de un aviso',
    description:
      'Pasa el aviso a `atendido` con su resultado. `taller` exige `fechaRegreso` futura: hasta esa fecha la instalación no genera avisos. ' +
      'El aviso sigue vivo hasta que el equipo vuelva a transmitir. Un aviso cerrado → 400. Roles 1–5.',
  })
  @ApiParam({ name: 'id', example: 12 })
  @ApiBody({ type: AtenderAvisoDto })
  @ApiOkResponse({ schema: { example: { status: 'success', message: 'Aviso atendido.', data: { id: 12, estatus: 'atendido', resultado: 'taller', fechaRegreso: '2026-11-04 09:00:00' } } } })
  @ApiNotFoundResponse({ description: 'Aviso no encontrado' })
  atender(@Param('id', ParseIntPipe) id: number, @Body() dto: AtenderAvisoDto, @Request() req) {
    return this.service.atender(id, dto, Number(req.user.userId));
  }

  @Post('evaluar')
  @HttpCode(200)
  @Roles(EnumRoles.SA, EnumRoles.DEV)
  @ApiOperation({
    summary: 'Evaluar ahora (manual)',
    description:
      'Corre la evaluación del día fuera de la ventana de 9:00–11:00. Si ya se evaluó hoy → 409, salvo `forzar: true`. Roles 1–2.',
  })
  @ApiBody({ type: EvaluarTransmisionDto, required: false })
  @ApiOkResponse({
    schema: { example: { data: { fecha: '2026-10-31', evaluadas: 407, avisos: 23, nuevos: 5, pausadas: 1, sinPrimeraTransmision: 238, cerrados: 3 } } },
  })
  @ApiConflictResponse({ description: 'Ya se evaluó hoy' })
  async evaluar(@Body() dto: EvaluarTransmisionDto, @Request() req) {
    const data = await this.service.evaluar({ origen: 'api', idUsuario: Number(req.user.userId), forzar: dto?.forzar === true });
    return { data };
  }
}
