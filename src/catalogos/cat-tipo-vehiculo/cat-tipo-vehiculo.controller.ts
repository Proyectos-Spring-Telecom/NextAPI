import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
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
import { CatTipoVehiculoService } from './cat-tipo-vehiculo.service';
import { CreateCatTipoVehiculoDto } from './dto/create-cat-tipo-vehiculo.dto';
import { UpdateCatTipoVehiculoDto } from './dto/update-cat-tipo-vehiculo.dto';
import { UpdateCatTipoVehiculoEstatusDto } from './dto/update-cat-tipo-vehiculo-estatus.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Catálogo Tipo Vehículo')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles() // o según permisos del módulo Vehículos
@Controller('cat-tipo-vehiculo')
export class CatTipoVehiculoController {
  constructor(
    private readonly catTipoVehiculoService: CatTipoVehiculoService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear tipo de vehículo' })
  @ApiResponse({ status: 201, description: 'Tipo de vehículo creado correctamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async create(
    @Body() dto: CreateCatTipoVehiculoDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.catTipoVehiculoService.create(dto, idUser);
  }

  @Get('list')
  @ApiOperation({ summary: 'Lista completa de tipos de vehículo' })
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
    return this.catTipoVehiculoService.findAllList(soloActivosBool);
  }

  @Get(':page/:limit')
  @ApiOperation({ summary: 'Lista paginada de tipos de vehículo' })
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
    return this.catTipoVehiculoService.findAll(
      page,
      limit,
      soloActivosBool,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener tipo de vehículo por ID' })
  @ApiParam({ name: 'id', description: 'ID del tipo de vehículo' })
  @ApiResponse({ status: 200, description: 'Tipo de vehículo encontrado' })
  @ApiResponse({ status: 404, description: 'Tipo de vehículo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.catTipoVehiculoService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar tipo de vehículo' })
  @ApiParam({ name: 'id', description: 'ID del tipo de vehículo' })
  @ApiResponse({ status: 200, description: 'Tipo de vehículo actualizado' })
  @ApiResponse({ status: 404, description: 'Tipo de vehículo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCatTipoVehiculoDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.catTipoVehiculoService.update(id, dto, idUser);
  }

  @Patch('estatus/:id')
  @ApiOperation({ summary: 'Cambiar estatus (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID del tipo de vehículo' })
  @ApiResponse({ status: 200, description: 'Estatus actualizado' })
  @ApiResponse({ status: 404, description: 'Tipo de vehículo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCatTipoVehiculoEstatusDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.catTipoVehiculoService.updateEstatus(id, dto, idUser);
  }
}
