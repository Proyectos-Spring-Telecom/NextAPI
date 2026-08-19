import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AlarmasService } from './alarmas.service';
import {
  FilterAlarmasQueryDto,
  FilterEventosDto,
} from './dto/filter-eventos.dto';

@ApiTags('Alarmas')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('alarmas')
export class AlarmasController {
  constructor(private readonly alarmasService: AlarmasService) {}

  @Get('paneles')
  @ApiOperation({
    summary: 'Listar paneles de alarma activos',
    description:
      'Paneles con Estatus=1, ordenados por nombre. Alcance según rol. Inmueble completo.',
  })
  @ApiResponse({ status: 200, description: 'Lista obtenida' })
  @ApiResponse({ status: 403, description: 'idCliente fuera del alcance del rol' })
  async findPaneles(@Query() query: FilterAlarmasQueryDto, @Request() req) {
    return this.alarmasService.findPaneles(
      req.user.rol,
      req.user.idCliente,
      query.idCliente,
    );
  }

  @Get('paneles/:id')
  @ApiOperation({
    summary: 'Detalle de panel',
    description: ':id = IdDispositivo. 404 si inactivo; 403 si no entra en el alcance.',
  })
  @ApiParam({ name: 'id', description: 'IdDispositivo del panel' })
  @ApiResponse({ status: 200, description: 'Panel encontrado' })
  @ApiResponse({ status: 403, description: 'Sin acceso' })
  @ApiResponse({ status: 404, description: 'No encontrado o inactivo' })
  async findPanelById(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.alarmasService.findPanelById(
      id,
      req.user.rol,
      req.user.idCliente,
    );
  }

  @Get('ultimos-eventos')
  @ApiOperation({
    summary: 'Último evento por panel activo',
    description:
      'Un item por panel Estatus=1. ultimoEvento puede ser null. Inmueble corto.',
  })
  @ApiResponse({ status: 200, description: 'Lista obtenida' })
  @ApiResponse({ status: 403, description: 'idCliente fuera del alcance del rol' })
  async findUltimosEventos(
    @Query() query: FilterAlarmasQueryDto,
    @Request() req,
  ) {
    return this.alarmasService.findUltimosEventos(
      req.user.rol,
      req.user.idCliente,
      query.idCliente,
    );
  }

  @Get('eventos')
  @ApiOperation({
    summary: 'Historial de eventos',
    description:
      'Estatus=1, orden RecibidoEn DESC. Filtros: idCliente, idPanel, codigoSia, desde, hasta, page, limit.',
  })
  @ApiResponse({ status: 200, description: 'Lista paginada' })
  @ApiResponse({ status: 403, description: 'idCliente fuera del alcance del rol' })
  async findEventos(@Query() query: FilterEventosDto, @Request() req) {
    return this.alarmasService.findEventos(
      req.user.rol,
      req.user.idCliente,
      query,
    );
  }

  @Get('eventos/:id')
  @ApiOperation({
    summary: 'Detalle de evento',
    description: '404 si Estatus != 1; 403 si el cliente no entra en el alcance.',
  })
  @ApiParam({ name: 'id', description: 'EventoAlarma.Id' })
  @ApiResponse({ status: 200, description: 'Evento encontrado' })
  @ApiResponse({ status: 403, description: 'Sin acceso' })
  @ApiResponse({ status: 404, description: 'No encontrado o inactivo' })
  async findEventoById(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.alarmasService.findEventoById(
      id,
      req.user.rol,
      req.user.idCliente,
    );
  }
}
