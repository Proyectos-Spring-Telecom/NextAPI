import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MonitoreoService } from './monitoreo.service';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { FilterHistoricoMonitoreoDto } from './dto/filter-historico-monitoreo.dto';
import { CaptureVideoMonitoreoDto } from './dto/capture-video-monitoreo.dto';
import { CaptureFotoMonitoreoDto } from './dto/capture-foto-monitoreo.dto';
import { FilterInstalacionesUsuariosMonitoreoDto } from './dto/filter-instalaciones-usuarios.dto';

@ApiTags('Monitoreo')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('monitoreo')
export class MonitoreoController {
  constructor(private readonly monitoreoService: MonitoreoService) { }

  @Get('list')
  @ApiOperation({
    summary: 'Listado de instalaciones con última posición GPS',
    description: [
      'Devuelve instalaciones activas (listado y socket, mismo shape plano en camelCase).',
      'Incluye canales TrackcamConfig: canal1Activo…canal4Activo (null si no aplica).',
      'No requiere `idCliente` en la ruta; el alcance se resuelve por rol del token.',
      '',
      '**SA, Dev, Admin, JefeMonitoreo, Monitoreo, Técnico (1–5, 8):** todas las instalaciones activas.',
      '**Cliente (6):** instalaciones de su cliente y descendientes (`spGetClientes`).',
      '**Operador (7) y Usuario (9):** solo instalaciones asignadas en `UsuariosInstalaciones` (activas).',
      '',
      '**GPS (vehículo 1, activo 2, persona 4):** un solo objeto plano = contexto del producto +',
      'campos de `UltimaPosicion` (null si no hay fila). Sin JSON anidados.',
      'Vehículo (1) además: `colorVehiculo`, `numeroSerieVehiculo` (planos).',
      '',
      '**Inmueble / panel (3):** no usa UltimaPosicion ni rutas de foto/video.',
      'Campos: cliente, imei, inmueble, economico, numeroSerie, estatus, modelo, marca,',
      'lat/lng del inmueble, ultimoHeartbeat, fechaHora, ultimoEventoAlarma.',
      '',
      '**Socket.IO** `/monitoreo` (mismo shape plano que este listado):',
      '- `conexion:lista` → `{ idsInstalaciones, posicion, "puntos-interes" }` al conectar.',
      '- `monitoreo:actualizacion` → un ítem de `posicion[]` (tras ingest GPS / panel).',
      '- `conexion:consola` / `consola:actualizacion` → shape de `GET /monitoreo/consola` (UltimaPosicion).',
      '',
      'Respuesta: `{ posicion: [...], "puntos-interes": [...] }` (sin wrapper `data`).',
      '`puntos-interes`: activos de `PuntosInteres` filtrados por rol/tenant',
      '(1–5, 8 global; 6 jerarquía; 7/9 su `idCliente`).',
    ].join('\n'),
  })
  @ApiResponse({ status: 200, description: 'Listado obtenido correctamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 500, description: 'Error interno' })
  async findList(@Request() req) {
    return this.monitoreoService.listado(
      Number(req.user.userId),
      Number(req.user.idCliente),
      Number(req.user.rol),
    );
  }

  @Get('consola')
  @ApiOperation({
    summary: 'Consola — listado de UltimaPosicion',
    description: [
      'Lista filas de `UltimaPosicion` (plano, camelCase) ordenadas por `fechaHora` **DESC**',
      '(más reciente → más antigua).',
      '',
      'Alcance por rol (mismo criterio que `GET /monitoreo/list`):',
      '- Roles globales (1–5, 8): todas las últimas posiciones con instalación activa.',
      '- Cliente (6): instalaciones de su jerarquía.',
      '- Operador (7) / Usuario (9): solo instalaciones asignadas.',
      '',
      '**Respuesta:** `{ posicion: [...] }` (sin wrapper `data`, sin JSON anidados).',
      'Incluye contexto mínimo: `idInstalacion`, `idCliente`, `idDispositivo`.',
      '',
      '**Tiempo real (Socket.IO `/monitoreo`):**',
      '- Al conectar: `conexion:consola` → mismo `{ posicion: [...] }`.',
      '- Tras ingest GPS: `consola:actualizacion` → un ítem (rooms `instalacion:{id}`).',
    ].join('\n'),
  })
  @ApiResponse({ status: 200, description: 'Consola obtenida correctamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 500, description: 'Error interno' })
  async consola(@Request() req) {
    return this.monitoreoService.consola(
      Number(req.user.userId),
      Number(req.user.idCliente),
      Number(req.user.rol),
    );
  }

  @Post('instalaciones-usuarios')
  @ApiOperation({
    summary: 'Instalaciones de un cliente asignadas a usuarios',
    description: [
      'Body: `idCliente` + `idUsuarios[]` (mín. 1).',
      'Une instalaciones **activas** del cliente vía `UsuariosInstalaciones` (estatus 1).',
      'Los usuarios deben pertenecer al mismo `idCliente`.',
      'El cliente debe estar en el alcance del token.',
      '',
      '**Respuesta:** `{ posicion: [...] }` — mismo shape plano que `GET /monitoreo/list` (sin anidar, sin `puntos-interes`).',
      'Instalaciones únicas (si varios usuarios comparten una, aparece una sola vez).',
    ].join('\n'),
  })
  @ApiBody({ type: FilterInstalacionesUsuariosMonitoreoDto })
  @ApiResponse({ status: 200, description: 'Listado plano obtenido' })
  @ApiResponse({ status: 400, description: 'Datos inválidos / usuarios ajenos al cliente' })
  @ApiResponse({ status: 403, description: 'Cliente fuera de alcance' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findInstalacionesPorUsuarios(
    @Body() dto: FilterInstalacionesUsuariosMonitoreoDto,
    @Request() req,
  ) {
    return this.monitoreoService.listadoPorUsuarios(
      Number(dto.idCliente),
      dto.idUsuarios,
      Number(req.user.idCliente),
      Number(req.user.rol),
    );
  }

  @Post(':idInstalacion/foto')
  @ApiOperation({
    summary: 'Capturar foto Trackcam (proxy gateway)',
    description: [
      'Resuelve la instalación → dispositivo TRACKCAM y llama `POST /gateway/photo/start`.',
      'Reenvía al gateway el mismo JWT Bearer del usuario autenticado (Authorize / header de la petición; no se pide otro token).',
      'Body opcional: `{ "channelId": 1 }` (1–4).',
      'Sin `channelId` → todos los canales activos del registry (máx. 4).',
      'Timeout ≥ 90 s. Persistencia vía AMQP `jt808.position` (no duplica INSERT).',
    ].join('\n'),
  })
  @ApiParam({ name: 'idInstalacion', type: Number })
  @ApiResponse({ status: 200, description: 'Foto(s) capturada(s) en el gateway' })
  @ApiResponse({ status: 400, description: 'No es TRACKCAM / canal inactivo / datos inválidos' })
  @ApiResponse({ status: 404, description: 'Instalación no encontrada' })
  @ApiResponse({ status: 409, description: 'Cámara offline (gateway)' })
  @ApiResponse({ status: 504, description: 'Timeout gateway' })
  async capturarFoto(
    @Param('idInstalacion', ParseIntPipe) idInstalacion: number,
    @Body() body: CaptureFotoMonitoreoDto,
    @Request() req,
  ) {
    return this.monitoreoService.capturarFoto(
      idInstalacion,
      extractBearerToken(req.headers?.authorization),
      body?.channelId,
    );
  }

  @Post(':idInstalacion/video')
  @ApiOperation({
    summary: 'Capturar video Trackcam (proxy gateway)',
    description: [
      'Resuelve la instalación → dispositivo TRACKCAM y llama `POST /gateway/video/capture`.',
      'Reenvía al gateway el mismo JWT Bearer del usuario autenticado (Authorize / header de la petición; no se pide otro token).',
      'Body: `{ "durationSeconds"?: 15, "channelId"?: 1 }` (`channelId` 1–4 opcional).',
      'Sin `channelId` → paralelo en canales activos. Con `channelId` → un solo stream.',
      'Timeout: ~90 s (1 canal) / ~150 s (multi). Persistencia vía AMQP.',
    ].join('\n'),
  })
  @ApiParam({ name: 'idInstalacion', type: Number })
  @ApiResponse({ status: 200, description: 'Video(s) capturado(s) en el gateway' })
  @ApiResponse({ status: 400, description: 'No es TRACKCAM / canal inactivo / datos inválidos' })
  @ApiResponse({ status: 404, description: 'Instalación no encontrada' })
  @ApiResponse({ status: 409, description: 'Cámara offline (gateway)' })
  @ApiResponse({ status: 504, description: 'Timeout gateway' })
  async capturarVideo(
    @Param('idInstalacion', ParseIntPipe) idInstalacion: number,
    @Body() body: CaptureVideoMonitoreoDto,
    @Request() req,
  ) {
    return this.monitoreoService.capturarVideo(
      idInstalacion,
      extractBearerToken(req.headers?.authorization),
      {
        durationSeconds: body?.durationSeconds,
        channelId: body?.channelId,
      },
    );
  }

  @Get(':idInstalacion/historico')
  @ApiOperation({
    summary: 'Histórico de posiciones por instalación',
    description: [
      'Resuelve el IMEI del dispositivo de la instalación y consulta `Posiciones` entre `fechaInicio` y `fechaFinal` (inclusive).',
      'Las fechas del query se interpretan como **hora de pared** (`YYYY-MM-DD HH:mm:ss`), alineadas a `Posiciones.FechaHora` (sin conversión UTC).',
      'No aplica filtro por cliente del token; solo requiere JWT válido.',
      '**No aplica** a instalaciones de tipo inmueble / panel (3).',
      '',
      '**Respuesta:** `{ totalDistancia, posiciones: [...] }` (sin wrapper `data`).',
      'Posiciones en orden **DESC** por `fechaHora` (más reciente primero).',
      '`id` e `idPosicion` = `Posiciones.Id`.',
      '',
      'Cada ítem mantiene los campos históricos existentes y añade en plano (camelCase, sin anidar)',
      'el resto de `Posiciones` + `rutaFoto` / `rutaFoto1..3` / `rutaVideo1..3` (`Fotos.Ruta` / `Videos.Ruta`), null si faltan.',
      'Además incluye `nombreEvento` (CatEventos) según `idEvento`; null si el id es desconocido o ausente.',
      '',
      '**Cálculo de distancia (`totalDistancia`, km con 2 decimales):**',
      '- Fórmula Haversine entre **todos** los puntos consecutivos en el tiempo.',
      '- Orden de consulta y respuesta: **DESC**; el acumulado avanza de la posición más antigua a la más reciente.',
      '- Cada ítem incluye `totalDistancia` acumulada hasta ese punto (km).',
      '- No se filtran saltos GPS, drift ni coordenadas; la validación de posiciones se implementará más adelante.',
    ].join('\n'),
  })
  @ApiParam({ name: 'idInstalacion', type: Number })
  @ApiQuery({
    name: 'fechaInicio',
    required: true,
    example: '2026-09-02 13:28:00',
  })
  @ApiQuery({
    name: 'fechaFinal',
    required: true,
    example: '2026-09-02 14:29:00',
  })
  @ApiResponse({ status: 200, description: 'Histórico obtenido correctamente' })
  @ApiResponse({ status: 400, description: 'Parámetros inválidos o sin IMEI' })
  @ApiResponse({ status: 404, description: 'Instalación no encontrada' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findHistorico(
    @Param('idInstalacion', ParseIntPipe) idInstalacion: number,
    @Query() query: FilterHistoricoMonitoreoDto,
  ) {
    return this.monitoreoService.reporteHistorico(
      idInstalacion,
      query.fechaInicio,
      query.fechaFinal,
    );
  }
}

function extractBearerToken(authorization?: string): string {
  const token = String(authorization ?? '')
    .replace(/^Bearer\s+/i, '')
    .trim();
  if (!token) {
    throw new UnauthorizedException('Falta Authorization Bearer');
  }
  return token;
}
