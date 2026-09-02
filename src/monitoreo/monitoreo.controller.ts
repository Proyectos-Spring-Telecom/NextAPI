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
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { MonitoreoService } from './monitoreo.service';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { FilterHistoricoMonitoreoDto } from './dto/filter-historico-monitoreo.dto';
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
      'Devuelve instalaciones activas con telemetría (`UltimaPosicion`) y campos según tipo de producto.',
      'No requiere `idCliente` en la ruta; el alcance se resuelve por rol del token.',
      '',
      '**SA, Dev, Admin, JefeMonitoreo, Monitoreo, Técnico (1–5, 8):** todas las instalaciones activas.',
      '**Cliente (6):** instalaciones de su cliente y descendientes (`spGetClientes`).',
      '**Operador (7) y Usuario (9):** solo instalaciones asignadas en `UsuariosInstalaciones` (activas).',
      '',
      'Cada elemento de `posicion` incluye solo los campos del tipo:',
      '- **Vehículo (1):** cliente, placa, económico, marca, modelo, ignición, velocidad, direccion, fechaHora, nivelCombustible, odometro, gps, gsm, lat, lng.',
      '- **Activo (2):** cliente, imei, descripcion, economico, numeroSerie, estatus, odometro, gps, gsm, direccion, modelo, marca, fechaHora, ultimaPosicion, lat, lng.',
      '- **Inmueble / panel (3):** cliente, imei, inmueble, economico, numeroSerie, estatus, modelo, marca, lat, lng, ultimoHeartbeat, fechaHora (último evento), ultimoEventoAlarma (`UltimoEventoAlarma`; no usa `UltimaPosicion`).',
      '- **Persona / teléfono (4):** cliente, imei, persona, economico, numeroSerie, estatus, odometro, gps, gsm, direccion, modelo, marca, fechaHora, ultimaPosicion, lat, lng.',
      '',
      '**Socket.IO** namespace `/monitoreo`:',
      '- Conexión con JWT (`auth.token`).',
      '- `conexion:lista` → `{ idsInstalaciones: number[] }` según rol.',
      '- `monitoreo:actualizacion` → mismo shape que un ítem de `posicion[]`.',
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


  @Get(':idInstalacion/historico')
  @ApiOperation({
    summary: 'Histórico de posiciones por instalación',
    description: [
      'Resuelve el IMEI del dispositivo de la instalación y consulta `Posiciones` entre `fechaInicio` y `fechaFinal` (inclusive).',
      'No aplica filtro por cliente del token; solo requiere JWT válido.',
      '',
      '**Respuesta:** `{ totalDistancia, posiciones: [...] }` (sin wrapper `data`).',
      'Posiciones en orden **DESC** por `fechaHora` (más reciente primero).',
      '`id` e `idPosicion` = `Posiciones.Id`.',
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
