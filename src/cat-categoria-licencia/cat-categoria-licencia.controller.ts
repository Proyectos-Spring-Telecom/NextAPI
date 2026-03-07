import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Put,
  Request,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { CatCategoriaLicenciaService } from './cat-categoria-licencia.service';
import { CreateCatCategoriaLicenciaDto } from './dto/create-cat-categoria-licencia.dto';
import { UpdateCatCategoriaLicenciaDto } from './dto/update-cat-categoria-licencia.dto';
import { UpdateCatCategoriaLicenciaEstatusDto } from './dto/update-cat-categoria-licencia-estatus.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Catálogo Categoría Licencia')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('cat-categoria-licencia')
export class CatCategoriaLicenciaController {
  constructor(
    private readonly catCategoriaLicenciaService: CatCategoriaLicenciaService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear categoría de licencia' })
  @ApiResponse({ status: 201, description: 'Categoría creada correctamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async create(
    @Body() dto: CreateCatCategoriaLicenciaDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.catCategoriaLicenciaService.create(dto, idUser);
  }

  @Get('list')
  @ApiOperation({ summary: 'Lista completa de categorías de licencia' })
  @ApiQuery({
    name: 'soloActivos',
    required: false,
    description: 'Si true, solo retorna registros activos (estatus=1)',
  })
  @ApiResponse({ status: 200, description: 'Lista obtenida correctamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAllList(
    @Query('soloActivos') soloActivos?: string,
  ): Promise<ApiResponseCommon> {
    const soloActivosBool = soloActivos !== 'false';
    return this.catCategoriaLicenciaService.findAllList(soloActivosBool);
  }

  @Get(':page/:limit')
  @ApiOperation({ summary: 'Lista paginada de categorías de licencia' })
  @ApiParam({ name: 'page', description: 'Número de página' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiQuery({
    name: 'soloActivos',
    required: false,
    description: 'Si true, solo retorna registros activos',
  })
  @ApiResponse({ status: 200, description: 'Lista paginada obtenida' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Query('soloActivos') soloActivos?: string,
  ): Promise<ApiResponseCommon> {
    const soloActivosBool = soloActivos === 'true';
    return this.catCategoriaLicenciaService.findAll(
      page,
      limit,
      soloActivosBool,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener categoría por ID' })
  @ApiParam({ name: 'id', description: 'ID de la categoría' })
  @ApiResponse({ status: 200, description: 'Categoría encontrada' })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.catCategoriaLicenciaService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar categoría de licencia' })
  @ApiParam({ name: 'id', description: 'ID de la categoría' })
  @ApiResponse({ status: 200, description: 'Categoría actualizada' })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCatCategoriaLicenciaDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.catCategoriaLicenciaService.update(id, dto, idUser);
  }

  @Patch(':id/estatus')
  @ApiOperation({ summary: 'Cambiar estatus (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID de la categoría' })
  @ApiResponse({ status: 200, description: 'Estatus actualizado' })
  @ApiResponse({ status: 404, description: 'Categoría no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCatCategoriaLicenciaEstatusDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.catCategoriaLicenciaService.updateEstatus(id, dto, idUser);
  }
}
