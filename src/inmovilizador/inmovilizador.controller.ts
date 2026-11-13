import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { EnumRoles } from 'src/common/estatus.enum';
import {
  ConfirmarInmovilizadorDto,
  SolicitarInmovilizadorDto,
} from './dto/inmovilizador.dto';
import { InmovilizadorService } from './inmovilizador.service';

@ApiTags('Inmovilizador')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(EnumRoles.SA, EnumRoles.DEV, EnumRoles.ADMIN, EnumRoles.JEFE_MONITOREO)
@Controller('inmovilizador')
export class InmovilizadorController {
  constructor(private readonly service: InmovilizadorService) {}

  @Post(':idInstalacion/solicitar')
  @ApiOperation({
    summary:
      'Paso 1: solicita paro o reanudación de motor (devuelve un código que vale 2 min)',
    description: [
      'Revisa la seguridad: para el **paro**, la última posición debe ser de hace 5 min o menos y con menos de 5 km/h',
      '(`INMOVILIZADOR_POSICION_MAX_MIN`, `INMOVILIZADOR_VELOCIDAD_MAX`). Reanudar no tiene restricción.',
      'Solo unidades cuya clase de equipo tiene relevador (`INMOVILIZADOR_CLASES`, p. ej. `GPS:jimi`).',
      'Roles SA, Dev, Admin y Jefe de monitoreo. Queda en bitácora, también si se rechaza.',
    ].join('\n'),
  })
  @ApiOkResponse({
    schema: {
      example: {
        data: {
          codigo: '9f1c…',
          expiraEnSegundos: 120,
          accion: 'paro',
          idInstalacion: 1000325,
          placa: 'PXP613F',
          velocidad: 0,
          fechaPosicion: '2026-11-13T15:40:02',
          aviso:
            'Confirma con POST /inmovilizador/confirmar. El comando vence si el equipo no lo recibe en pocos minutos.',
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'La unidad no tiene paro de motor habilitado' })
  @ApiConflictResponse({ description: 'La unidad va en marcha o su posición es vieja' })
  @ApiNotFoundResponse({
    description: 'Instalación no encontrada, sin equipo o fuera de alcance',
  })
  async solicitar(
    @Param('idInstalacion', ParseIntPipe) idInstalacion: number,
    @Body() dto: SolicitarInmovilizadorDto,
    @Request() req,
  ) {
    return this.service.solicitar(req.user, idInstalacion, dto.accion, dto.motivo.trim());
  }

  @Post('confirmar')
  @ApiOperation({
    summary: 'Paso 2: confirma con el código (mismo usuario) y manda el comando',
    description:
      'Vuelve a revisar la seguridad (la unidad pudo arrancar) y encola el comando con vigencia corta ' +
      '(`INMOVILIZADOR_VIGENCIA_MIN`, 5): si el equipo no lo recibe a tiempo, vence y no se entrega después.',
  })
  @ApiOkResponse({
    schema: {
      example: {
        data: {
          idComando: 812,
          accion: 'paro',
          idInstalacion: 1000325,
          estatus: 'pendiente',
          venceEnMinutos: 5,
        },
      },
    },
  })
  @ApiConflictResponse({ description: 'La unidad arrancó o su posición es vieja' })
  @ApiForbiddenResponse({ description: 'Otro usuario solicitó' })
  @ApiNotFoundResponse({ description: 'Código inválido o vencido' })
  async confirmar(@Body() dto: ConfirmarInmovilizadorDto, @Request() req) {
    return this.service.confirmar(req.user, dto.codigo);
  }

  @Get(':idInstalacion/comandos')
  @ApiOperation({
    summary: 'Últimos 20 paros y reanudaciones de la unidad con su estatus',
  })
  @ApiNotFoundResponse({ description: 'Instalación fuera de alcance' })
  async historial(
    @Param('idInstalacion', ParseIntPipe) idInstalacion: number,
    @Request() req,
  ) {
    return this.service.historial(req.user, idInstalacion);
  }
}
