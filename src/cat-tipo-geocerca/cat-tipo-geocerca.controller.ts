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
import { CatTipoGeocercaService } from './cat-tipo-geocerca.service';
import { CreateCatTipoGeocercaDto } from './dto/create-cat-tipo-geocerca.dto';
import { UpdateCatTipoGeocercaDto } from './dto/update-cat-tipo-geocerca.dto';
import { UpdateCatTipoGeocercaEstatusDto } from './dto/update-cat-tipo-geocerca-estatus.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Catálogo Tipo Geocerca')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles() // o según permisos del módulo Geocercas
@Controller('cat-tipo-geocerca')
export class CatTipoGeocercaController {
  constructor(
    private readonly catTipoGeocercaService: CatTipoGeocercaService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear tipo de geocerca' })
  @ApiResponse({ status: 201, description: 'Tipo de geocerca creado correctamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async create(
    @Body() dto: CreateCatTipoGeocercaDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.catTipoGeocercaService.create(dto, idUser);
  }

  @Get('list')
  @ApiOperation({ summary: 'Lista completa de tipos de geocerca' })
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
    return this.catTipoGeocercaService.findAllList(soloActivosBool);
  }

  @Get(':page/:limit')
  @ApiOperation({ summary: 'Lista paginada de tipos de geocerca' })
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
    return this.catTipoGeocercaService.findAll(
      page,
      limit,
      soloActivosBool,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener tipo de geocerca por ID' })
  @ApiParam({ name: 'id', description: 'ID del tipo de geocerca' })
  @ApiResponse({ status: 200, description: 'Tipo de geocerca encontrado' })
  @ApiResponse({ status: 404, description: 'Tipo de geocerca no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.catTipoGeocercaService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar tipo de geocerca' })
  @ApiParam({ name: 'id', description: 'ID del tipo de geocerca' })
  @ApiResponse({ status: 200, description: 'Tipo de geocerca actualizado' })
  @ApiResponse({ status: 404, description: 'Tipo de geocerca no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCatTipoGeocercaDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.catTipoGeocercaService.update(id, dto, idUser);
  }

  @Patch('estatus/:id')
  @ApiOperation({ summary: 'Cambiar estatus (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID del tipo de geocerca' })
  @ApiResponse({ status: 200, description: 'Estatus actualizado' })
  @ApiResponse({ status: 404, description: 'Tipo de geocerca no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCatTipoGeocercaEstatusDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.catTipoGeocercaService.updateEstatus(id, dto, idUser);
  }
}
