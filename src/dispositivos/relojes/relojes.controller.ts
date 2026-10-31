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
import { RelojesService } from './relojes.service';
import { CreateRelojDto } from './dto/create-reloj.dto';
import { UpdateRelojDto } from './dto/update-reloj.dto';
import { UpdateDispositivoEstatusDto } from '../dto/update-dispositivo-estatus.dto';
import {
  OBTENER_TODOS_API_QUERY,
  ObtenerTodosQueryDto,
} from 'src/common/dto/obtener-todos-query.dto';

@ApiTags('Dispositivos - Relojes')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('dispositivos/relojes')
export class RelojesController {
  constructor(private readonly relojesService: RelojesService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear reloj (FA100S)',
    description:
      'Crea el dispositivo (datos comunes) y `RelojConfig` (reporte, GPS y sensor de caída) en una transacción. ' +
      'Sin `idCliente` entra al almacén (solo operación: roles 1–5 y 8); con él queda reservado a ese cliente. El tipo se asigna como RELOJ. `numeroSerie` = ID de 10 dígitos del reloj o su IMEI; ' +
      '`imei` (15 dígitos) obligatorio: con él se asocia la telemetría. Se instala en un producto tipo Persona.',
  })
  @ApiResponse({ status: 201, description: 'Reloj creado correctamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o falta tipo RELOJ en catálogo' })
  @ApiResponse({ status: 403, description: 'El cliente está fuera de tu alcance' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async create(
    @Body() dto: CreateRelojDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.relojesService.create(dto, req.user.userId, req.user);
  }

  @Get('list')
  @ApiOperation({
    summary: 'Lista completa de relojes',
    description: 'Lista plana: datos de `Dispositivos` + configuración operativa.',
  })
  @ApiResponse({ status: 200, description: 'Lista obtenida correctamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAllList(@Request() req): Promise<ApiResponseCommon> {
    return this.relojesService.findAllList(req.user.idCliente, req.user.rol);
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Lista paginada de relojes',
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
    return this.relojesService.findAll(
      req.user.idCliente,
      req.user.rol,
      page,
      limit,
      query.obtenerTodos,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener reloj por ID de dispositivo' })
  @ApiParam({ name: 'id', description: 'ID del dispositivo / reloj' })
  @ApiResponse({ status: 200, description: 'Reloj encontrado' })
  @ApiResponse({ status: 404, description: 'Reloj no encontrado o fuera de tu alcance' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.relojesService.findOne(id, req.user);
  }

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Cambiar estatus',
    description:
      'Establece el estatus del dispositivo por ID; el registro debe estar en el alcance del rol (404 si no). Body: `{ "estatus": 0|1|2|3|4|5 }`. ' +
      '`RelojConfig` no tiene estatus propio. ' +
      'Si el estatus actual es 2 (asignado a una instalación), la operación se rechaza.',
  })
  @ApiParam({ name: 'id', description: 'ID del dispositivo / reloj' })
  @ApiBody({ type: UpdateDispositivoEstatusDto })
  @ApiResponse({ status: 200, description: 'Estatus actualizado' })
  @ApiResponse({
    status: 400,
    description: 'estatus inválido o dispositivo asignado a una instalación',
  })
  @ApiResponse({ status: 404, description: 'Reloj no encontrado o fuera de tu alcance' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDispositivoEstatusDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.relojesService.updateEstatus(
      id,
      dto,
      req.user.idCliente,
      req.user.userId,
      req.user,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar reloj y su configuración' })
  @ApiParam({ name: 'id', description: 'ID del dispositivo / reloj' })
  @ApiResponse({ status: 200, description: 'reloj actualizado' })
  @ApiResponse({ status: 404, description: 'Reloj no encontrado o fuera de tu alcance' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRelojDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.relojesService.update(
      id,
      dto,
      req.user.idCliente,
      req.user.userId,
      req.user,
    );
  }
}
