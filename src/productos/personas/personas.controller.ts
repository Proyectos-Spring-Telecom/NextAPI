import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
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
import { PersonasService } from './personas.service';
import { CreatePersonasDto } from './dto/create-personas.dto';
import { UpdatePersonasDto } from './dto/update-personas.dto';
import { UpdateProductoEstatusDto } from '../dto/update-producto-estatus.dto';
import {
  OBTENER_TODOS_API_QUERY,
  ObtenerTodosQueryDto,
} from 'src/common/dto/obtener-todos-query.dto';

@ApiTags('Productos - Personas')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('productos/personas')
export class PersonasController {
  constructor(private readonly personasService: PersonasService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear persona',
    description:
      'Crea el producto (tipo PERSONA) y el detalle de persona en una transacción. ' +
      'Requiere `idCliente` en el body, que debe estar en el alcance de quien crea (403 si no). El estatus inicia en ACTIVO.',
  })
  @ApiResponse({ status: 201, description: 'Persona creada correctamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 403, description: 'El cliente está fuera de tu alcance' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async create(
    @Body() dto: CreatePersonasDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.personasService.create(dto, req.user.userId, req.user);
  }

  @Get('list')
  @ApiOperation({
    summary: 'Lista completa de personas',
    description: 'Lista plana de personas (sin JSON anidados).',
  })
  @ApiResponse({ status: 200, description: 'Lista obtenida correctamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAllList(@Request() req): Promise<ApiResponseCommon> {
    return this.personasService.findAllList(req.user.idCliente, req.user.rol);
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Lista paginada de personas',
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
    return this.personasService.findAll(
      req.user.idCliente,
      req.user.rol,
      page,
      limit,
      query.obtenerTodos,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener persona por ID de producto' })
  @ApiParam({ name: 'id', description: 'ID del producto / persona' })
  @ApiResponse({ status: 200, description: 'Persona encontrada' })
  @ApiResponse({ status: 404, description: 'Persona no encontrada o fuera de tu alcance' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.personasService.findOne(id, req.user);
  }

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Cambiar estatus',
    description:
      'Establece el estatus del producto por ID; debe ser de un cliente del alcance del usuario (404 si no). Body: `{ "estatus": 0|1|2|3|4|5 }` ' +
      '(0=inactivo, 1=activo/disponible, 2=asignado, 3=baja_remplazo, 4=baja_mantenimiento, 5=inservible). ' +
      'Si el estatus actual es 2 (asignado a una instalación), la operación se rechaza.',
  })
  @ApiParam({ name: 'id', description: 'ID del producto / persona' })
  @ApiBody({ type: UpdateProductoEstatusDto })
  @ApiResponse({ status: 200, description: 'Estatus actualizado' })
  @ApiResponse({
    status: 400,
    description: 'estatus inválido o producto asignado a una instalación',
  })
  @ApiResponse({ status: 404, description: 'Persona no encontrada o fuera de tu alcance' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductoEstatusDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.personasService.updateEstatus(
      id,
      dto,
      req.user.idCliente,
      req.user.userId,
      req.user,
    );
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar persona',
    description:
      'La persona debe ser de un cliente del alcance del usuario (incluye clientes hijos para rol 6 y todos para administración).',
  })
  @ApiParam({ name: 'id', description: 'ID del producto / persona' })
  @ApiResponse({ status: 200, description: 'Persona actualizada' })
  @ApiResponse({ status: 404, description: 'Persona no encontrada o fuera de tu alcance' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePersonasDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.personasService.update(
      id,
      dto,
      req.user,
      req.user.userId,
    );
  }
}
