import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CatTipoProductoService } from './cat-tipo-producto.service';

@ApiTags('Catálogos - Tipo Producto')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('cat-tipo-producto')
export class CatTipoProductoController {
  constructor(private readonly service: CatTipoProductoService) {}

  @Get('list')
  @ApiOperation({
    summary: 'Lista completa de tipos de producto',
    description: 'Catálogo `CatTipoProducto` (1 Vehículo, 2 Activo, 3 Inmueble, 4 Persona).',
  })
  @ApiQuery({
    name: 'soloActivos',
    required: false,
    description: 'Si true (default), solo retorna registros activos (estatus=1)',
  })
  @ApiResponse({ status: 200, description: 'Lista obtenida correctamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAllList(
    @Query('soloActivos') soloActivos?: string,
  ): Promise<ApiResponseCommon> {
    return this.service.findAllList(soloActivos !== 'false');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener tipo de producto por ID' })
  @ApiParam({ name: 'id', description: 'ID del tipo de producto' })
  @ApiResponse({ status: 200, description: 'Registro encontrado' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }
}
