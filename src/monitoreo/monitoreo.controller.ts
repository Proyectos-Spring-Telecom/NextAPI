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
import {
  MONITOREO_DISTANCIA_DEFAULTS,
  MONITOREO_DISTANCIA_ENV,
} from './helpers/monitoreo-distancia.config';

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
      'No requiere `idCliente` en la ruta; el alcance se resuelve por rol del token.',
      '',
      '**SA, Dev, Admin, JefeMonitoreo, Monitoreo, Técnico (1–5, 8):** todas las instalaciones activas.',
      '**Cliente (6):** instalaciones de su cliente y descendientes (`spGetClientes`).',
      '**Operador (7) y Usuario (9):** solo instalaciones asignadas en `UsuariosInstalaciones` (activas).',
      '',
      '**GPS (vehículo 1, activo 2, persona 4):** un solo objeto plano = contexto del producto +',
      'campos de `UltimaPosicion` (null si no hay fila). Sin JSON anidados.',
      '',
      '**Inmueble / panel (3):** no usa UltimaPosicion ni rutas de foto/video.',
      'Campos: cliente, imei, inmueble, economico, numeroSerie, estatus, modelo, marca,',
      'lat/lng del inmueble, ultimoHeartbeat, fechaHora, ultimoEventoAlarma.',
      '',
      '**Socket.IO** `/monitoreo` (mismo shape plano que este listado):',
      '- `conexion:lista` → `{ idsInstalaciones, posicion }` al conectar.',
      '- `monitoreo:actualizacion` → un ítem de `posicion[]` (tras ingest GPS / panel).',
      '',
      'Respuesta: `{ posicion: [...] }` (sin wrapper `data`).',
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

  @Post(':idInstalacion/foto')
  @ApiOperation({
    summary: 'Capturar foto Trackcam (proxy gateway)',
    description: [
      'Resuelve la instalación → dispositivo TRACKCAM y llama `POST /gateway/photo/start`.',
      'Reenvía al gateway el mismo JWT Bearer del usuario autenticado (Authorize / header de la petición; no se pide otro token).',
      'Body opcional: `{ "channelId": 1 }` (1–5).',
      'Sin `channelId` → todos los canales activos del registry (máx. 3).',
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
      'Body: `{ "durationSeconds"?: 15, "channelId"?: 1 }` (`channelId` 1–5 opcional).',
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
      '',
      '**Cálculo de distancia (`totalDistancia`, km con 2 decimales):**',
      '- Fórmula Haversine entre puntos consecutivos en el tiempo.',
      '- Orden de consulta y respuesta: **DESC**; el acumulado avanza de la posición más antigua a la más reciente.',
      '- Cada ítem incluye `totalDistancia` acumulada hasta ese punto (km).',
      '',
      '**Importante:** no se eliminan posiciones del arreglo; solo se discriminan **segmentos** al sumar distancia:',
      '',
      `1. **Coordenada inválida** → el punto no entra al recorrido y su \`totalDistancia\` es \`null\`:`,
      '   - `lat`/`lng` no numéricos, `(0, 0)`, `|lat| > 90` o `|lng| > 180`.',
      '   - El punto **sí aparece** en `posiciones[]`.',
      '',
      `2. **Salto GPS** → no suma el tramo si la distancia entre consecutivos supera \`${MONITOREO_DISTANCIA_ENV.saltoGpsMetros}\` (metros; default **${MONITOREO_DISTANCIA_DEFAULTS.saltoGpsMetros}** = ${MONITOREO_DISTANCIA_DEFAULTS.saltoGpsMetros / 1000} km).`,
      '   - Típico de pérdida de señal o fix erróneo.',
      '',
      `3. **Drift estacionado** → no suma si el tramo es menor a \`${MONITOREO_DISTANCIA_ENV.driftDetenidoMetros}\` (metros; default **${MONITOREO_DISTANCIA_DEFAULTS.driftDetenidoMetros}**) y **ambos** extremos están detenidos.`,
      '',
      '4. **Vehículo detenido en ambos extremos** → no suma el tramo si ninguno de los dos puntos está en movimiento.',
      '',
      '**En movimiento** = `Movimiento === 1` **o** `Velocidad > 0`.',
      'Un segmento **sí suma** si al menos un extremo está en movimiento y no cae en las reglas anteriores.',
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
