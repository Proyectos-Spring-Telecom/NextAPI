import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Request,
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
  ApiBody,
} from '@nestjs/swagger';
import { InmueblesService } from './inmuebles.service';
import { CreateInmueblesDto } from './dto/create-inmuebles.dto';
import { UpdateInmueblesDto } from './dto/update-inmuebles.dto';
import { UpdateProductoEstatusDto } from '../dto/update-producto-estatus.dto';
import {
  OBTENER_TODOS_API_QUERY,
  ObtenerTodosQueryDto,
} from 'src/common/dto/obtener-todos-query.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Productos - Inmuebles')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('productos/inmuebles')
export class InmueblesController {
  constructor(private readonly inmueblesService: InmueblesService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear inmueble',
    description:
      'Crea el producto (tipo INMUEBLE) y el detalle de inmueble en una transacción. ' +
      'Requiere `idCliente` en el body. El estatus inicia en ACTIVO.',
  })
  @ApiResponse({ status: 201, description: 'Inmueble creado correctamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async create(
    @Body() dto: CreateInmueblesDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.inmueblesService.create(dto, req.user.userId);
  }

  @Get('list')
  @ApiOperation({
    summary: 'Lista completa de inmuebles',
    description: 'Lista plana de inmuebles (sin JSON anidados).',
  })
  @ApiResponse({ status: 200, description: 'Lista obtenida correctamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAllList(@Request() req): Promise<ApiResponseCommon> {
    const idCliente = req.user.idCliente;
    const rol = req.user.rol;
    return this.inmueblesService.findAllList(idCliente, rol);
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Lista paginada de inmuebles',
    description:
      'Lista paginada. Alcance según rol del token. ' +
      'Por defecto (u `obtenerTodos=0`) excluye INSERVIBLE; con `obtenerTodos=1` incluye todos los estatus.',
  })
  @ApiParam({ name: 'page', description: 'Número de página (base 1)' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiQuery(OBTENER_TODOS_API_QUERY)
  @ApiResponse({ status: 200, description: 'Lista paginada obtenida' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Request() req,
    @Query() query: ObtenerTodosQueryDto,
  ): Promise<ApiResponseCommon> {
    const idCliente = req.user.idCliente;
    const rol = req.user.rol;
    return this.inmueblesService.findAll(
      idCliente,
      rol,
      page,
      limit,
      query.obtenerTodos,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener inmueble por ID' })
  @ApiParam({ name: 'id', description: 'ID del inmueble' })
  @ApiResponse({ status: 200, description: 'Inmueble encontrado' })
  @ApiResponse({ status: 404, description: 'Inmueble no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    const idCliente = req.user.idCliente;
    return this.inmueblesService.findOne(id, idCliente);
  }

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Cambiar estatus',
    description:
      'Establece el estatus del producto por ID (sin validar `idCliente` del token). Body: `{ "estatus": 0|1|2|3|4|5 }` ' +
      '(0=inactivo, 1=activo/disponible, 2=asignado, 3=baja_remplazo, 4=baja_mantenimiento, 5=inservible). ' +
      'Si el estatus actual es 2 (asignado a una instalación), la operación se rechaza.',
  })
  @ApiParam({ name: 'id', description: 'ID del inmueble' })
  @ApiBody({ type: UpdateProductoEstatusDto })
  @ApiResponse({ status: 200, description: 'Estatus actualizado' })
  @ApiResponse({
    status: 400,
    description: 'estatus inválido o producto asignado a una instalación',
  })
  @ApiResponse({ status: 404, description: 'Inmueble no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductoEstatusDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.inmueblesService.updateEstatus(
      id,
      dto,
      req.user.idCliente,
      req.user.userId,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar inmueble' })
  @ApiParam({ name: 'id', description: 'ID del inmueble' })
  @ApiResponse({ status: 200, description: 'Inmueble actualizado' })
  @ApiResponse({ status: 404, description: 'Inmueble no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInmueblesDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idCliente = req.user.idCliente;
    const idUser = req.user.userId;
    return this.inmueblesService.update(id, dto, idCliente, idUser);
  }
}
