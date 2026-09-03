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
import { TrackcamService } from './trackcam.service';
import { CreateTrackcamDto } from './dto/create-trackcam.dto';
import { UpdateTrackcamDto } from './dto/update-trackcam.dto';
import { UpdateDispositivoEstatusDto } from '../dto/update-dispositivo-estatus.dto';
import {
  OBTENER_TODOS_API_QUERY,
  ObtenerTodosQueryDto,
} from 'src/common/dto/obtener-todos-query.dto';

@ApiTags('Dispositivos - Trackcam')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('dispositivos/trackcam')
export class TrackcamController {
  constructor(private readonly trackcamService: TrackcamService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear Trackcam (dashcam GPS)',
    description:
      'Crea el dispositivo (datos comunes) y `TrackcamConfig` (reporteo, canales y alarmas) en una transacción. ' +
      'Requiere `idCliente`. El tipo se asigna como TRACKCAM. ' +
      'No incluye servidores, parámetros JT ni media.',
  })
  @ApiResponse({ status: 201, description: 'Trackcam creado correctamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o falta tipo TRACKCAM en catálogo' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async create(
    @Body() dto: CreateTrackcamDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.trackcamService.create(dto, req.user.userId);
  }

  @Get('list')
  @ApiOperation({
    summary: 'Lista completa de Trackcam',
    description: 'Lista plana: datos de `Dispositivos` + configuración operativa.',
  })
  @ApiResponse({ status: 200, description: 'Lista obtenida correctamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAllList(@Request() req): Promise<ApiResponseCommon> {
    return this.trackcamService.findAllList(req.user.idCliente, req.user.rol);
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Lista paginada de Trackcam',
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
    return this.trackcamService.findAll(
      req.user.idCliente,
      req.user.rol,
      page,
      limit,
      query.obtenerTodos,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener Trackcam por ID de dispositivo' })
  @ApiParam({ name: 'id', description: 'ID del dispositivo / Trackcam' })
  @ApiResponse({ status: 200, description: 'Trackcam encontrado' })
  @ApiResponse({ status: 404, description: 'Trackcam no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.trackcamService.findOne(id, req.user.idCliente);
  }

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Cambiar estatus',
    description:
      'Establece el estatus del dispositivo por ID (sin validar `idCliente` del token). Body: `{ "estatus": 0|1|2|3|4|5 }`. ' +
      '`TrackcamConfig` no tiene estatus propio. ' +
      'Si el estatus actual es 2 (asignado a una instalación), la operación se rechaza.',
  })
  @ApiParam({ name: 'id', description: 'ID del dispositivo / Trackcam' })
  @ApiBody({ type: UpdateDispositivoEstatusDto })
  @ApiResponse({ status: 200, description: 'Estatus actualizado' })
  @ApiResponse({
    status: 400,
    description: 'estatus inválido o dispositivo asignado a una instalación',
  })
  @ApiResponse({ status: 404, description: 'Trackcam no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDispositivoEstatusDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.trackcamService.updateEstatus(
      id,
      dto,
      req.user.idCliente,
      req.user.userId,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar Trackcam y su configuración' })
  @ApiParam({ name: 'id', description: 'ID del dispositivo / Trackcam' })
  @ApiResponse({ status: 200, description: 'Trackcam actualizado' })
  @ApiResponse({ status: 404, description: 'Trackcam no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTrackcamDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.trackcamService.update(
      id,
      dto,
      req.user.idCliente,
      req.user.userId,
    );
  }
}
