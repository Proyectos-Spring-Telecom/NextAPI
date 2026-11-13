import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiSecurity,
  ApiTags,
} from '@nestjs/swagger';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { EnumRoles } from 'src/common/estatus.enum';
import { JwtOLlaveApiGuard } from 'src/llaves-api/jwt-o-llave-api.guard';
import { AceptaLlaveApi } from 'src/llaves-api/acepta-llave-api.decorator';
import {
  ActualizarRutaDto,
  ActualizarTrabajoDto,
  CancelarTrabajoDto,
  CrearRutaDto,
  CrearTrabajoDto,
  ListarTrabajosDto,
} from './dto/despacho.dto';
import { DespachoService } from './despacho.service';

/** Quién programa despacho: SA, Dev, Admin, Jefe de monitoreo y Cliente (su propia flota). */
const ROLES_ESCRITURA = [
  EnumRoles.SA,
  EnumRoles.DEV,
  EnumRoles.ADMIN,
  EnumRoles.JEFE_MONITOREO,
  EnumRoles.CLIENTE,
];

const CUMPLIMIENTO = [
  '**Cumplimiento** (se calcula al consultar con las posiciones de la unidad):',
  '- Llega al entrar al radio del punto de interés; sale al alejarse más del radio + margen (15 m o 20 %).',
  '- Parada: `pendiente`, `en_sitio`, `a_tiempo`, `tarde`, `antes` (antes de su ventana), `visitada` (sin ventana) o `no_visitada`.',
  '- Trabajo: `programado`, `en_curso`, `completado`, `incompleto` (terminó sin visitar todo) o `cancelado`;',
  '  con `visitadas`, `aTiempo`, `tarde`, `noVisitadas` y `enOrden` (si siguió la secuencia).',
  '- El chofer no se captura aquí: la asignación es de ShiftControl.',
];

const TRABAJO_EJEMPLO = {
  id: 15,
  idCliente: 47,
  idInstalacion: 1000325,
  idRuta: 3,
  titulo: 'Reparto zona norte',
  notas: null,
  fecha: '2026-11-14',
  inicio: '2026-11-14 07:00:00',
  fin: '2026-11-14 18:00:00',
  cancelado: false,
  motivoCancelacion: null,
  placa: 'PXP613F',
  economico: 'PXP613F',
  estado: 'en_curso',
  totalParadas: 2,
  visitadas: 1,
  aTiempo: 1,
  tarde: 0,
  noVisitadas: 0,
  enOrden: true,
};

@ApiTags('Despacho')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtOLlaveApiGuard, RolesGuard)
@Roles()
@Controller('despacho')
export class DespachoController {
  constructor(private readonly service: DespachoService) {}

  @Post('rutas')
  @Roles(...ROLES_ESCRITURA)
  @ApiOperation({
    summary:
      'Crea una ruta: secuencia de puntos de interés con ventana de llegada opcional',
  })
  @ApiBadRequestResponse({
    description: 'Puntos de interés que no son del cliente o ventanas inválidas',
  })
  @ApiForbiddenResponse({ description: 'Cliente fuera de alcance' })
  async crearRuta(@Body() dto: CrearRutaDto, @Request() req) {
    return this.service.crearRuta(req.user, dto);
  }

  @Get('rutas')
  @AceptaLlaveApi()
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Rutas del alcance (con el número de paradas)' })
  @ApiQuery({ name: 'idCliente', required: false, type: Number })
  async listarRutas(@Query('idCliente') idCliente: string | undefined, @Request() req) {
    const id = idCliente ? Number(idCliente) : undefined;
    return this.service.listarRutas(req.user, Number.isFinite(id) ? id : undefined);
  }

  @Get('rutas/:id')
  @AceptaLlaveApi()
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Detalle de una ruta con sus paradas' })
  @ApiNotFoundResponse({ description: 'Ruta no encontrada o fuera de alcance' })
  async obtenerRuta(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.obtenerRuta(req.user, id);
  }

  @Patch('rutas/:id')
  @Roles(...ROLES_ESCRITURA)
  @ApiOperation({
    summary:
      'Edita una ruta; `paradas` reemplaza todas (los trabajos ya creados no cambian)',
  })
  @ApiNotFoundResponse({ description: 'Ruta no encontrada o fuera de alcance' })
  async actualizarRuta(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarRutaDto,
    @Request() req,
  ) {
    return this.service.actualizarRuta(req.user, id, dto);
  }

  @Post('trabajos')
  @Roles(...ROLES_ESCRITURA)
  @ApiOperation({
    summary:
      'Asigna un trabajo a una unidad para una fecha (desde una ruta o con paradas sueltas)',
    description: CUMPLIMIENTO.join('\n'),
  })
  @ApiOkResponse({ schema: { example: { data: { ...TRABAJO_EJEMPLO, paradas: [] } } } })
  @ApiBadRequestResponse({
    description: 'Sin paradas, ruta inactiva o puntos que no son del cliente',
  })
  @ApiNotFoundResponse({ description: 'Instalación fuera de alcance' })
  async crearTrabajo(@Body() dto: CrearTrabajoDto, @Request() req) {
    return this.service.crearTrabajo(req.user, dto);
  }

  @Get('trabajos')
  @AceptaLlaveApi()
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Trabajos del periodo con su avance (máximo 31 días)',
    description: CUMPLIMIENTO.join('\n'),
  })
  @ApiOkResponse({
    schema: {
      example: {
        data: {
          fechaInicio: '2026-11-14',
          fechaFinal: '2026-11-14',
          total: 1,
          trabajos: [TRABAJO_EJEMPLO],
        },
      },
    },
  })
  async listarTrabajos(@Query() q: ListarTrabajosDto, @Request() req) {
    return this.service.listarTrabajos(req.user, q);
  }

  @Get('trabajos/:id')
  @AceptaLlaveApi()
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Detalle de un trabajo con el cumplimiento de cada parada',
    description: CUMPLIMIENTO.join('\n'),
  })
  @ApiOkResponse({
    schema: {
      example: {
        data: {
          ...TRABAJO_EJEMPLO,
          paradas: [
            {
              orden: 1,
              idPuntoInteres: 40,
              nombre: 'Almacén',
              lat: 20.5675,
              lng: -100.4175,
              radioMetros: 100,
              ventanaDesde: '2026-11-14 08:00:00',
              ventanaHasta: '2026-11-14 09:00:00',
              llegada: '2026-11-14T08:10:00',
              salida: '2026-11-14T08:30:00',
              minutosEnSitio: 20,
              estado: 'a_tiempo',
            },
          ],
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'Trabajo no encontrado o fuera de alcance' })
  async obtenerTrabajo(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.obtenerTrabajo(req.user, id);
  }

  @Patch('trabajos/:id')
  @Roles(...ROLES_ESCRITURA)
  @ApiOperation({ summary: 'Edita título, notas o el horario del trabajo' })
  @ApiNotFoundResponse({ description: 'Trabajo no encontrado o fuera de alcance' })
  async actualizarTrabajo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarTrabajoDto,
    @Request() req,
  ) {
    return this.service.actualizarTrabajo(req.user, id, dto);
  }

  @Patch('trabajos/:id/cancelar')
  @Roles(...ROLES_ESCRITURA)
  @ApiOperation({ summary: 'Cancela un trabajo (con motivo)' })
  @ApiNotFoundResponse({ description: 'Trabajo no encontrado o fuera de alcance' })
  async cancelarTrabajo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelarTrabajoDto,
    @Request() req,
  ) {
    return this.service.cancelarTrabajo(req.user, id, dto.motivo);
  }
}
