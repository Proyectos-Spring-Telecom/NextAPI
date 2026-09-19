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
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { Roles } from 'src/common/decorators/roles.decorator';
import {
  EstatusIncidente,
  TipoOrigenIncidente,
} from 'src/common/estatus.enum';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { CreateIncidenteDto } from './dto/create-incidente.dto';
import { CreateSeguimientoIncidenteDto } from './dto/create-seguimiento-incidente.dto';
import { UpdateIncidenteDto } from './dto/update-incidente.dto';
import { IncidentesService } from './incidentes.service';

const ITEM_EXAMPLE = {
  id: 10,
  idCliente: 1,
  nombreCliente: 'Next',
  tipoOrigen: TipoOrigenIncidente.POSICION,
  idPosicion: 2356,
  idPosicionOrigen: 2356,
  idEventoAlarma: null,
  idEventoAlarmaOrigen: null,
  datosOrigen: {
    id: 2356,
    imei: '123456789012345',
    lat: 19.4326,
    lng: -99.1332,
    idEvento: 5,
  },
  idUsuario: 8,
  nombreUsuario: 'Ana Monitorista',
  descripcion: 'Help Me',
  fechaInicio: '2026-09-18T22:13:00.000Z',
  fechaCierre: null,
  estatus: EstatusIncidente.ABIERTO,
  fechaCreacion: '2026-09-18T22:13:00.000Z',
  fechaActualizacion: '2026-09-18T22:13:00.000Z',
};

@ApiTags('Incidentes')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('incidentes')
export class IncidentesController {
  constructor(private readonly service: IncidentesService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear incidente',
    description: [
      'Alta manual con `estatus = ABIERTO (1)`.',
      '',
      'El front solo indica el origen. El backend carga la fila, resuelve `idCliente`, copia los IDs `*Origen` y construye `datosOrigen`.',
      '',
      '**tipoOrigen = 1 (POSICION):** enviar `idPosicion`. No enviar `idEventoAlarma`.',
      '**tipoOrigen = 2 (EVENTO_ALARMA):** enviar `idEventoAlarma`. No enviar `idPosicion`.',
      '',
      '`idCliente` se toma del dispositivo (IMEI) o del evento; no se acepta en el body.',
    ].join('\n'),
  })
  @ApiBody({ type: CreateIncidenteDto })
  @ApiCreatedResponse({ description: 'Creado correctamente' })
  @ApiBadRequestResponse({
    description: 'Datos inválidos / origen sin cliente / combinación de IDs',
  })
  @ApiForbiddenResponse({ description: 'Cliente del origen fuera de alcance' })
  @ApiNotFoundResponse({ description: 'Posición o evento no encontrado' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async create(
    @Body() dto: CreateIncidenteDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.service.create(
      dto,
      Number(req.user.idCliente),
      Number(req.user.rol),
      Number(req.user.userId),
    );
  }

  @Get('list')
  @ApiOperation({
    summary: 'Lista de incidentes abiertos',
    description:
      'Solo `estatus = 1`. Alcance por rol. Query opcional `idCliente` y `tipoOrigen`.',
  })
  @ApiQuery({ name: 'idCliente', required: false, type: Number })
  @ApiQuery({
    name: 'tipoOrigen',
    required: false,
    enum: TipoOrigenIncidente,
  })
  @ApiOkResponse({
    description: 'Lista obtenida',
    schema: { example: { data: [ITEM_EXAMPLE] } },
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async findAllList(
    @Request() req,
    @Query('idCliente') idCliente?: string,
    @Query('tipoOrigen') tipoOrigen?: string,
  ): Promise<ApiResponseCommon> {
    return this.service.findAllList(
      Number(req.user.idCliente),
      Number(req.user.rol),
      this.parseOptionalInt(idCliente),
      this.parseOptionalInt(tipoOrigen),
    );
  }

  @Get('cliente/:idCliente')
  @ApiOperation({
    summary: 'Incidentes abiertos por idCliente',
    description:
      'Solo `estatus = 1`. El `idCliente` debe estar en el alcance del rol.',
  })
  @ApiParam({ name: 'idCliente', type: Number })
  @ApiQuery({
    name: 'tipoOrigen',
    required: false,
    enum: TipoOrigenIncidente,
  })
  @ApiOkResponse({
    description: 'Lista por cliente',
    schema: { example: { data: [ITEM_EXAMPLE] } },
  })
  @ApiForbiddenResponse({ description: 'Cliente fuera de alcance' })
  @ApiBadRequestResponse({ description: 'idCliente inválido / no existe' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async findByIdCliente(
    @Param('idCliente', ParseIntPipe) idCliente: number,
    @Request() req,
    @Query('tipoOrigen') tipoOrigen?: string,
  ): Promise<ApiResponseCommon> {
    return this.service.findByIdCliente(
      idCliente,
      Number(req.user.idCliente),
      Number(req.user.rol),
      this.parseOptionalInt(tipoOrigen),
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Lista paginada de incidentes',
    description: 'Incluye abiertos y cerrados. Alcance por rol del token.',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({
    name: 'tipoOrigen',
    required: false,
    enum: TipoOrigenIncidente,
  })
  @ApiOkResponse({ description: 'Lista paginada' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async findAll(
    @Request() req,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('tipoOrigen') tipoOrigen?: string,
  ): Promise<ApiResponseCommon> {
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(200, Math.max(1, Number(limit) || 20));
    return this.service.findAll(
      Number(req.user.idCliente),
      Number(req.user.rol),
      pageNum,
      limitNum,
      this.parseOptionalInt(tipoOrigen),
    );
  }

  @Get(':id/seguimientos')
  @ApiOperation({ summary: 'Seguimientos de un incidente' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ description: 'Lista de seguimientos' })
  @ApiNotFoundResponse({ description: 'Incidente no encontrado o fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async findSeguimientos(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    return this.service.findSeguimientos(
      id,
      Number(req.user.idCliente),
      Number(req.user.rol),
    );
  }

  @Post(':id/seguimientos')
  @ApiOperation({
    summary: 'Registrar seguimiento',
    description: '`idUsuario` se toma del token. `fechaHora` opcional.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: CreateSeguimientoIncidenteDto })
  @ApiCreatedResponse({ description: 'Seguimiento registrado' })
  @ApiNotFoundResponse({ description: 'Incidente no encontrado o fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async createSeguimiento(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateSeguimientoIncidenteDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.service.createSeguimiento(
      id,
      dto,
      Number(req.user.idCliente),
      Number(req.user.rol),
      Number(req.user.userId),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un incidente' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({
    description: 'Detalle con `datosOrigen` y seguimientos',
    schema: {
      example: {
        data: {
          ...ITEM_EXAMPLE,
          seguimientos: [
            {
              id: 1,
              actividad: 'Se realiza llamada a recepción',
              medio: 'Llamada',
            },
          ],
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'No encontrado o fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<{ data: unknown }> {
    return this.service.findOne(
      id,
      Number(req.user.idCliente),
      Number(req.user.rol),
    );
  }

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Alternar estatus (abierto ↔ cerrado)',
    description:
      'Sin body. `1 → 0` cierra y llena `fechaCierre`. `0 → 1` reabre y deja `fechaCierre` en null.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ description: 'Estatus alternado' })
  @ApiNotFoundResponse({ description: 'No encontrado o fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.service.updateEstatus(
      id,
      Number(req.user.idCliente),
      Number(req.user.rol),
      Number(req.user.userId),
    );
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar incidente',
    description: 'Solo `descripcion`. No se puede cambiar origen ni snapshot.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: UpdateIncidenteDto })
  @ApiOkResponse({ description: 'Actualizado' })
  @ApiNotFoundResponse({ description: 'No encontrado o fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateIncidenteDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.service.update(
      id,
      dto,
      Number(req.user.idCliente),
      Number(req.user.rol),
      Number(req.user.userId),
    );
  }

  private parseOptionalInt(value?: string): number | undefined {
    if (value == null || value === '') {
      return undefined;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
}
