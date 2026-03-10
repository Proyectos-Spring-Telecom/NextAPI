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
import { InstalacionesService } from './instalaciones.service';
import { CreateInstalacionesDto } from './dto/create-instalaciones.dto';
import { UpdateInstalacionesDto } from './dto/update-instalaciones.dto';
import { UpdateInstalacionesEstatusDto } from './dto/update-instalaciones-estatus.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Instalaciones')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('instalaciones')
export class InstalacionesController {
  constructor(
    private readonly instalacionesService: InstalacionesService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear instalación' })
  @ApiResponse({ status: 201, description: 'Instalación creada correctamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async create(
    @Body() dto: CreateInstalacionesDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idCliente = req.user.idCliente;
    const idUser = req.user.userId;
    return this.instalacionesService.create(dto, idCliente, idUser);
  }

  @Get('list')
  @ApiOperation({ summary: 'Lista completa de instalaciones' })
  @ApiQuery({
    name: 'soloActivos',
    required: false,
    description: 'Si true, solo retorna registros activos (estatus=1)',
  })
  @ApiResponse({ status: 200, description: 'Lista obtenida correctamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAllList(
    @Request() req,
    @Query('soloActivos') soloActivos?: string,
  ): Promise<ApiResponseCommon> {
    const idCliente = req.user.idCliente;
    const soloActivosBool = soloActivos !== 'false';
    return this.instalacionesService.findAllList(idCliente, soloActivosBool);
  }

  @Get(':page/:limit')
  @ApiOperation({ summary: 'Lista paginada de instalaciones' })
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
    @Request() req,
    @Query('soloActivos') soloActivos?: string,
  ): Promise<ApiResponseCommon> {
    const idCliente = req.user.idCliente;
    const soloActivosBool = soloActivos === 'true';
    return this.instalacionesService.findAll(
      idCliente,
      page,
      limit,
      soloActivosBool,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener instalación por ID' })
  @ApiParam({ name: 'id', description: 'ID de la instalación' })
  @ApiResponse({ status: 200, description: 'Instalación encontrada' })
  @ApiResponse({ status: 404, description: 'Instalación no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    const idCliente = req.user.idCliente;
    return this.instalacionesService.findOne(id, idCliente);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar instalación' })
  @ApiParam({ name: 'id', description: 'ID de la instalación' })
  @ApiResponse({ status: 200, description: 'Instalación actualizada' })
  @ApiResponse({ status: 404, description: 'Instalación no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInstalacionesDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idCliente = req.user.idCliente;
    const idUser = req.user.userId;
    return this.instalacionesService.update(id, dto, idCliente, idUser);
  }

  @Patch('estatus/:id')
  @ApiOperation({ summary: 'Cambiar estatus (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID de la instalación' })
  @ApiResponse({ status: 200, description: 'Estatus actualizado' })
  @ApiResponse({ status: 404, description: 'Instalación no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInstalacionesEstatusDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idCliente = req.user.idCliente;
    const idUser = req.user.userId;
    return this.instalacionesService.updateEstatus(id, dto, idCliente, idUser);
  }
}
