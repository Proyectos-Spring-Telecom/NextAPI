import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Request,
  Query,
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
} from '@nestjs/swagger';
import { DispositivosService } from './dispositivos.service';
import { CreateDispositivosDto } from './dto/create-dispositivos.dto';
import { UpdateDispositivosDto } from './dto/update-dispositivos.dto';
import { UpdateDispositivosEstatusDto } from './dto/update-dispositivos-estatus.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Dispositivos')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('dispositivos')
export class DispositivosController {
  constructor(
    private readonly dispositivosService: DispositivosService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Crear dispositivo' })
  @ApiResponse({ status: 201, description: 'Dispositivo creado correctamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async create(
    @Body() dto: CreateDispositivosDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idCliente = req.user.idCliente;
    const idUser = req.user.userId;
    return this.dispositivosService.create(dto, idCliente, idUser);
  }

  @Get('list')
  @ApiOperation({ summary: 'Lista completa de dispositivos' })
  @ApiQuery({
    name: 'soloActivos',
    required: false,
    description: 'Si true, solo retorna registros activos (estatus=1)',
  })
  @ApiResponse({ status: 200, description: 'Lista obtenida correctamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAllList(
    @Request() req,
    @Query('soloActivos') soloActivos?: string,
  ): Promise<ApiResponseCommon> {
    const idCliente = req.user.idCliente;
    const soloActivosBool = soloActivos !== 'false';
    return this.dispositivosService.findAllList(idCliente, soloActivosBool);
  }

  @Get(':page/:limit')
  @ApiOperation({ summary: 'Lista paginada de dispositivos' })
  @ApiParam({ name: 'page', description: 'Número de página' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiQuery({
    name: 'soloActivos',
    required: false,
    description: 'Si true, solo retorna registros activos',
  })
  @ApiResponse({ status: 200, description: 'Lista paginada obtenida' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Request() req,
    @Query('soloActivos') soloActivos?: string,
  ): Promise<ApiResponseCommon> {
    const idCliente = req.user.idCliente;
    const soloActivosBool = soloActivos === 'true';
    return this.dispositivosService.findAll(
      idCliente,
      page,
      limit,
      soloActivosBool,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener dispositivo por ID' })
  @ApiParam({ name: 'id', description: 'ID del dispositivo' })
  @ApiResponse({ status: 200, description: 'Dispositivo encontrado' })
  @ApiResponse({ status: 404, description: 'Dispositivo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    const idCliente = req.user.idCliente;
    return this.dispositivosService.findOne(id, idCliente);
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
    const idCliente = req.user.idCliente;
    const idUser = req.user.userId;
    return this.dispositivosService.update(id, dto, idCliente, idUser);
  }

  @Patch('estatus/:id')
  @ApiOperation({ summary: 'Cambiar estatus (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID del dispositivo' })
  @ApiResponse({ status: 200, description: 'Estatus actualizado' })
  @ApiResponse({ status: 404, description: 'Dispositivo no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDispositivosEstatusDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idCliente = req.user.idCliente;
    const idUser = req.user.userId;
    return this.dispositivosService.updateEstatus(id, dto, idCliente, idUser);
  }
}
