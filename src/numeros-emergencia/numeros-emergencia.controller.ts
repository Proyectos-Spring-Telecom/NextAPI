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
import { NumerosEmergenciaService } from './numeros-emergencia.service';
import { CreateNumeroEmergenciaDto } from './dto/create-numero-emergencia.dto';
import { UpdateNumeroEmergenciaDto } from './dto/update-numero-emergencia.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { EstatusEnum } from 'src/common/estatus.enum';

const ITEM_EXAMPLE = {
  id: 1,
  idCliente: 1,
  nombreCliente: 'Next',
  nombre: 'Central de monitoreo',
  telefono: '5512345678',
  descripcion: 'Línea 24/7',
  prioridad: 1,
  estatus: EstatusEnum.ACTIVO,
  fechaCreacion: '2026-09-08T18:00:00.000Z',
  fechaActualizacion: '2026-09-08T18:00:00.000Z',
};

@ApiTags('Números de emergencia')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('numeros-emergencia')
export class NumerosEmergenciaController {
  constructor(private readonly service: NumerosEmergenciaService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear número de emergencia',
    description: [
      'Alta con `estatus = ACTIVO (1)`.',
      '',
      '**idCliente:**',
      '- Roles **Cliente (6)** y **Usuario (9):** se toma del JWT.',
      '- Resto de roles: obligatorio en body y dentro del alcance.',
    ].join('\n'),
  })
  @ApiBody({ type: CreateNumeroEmergenciaDto })
  @ApiCreatedResponse({ description: 'Creado correctamente' })
  @ApiBadRequestResponse({ description: 'Datos inválidos' })
  @ApiForbiddenResponse({ description: 'Cliente fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async create(
    @Body() dto: CreateNumeroEmergenciaDto,
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
    summary: 'Lista de números de emergencia activos',
    description:
      'Solo `estatus = 1`. Orden por prioridad. Query opcional `idCliente`.',
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

  @Get('cliente/:idCliente')
  @ApiOperation({
    summary: 'Números de emergencia por idCliente',
    description:
      'Solo activos (`estatus = 1`). El `idCliente` debe estar en el alcance del rol.',
  })
  @ApiParam({ name: 'idCliente', type: Number })
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
  ): Promise<ApiResponseCommon> {
    return this.service.findByIdCliente(
      idCliente,
      Number(req.user.idCliente),
      Number(req.user.rol),
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Lista paginada de números de emergencia',
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
  @ApiOperation({ summary: 'Detalle de un número de emergencia' })
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
      'Sin body. Baja lógica: intercambia `estatus` entre `1` y `0`. No hay eliminado permanente.',
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
    summary: 'Actualizar número de emergencia',
    description: [
      'Actualización parcial.',
      'Roles **Cliente (6)** y **Usuario (9):** el `idCliente` queda fijado al del token.',
    ].join('\n'),
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: UpdateNumeroEmergenciaDto })
  @ApiOkResponse({ description: 'Actualizado' })
  @ApiNotFoundResponse({ description: 'No encontrado o fuera de alcance' })
  @ApiForbiddenResponse({ description: 'Cliente destino fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateNumeroEmergenciaDto,
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
