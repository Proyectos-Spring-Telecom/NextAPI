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
import { SimsService } from './sims.service';
import { CreateSimsDto } from './dto/create-sims.dto';
import { UpdateSimsDto } from './dto/update-sims.dto';
import { UpdateSimsEstatusDto } from './dto/update-sims-estatus.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Sims')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('sims')
export class SimsController {
  constructor(private readonly simsService: SimsService) {}

  @Post()
  @ApiOperation({ summary: 'Crear SIM' })
  @ApiResponse({ status: 201, description: 'SIM creado correctamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async create(
    @Body() dto: CreateSimsDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idCliente = req.user.idCliente;
    const idUser = req.user.userId;
    return this.simsService.create(dto, idCliente, idUser);
  }

  @Get('list')
  @ApiOperation({ summary: 'Lista completa de SIMs' })
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
    return this.simsService.findAllList(idCliente, soloActivosBool);
  }

  @Get(':page/:limit')
  @ApiOperation({ summary: 'Lista paginada de SIMs' })
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
    return this.simsService.findAll(idCliente, page, limit, soloActivosBool);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener SIM por ID' })
  @ApiParam({ name: 'id', description: 'ID del SIM' })
  @ApiResponse({ status: 200, description: 'SIM encontrado' })
  @ApiResponse({ status: 404, description: 'SIM no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    const idCliente = req.user.idCliente;
    return this.simsService.findOne(id, idCliente);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar SIM' })
  @ApiParam({ name: 'id', description: 'ID del SIM' })
  @ApiResponse({ status: 200, description: 'SIM actualizado' })
  @ApiResponse({ status: 404, description: 'SIM no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSimsDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idCliente = req.user.idCliente;
    const idUser = req.user.userId;
    return this.simsService.update(id, dto, idCliente, idUser);
  }

  @Patch('estatus/:id')
  @ApiOperation({ summary: 'Cambiar estatus (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID del SIM' })
  @ApiResponse({ status: 200, description: 'Estatus actualizado' })
  @ApiResponse({ status: 404, description: 'SIM no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSimsEstatusDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idCliente = req.user.idCliente;
    const idUser = req.user.userId;
    return this.simsService.updateEstatus(id, dto, idCliente, idUser);
  }
}
