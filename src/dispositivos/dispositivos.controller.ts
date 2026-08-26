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
import { DispositivosService } from './dispositivos.service';
import { CreateDispositivosDto } from './dto/create-dispositivos.dto';
import { UpdateDispositivosDto } from './dto/update-dispositivos.dto';
import { UpdateDispositivoEstatusDto } from './dto/update-dispositivo-estatus.dto';

@ApiTags('Dispositivos')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('dispositivos')
export class DispositivosController {
  constructor(private readonly dispositivosService: DispositivosService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear dispositivo',
    description:
      'Alta de rastreador, AVL o teléfono (datos comunes en `Dispositivos`). ' +
      'Requiere `idCliente` e `idTipoDispositivo`. ' +
      'Los paneles de alarma se crean en POST /dispositivos/paneles porque necesitan datos extra.',
  })
  @ApiResponse({ status: 201, description: 'Dispositivo creado correctamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async create(
    @Body() dto: CreateDispositivosDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.dispositivosService.create(dto, req.user.userId);
  }

  @Get('list')
  @ApiOperation({
    summary: 'Lista completa de dispositivos',
    description:
      'Lista plana de dispositivos disponibles (`estatus = 1`). ' +
      'Incluye todos los tipos (rastreador, AVL, teléfono, panel). ' +
      'Opcionalmente filtra por `idTipoDispositivo` y `idCliente`.',
  })
  @ApiQuery({
    name: 'idTipoDispositivo',
    required: false,
    type: Number,
    description: 'Filtrar por CatTipoDispositivo.Id',
  })
  @ApiQuery({
    name: 'idCliente',
    required: false,
    type: Number,
    description:
      'Filtrar por cliente. Si se omite, aplica el alcance del rol del token.',
  })
  @ApiResponse({ status: 200, description: 'Lista obtenida correctamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAllList(
    @Request() req,
    @Query('idTipoDispositivo') idTipoDispositivo?: string,
    @Query('idCliente') idCliente?: string,
  ): Promise<ApiResponseCommon> {
    const tipo = idTipoDispositivo ? Number(idTipoDispositivo) : undefined;
    const clienteFiltro = idCliente ? Number(idCliente) : undefined;
    return this.dispositivosService.findAllList(
      req.user.idCliente,
      req.user.rol,
      Number.isFinite(tipo) ? tipo : undefined,
      Number.isFinite(clienteFiltro) ? clienteFiltro : undefined,
    );
  }

  @Get('paginado/:page/:limit')
  @ApiOperation({
    summary: 'Lista paginada de dispositivos',
    description: 'Lista paginada. Alcance según rol del token.',
  })
  @ApiParam({ name: 'page', description: 'Número de página' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiQuery({
    name: 'idTipoDispositivo',
    required: false,
    type: Number,
  })
  @ApiResponse({ status: 200, description: 'Lista paginada obtenida' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Request() req,
    @Query('idTipoDispositivo') idTipoDispositivo?: string,
  ): Promise<ApiResponseCommon> {
    const tipo = idTipoDispositivo ? Number(idTipoDispositivo) : undefined;
    return this.dispositivosService.findAll(
      req.user.idCliente,
      req.user.rol,
      page,
      limit,
      Number.isFinite(tipo) ? tipo : undefined,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener dispositivo por ID' })
  @ApiParam({ name: 'id', description: 'ID del dispositivo' })
  @ApiResponse({ status: 200, description: 'Dispositivo encontrado' })
  @ApiResponse({ status: 404, description: 'Dispositivo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.dispositivosService.findOne(id, req.user.idCliente);
  }

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Cambiar estatus',
    description:
      'Establece el estatus del dispositivo. Body: `{ "estatus": 0|1|2|3|4|5 }` ' +
      '(0=inactivo, 1=activo/disponible, 2=asignado, 3=baja_remplazo, 4=baja_mantenimiento, 5=inservible). ' +
      'Si el estatus actual es 2 (asignado a una instalación), la operación se rechaza.',
  })
  @ApiParam({ name: 'id', description: 'ID del dispositivo' })
  @ApiBody({ type: UpdateDispositivoEstatusDto })
  @ApiResponse({ status: 200, description: 'Estatus actualizado' })
  @ApiResponse({
    status: 400,
    description: 'estatus inválido o dispositivo asignado a una instalación',
  })
  @ApiResponse({ status: 404, description: 'Dispositivo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDispositivoEstatusDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.dispositivosService.updateEstatus(
      id,
      dto,
      req.user.idCliente,
      req.user.userId,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar dispositivo' })
  @ApiParam({ name: 'id', description: 'ID del dispositivo' })
  @ApiResponse({ status: 200, description: 'Dispositivo actualizado' })
  @ApiResponse({ status: 404, description: 'Dispositivo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDispositivosDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.dispositivosService.update(
      id,
      dto,
      req.user.idCliente,
      req.user.userId,
    );
  }
}
