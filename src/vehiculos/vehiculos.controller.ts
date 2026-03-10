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
import { VehiculosService } from './vehiculos.service';
import { CreateVehiculosDto } from './dto/create-vehiculos.dto';
import { UpdateVehiculosDto } from './dto/update-vehiculos.dto';
import { UpdateVehiculosEstatusDto } from './dto/update-vehiculos-estatus.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Vehiculos')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('vehiculos')
export class VehiculosController {
  constructor(
    private readonly vehiculosService: VehiculosService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear vehículo' })
  @ApiResponse({ status: 201, description: 'Vehículo creado correctamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async create(
    @Body() dto: CreateVehiculosDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idCliente = req.user.idCliente;
    const idUser = req.user.userId;
    return this.vehiculosService.create(dto, idCliente, idUser);
  }

  @Get('list')
  @ApiOperation({ summary: 'Lista completa de vehículos' })
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
    return this.vehiculosService.findAllList(idCliente, soloActivosBool);
  }

  @Get(':page/:limit')
  @ApiOperation({ summary: 'Lista paginada de vehículos' })
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
    return this.vehiculosService.findAll(
      idCliente,
      page,
      limit,
      soloActivosBool,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener vehículo por ID' })
  @ApiParam({ name: 'id', description: 'ID del vehículo' })
  @ApiResponse({ status: 200, description: 'Vehículo encontrado' })
  @ApiResponse({ status: 404, description: 'Vehículo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    const idCliente = req.user.idCliente;
    return this.vehiculosService.findOne(id, idCliente);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar vehículo' })
  @ApiParam({ name: 'id', description: 'ID del vehículo' })
  @ApiResponse({ status: 200, description: 'Vehículo actualizado' })
  @ApiResponse({ status: 404, description: 'Vehículo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVehiculosDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idCliente = req.user.idCliente;
    const idUser = req.user.userId;
    return this.vehiculosService.update(id, dto, idCliente, idUser);
  }

  @Patch('estatus/:id')
  @ApiOperation({ summary: 'Cambiar estatus (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID del vehículo' })
  @ApiResponse({ status: 200, description: 'Estatus actualizado' })
  @ApiResponse({ status: 404, description: 'Vehículo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVehiculosEstatusDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idCliente = req.user.idCliente;
    const idUser = req.user.userId;
    return this.vehiculosService.updateEstatus(id, dto, idCliente, idUser);
  }
}
