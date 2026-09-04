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
import { PuntosInteresService } from './puntos-interes.service';
import { CreatePuntoInteresDto } from './dto/create-punto-interes.dto';
import { UpdatePuntoInteresDto } from './dto/update-punto-interes.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { EstatusEnum } from 'src/common/estatus.enum';

const ITEM_EXAMPLE = {
  id: 1,
  idCliente: 1,
  nombreCliente: 'Next',
  nombre: 'Base Norte',
  descripcion: 'Punto de control acceso norte',
  lng: -99.133209,
  lat: 19.432608,
  icono: 'https://cdn.example.com/icons/poi-base.png',
  estatus: EstatusEnum.ACTIVO,
  fechaCreacion: '2026-09-04T18:00:00.000Z',
  fechaActualizacion: '2026-09-04T18:00:00.000Z',
};

@ApiTags('Puntos de interés')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('puntos-interes')
export class PuntosInteresController {
  constructor(private readonly service: PuntosInteresService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear punto de interés',
    description: [
      'Alta con `estatus = ACTIVO (1)`.',
      '',
      '**idCliente:**',
      '- Roles **Cliente (6)** y **Usuario (9):** se toma del JWT (se ignora el body).',
      '- Resto de roles: obligatorio en body y debe estar en el alcance del rol.',
      '',
      '**Visualización (listados):** tenant por rol (1–5, 8 global; 6 jerarquía; 7/9 su cliente).',
    ].join('\n'),
  })
  @ApiBody({ type: CreatePuntoInteresDto })
  @ApiCreatedResponse({ description: 'Creado correctamente' })
  @ApiBadRequestResponse({ description: 'Datos inválidos / cliente inexistente' })
  @ApiForbiddenResponse({ description: 'Cliente fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async create(
    @Body() dto: CreatePuntoInteresDto,
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
    summary: 'Lista de puntos de interés activos',
    description:
      'Solo `estatus = 1`. Respeta alcance por rol. Query opcional `idCliente` (debe estar en alcance).',
  })
  @ApiQuery({ name: 'idCliente', required: false, type: Number })
  @ApiOkResponse({
    description: 'Lista obtenida',
    schema: { example: { data: [ITEM_EXAMPLE] } },
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async findAllList(
    @Request() req,
    @Query('idCliente') idCliente?: string,
  ): Promise<ApiResponseCommon> {
    const filtro =
      idCliente != null && idCliente !== ''
        ? Number(idCliente)
        : undefined;
    return this.service.findAllList(
      Number(req.user.idCliente),
      Number(req.user.rol),
      Number.isFinite(filtro as number) ? filtro : undefined,
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Lista paginada de puntos de interés',
    description:
      'Incluye activos e inactivos. Alcance por rol del token.',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiOkResponse({ description: 'Lista paginada' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async findAll(
    @Request() req,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ): Promise<ApiResponseCommon> {
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(200, Math.max(1, Number(limit) || 20));
    return this.service.findAll(
      Number(req.user.idCliente),
      Number(req.user.rol),
      pageNum,
      limitNum,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un punto de interés' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({
    description: 'Detalle',
    schema: { example: { data: ITEM_EXAMPLE } },
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
    summary: 'Alternar estatus (activo ↔ inactivo)',
    description:
      'Sin body. Intercambia `estatus` entre `1` (activo) y `0` (inactivo).',
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
    summary: 'Actualizar punto de interés',
    description: [
      'Actualización parcial. Se puede cambiar `idCliente` (reasignar tenant).',
      'Roles **Cliente (6)** y **Usuario (9):** el `idCliente` queda fijado al del token.',
    ].join('\n'),
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: UpdatePuntoInteresDto })
  @ApiOkResponse({ description: 'Actualizado' })
  @ApiNotFoundResponse({ description: 'No encontrado o fuera de alcance' })
  @ApiForbiddenResponse({ description: 'Cliente destino fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePuntoInteresDto,
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
}
