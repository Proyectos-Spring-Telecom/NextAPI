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
import { OperadoresService } from './operadores.service';
import { CreateOperadoresDto } from './dto/create-operadores.dto';
import { UpdateOperadoresDto } from './dto/update-operadores.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Operadores')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('operadores')
export class OperadoresController {
  constructor(private readonly operadoresService: OperadoresService) {}

  @Post()
  @ApiOperation({ summary: 'Crear operador' })
  @ApiResponse({ status: 201, description: 'Operador creado correctamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async create(
    @Body() dto: CreateOperadoresDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idCliente = req.user.idCliente;
    const idUser = req.user.userId;
    return this.operadoresService.create(dto, idCliente, idUser);
  }

  @Get('list')
  @ApiOperation({
    summary: 'Lista completa de operadores',
    description: 'Solo activos (Estatus=1). Alcance según rol.',
  })
  @ApiResponse({ status: 200, description: 'Lista obtenida correctamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAllList(@Request() req): Promise<ApiResponseCommon> {
    const idCliente = req.user.idCliente;
    const rol = req.user.rol;
    return this.operadoresService.findAllList(idCliente, rol);
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Lista paginada de operadores',
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
    return this.operadoresService.findAll(idCliente, rol, page, limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener operador por ID' })
  @ApiParam({ name: 'id', description: 'ID del operador' })
  @ApiResponse({ status: 200, description: 'Operador encontrado' })
  @ApiResponse({ status: 404, description: 'Operador no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    const idCliente = req.user.idCliente;
    return this.operadoresService.findOne(id, idCliente);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar operador' })
  @ApiParam({ name: 'id', description: 'ID del operador' })
  @ApiResponse({ status: 200, description: 'Operador actualizado' })
  @ApiResponse({ status: 404, description: 'Operador no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOperadoresDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idCliente = req.user.idCliente;
    const idUser = req.user.userId;
    return this.operadoresService.update(id, dto, idCliente, idUser);
  }

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Cambiar estatus',
    description: 'Alterna el estatus 1 ↔ 0. No requiere body.',
  })
  @ApiParam({ name: 'id', description: 'ID del operador' })
  @ApiResponse({ status: 200, description: 'Estatus actualizado' })
  @ApiResponse({ status: 404, description: 'Operador no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idCliente = req.user.idCliente;
    const idUser = req.user.userId;
    return this.operadoresService.updateEstatus(id, idCliente, idUser);
  }
}
