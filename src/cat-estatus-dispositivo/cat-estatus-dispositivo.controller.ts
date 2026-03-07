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
import { CatEstatusDispositivoService } from './cat-estatus-dispositivo.service';
import { CreateCatEstatusDispositivoDto } from './dto/create-cat-estatus-dispositivo.dto';
import { UpdateCatEstatusDispositivoDto } from './dto/update-cat-estatus-dispositivo.dto';
import { UpdateCatEstatusDispositivoEstatusDto } from './dto/update-cat-estatus-dispositivo-estatus.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Catálogo Estatus Dispositivo')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('cat-estatus-dispositivo')
export class CatEstatusDispositivoController {
  constructor(
    private readonly catEstatusDispositivoService: CatEstatusDispositivoService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear estatus de dispositivo' })
  @ApiResponse({ status: 201, description: 'Estatus creado correctamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async create(
    @Body() dto: CreateCatEstatusDispositivoDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.catEstatusDispositivoService.create(dto, idUser);
  }

  @Get('list')
  @ApiOperation({ summary: 'Lista completa de estatus de dispositivo' })
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
    return this.catEstatusDispositivoService.findAllList(soloActivosBool);
  }

  @Get(':page/:limit')
  @ApiOperation({ summary: 'Lista paginada de estatus de dispositivo' })
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
    return this.catEstatusDispositivoService.findAll(
      page,
      limit,
      soloActivosBool,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener estatus por ID' })
  @ApiParam({ name: 'id', description: 'ID del estatus' })
  @ApiResponse({ status: 200, description: 'Estatus encontrado' })
  @ApiResponse({ status: 404, description: 'Estatus no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.catEstatusDispositivoService.findOne(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar estatus de dispositivo' })
  @ApiParam({ name: 'id', description: 'ID del estatus' })
  @ApiResponse({ status: 200, description: 'Estatus actualizado' })
  @ApiResponse({ status: 404, description: 'Estatus no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCatEstatusDispositivoDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.catEstatusDispositivoService.update(id, dto, idUser);
  }

  @Patch(':id/estatus')
  @ApiOperation({ summary: 'Cambiar estatus (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID del estatus' })
  @ApiResponse({ status: 200, description: 'Estatus actualizado' })
  @ApiResponse({ status: 404, description: 'Estatus no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCatEstatusDispositivoEstatusDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.catEstatusDispositivoService.updateEstatus(id, dto, idUser);
  }
}
