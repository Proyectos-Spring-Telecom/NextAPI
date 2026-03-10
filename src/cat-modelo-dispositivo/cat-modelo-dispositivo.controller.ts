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
import { CatModeloDispositivoService } from './cat-modelo-dispositivo.service';
import { CreateCatModeloDispositivoDto } from './dto/create-cat-modelo-dispositivo.dto';
import { UpdateCatModeloDispositivoDto } from './dto/update-cat-modelo-dispositivo.dto';
import { UpdateCatModeloDispositivoEstatusDto } from './dto/update-cat-modelo-dispositivo-estatus.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Catálogo Modelo Dispositivo')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('cat-modelo-dispositivo')
export class CatModeloDispositivoController {
  constructor(
    private readonly catModeloDispositivoService: CatModeloDispositivoService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear modelo de dispositivo' })
  @ApiResponse({ status: 201, description: 'Modelo creado correctamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async create(
    @Body() dto: CreateCatModeloDispositivoDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.catModeloDispositivoService.create(dto, idUser);
  }

  @Get('list')
  @ApiOperation({ summary: 'Lista completa de modelos de dispositivo' })
  @ApiQuery({
    name: 'soloActivos',
    required: false,
    description: 'Si true, solo retorna registros activos (estatus=1)',
  })
  @ApiQuery({
    name: 'idMarca',
    required: false,
    description: 'Filtrar por ID de marca de dispositivo (CatMarcaDispositivo)',
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
    return this.catModeloDispositivoService.findAllList(
      soloActivosBool,
      idMarcaNum,
    );
  }

  @Get(':page/:limit')
  @ApiOperation({ summary: 'Lista paginada de modelos de dispositivo' })
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
    description: 'Filtrar por ID de marca de dispositivo',
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
    return this.catModeloDispositivoService.findAll(
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
    return this.catModeloDispositivoService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar modelo de dispositivo' })
  @ApiParam({ name: 'id', description: 'ID del modelo' })
  @ApiResponse({ status: 200, description: 'Modelo actualizado' })
  @ApiResponse({ status: 404, description: 'Modelo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCatModeloDispositivoDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.catModeloDispositivoService.update(id, dto, idUser);
  }

  @Patch('estatus/:id')
  @ApiOperation({ summary: 'Cambiar estatus (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID del modelo' })
  @ApiResponse({ status: 200, description: 'Estatus actualizado' })
  @ApiResponse({ status: 404, description: 'Modelo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCatModeloDispositivoEstatusDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.catModeloDispositivoService.updateEstatus(id, dto, idUser);
  }
}
