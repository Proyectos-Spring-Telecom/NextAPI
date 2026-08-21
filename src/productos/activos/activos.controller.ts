import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { ActivosService } from './activos.service';
import { CreateActivosDto } from './dto/create-activos.dto';
import { UpdateActivosDto } from './dto/update-activos.dto';
import { UpdateProductoEstatusDto } from '../dto/update-producto-estatus.dto';

@ApiTags('Productos - Activos')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('productos/activos')
export class ActivosController {
  constructor(private readonly activosService: ActivosService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear activo',
    description:
      'Crea el producto (tipo ACTIVO) y el detalle de activo en una transacción. ' +
      'Requiere `idCliente` en el body. El estatus inicia en ACTIVO.',
  })
  @ApiResponse({ status: 201, description: 'Activo creado correctamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async create(
    @Body() dto: CreateActivosDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.activosService.create(dto, req.user.userId);
  }

  @Get('list')
  @ApiOperation({
    summary: 'Lista completa de activos',
    description: 'Incluye cliente y producto (nombre y tipo).',
  })
  @ApiResponse({ status: 200, description: 'Lista obtenida correctamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAllList(@Request() req): Promise<ApiResponseCommon> {
    return this.activosService.findAllList(req.user.idCliente, req.user.rol);
  }

  @Get(':page/:limit')
  @ApiOperation({ summary: 'Lista paginada de activos' })
  @ApiParam({ name: 'page', description: 'Número de página' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiResponse({ status: 200, description: 'Lista paginada obtenida' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    return this.activosService.findAll(
      req.user.idCliente,
      req.user.rol,
      page,
      limit,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener activo por ID de producto' })
  @ApiParam({ name: 'id', description: 'ID del producto / activo' })
  @ApiResponse({ status: 200, description: 'Activo encontrado' })
  @ApiResponse({ status: 404, description: 'Activo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.activosService.findOne(id, req.user.idCliente);
  }

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Cambiar estatus',
    description:
      'Establece el estatus del producto. Body: `{ "estatus": 0|1|2|3|4|5 }` ' +
      '(0=inactivo, 1=activo/disponible, 2=asignado, 3=baja_remplazo, 4=baja_mantenimiento, 5=inservible). ' +
      'Si el estatus actual es 2 (asignado a una instalación), la operación se rechaza.',
  })
  @ApiParam({ name: 'id', description: 'ID del producto / activo' })
  @ApiBody({ type: UpdateProductoEstatusDto })
  @ApiResponse({ status: 200, description: 'Estatus actualizado' })
  @ApiResponse({
    status: 400,
    description: 'estatus inválido o producto asignado a una instalación',
  })
  @ApiResponse({ status: 404, description: 'Activo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductoEstatusDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.activosService.updateEstatus(
      id,
      dto,
      req.user.idCliente,
      req.user.userId,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar activo' })
  @ApiParam({ name: 'id', description: 'ID del producto / activo' })
  @ApiResponse({ status: 200, description: 'Activo actualizado' })
  @ApiResponse({ status: 404, description: 'Activo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateActivosDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.activosService.update(
      id,
      dto,
      req.user.idCliente,
      req.user.userId,
    );
  }
}
