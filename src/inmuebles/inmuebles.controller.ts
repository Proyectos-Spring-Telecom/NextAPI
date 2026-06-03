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
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
} from '@nestjs/swagger';
import { InmueblesService } from './inmuebles.service';
import { CreateInmueblesDto } from './dto/create-inmuebles.dto';
import { UpdateInmueblesDto } from './dto/update-inmuebles.dto';
import { UpdateInmueblesEstatusDto } from './dto/update-inmuebles-estatus.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Inmuebles')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('inmuebles')
export class InmueblesController {
  constructor(private readonly inmueblesService: InmueblesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear inmueble' })
  @ApiResponse({ status: 201, description: 'Inmueble creado correctamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async create(
    @Body() dto: CreateInmueblesDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idCliente = req.user.idCliente;
    const idUser = req.user.userId;
    return this.inmueblesService.create(dto, idCliente, idUser);
  }

  @Get('list')
  @ApiOperation({
    summary: 'Lista completa de inmuebles',
    description: 'Solo activos (Estatus=1). Alcance según rol.',
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
    description: 'Activos e inactivos. Alcance según rol.',
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
    return this.inmueblesService.findAll(idCliente, rol, page, limit);
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
  @ApiOperation({ summary: 'Cambiar estatus (soft delete)' })
  @ApiParam({ name: 'id', description: 'ID del inmueble' })
  @ApiResponse({ status: 200, description: 'Estatus actualizado' })
  @ApiResponse({ status: 404, description: 'Inmueble no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInmueblesEstatusDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idCliente = req.user.idCliente;
    const idUser = req.user.userId;
    return this.inmueblesService.updateEstatus(id, dto, idCliente, idUser);
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
