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
import { CatTipoDispositivoService } from './cat-tipo-dispositivo.service';
import { CreateCatTipoDispositivoDto } from './dto/create-cat-tipo-dispositivo.dto';
import { UpdateCatTipoDispositivoDto } from './dto/update-cat-tipo-dispositivo.dto';
import { UpdateCatTipoDispositivoEstatusDto } from './dto/update-cat-tipo-dispositivo-estatus.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Catálogo Tipo Dispositivo')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles() // o según permisos del módulo Dispositivos
@Controller('cat-tipo-dispositivo')
export class CatTipoDispositivoController {
  constructor(
    private readonly catTipoDispositivoService: CatTipoDispositivoService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear tipo de dispositivo' })
  @ApiResponse({ status: 201, description: 'Tipo de dispositivo creado correctamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async create(
    @Body() dto: CreateCatTipoDispositivoDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.catTipoDispositivoService.create(dto, idUser);
  }

  @Get('list')
  @ApiOperation({ summary: 'Lista completa de tipos de dispositivo' })
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
    return this.catTipoDispositivoService.findAllList(soloActivosBool);
  }

  @Get(':page/:limit')
  @ApiOperation({ summary: 'Lista paginada de tipos de dispositivo' })
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
    return this.catTipoDispositivoService.findAll(
      page,
      limit,
      soloActivosBool,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener tipo de dispositivo por ID' })
  @ApiParam({ name: 'id', description: 'ID del tipo de dispositivo' })
  @ApiResponse({ status: 200, description: 'Tipo de dispositivo encontrado' })
  @ApiResponse({ status: 404, description: 'Tipo de dispositivo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.catTipoDispositivoService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar tipo de dispositivo' })
  @ApiParam({ name: 'id', description: 'ID del tipo de dispositivo' })
  @ApiResponse({ status: 200, description: 'Tipo de dispositivo actualizado' })
  @ApiResponse({ status: 404, description: 'Tipo de dispositivo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCatTipoDispositivoDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.catTipoDispositivoService.update(id, dto, idUser);
  }

  @Patch('estatus/:id')
  @ApiOperation({ summary: 'Cambiar estatus (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID del tipo de dispositivo' })
  @ApiResponse({ status: 200, description: 'Estatus actualizado' })
  @ApiResponse({ status: 404, description: 'Tipo de dispositivo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCatTipoDispositivoEstatusDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.catTipoDispositivoService.updateEstatus(id, dto, idUser);
  }
}
