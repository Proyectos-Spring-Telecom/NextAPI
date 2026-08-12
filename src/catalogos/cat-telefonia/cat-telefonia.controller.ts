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
import { CatTelefoniaService } from './cat-telefonia.service';
import { CatTelefoniaResponseDto } from './dto/cat-telefonia-response.dto';
import { CreateCatTelefoniaDto } from './dto/create-cat-telefonia.dto';
import { FilterCatPlanesTelefoniaDto } from '../cat-planes-telefonia/dto/filter-cat-planes-telefonia.dto';
import { FilterCatTelefoniaDto } from './dto/filter-cat-telefonia.dto';
import { UpdateCatTelefoniaDto } from './dto/update-cat-telefonia.dto';

@ApiTags('Catálogo Telefonía')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('cat-telefonia')
export class CatTelefoniaController {
  constructor(private readonly service: CatTelefoniaService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una telefonía' })
  @ApiResponse({
    status: 201,
    description: 'Telefonía creada correctamente',
    type: CatTelefoniaResponseDto,
  })
  @ApiResponse({ status: 409, description: 'Nombre duplicado' })
  create(@Body() dto: CreateCatTelefoniaDto, @Request() req) {
    return this.service.create(dto, req.user.userId);
  }

  @Get('list')
  @ApiOperation({ summary: 'Obtener lista simple de telefonías' })
  @ApiQuery({ name: 'soloActivos', required: false, type: Boolean })
  @ApiResponse({
    status: 200,
    description: 'Lista obtenida correctamente',
    type: [CatTelefoniaResponseDto],
  })
  findAllList(@Query('soloActivos') soloActivos?: string) {
    return this.service.findAllList(soloActivos !== 'false');
  }

  @Get()
  @ApiOperation({ summary: 'Consultar telefonías con filtros y paginación' })
  @ApiResponse({
    status: 200,
    description: 'Listado paginado con propiedades camelCase',
    type: [CatTelefoniaResponseDto],
  })
  findAll(@Query() filters: FilterCatTelefoniaDto) {
    return this.service.findAll(filters);
  }

  @Get(':idTelefonia/planes')
  @ApiOperation({ summary: 'Consultar planes asociados a una telefonía' })
  @ApiParam({ name: 'idTelefonia', type: Number })
  @ApiQuery({ name: 'estatus', required: false, enum: [0, 1] })
  @ApiQuery({ name: 'vigentes', required: false, type: Boolean })
  findPlanes(
    @Param('idTelefonia', ParseIntPipe) idTelefonia: number,
    @Query() filters: FilterCatPlanesTelefoniaDto,
  ) {
    return this.service.findPlanesByTelefonia(idTelefonia, filters);
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Consultar telefonías paginadas (ruta compatible)',
  })
  @ApiParam({ name: 'page', type: Number })
  @ApiParam({ name: 'limit', type: Number })
  @ApiQuery({ name: 'soloActivos', required: false, type: Boolean })
  findAllLegacy(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Query('soloActivos') soloActivos?: string,
  ) {
    return this.service.findAll({
      page,
      limit,
      ...(soloActivos === 'true' ? { estatus: 1 } : {}),
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una telefonía y sus planes activos' })
  @ApiParam({ name: 'id', type: Number })
  @ApiResponse({
    status: 200,
    description: 'Telefonía encontrada',
    type: CatTelefoniaResponseDto,
  })
  @ApiResponse({ status: 404, description: 'Telefonía no encontrada' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Actualizar parcialmente una telefonía' })
  @ApiParam({ name: 'id', type: Number })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCatTelefoniaDto,
    @Request() req,
  ) {
    return this.service.update(id, dto, req.user.userId);
  }

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Cambiar estatus',
    description: 'Alterna el estatus 1 ↔ 0. No requiere body.',
  })
  @ApiResponse({ status: 409, description: 'Tiene planes activos asociados' })
  updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.service.updateEstatus(id, req.user.userId);
  }
}
