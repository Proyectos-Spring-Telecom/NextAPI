import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
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
import { PersonasService } from './personas.service';
import { CreatePersonasDto } from './dto/create-personas.dto';
import { UpdatePersonasDto } from './dto/update-personas.dto';
import { UpdateProductoEstatusDto } from '../dto/update-producto-estatus.dto';

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
      'Requiere `idCliente` en el body. El estatus inicia en ACTIVO.',
  })
  @ApiResponse({ status: 201, description: 'Persona creada correctamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async create(
    @Body() dto: CreatePersonasDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.personasService.create(dto, req.user.userId);
  }

  @Get('list')
  @ApiOperation({
    summary: 'Lista completa de personas',
    description: 'Incluye cliente y producto (nombre y tipo).',
  })
  @ApiResponse({ status: 200, description: 'Lista obtenida correctamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAllList(@Request() req): Promise<ApiResponseCommon> {
    return this.personasService.findAllList(req.user.idCliente, req.user.rol);
  }

  @Get(':page/:limit')
  @ApiOperation({ summary: 'Lista paginada de personas' })
  @ApiParam({ name: 'page', description: 'Número de página' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiResponse({ status: 200, description: 'Lista paginada obtenida' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    return this.personasService.findAll(
      req.user.idCliente,
      req.user.rol,
      page,
      limit,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener persona por ID de producto' })
  @ApiParam({ name: 'id', description: 'ID del producto / persona' })
  @ApiResponse({ status: 200, description: 'Persona encontrada' })
  @ApiResponse({ status: 404, description: 'Persona no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.personasService.findOne(id, req.user.idCliente);
  }

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Cambiar estatus',
    description:
      'Establece el estatus del producto. Body requerido: `{ "estatus": 0 | 1 }`.',
  })
  @ApiParam({ name: 'id', description: 'ID del producto / persona' })
  @ApiBody({ type: UpdateProductoEstatusDto })
  @ApiResponse({ status: 200, description: 'Estatus actualizado' })
  @ApiResponse({ status: 400, description: 'estatus inválido' })
  @ApiResponse({ status: 404, description: 'Persona no encontrada' })
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
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar persona' })
  @ApiParam({ name: 'id', description: 'ID del producto / persona' })
  @ApiResponse({ status: 200, description: 'Persona actualizada' })
  @ApiResponse({ status: 404, description: 'Persona no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePersonasDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.personasService.update(
      id,
      dto,
      req.user.idCliente,
      req.user.userId,
    );
  }
}
