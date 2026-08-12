import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { EnumTipoProducto } from 'src/common/estatus.enum';
import { ProductosService } from './productos.service';
import { UpdateProductosDto } from './dto/update-productos.dto';
import { UpdateProductoEstatusDto } from './dto/update-producto-estatus.dto';

@ApiTags('Productos')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('productos')
export class ProductosController {
  constructor(private readonly productosService: ProductosService) {}

  @Get('list')
  @ApiOperation({
    summary: 'Lista completa de productos',
    description:
      'Lista productos del cliente. Opcionalmente filtra por tipo (vehículo, inmueble, persona, activo).',
  })
  @ApiQuery({
    name: 'idTipoProducto',
    required: false,
    enum: EnumTipoProducto,
    description: 'Filtrar por CatTipoProducto.Id',
  })
  @ApiResponse({ status: 200, description: 'Lista obtenida correctamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAllList(
    @Request() req,
    @Query('idTipoProducto') idTipoProducto?: string,
  ): Promise<ApiResponseCommon> {
    const tipo = idTipoProducto ? Number(idTipoProducto) : undefined;
    return this.productosService.findAllList(
      req.user.idCliente,
      req.user.rol,
      Number.isFinite(tipo) ? tipo : undefined,
    );
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Lista paginada de productos',
    description: 'Lista paginada. Alcance según rol del token.',
  })
  @ApiParam({ name: 'page', description: 'Número de página' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiQuery({
    name: 'idTipoProducto',
    required: false,
    enum: EnumTipoProducto,
  })
  @ApiResponse({ status: 200, description: 'Lista paginada obtenida' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Request() req,
    @Query('idTipoProducto') idTipoProducto?: string,
  ): Promise<ApiResponseCommon> {
    const tipo = idTipoProducto ? Number(idTipoProducto) : undefined;
    return this.productosService.findAll(
      req.user.idCliente,
      req.user.rol,
      page,
      limit,
      Number.isFinite(tipo) ? tipo : undefined,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener producto por ID' })
  @ApiParam({ name: 'id', description: 'ID del producto' })
  @ApiResponse({ status: 200, description: 'Producto encontrado' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.productosService.findOne(id, req.user.idCliente);
  }

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Cambiar estatus',
    description:
      'Establece el estatus del producto. Body requerido: `{ "estatus": 0 | 1 }`.',
  })
  @ApiParam({ name: 'id', description: 'ID del producto' })
  @ApiBody({ type: UpdateProductoEstatusDto })
  @ApiResponse({ status: 200, description: 'Estatus actualizado' })
  @ApiResponse({ status: 400, description: 'estatus inválido' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductoEstatusDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.productosService.updateEstatus(
      id,
      dto,
      req.user.idCliente,
      req.user.userId,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar nombre del producto' })
  @ApiParam({ name: 'id', description: 'ID del producto' })
  @ApiResponse({ status: 200, description: 'Producto actualizado' })
  @ApiResponse({ status: 404, description: 'Producto no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductosDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.productosService.update(
      id,
      dto,
      req.user.idCliente,
      req.user.userId,
    );
  }
}
