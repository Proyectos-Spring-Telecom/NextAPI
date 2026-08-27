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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { PanelesService } from './paneles.service';
import { CreatePanelAlarmaDto } from './dto/create-panel-alarma.dto';
import { UpdatePanelAlarmaDto } from './dto/update-panel-alarma.dto';
import { UpdateDispositivoEstatusDto } from '../dto/update-dispositivo-estatus.dto';
import { ObtenerTodosQueryDto } from 'src/common/dto/obtener-todos-query.dto';

@ApiTags('Dispositivos - Paneles')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('dispositivos/paneles')
export class PanelesController {
  constructor(private readonly panelesService: PanelesService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear panel de alarma',
    description:
      'Crea el dispositivo (datos comunes) y el detalle exclusivo de panel ' +
      '(cuenta SIA, IP, cifrado, etc.) en una transacción. ' +
      'Requiere `idCliente`. El tipo se asigna como panel. `aesKey` no se devuelve en GET.',
  })
  @ApiResponse({ status: 201, description: 'Panel creado correctamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async create(
    @Body() dto: CreatePanelAlarmaDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.panelesService.create(dto, req.user.userId);
  }

  @Get('list')
  @ApiOperation({
    summary: 'Lista completa de paneles',
    description: 'Lista plana de paneles (sin JSON anidados). No incluye aesKey.',
  })
  @ApiResponse({ status: 200, description: 'Lista obtenida correctamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAllList(@Request() req): Promise<ApiResponseCommon> {
    return this.panelesService.findAllList(req.user.idCliente, req.user.rol);
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Lista paginada de paneles',
    description:
      'Lista paginada. Alcance según rol del token. ' +
      'Por defecto (u `obtenerTodos=0`) excluye INSERVIBLE; con `obtenerTodos=1` incluye todos los estatus.',
  })
  @ApiParam({ name: 'page', description: 'Número de página' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiResponse({ status: 200, description: 'Lista paginada obtenida' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Request() req,
    @Query() query: ObtenerTodosQueryDto,
  ): Promise<ApiResponseCommon> {
    return this.panelesService.findAll(
      req.user.idCliente,
      req.user.rol,
      page,
      limit,
      query.obtenerTodos,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener panel por ID de dispositivo' })
  @ApiParam({ name: 'id', description: 'ID del dispositivo / panel' })
  @ApiResponse({ status: 200, description: 'Panel encontrado' })
  @ApiResponse({ status: 404, description: 'Panel no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.panelesService.findOne(id, req.user.idCliente);
  }

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Cambiar estatus',
    description:
      'Establece el estatus del dispositivo y del panel. Body: `{ "estatus": 0|1|2|3|4|5 }` ' +
      '(0=inactivo, 1=activo/disponible, 2=asignado, 3=baja_remplazo, 4=baja_mantenimiento, 5=inservible). ' +
      'Si el estatus actual es 2 (asignado a una instalación), la operación se rechaza.',
  })
  @ApiParam({ name: 'id', description: 'ID del dispositivo / panel' })
  @ApiBody({ type: UpdateDispositivoEstatusDto })
  @ApiResponse({ status: 200, description: 'Estatus actualizado' })
  @ApiResponse({
    status: 400,
    description: 'estatus inválido o dispositivo asignado a una instalación',
  })
  @ApiResponse({ status: 404, description: 'Panel no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDispositivoEstatusDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.panelesService.updateEstatus(
      id,
      dto,
      req.user.idCliente,
      req.user.userId,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar panel de alarma' })
  @ApiParam({ name: 'id', description: 'ID del dispositivo / panel' })
  @ApiResponse({ status: 200, description: 'Panel actualizado' })
  @ApiResponse({ status: 404, description: 'Panel no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePanelAlarmaDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.panelesService.update(
      id,
      dto,
      req.user.idCliente,
      req.user.userId,
    );
  }
}
