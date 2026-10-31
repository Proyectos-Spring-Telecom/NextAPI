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
import { CorregirVigenteDesdeDto } from './dto/corregir-vigente-desde.dto';
import { CorregirClienteInstalacionDto } from './dto/corregir-cliente.dto';
import { FilterInstalacionesPaginadoDto } from './dto/filter-instalaciones-paginado.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { EnumRoles } from 'src/common/estatus.enum';

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
  @ApiResponse({ status: 403, description: 'El cliente está fuera de tu alcance' })
  async create(
    @Body() dto: CreateInstalacionesDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.instalacionesService.create(dto, req.user.userId, undefined, req.user);
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

  @Get('list/tipo/:idTipoProducto')
  @ApiOperation({
    summary: 'Lista completa de instalaciones activas por tipo de producto',
    description:
      'Solo `Estatus = 1`. Mismo formato que el paginado (instalación → cliente → producto+detalle → dispositivo → SIM). ' +
      'Alcance por rol vía tenant (`IdCliente`). ' +
      'Rol **Usuario (9)**: solo instalaciones con relación activa en `UsuariosInstalaciones` para el usuario del token.',
  })
  @ApiParam({
    name: 'idTipoProducto',
    description: '1=vehículo, 2=activo, 3=inmueble, 4=persona',
    example: 1,
  })
  @ApiResponse({ status: 200, description: 'Lista obtenida correctamente' })
  @ApiResponse({ status: 400, description: 'Tipo de producto inválido' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAllListByTipoProducto(
    @Param('idTipoProducto', ParseIntPipe) idTipoProducto: number,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    return this.instalacionesService.findAllListByTipoProducto(
      req.user.idCliente,
      req.user.rol,
      req.user.userId,
      idTipoProducto,
    );
  }

  @Get('cliente/:idCliente')
  @ApiOperation({
    summary: 'Lista de instalaciones por idCliente',
    description:
      'Param `idCliente`. Solo `Estatus = 1`. Mismo shape plano que el paginado ' +
      '(instalación → cliente → producto+detalle → dispositivo(+panel) → SIM; sin JSON anidados). ' +
      'El `idCliente` solicitado debe estar dentro del alcance del rol del token.',
  })
  @ApiParam({
    name: 'idCliente',
    description: 'ID del cliente propietario de las instalaciones',
    example: 1,
  })
  @ApiResponse({ status: 200, description: 'Lista obtenida correctamente' })
  @ApiResponse({ status: 400, description: 'idCliente inválido' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Cliente fuera de alcance' })
  async findAllByIdCliente(
    @Param('idCliente', ParseIntPipe) idCliente: number,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    return this.instalacionesService.findAllByIdCliente(
      idCliente,
      req.user.idCliente,
      req.user.rol,
    );
  }

  @Get('historico/:id')
  @ApiOperation({
    summary: 'Histórico de una instalación',
    description:
      'Devuelve la versión vigente (si existe) y la cadena de `HistoricoInstalaciones` de lo más reciente a lo más antiguo. ' +
      'Campos planos camelCase: producto (nombreTipoProducto, nombreProducto), dispositivo (nombreTipoDispositivo, numeroSerie, imei, nombreMarca, nombreModelo), SIM (imeiSim, numeroTelefonico). ' +
      'Sin idProducto/idDispositivo/idSim ni JSON anidados.',
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
      'Solo se permiten **0**, **1** y **5**, por el motor de activos (docs/motor-activos.md §13).\n' +
      '- **0 (inactivo) / 5 (inservible):** archiva el periodo en `HistoricoInstalaciones` (`Accion = Baja`, ' +
      '`VigenteHasta`), deja la fila con `Estatus` = 0 y saca los componentes: el dispositivo a por revisar (3), ' +
      'o inservible (5) si la baja es 5; la SIM a por revisar (3); el producto a activo (1). ' +
      'Las geocercas son del vehículo y no se borran. Una baja 0 se puede corregir a 5.\n' +
      '- **1 (reactivar):** los componentes deben estar disponibles (1, ya revisados); pasan a instalado (2) ' +
      'y se abre una versión nueva (`VigenteDesde` = ahora).\n' +
      'Una instalación activa no se reactiva y una dada de baja no se vuelve a dar de baja (400).',
  })
  @ApiParam({ name: 'id', description: 'ID de la instalación vigente' })
  @ApiBody({ type: BajaInstalacionDto })
  @ApiResponse({
    status: 200,
    description: 'Estatus actualizado correctamente',
  })
  @ApiResponse({ status: 400, description: 'Estatus inválido, componentes no disponibles o la instalación ya está en ese estado' })
  @ApiResponse({ status: 409, description: 'Un componente cambió de estatus mientras se procesaba' })
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

  @Patch(':id/corregir-cliente')
  @Roles(EnumRoles.SA, EnumRoles.DEV, EnumRoles.ADMIN, EnumRoles.JEFE_MONITOREO)
  @ApiOperation({
    summary: 'Corregir instalación capturada en el cliente equivocado',
    description:
      'Roles 1–4, con motivo. Cierra el periodo en el cliente actual (lo transmitido hasta ahora se queda con ese ' +
      'cliente) y regresa su vehículo a activo; el dispositivo y la SIM siguen instalados y pasan al cliente correcto, ' +
      'en una instalación nueva con el vehículo indicado (`idProducto`, disponible en ese cliente; se da de alta antes). ' +
      'Las asignaciones de usuarios de la instalación anterior no se trasladan; las geocercas se quedan con el vehículo anterior. Queda en ' +
      '`CorreccionesInstalacion` y en el historial de cada recurso. Responde el id de la instalación nueva.',
  })
  @ApiParam({ name: 'id', description: 'ID de la instalación (activa)' })
  @ApiBody({ type: CorregirClienteInstalacionDto })
  @ApiResponse({ status: 200, description: '`data.id` = instalación nueva; `data.idInstalacionAnterior` = la corregida' })
  @ApiResponse({ status: 400, description: 'Instalación inactiva, mismo cliente, cliente o vehículo inválido, sin motivo' })
  @ApiResponse({ status: 403, description: 'Solo roles 1–4' })
  @ApiResponse({ status: 404, description: 'Instalación no encontrada' })
  @ApiResponse({ status: 409, description: 'Un componente cambió mientras se procesaba' })
  async corregirCliente(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CorregirClienteInstalacionDto,
    @Request() req,
  ) {
    return this.instalacionesService.corregirCliente(id, dto, req.user.userId);
  }

  @Patch(':id/vigente-desde')
  @Roles(EnumRoles.SA, EnumRoles.DEV, EnumRoles.ADMIN, EnumRoles.JEFE_MONITOREO)
  @ApiOperation({
    summary: 'Corregir la fecha real de instalación',
    description:
      'Mueve `VigenteDesde` de la versión vigente **hacia atrás**, para una instalación dada de alta en Next ' +
      'después de que el equipo ya transmitía. Roles 1–4, con motivo. Solo instalaciones activas. ' +
      'Se rechaza si se traslapa con la versión anterior de la misma instalación o con otro periodo del ' +
      'mismo dispositivo o SIM. Queda en `CorreccionesInstalacion` y en bitácora. ' +
      'El histórico, los reportes y la consola recortan las posiciones a la vigencia: con la fecha corregida ' +
      'aparecen los recorridos anteriores al alta.',
  })
  @ApiParam({ name: 'id', description: 'ID de la instalación' })
  @ApiBody({ type: CorregirVigenteDesdeDto })
  @ApiResponse({ status: 200, description: 'Fecha corregida; `data.vigenteDesdeAnterior` trae la anterior' })
  @ApiResponse({ status: 400, description: 'Fecha futura o posterior a la actual, traslape, instalación inactiva o sin motivo' })
  @ApiResponse({ status: 403, description: 'Solo roles 1–4' })
  @ApiResponse({ status: 404, description: 'Instalación no encontrada' })
  @ApiResponse({ status: 409, description: 'La instalación cambió mientras se procesaba' })
  async corregirVigenteDesde(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CorregirVigenteDesdeDto,
    @Request() req,
  ) {
    return this.instalacionesService.corregirVigenteDesde(id, dto, req.user.userId);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar instalación (archiva + nueva versión)',
    description:
      'En una transacción: archiva la vigente en `HistoricoInstalaciones` con el ' +
      '`estatusInstalacionAnterior` enviado, crea una nueva ACTIVA (1), migra ' +
      '`UsuariosInstalaciones` al nuevo id y elimina la fila anterior; las geocercas son del vehículo y se quedan. ' +
      'Si cambia producto/dispositivo/SIM: el equipo o SIM nuevo debe estar disponible (1), del almacén o reservado al cliente; ' +
      'el vehículo nuevo, disponible o instalado con equipos de otra clase. Un cambio de equipo es de la misma clase ' +
      '(GPS por GPS, TrackCam por TrackCam). El que sale recibe `estatus*Anterior` (equipo y SIM: 3, 4 o 5). ' +
      'El que entra queda instalado (2). ' +
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
