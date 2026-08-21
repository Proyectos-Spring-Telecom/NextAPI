import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Request,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiBody,
  ApiConsumes,
} from '@nestjs/swagger';
import { VehiculosService } from './vehiculos.service';
import { CreateVehiculosDto } from './dto/create-vehiculos.dto';
import { UpdateVehiculosDto } from './dto/update-vehiculos.dto';
import { UpdateProductoEstatusDto } from '../dto/update-producto-estatus.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import {
  vehiculosFileFieldsInterceptor,
  StripEmptyVehiculoFileFieldsInterceptor,
} from './vehiculos-upload.interceptor';
import type { VehiculosUploadFiles } from './vehiculos-upload.interceptor';
import {
  vehiculosCreateMultipartApiBody,
  vehiculosUpdateMultipartApiBody,
} from './vehiculos-swagger-multipart';

@ApiTags('Productos - Vehículos')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('productos/vehiculos')
export class VehiculosController {
  constructor(private readonly vehiculosService: VehiculosService) {}

  @Post()
  @UseInterceptors(
    vehiculosFileFieldsInterceptor(),
    StripEmptyVehiculoFileFieldsInterceptor,
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody(vehiculosCreateMultipartApiBody)
  @ApiOperation({
    summary: 'Crear vehículo',
    description:
      'Crea el producto (tipo VEHICULO) y el detalle de vehículo en una transacción. ' +
      'Requiere `idCliente` en el body. El estatus inicia en ACTIVO.',
  })
  @ApiResponse({ status: 201, description: 'Vehículo creado correctamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async create(
    @Body() dto: CreateVehiculosDto,
    @UploadedFiles() files: VehiculosUploadFiles,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.vehiculosService.create(dto, req.user.userId, files);
  }

  @Get('list')
  @ApiOperation({
    summary: 'Lista completa de vehículos',
    description:
      'Lista plana de vehículos activos (Estatus=1), sin JSON anidados.',
  })
  @ApiResponse({ status: 200, description: 'Lista obtenida correctamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAllList(@Request() req): Promise<ApiResponseCommon> {
    const idCliente = req.user.idCliente;
    const rol = req.user.rol;
    return this.vehiculosService.findAllList(idCliente, rol);
  }

  @Get('placa/:placa')
  @ApiOperation({
    summary: 'Obtener vehículo por placa',
    description:
      'Solo vehículos activos (Estatus=1). Misma regla de tenant que el resto de listados: roles 1–2 sin filtro IdCliente; 3–4 IdCliente en jerarquía (spGetClientes); 5–6 solo token. Si en el ámbito hay más de un registro con la misma placa, responde 400.',
  })
  @ApiParam({ name: 'placa', description: 'Placa del vehículo' })
  @ApiResponse({ status: 200, description: 'Vehículo encontrado' })
  @ApiResponse({ status: 400, description: 'Placa inválida' })
  @ApiResponse({ status: 404, description: 'Vehículo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findOneByPlaca(@Param('placa') placa: string, @Request() req) {
    const idCliente = req.user.idCliente;
    const rol = req.user.rol;
    return this.vehiculosService.findOneByPlaca(placa, idCliente, rol);
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Lista paginada de vehículos',
    description:
      'Lista plana de vehículos (activos e inactivos), sin JSON anidados.',
  })
  @ApiParam({ name: 'page', description: 'Número de página' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiResponse({ status: 200, description: 'Lista paginada obtenida' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    const idCliente = req.user.idCliente;
    const rol = req.user.rol;
    return this.vehiculosService.findAll(idCliente, rol, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener vehículo por ID' })
  @ApiParam({ name: 'id', description: 'ID del vehículo' })
  @ApiResponse({ status: 200, description: 'Vehículo encontrado' })
  @ApiResponse({ status: 404, description: 'Vehículo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    const idCliente = req.user.idCliente;
    return this.vehiculosService.findOne(id, idCliente);
  }

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Cambiar estatus',
    description:
      'Establece el estatus del producto. Body: `{ "estatus": 0|1|2|3|4|5 }` ' +
      '(0=inactivo, 1=activo/disponible, 2=asignado, 3=baja_remplazo, 4=baja_mantenimiento, 5=inservible). ' +
      'Si el estatus actual es 2 (asignado a una instalación), la operación se rechaza.',
  })
  @ApiParam({ name: 'id', description: 'ID del vehículo' })
  @ApiBody({ type: UpdateProductoEstatusDto })
  @ApiResponse({ status: 200, description: 'Estatus actualizado' })
  @ApiResponse({
    status: 400,
    description: 'estatus inválido o producto asignado a una instalación',
  })
  @ApiResponse({ status: 404, description: 'Vehículo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductoEstatusDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.vehiculosService.updateEstatus(
      id,
      dto,
      req.user.idCliente,
      req.user.userId,
    );
  }

  @Patch(':id')
  @UseInterceptors(
    vehiculosFileFieldsInterceptor(),
    StripEmptyVehiculoFileFieldsInterceptor,
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody(vehiculosUpdateMultipartApiBody)
  @ApiOperation({ summary: 'Actualizar vehículo' })
  @ApiParam({ name: 'id', description: 'ID del vehículo' })
  @ApiResponse({ status: 200, description: 'Vehículo actualizado' })
  @ApiResponse({ status: 404, description: 'Vehículo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateVehiculosDto,
    @UploadedFiles() files: VehiculosUploadFiles,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idCliente = req.user.idCliente;
    const idUser = req.user.userId;
    return this.vehiculosService.update(id, dto, idCliente, idUser, files);
  }
}
