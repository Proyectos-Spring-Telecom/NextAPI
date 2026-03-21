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
import { CatModeloVehiculoService } from './cat-modelo-vehiculo.service';
import { CreateCatModeloVehiculoDto } from './dto/create-cat-modelo-vehiculo.dto';
import { UpdateCatModeloVehiculoDto } from './dto/update-cat-modelo-vehiculo.dto';
import { UpdateCatModeloVehiculoEstatusDto } from './dto/update-cat-modelo-vehiculo-estatus.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Catálogo Modelo Vehículo')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles() // según permisos del módulo Vehículos
@Controller('cat-modelo-vehiculo')
export class CatModeloVehiculoController {
  constructor(
    private readonly catModeloVehiculoService: CatModeloVehiculoService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear modelo de vehículo' })
  @ApiResponse({ status: 201, description: 'Modelo creado correctamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async create(
    @Body() dto: CreateCatModeloVehiculoDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.catModeloVehiculoService.create(dto, idUser);
  }

  @Get('list')
  @ApiOperation({ summary: 'Lista completa de modelos de vehículo' })
  @ApiQuery({
    name: 'soloActivos',
    required: false,
    description: 'Si true, solo retorna registros activos (estatus=1)',
  })
  @ApiQuery({
    name: 'idMarca',
    required: false,
    description: 'Filtrar por ID de marca de vehículo (CatMarcaVehiculo)',
  })
  @ApiResponse({ status: 200, description: 'Lista obtenida correctamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAllList(
    @Query('soloActivos') soloActivos?: string,
    @Query('idMarca') idMarca?: string,
  ): Promise<ApiResponseCommon> {
    const soloActivosBool = soloActivos !== 'false';
    const idMarcaParsed =
      idMarca !== undefined && idMarca !== ''
        ? parseInt(idMarca, 10)
        : NaN;
    const idMarcaNum = !isNaN(idMarcaParsed) ? idMarcaParsed : undefined;
    return this.catModeloVehiculoService.findAllList(
      soloActivosBool,
      idMarcaNum,
    );
  }

  @Get(':page/:limit')
  @ApiOperation({ summary: 'Lista paginada de modelos de vehículo' })
  @ApiParam({ name: 'page', description: 'Número de página' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiQuery({
    name: 'soloActivos',
    required: false,
    description: 'Si true, solo retorna registros activos',
  })
  @ApiQuery({
    name: 'idMarca',
    required: false,
    description: 'Filtrar por ID de marca de vehículo',
  })
  @ApiResponse({ status: 200, description: 'Lista paginada obtenida' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Query('soloActivos') soloActivos?: string,
    @Query('idMarca') idMarca?: string,
  ): Promise<ApiResponseCommon> {
    const soloActivosBool = soloActivos === 'true';
    const idMarcaParsed =
      idMarca !== undefined && idMarca !== ''
        ? parseInt(idMarca, 10)
        : NaN;
    const idMarcaNum = !isNaN(idMarcaParsed) ? idMarcaParsed : undefined;
    return this.catModeloVehiculoService.findAll(
      page,
      limit,
      soloActivosBool,
      idMarcaNum,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener modelo por ID' })
  @ApiParam({ name: 'id', description: 'ID del modelo' })
  @ApiResponse({ status: 200, description: 'Modelo encontrado' })
  @ApiResponse({ status: 404, description: 'Modelo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.catModeloVehiculoService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar modelo de vehículo' })
  @ApiParam({ name: 'id', description: 'ID del modelo' })
  @ApiResponse({ status: 200, description: 'Modelo actualizado' })
  @ApiResponse({ status: 404, description: 'Modelo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCatModeloVehiculoDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.catModeloVehiculoService.update(id, dto, idUser);
  }

  @Patch('estatus/:id')
  @ApiOperation({ summary: 'Cambiar estatus (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID del modelo' })
  @ApiResponse({ status: 200, description: 'Estatus actualizado' })
  @ApiResponse({ status: 404, description: 'Modelo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCatModeloVehiculoEstatusDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.catModeloVehiculoService.updateEstatus(id, dto, idUser);
  }
}
