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
import { InstalacionesService } from './instalaciones.service';
import { CreateInstalacionesDto } from './dto/create-instalaciones.dto';
import { UpdateInstalacionesDto } from './dto/update-instalaciones.dto';
import { BajaInstalacionDto } from './dto/baja-instalacion.dto';
import { FilterInstalacionesPaginadoDto } from './dto/filter-instalaciones-paginado.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@ApiTags('Instalaciones')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('instalaciones')
export class InstalacionesController {
  constructor(private readonly instalacionesService: InstalacionesService) { }

  @Post()
  @ApiOperation({
    summary: 'Crear instalación',
    description:
      'Alta vigente con `estatusInstalacion = ACTIVA (1)`, `VigenteDesde = ahora` e `IdUsuario` del token. ' +
      'Producto (y dispositivo/SIM si se envían) deben pertenecer al mismo `idCliente` y tener `estatus = 1` ' +
      '(activo/disponible); tras el alta pasan a `ASIGNADO (2)`. Sin histórico. ' +
      'Además se asigna automáticamente en `UsuariosInstalaciones` a usuarios activos con rol SA (1) ' +
      'y a usuarios activos con rol cliente (6) del mismo `idCliente`.',
  })
  @ApiResponse({ status: 201, description: 'Instalación creada correctamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async create(
    @Body() dto: CreateInstalacionesDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.instalacionesService.create(dto, req.user.userId);
  }

  @Get('list')
  @ApiOperation({
    summary: 'Lista completa de instalaciones activas',
    description: 'Solo `Estatus = 1`. Alcance según rol.',
  })
  @ApiResponse({ status: 200, description: 'Lista obtenida correctamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAllList(@Request() req): Promise<ApiResponseCommon> {
    return this.instalacionesService.findAllList(
      req.user.idCliente,
      req.user.rol,
    );
  }

  @Get('historico/:id')
  @ApiOperation({
    summary: 'Histórico de una instalación',
    description:
      'Devuelve la versión vigente (si existe) y la cadena de `HistoricoInstalaciones` de lo más reciente a lo más antiguo.',
  })
  @ApiParam({
    name: 'id',
    description: 'Id de la instalación vigente o IdInstalacionOriginal',
  })
  @ApiResponse({ status: 200, description: 'Histórico obtenido' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  async findHistorico(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.instalacionesService.findHistorico(
      id,
      req.user.idCliente,
      req.user.rol,
    );
  }

  @Post('paginado')
  @ApiOperation({
    summary: 'Lista paginada de instalaciones por tipo de producto',
    description:
      'Body: `page`, `limit`, y opcionalmente `idTipoProducto` (1=vehículo, 2=activo, 3=inmueble, 4=persona). ' +
      'Si no envías `idTipoProducto`, se listan instalaciones de **todos** los tipos. ' +
      'Orden del JSON: instalación → cliente → producto+detalle → dispositivo(+panel si tipo 2) → SIM. ' +
      'Nomenclatura: nombre real + sufijo de origen (`…Dispositivo`, `…Panel`, `…Vehiculo`/`…Activo`/`…Inmueble`/`…Persona`, `…Sim`). ' +
      'Respeta el alcance del rol.',
  })
  @ApiBody({ type: FilterInstalacionesPaginadoDto })
  @ApiResponse({ status: 200, description: 'Lista paginada obtenida' })
  @ApiResponse({ status: 400, description: 'Parámetros inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAllPaginado(
    @Body() dto: FilterInstalacionesPaginadoDto,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    return this.instalacionesService.findAllPaginado(
      req.user.idCliente,
      req.user.rol,
      dto,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener instalación por ID (detalle completo)',
    description:
      'Misma nomenclatura y orden que el paginado: instalación → cliente → producto+detalle → dispositivo(+panel) → SIM. ' +
      'Incluye todos los campos de instalación, producto, dispositivo, panel (sin aesKey) y SIM (telefonía, plan, notas, estatus, fechas).',
  })
  @ApiParam({ name: 'id', description: 'ID de la instalación vigente' })
  @ApiResponse({ status: 200, description: 'Instalación encontrada' })
  @ApiResponse({ status: 404, description: 'Instalación no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.instalacionesService.findOne(
      id,
      req.user.idCliente,
      req.user.rol,
    );
  }

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Cambiar estatus de instalación',
    description:
      'Solo se permiten **0**, **1** y **5**.\n' +
      '- **0 (inactivo) / 5 (inservible):** `EstatusInstalacion` = valor enviado, ' +
      '`Estatus` de fila = 0 (así `SimActivo` y `DispositivoActivo` quedan nulos), ' +
      'y producto/dispositivo/SIM pasan a disponible (1).\n' +
      '- **1 (activa):** todos los componentes vinculados deben estar en disponible (1); ' +
      'luego la instalación queda activa (`Estatus` = 1, columnas activas llenas) y ' +
      'los componentes pasan a asignado (2).\n' +
      'No archiva ni elimina la instalación.',
  })
  @ApiParam({ name: 'id', description: 'ID de la instalación vigente' })
  @ApiBody({ type: BajaInstalacionDto })
  @ApiResponse({
    status: 200,
    description: 'Estatus actualizado correctamente',
  })
  @ApiResponse({ status: 400, description: 'Estatus inválido o componentes no disponibles' })
  @ApiResponse({ status: 404, description: 'Instalación no encontrada' })
  async baja(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: BajaInstalacionDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.instalacionesService.baja(
      id,
      dto,
      req.user.idCliente,
      req.user.rol,
      req.user.userId,
    );
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar instalación (archiva + nueva versión)',
    description:
      'En una transacción: archiva la vigente en `HistoricoInstalaciones` con el ' +
      '`estatusInstalacionAnterior` enviado, crea una nueva ACTIVA (1), migra ' +
      '`UsuariosInstalaciones` al nuevo id, elimina la fila anterior. ' +
      'Si cambia producto/dispositivo/SIM: el recurso nuevo debe tener estatus=1 ' +
      '(disponible) y mismo idCliente; el que sale recibe `estatus*Anterior` (0–5); ' +
      'el que entra queda en ASIGNADO (2). ' +
      'Campos: estatusInstalacionAnterior, estatusProductoAnterior, estatusDispositivoAnterior, estatusSimAnterior.',
  })
  @ApiParam({ name: 'id', description: 'ID de la instalación vigente' })
  @ApiBody({ type: UpdateInstalacionesDto })
  @ApiResponse({ status: 200, description: 'Instalación actualizada (nuevo Id)' })
  @ApiResponse({ status: 400, description: 'Sin cambios o datos inválidos' })
  @ApiResponse({ status: 404, description: 'Instalación no encontrada' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateInstalacionesDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.instalacionesService.update(
      id,
      dto,
      req.user.idCliente,
      req.user.rol,
      req.user.userId,
    );
  }

}
