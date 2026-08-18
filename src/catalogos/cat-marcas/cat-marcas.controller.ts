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
import { EnumCatProducto } from 'src/common/estatus.enum';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { CatMarcasService } from './cat-marcas.service';
import { CreateCatMarcasDto } from './dto/create-cat-marcas.dto';
import { UpdateCatMarcasDto } from './dto/update-cat-marcas.dto';

@ApiTags('Catálogos - Marcas')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('cat-marcas')
export class CatMarcasController {
  constructor(private readonly catMarcasService: CatMarcasService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear marca',
    description: 'El estatus inicia en `EstatusEnum.ACTIVO` (1). No se envía en el body.',
  })
  @ApiResponse({ status: 201, description: 'Marca creada correctamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 409, description: 'Nombre duplicado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async create(
    @Body() dto: CreateCatMarcasDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.catMarcasService.create(dto, req.user.userId);
  }

  @Get('list')
  @ApiOperation({
    summary: 'Lista completa de marcas',
    description:
      'Solo registros con `estatus = 1`. Incluye `producto` (id y nombre de CatProductos).',
  })
  @ApiQuery({
    name: 'idProducto',
    required: false,
    enum: EnumCatProducto,
    enumName: 'EnumCatProducto',
    description:
      'Filtrar por CatProductos: 1 Dispositivo, 2 Vehiculo, 3 Activo, 4 Telefono, 5 Panel',
    example: EnumCatProducto.VEHICULO,
  })
  @ApiResponse({ status: 200, description: 'Lista obtenida correctamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAllList(
    @Query('idProducto') idProducto?: string,
  ): Promise<ApiResponseCommon> {
    const tipo = idProducto ? Number(idProducto) : undefined;
    return this.catMarcasService.findAllList(
      Number.isFinite(tipo) ? tipo : undefined,
    );
  }

  @Get(':id/modelos')
  @ApiOperation({ summary: 'Listar modelos de una marca' })
  @ApiParam({ name: 'id', description: 'ID de la marca' })
  @ApiQuery({ name: 'soloActivos', required: false })
  @ApiResponse({ status: 200, description: 'Lista de modelos' })
  @ApiResponse({ status: 404, description: 'Marca no encontrada' })
  async findModelos(
    @Param('id', ParseIntPipe) id: number,
    @Query('soloActivos') soloActivos?: string,
  ) {
    return this.catMarcasService.findModelosByMarca(
      id,
      soloActivos !== 'false',
    );
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Lista paginada de marcas',
    description: 'Devuelve todos los registros (activos e inactivos).',
  })
  @ApiParam({ name: 'page', description: 'Número de página' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiQuery({
    name: 'idProducto',
    required: false,
    enum: EnumCatProducto,
    enumName: 'EnumCatProducto',
    description:
      'Filtrar por CatProductos: 1 Dispositivo, 2 Vehiculo, 3 Activo, 4 Telefono, 5 Panel',
    example: EnumCatProducto.VEHICULO,
  })
  @ApiResponse({ status: 200, description: 'Lista paginada obtenida' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Query('idProducto') idProducto?: string,
  ): Promise<ApiResponseCommon> {
    const tipo = idProducto ? Number(idProducto) : undefined;
    return this.catMarcasService.findAll(
      page,
      limit,
      Number.isFinite(tipo) ? tipo : undefined,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener marca por ID' })
  @ApiParam({ name: 'id', description: 'ID de la marca' })
  @ApiResponse({ status: 200, description: 'Marca encontrada' })
  @ApiResponse({ status: 404, description: 'Marca no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.catMarcasService.findOne(id);
  }

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Cambiar estatus',
    description: 'Alterna el estatus 1 ↔ 0. No requiere body.',
  })
  @ApiParam({ name: 'id', description: 'ID de la marca' })
  @ApiResponse({ status: 200, description: 'Estatus actualizado' })
  @ApiResponse({ status: 404, description: 'Marca no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.catMarcasService.updateEstatus(id, req.user.userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar marca' })
  @ApiParam({ name: 'id', description: 'ID de la marca' })
  @ApiResponse({ status: 200, description: 'Marca actualizada' })
  @ApiResponse({ status: 404, description: 'Marca no encontrada' })
  @ApiResponse({ status: 409, description: 'Nombre duplicado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCatMarcasDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.catMarcasService.update(id, dto, req.user.userId);
  }
}
