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
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { CatModelosService } from './cat-modelos.service';
import { CreateCatModelosDto } from './dto/create-cat-modelos.dto';
import { UpdateCatModelosDto } from './dto/update-cat-modelos.dto';

@ApiTags('Catálogos - Modelos')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('cat-modelos')
export class CatModelosController {
  constructor(private readonly catModelosService: CatModelosService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear modelo',
    description: 'El estatus inicia en `EstatusEnum.ACTIVO` (1). No se envía en el body.',
  })
  @ApiResponse({ status: 201, description: 'Modelo creado correctamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 409, description: 'Modelo duplicado en la marca' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async create(
    @Body() dto: CreateCatModelosDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.catModelosService.create(dto, req.user.userId);
  }

  @Get('list')
  @ApiOperation({
    summary: 'Lista completa de modelos',
    description:
      'Solo registros con `estatus = 1`. Incluye `marca` (id, nombre, idProducto).',
  })
  @ApiQuery({
    name: 'idCatMarcas',
    required: false,
    description: 'Filtrar por marca',
  })
  @ApiResponse({ status: 200, description: 'Lista obtenida correctamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAllList(
    @Query('idCatMarcas') idCatMarcas?: string,
  ): Promise<ApiResponseCommon> {
    const marca = idCatMarcas ? Number(idCatMarcas) : undefined;
    return this.catModelosService.findAllList(
      Number.isFinite(marca) ? marca : undefined,
    );
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Lista paginada de modelos',
    description: 'Devuelve todos los registros (activos e inactivos).',
  })
  @ApiParam({ name: 'page', description: 'Número de página' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiQuery({ name: 'idCatMarcas', required: false })
  @ApiResponse({ status: 200, description: 'Lista paginada obtenida' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Query('idCatMarcas') idCatMarcas?: string,
  ): Promise<ApiResponseCommon> {
    const marca = idCatMarcas ? Number(idCatMarcas) : undefined;
    return this.catModelosService.findAll(
      page,
      limit,
      Number.isFinite(marca) ? marca : undefined,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener modelo por ID' })
  @ApiParam({ name: 'id', description: 'ID del modelo' })
  @ApiResponse({ status: 200, description: 'Modelo encontrado' })
  @ApiResponse({ status: 404, description: 'Modelo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.catModelosService.findOne(id);
  }

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Cambiar estatus',
    description: 'Alterna el estatus 1 ↔ 0. No requiere body.',
  })
  @ApiParam({ name: 'id', description: 'ID del modelo' })
  @ApiResponse({ status: 200, description: 'Estatus actualizado' })
  @ApiResponse({ status: 404, description: 'Modelo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.catModelosService.updateEstatus(id, req.user.userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar modelo' })
  @ApiParam({ name: 'id', description: 'ID del modelo' })
  @ApiResponse({ status: 200, description: 'Modelo actualizado' })
  @ApiResponse({ status: 404, description: 'Modelo no encontrado' })
  @ApiResponse({ status: 409, description: 'Modelo duplicado en la marca' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCatModelosDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.catModelosService.update(id, dto, req.user.userId);
  }
}
