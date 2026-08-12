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
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { CatPlanesTelefoniaService } from './cat-planes-telefonia.service';
import { CatPlanTelefoniaResponseDto } from './dto/cat-plan-telefonia-response.dto';
import { CreateCatPlanesTelefoniaDto } from './dto/create-cat-planes-telefonia.dto';
import { FilterCatPlanesTelefoniaDto } from './dto/filter-cat-planes-telefonia.dto';
import { UpdateCatPlanesTelefoniaDto } from './dto/update-cat-planes-telefonia.dto';

@ApiTags('Catálogo Planes Telefonía')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('cat-planes-telefonia')
export class CatPlanesTelefoniaController {
  constructor(private readonly service: CatPlanesTelefoniaService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un plan de telefonía' })
  @ApiResponse({
    status: 201,
    description: 'Plan creado correctamente',
    type: CatPlanTelefoniaResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Datos o fechas inválidos' })
  @ApiResponse({ status: 404, description: 'Telefonía no encontrada' })
  @ApiResponse({ status: 409, description: 'Telefonía inactiva' })
  create(@Body() dto: CreateCatPlanesTelefoniaDto, @Request() req) {
    return this.service.create(dto, req.user.userId);
  }

  @Get('list')
  @ApiOperation({ summary: 'Obtener lista simple de planes' })
  @ApiQuery({ name: 'soloActivos', required: false, type: Boolean })
  @ApiQuery({ name: 'idTelefonia', required: false, type: Number })
  @ApiResponse({
    status: 200,
    description: 'Lista obtenida correctamente',
    type: [CatPlanTelefoniaResponseDto],
  })
  findAllList(
    @Query('soloActivos') soloActivos?: string,
    @Query('idTelefonia') idTelefonia?: string,
  ) {
    const parsed = idTelefonia ? Number(idTelefonia) : undefined;
    return this.service.findAllList(
      soloActivos !== 'false',
      parsed !== undefined && Number.isInteger(parsed) ? parsed : undefined,
    );
  }

  @Get()
  @ApiOperation({ summary: 'Consultar planes con filtros y paginación' })
  @ApiResponse({
    status: 200,
    description: 'Listado paginado con propiedades camelCase',
    type: [CatPlanTelefoniaResponseDto],
  })
  findAll(@Query() filters: FilterCatPlanesTelefoniaDto) {
    return this.service.findAll(filters);
  }

  @Get(':page/:limit')
  @ApiOperation({ summary: 'Consultar planes paginados (ruta compatible)' })
  @ApiParam({ name: 'page', type: Number })
  @ApiParam({ name: 'limit', type: Number })
  @ApiQuery({ name: 'soloActivos', required: false, type: Boolean })
  @ApiQuery({ name: 'idTelefonia', required: false, type: Number })
  findAllLegacy(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Query('soloActivos') soloActivos?: string,
    @Query('idTelefonia') idTelefonia?: string,
  ) {
    const parsed = idTelefonia ? Number(idTelefonia) : undefined;
    return this.service.findAll({
      page,
      limit,
      ...(soloActivos === 'true' ? { estatus: 1 } : {}),
      ...(parsed !== undefined && Number.isInteger(parsed)
        ? { idTelefonia: parsed }
        : {}),
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un plan y su telefonía' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Plan encontrado',
    type: CatPlanTelefoniaResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Plan no encontrado' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar parcialmente un plan' })
  @ApiParam({ name: 'id', type: Number })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCatPlanesTelefoniaDto,
    @Request() req,
  ) {
    return this.service.update(id, dto, req.user.userId);
  }

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Cambiar estatus',
    description: 'Alterna el estatus 1 ↔ 0. No requiere body.',
  })
  updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.service.updateEstatus(id, req.user.userId);
  }
}
