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
import { CatPlanesTelefoniaService } from './cat-planes-telefonia.service';
import { CreateCatPlanesTelefoniaDto } from './dto/create-cat-planes-telefonia.dto';
import { UpdateCatPlanesTelefoniaDto } from './dto/update-cat-planes-telefonia.dto';
import { UpdateCatPlanesTelefoniaEstatusDto } from './dto/update-cat-planes-telefonia-estatus.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Catálogo Planes Telefonía')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('cat-planes-telefonia')
export class CatPlanesTelefoniaController {
  constructor(
    private readonly catPlanesTelefoniaService: CatPlanesTelefoniaService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear plan de telefonía' })
  @ApiResponse({ status: 201, description: 'Plan creado correctamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async create(
    @Body() dto: CreateCatPlanesTelefoniaDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.catPlanesTelefoniaService.create(dto, idUser);
  }

  @Get('list')
  @ApiOperation({ summary: 'Lista completa de planes de telefonía' })
  @ApiQuery({
    name: 'soloActivos',
    required: false,
    description: 'Si true, solo retorna registros activos (estatus=1)',
  })
  @ApiQuery({
    name: 'idTelefonia',
    required: false,
    description: 'Filtrar por ID de operador de telefonía (CatTelefonia)',
  })
  @ApiResponse({ status: 200, description: 'Lista obtenida correctamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAllList(
    @Query('soloActivos') soloActivos?: string,
    @Query('idTelefonia') idTelefonia?: string,
  ): Promise<ApiResponseCommon> {
    const soloActivosBool = soloActivos !== 'false';
    const idTelefoniaParsed =
      idTelefonia !== undefined && idTelefonia !== ''
        ? parseInt(idTelefonia, 10)
        : NaN;
    const idTelefoniaNum = !isNaN(idTelefoniaParsed) ? idTelefoniaParsed : undefined;
    return this.catPlanesTelefoniaService.findAllList(
      soloActivosBool,
      idTelefoniaNum,
    );
  }

  @Get(':page/:limit')
  @ApiOperation({ summary: 'Lista paginada de planes de telefonía' })
  @ApiParam({ name: 'page', description: 'Número de página' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiQuery({
    name: 'soloActivos',
    required: false,
    description: 'Si true, solo retorna registros activos',
  })
  @ApiQuery({
    name: 'idTelefonia',
    required: false,
    description: 'Filtrar por ID de operador de telefonía',
  })
  @ApiResponse({ status: 200, description: 'Lista paginada obtenida' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Query('soloActivos') soloActivos?: string,
    @Query('idTelefonia') idTelefonia?: string,
  ): Promise<ApiResponseCommon> {
    const soloActivosBool = soloActivos === 'true';
    const idTelefoniaParsed =
      idTelefonia !== undefined && idTelefonia !== ''
        ? parseInt(idTelefonia, 10)
        : NaN;
    const idTelefoniaNum = !isNaN(idTelefoniaParsed) ? idTelefoniaParsed : undefined;
    return this.catPlanesTelefoniaService.findAll(
      page,
      limit,
      soloActivosBool,
      idTelefoniaNum,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener plan por ID' })
  @ApiParam({ name: 'id', description: 'ID del plan' })
  @ApiResponse({ status: 200, description: 'Plan encontrado' })
  @ApiResponse({ status: 404, description: 'Plan no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.catPlanesTelefoniaService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar plan de telefonía' })
  @ApiParam({ name: 'id', description: 'ID del plan' })
  @ApiResponse({ status: 200, description: 'Plan actualizado' })
  @ApiResponse({ status: 404, description: 'Plan no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCatPlanesTelefoniaDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.catPlanesTelefoniaService.update(id, dto, idUser);
  }

  @Patch(':id/estatus')
  @ApiOperation({ summary: 'Cambiar estatus (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID del plan' })
  @ApiResponse({ status: 200, description: 'Estatus actualizado' })
  @ApiResponse({ status: 404, description: 'Plan no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCatPlanesTelefoniaEstatusDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.catPlanesTelefoniaService.updateEstatus(id, dto, idUser);
  }
}
