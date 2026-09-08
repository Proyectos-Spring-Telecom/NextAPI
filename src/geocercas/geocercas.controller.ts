import {
  Body,
  Controller,
  Delete,
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
import { GeocercasService } from './geocercas.service';
import { CreateGeocercaDto } from './dto/create-geocerca.dto';
import { UpdateGeocercaDto } from './dto/update-geocerca.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { EstatusEnum } from 'src/common/estatus.enum';

const ITEM_EXAMPLE = {
  id: 1,
  idCliente: 1,
  nombreCliente: 'Next',
  idInstalacion: 10,
  nombre: 'Zona industrial norte',
  descripcion: 'Perímetro de la planta norte',
  geocerca: {
    type: 'Polygon',
    coordinates: [
      [
        [-99.14, 19.43],
        [-99.13, 19.43],
        [-99.13, 19.44],
        [-99.14, 19.44],
        [-99.14, 19.43],
      ],
    ],
  },
  estatus: EstatusEnum.ACTIVO,
  fechaCreacion: '2026-09-07T18:00:00.000Z',
  fechaActualizacion: '2026-09-07T18:00:00.000Z',
  usuariosGeocerca: [
    {
      id: 1,
      idUsuario: 5,
      nombreUsuario: 'Juan Pérez',
      estatus: 1,
    },
  ],
};

@ApiTags('Geocercas')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('geocercas')
export class GeocercasController {
  constructor(private readonly service: GeocercasService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear geocerca',
    description: [
      'Alta con `estatus = ACTIVO (1)`.',
      '',
      '**idCliente:**',
      '- Roles **Cliente (6)** y **Usuario (9):** se toma del JWT (se ignora el body).',
      '- Resto de roles: obligatorio en body y debe estar en el alcance del rol.',
      '',
      '**idInstalacion:** opcional; si se envía debe pertenecer al cliente.',
      '',
      '**usuariosIds:**',
      '- Roles **Cliente (6)** y **Usuario (9):** opcional; si se omite o `[]`, se vincula el usuario del token.',
      '- Resto de roles: obligatorio, al menos un usuario.',
    ].join('\n'),
  })  @ApiBody({ type: CreateGeocercaDto })
  @ApiCreatedResponse({ description: 'Creado correctamente' })
  @ApiBadRequestResponse({
    description: 'Datos inválidos / cliente o usuarios inexistentes',
  })
  @ApiForbiddenResponse({ description: 'Cliente fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async create(
    @Body() dto: CreateGeocercaDto,
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
    summary: 'Lista de geocercas activas',
    description:
      'Solo `estatus = 1`. Respeta alcance por rol. Query opcional `idCliente`.',
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
    summary: 'Lista paginada de geocercas',
    description: 'Incluye activos e inactivos. Alcance por rol del token.',
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
  @ApiOperation({ summary: 'Detalle de una geocerca' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({
    description: 'Detalle',
    schema: { example: { data: ITEM_EXAMPLE } },
  })
  @ApiNotFoundResponse({ description: 'No encontrada o fuera de alcance' })
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
  @ApiNotFoundResponse({ description: 'No encontrada o fuera de alcance' })
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
    summary: 'Actualizar geocerca',
    description: [
      'Actualización parcial.',
      'Roles **Cliente (6)** y **Usuario (9):** el `idCliente` queda fijado al del token.',
      '',
      '**usuariosIds:** misma lógica que `permisosIds` al actualizar usuario:',
      '- Omitir → no modifica `UsuariosGeocerca`.',
      '- Array (incl. `[]`) → lista definitiva (reactiva / crea / desactiva).',
    ].join('\n'),
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: UpdateGeocercaDto })
  @ApiOkResponse({ description: 'Actualizado' })
  @ApiNotFoundResponse({ description: 'No encontrada o fuera de alcance' })
  @ApiForbiddenResponse({ description: 'Cliente destino fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateGeocercaDto,
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

  @Delete(':id')
  @ApiOperation({
    summary: 'Eliminar geocerca permanentemente',
    description:
      'Borrado físico de la geocerca. Las filas de `UsuariosGeocerca` asociadas se eliminan en cascada.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ description: 'Eliminada permanentemente' })
  @ApiNotFoundResponse({ description: 'No encontrada o fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.service.remove(
      id,
      Number(req.user.idCliente),
      Number(req.user.rol),
      Number(req.user.userId),
    );
  }
}
