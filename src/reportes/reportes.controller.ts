import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { PasoPorPoiDto } from './dto/paso-por-poi.dto';
import { VelocidadDto } from './dto/velocidad.dto';
import { ReportePosicionesDto } from './dto/reporte-posiciones.dto';
import { UltimaPosicionDto } from './dto/ultima-posicion.dto';
import { DistanciaDto } from './dto/distancia.dto';
import { ReporteSalidasGeocercaDto } from './dto/salidas-geocerca.dto';
import { ReporteSalidasGeocercaInstalacionDto } from './dto/salidas-geocerca-instalacion.dto';
import { RecorridoSalidaGeocercaDto } from './dto/recorrido-salida-geocerca.dto';
import { ReportesService } from './reportes.service';

@ApiTags('Reportes')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('reportes')
export class ReportesController {
  constructor(private readonly service: ReportesService) {}

  @Post('paso-por-poi')
  @ApiOperation({
    summary: 'Dispositivos que pasaron por uno o más puntos de interés',
    description: [
      'Por cada POI cuenta **dispositivos distintos** (instalaciones) con al menos una posición',
      'dentro de su radio (`PuntosInteres.RadioMetros`) en el periodo indicado.',
      '',
      '**Body:**',
      '- `idCliente` + `idsPuntoInteres` (1..N; todos deben ser del cliente).',
      '- `fechaInicio` / `fechaFinal` (inclusive, hora de pared como `Posiciones.FechaHora`).',
      '- `filtro` + `valores` opcionales para acotar instalaciones:',
      '  - `imei` / `numeroSerie` → busca en `Dispositivos`.',
      '  - `placa` / `economico` → busca en `Vehiculos`.',
      '  - Sin `filtro` → todas las instalaciones **activas** del cliente con dispositivo e IMEI.',
      '  - Con filtro sin coincidencias → respuesta vacía (0 dispositivos/posiciones).',
      '',
      '**Respuesta:** `data.puntos[]` (detalle por POI) y `data.totalDispositivosUnicos`',
      '(unión de dispositivos que pasaron por al menos un POI).',
      'En cada POI: `dispositivos` (resumen) y `posiciones` (filas planas con campos de',
      '`Posiciones` + producto: base + vehículo (placa/eco/marca/modelo/anio/foto)',
      '+ activo + persona; sin atributos de inmueble).',
      '',
      '**Exclusiones:** tipo panel de alarma (`idTipoDispositivo = 2`).',
      '',
      '**Alcance:** `idCliente` debe estar visible según el rol del token.',
    ].join('\n'),
  })
  @ApiBody({ type: PasoPorPoiDto })
  @ApiOkResponse({
    description:
      'Reporte generado (`data.puntos` con `dispositivos`, `posiciones` planas + producto, y `totalDispositivosUnicos`)',
  })
  @ApiBadRequestResponse({
    description: 'Fechas inválidas / filtro inválido / POI de otro cliente',
  })
  @ApiForbiddenResponse({ description: 'Cliente fuera de alcance' })
  @ApiNotFoundResponse({
    description: 'Uno o más puntos de interés no encontrados',
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async pasoPorPuntoInteres(@Body() dto: PasoPorPoiDto, @Request() req) {
    return this.service.pasoPorPuntoInteres(
      dto,
      Number(req.user.idCliente),
      Number(req.user.rol),
    );
  }

  @Post('velocidad')
  @ApiOperation({
    summary: 'Posiciones de vehículos con velocidad mínima',
    description: [
      'Obtiene posiciones de **productos vehículo** cuya `Posiciones.Velocidad`',
      'sea **>=** al umbral `velocidad` en el periodo indicado.',
      '',
      '**Body:**',
      '- `idCliente` + `velocidad` (mínima, inclusive).',
      '- `fechaInicio` / `fechaFinal` (inclusive, hora de pared como `Posiciones.FechaHora`).',
      '- `filtro` + `valores` opcionales (misma lógica que paso-por-poi):',
      '  - `imei` / `numeroSerie` → `Dispositivos`.',
      '  - `placa` / `economico` → `Vehiculos`.',
      '  - Sin `filtro` → todas las instalaciones activas de vehículos del cliente.',
      '  - Con filtro sin coincidencias → respuesta vacía.',
      '',
      '**Respuesta:** `data.posiciones[]` con campos de `Posiciones` + vehículo:',
      '`imei`, `id` (posición), `placas`, `economico`, `descripcion`, `lat`, `lng`,',
      '`estado`, `ignicion`, `velocidad`, `fechaHora`, `modelo`, `numeroSerie`,',
      '`imagen`, `idProducto`.',
      '',
      '**Exclusiones:** paneles de alarma; productos que no sean vehículo.',
      '',
      '**Alcance:** `idCliente` debe estar visible según el rol del token.',
    ].join('\n'),
  })
  @ApiBody({ type: VelocidadDto })
  @ApiOkResponse({
    description:
      'Reporte de velocidad (`data.posiciones` + `data.total`)',
  })
  @ApiBadRequestResponse({
    description: 'Fechas inválidas / filtro inválido / velocidad inválida',
  })
  @ApiForbiddenResponse({ description: 'Cliente fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async velocidad(@Body() dto: VelocidadDto, @Request() req) {
    return this.service.velocidad(
      dto,
      Number(req.user.idCliente),
      Number(req.user.rol),
    );
  }

  @Post('posiciones')
  @ApiOperation({
    summary: 'Posiciones por cliente y periodo',
    description: [
      'Obtiene filas de `Posiciones` en el periodo indicado para las instalaciones',
      'resueltas con `filtro` / `valores` (misma lógica que los demás reportes).',
      '',
      '**Body:**',
      '- `idCliente` + `fechaInicio` / `fechaFinal`.',
      '- `filtro` + `valores` opcionales:',
      '  - `imei` / `numeroSerie` → `Dispositivos`.',
      '  - `placa` / `economico` → `Vehiculos`.',
      '  - Sin `filtro` → todas las instalaciones activas del cliente con dispositivo e IMEI.',
      '  - Con filtro sin coincidencias → respuesta vacía.',
      '',
      '**Respuesta:** `data.posiciones[]` plano (sin JSON anidado):',
      '- Contexto: `idInstalacion`, `idDispositivo`, `numeroSerie`.',
      '- Producto (mismos nombres que listado de instalaciones): base + vehículo / activo /',
      '  inmueble / persona según tipo (campos de otros tipos en `null`).',
      '- Telemetría: campos de la tabla `Posiciones`.',
      '',
      '**Exclusiones:** tipo panel de alarma (`idTipoDispositivo = 2`).',
      '',
      '**Alcance:** `idCliente` debe estar visible según el rol del token.',
    ].join('\n'),
  })
  @ApiBody({ type: ReportePosicionesDto })
  @ApiOkResponse({
    description:
      'Reporte de posiciones (`data.posiciones` plano con producto + `data.total`)',
  })
  @ApiBadRequestResponse({
    description: 'Fechas inválidas / filtro inválido',
  })
  @ApiForbiddenResponse({ description: 'Cliente fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async posiciones(@Body() dto: ReportePosicionesDto, @Request() req) {
    return this.service.posiciones(
      dto,
      Number(req.user.idCliente),
      Number(req.user.rol),
    );
  }

  @Post('ultima-posicion')
  @ApiOperation({
    summary: 'Última posición por cliente y periodo',
    description: [
      'Misma lógica que `posiciones`, pero consulta `UltimaPosicion`',
      '(una fila por IMEI) filtrada por `FechaHora` en el periodo.',
      '',
      '**Body:**',
      '- `idCliente` + `fechaInicio` / `fechaFinal`.',
      '- `filtro` + `valores` opcionales:',
      '  - `imei` / `numeroSerie` → `Dispositivos`.',
      '  - `placa` / `economico` → `Vehiculos`.',
      '  - Sin `filtro` → todas las instalaciones activas del cliente con dispositivo e IMEI.',
      '  - Con filtro sin coincidencias → respuesta vacía.',
      '',
      '**Respuesta:** `data.posiciones[]` plano (sin JSON anidado):',
      '- Contexto: `idInstalacion`, `idDispositivo`, `numeroSerie`.',
      '- Producto (mismos nombres que listado de instalaciones): base + vehículo / activo /',
      '  inmueble / persona según tipo (campos de otros tipos en `null`).',
      '- Telemetría: campos de `UltimaPosicion`.',
      'Orden: `fechaHora` DESC, `id` DESC.',
      '',
      '**Exclusiones:** tipo panel de alarma (`idTipoDispositivo = 2`).',
      '',
      '**Alcance:** `idCliente` debe estar visible según el rol del token.',
    ].join('\n'),
  })
  @ApiBody({ type: UltimaPosicionDto })
  @ApiOkResponse({
    description:
      'Reporte de última posición (`data.posiciones` plano con producto + `data.total`)',
  })
  @ApiBadRequestResponse({
    description: 'Fechas inválidas / filtro inválido',
  })
  @ApiForbiddenResponse({ description: 'Cliente fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async ultimaPosicion(@Body() dto: UltimaPosicionDto, @Request() req) {
    return this.service.ultimaPosicion(
      dto,
      Number(req.user.idCliente),
      Number(req.user.rol),
    );
  }

  @Post('distancia')
  @ApiOperation({
    summary: 'Distancia recorrida por instalación / IMEI',
    description: [
      'Calcula la distancia Haversine del recorrido en el periodo, con la **misma lógica**',
      'que `GET /monitoreo/:idInstalacion/historico` (`calcularDistanciaHistoricoMonitoreo`):',
      'suma **todos** los tramos consecutivos (sin filtrar saltos ni drift).',
      '',
      '**Body:**',
      '- `idCliente` + `fechaInicio` / `fechaFinal`.',
      '- `filtro` + `valores` opcionales (misma lógica que posiciones):',
      '  - `imei` / `numeroSerie` → `Dispositivos`.',
      '  - `placa` / `economico` → `Vehiculos`.',
      '  - Sin `filtro` → todas las instalaciones activas del cliente con dispositivo e IMEI.',
      '  - Con filtro sin coincidencias → respuesta vacía.',
      '',
      '**Respuesta:** `data.recorridos[]` (uno por IMEI) con:',
      '- `totalDistancia` del recorrido (km, 2 decimales).',
      '- `posiciones[]` en orden DESC; cada ítem incluye `totalDistancia` acumulada',
      '  desde el punto más antiguo hasta ese punto.',
      '- `data.totalDistancia` = suma de los recorridos.',
      '',
      '**Campos nuevos:** `recorridos[].placas`, `economico`, `descripcion`, `porDia[]` (km por día,',
      'un punto por cada día del periodo, 0 sin movimiento) y `posiciones[].distanciaTramo`',
      '(km desde la posición anterior; 0 en la más antigua).',
      '',
      '**Paginación (opcional):** `page` (≥1) y `limit` (1..200, default 20).',
      '- Con alguno → `data.filas` (renglones ligeros, orden `fechaHora` DESC) + `paginated`;',
      '  `recorridos[].posiciones` va vacío. Totales y `porDia` siempre son del periodo completo.',
      '- Sin ambos → respuesta completa como antes (uso: exportar).',
      '',
      '**Exclusiones:** tipo panel de alarma (`idTipoDispositivo = 2`).',
      '',
      '**Alcance:** `idCliente` debe estar visible según el rol del token.',
    ].join('\n'),
  })
  @ApiBody({
    type: DistanciaDto,
    examples: {
      completo: {
        summary: 'Distancia completa en el periodo (sin paginar)',
        value: {
          idCliente: 15,
          fechaInicio: '2026-09-01 00:00:00',
          fechaFinal: '2026-09-03 23:59:59',
          filtro: 'imei',
          valores: ['860123456789012'],
        },
      },
      paginado: {
        summary: 'Distancia paginada (página 1, 20 renglones)',
        value: {
          idCliente: 15,
          fechaInicio: '2026-09-01 00:00:00',
          fechaFinal: '2026-09-03 23:59:59',
          filtro: 'imei',
          valores: ['860123456789012'],
          page: 1,
          limit: 20,
        },
      },
    },
  })
  @ApiOkResponse({
    description:
      'Reporte de distancia (`data.recorridos` con `totalDistancia`, `porDia` y acumulado por punto; en modo paginado, `data.filas` + `paginated` y `recorridos[].posiciones` vacío)',
    schema: {
      example: {
        data: {
          idCliente: 15,
          fechaInicio: '2026-09-01 00:00:00',
          fechaFinal: '2026-09-03 23:59:59',
          totalDistancia: 12.5,
          totalRecorridos: 1,
          totalPosiciones: 2,
          recorridos: [
            {
              idInstalacion: 25,
              idDispositivo: 18,
              imei: '860123456789012',
              numeroSerie: 'NS-001',
              placas: 'ABC123',
              economico: 'ECO-01',
              descripcion: 'Unidad Demo',
              totalDistancia: 12.5,
              total: 2,
              porDia: [
                { fecha: '2026-09-01', km: 0 },
                { fecha: '2026-09-02', km: 12.5 },
                { fecha: '2026-09-03', km: 0 },
              ],
              posiciones: [],
            },
          ],
          filas: [
            {
              idInstalacion: 25,
              idPosicion: 1002,
              imei: '860123456789012',
              placas: 'ABC123',
              economico: 'ECO-01',
              descripcion: 'Unidad Demo',
              fechaHora: '2026-09-02T10:30:00',
              lat: 18.921,
              lng: -99.234,
              velocidad: 40,
              ignicion: 1,
              estado: 1,
              distanciaTramo: 12.5,
              distanciaAcumulada: 12.5,
            },
            {
              idInstalacion: 25,
              idPosicion: 1001,
              imei: '860123456789012',
              placas: 'ABC123',
              economico: 'ECO-01',
              descripcion: 'Unidad Demo',
              fechaHora: '2026-09-01T08:00:00',
              lat: 18.92,
              lng: -99.235,
              velocidad: 0,
              ignicion: 1,
              estado: 1,
              distanciaTramo: 0,
              distanciaAcumulada: 0,
            },
          ],
        },
        paginated: { total: 2, page: 1, limit: 20, totalPages: 1 },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Fechas inválidas / filtro inválido',
  })
  @ApiForbiddenResponse({ description: 'Cliente fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async distancia(@Body() dto: DistanciaDto, @Request() req) {
    return this.service.distancia(
      dto,
      Number(req.user.idCliente),
      Number(req.user.rol),
    );
  }

  @Post('salidas-geocerca')
  @ApiOperation({
    summary: 'Reporte de salidas de geocerca',
    description: [
      'Consulta las salidas de geocercas detectadas a partir de las posiciones históricas GPS',
      'de los dispositivos de monitoreo, respetando los clientes, roles y permisos del usuario autenticado.',
      '',
      'Analiza `Posiciones` en orden cronológico y registra un evento solo en la transición',
      '**DENTRO → FUERA** de cada geocerca (no uno por cada posición fuera). Si después vuelve',
      'a entrar, el evento se cierra con `fechaReingreso` y `duracionFueraSegundos`.',
      'Es un reporte histórico de solo lectura: no modifica posiciones, no altera el monitoreo',
      'en tiempo real ni envía alertas.',
      '',
      '**Body:**',
      '- `idCliente` + `fechaInicio` / `fechaFinal` (inclusive, hora de pared como `Posiciones.FechaHora`).',
      '- `idsGeocerca` opcional (1..N; todas deben ser del cliente y estar activas).',
      '  Sin `idsGeocerca` → todas las geocercas activas aplicables a las instalaciones autorizadas.',
      '- `filtro` + `valores` opcionales para acotar instalaciones:',
      '  - `imei` / `numeroSerie` → busca en `Dispositivos`.',
      '  - `placa` / `economico` → busca en `Vehiculos`.',
      '  - Sin `filtro` → todas las instalaciones **activas** del cliente con dispositivo e IMEI.',
      '  - Con filtro sin coincidencias → respuesta vacía (0 salidas).',
      '',
      '**Paginación (opcional):** `page` (≥1) y `limit` (1..200, default 20).',
      '- Si se envía alguno → `data.salidas` trae solo esa página y la respuesta incluye',
      '  `paginated: { total, page, limit, totalPages }`. `data.resumen` siempre es del total.',
      '- Sin `page` ni `limit` → todas las salidas, sin `paginated` (uso: exportar).',
      '- Orden: `fechaSalida` descendente (más reciente primero).',
      '',
      '**Aplicabilidad:** una geocerca solo se evalúa contra la instalación de su',
      '`Geocercas.IdInstalacion` (misma regla que la evaluación en tiempo real);',
      'las geocercas sin instalación asociada no se atribuyen a ningún dispositivo.',
      '',
      '**Detección:**',
      '- `fechaSalida` es la primera posición detectada fuera (no se interpola el cruce exacto).',
      '- Si la primera posición del periodo ya está fuera, solo se confirma la salida cuando',
      '  la última posición anterior al periodo estaba dentro; sin esa evidencia no se registra.',
      '- Se ignoran posiciones duplicadas, coordenadas inválidas (incl. `0,0`) y geocercas sin geometría válida.',
      '',
      '**Respuesta:** `data.resumen` (`totalSalidas`, `totalDispositivos`, `totalGeocercas`,',
      '`instalacionesEvaluadas`, `geocercasEvaluadas`) y `data.salidas[]` con cliente, instalación,',
      'dispositivo (IMEI / serie / placas / económico), geocerca, `fechaSalida`, `latSalida`, `lngSalida`,',
      '`ultimaPosicionDentro`, `primeraPosicionFuera`, `fechaReingreso`, `duracionFueraSegundos` y `estadoEvento`.',
      '',
      '**Estados del evento (`estadoEvento`):**',
      '- `REINGRESO_DETECTADO`: se detectó una posición posterior dentro de la geocerca;',
      '  incluye `fechaReingreso` y `duracionFueraSegundos`.',
      '- `SIN_REINGRESO`: no volvió a entrar dentro del periodo; `fechaReingreso` y',
      '  `duracionFueraSegundos` van en `null`.',
      '- `tiempoAcumuladoSegundos`: con reingreso = `duracionFueraSegundos`; sin reingreso = hasta la última',
      '  posición registrada del periodo (`tiempoAcumuladoHasta`). Nunca hasta `fechaFinal` ni hasta hoy.',
      '',
      '**Exclusiones:** tipo panel de alarma (`idTipoDispositivo = 2`).',
      '',
      '**Alcance:** `idCliente` debe estar visible según el rol del token; las geocercas e',
      'instalaciones de otro cliente nunca se exponen, aunque se manipulen los parámetros.',
    ].join('\n'),
  })
  @ApiBody({
    type: ReporteSalidasGeocercaDto,
    examples: {
      ejemplo: {
        summary: 'Salidas por placa en el periodo',
        value: {
          idCliente: 15,
          fechaInicio: '2026-10-01 00:00:00',
          fechaFinal: '2026-10-20 23:59:59',
          idsGeocerca: [1, 2, 3],
          filtro: 'placa',
          valores: ['ABC123'],
        },
      },
      paginado: {
        summary: 'Salidas paginadas (página 1, 20 por página)',
        value: {
          idCliente: 15,
          fechaInicio: '2026-10-01 00:00:00',
          fechaFinal: '2026-10-20 23:59:59',
          idsGeocerca: [1, 2, 3],
          filtro: 'placa',
          valores: ['ABC123'],
          page: 1,
          limit: 20,
        },
      },
    },
  })
  @ApiOkResponse({
    description:
      'Reporte generado (`data.resumen` + `data.salidas` con eventos DENTRO → FUERA)',
    schema: {
      example: {
        data: {
          idCliente: 15,
          nombreCliente: 'Cliente Demo',
          fechaInicio: '2026-10-01 00:00:00',
          fechaFinal: '2026-10-20 23:59:59',
          resumen: {
            totalSalidas: 2,
            totalDispositivos: 1,
            totalGeocercas: 1,
            instalacionesEvaluadas: 1,
            geocercasEvaluadas: 1,
          },
          salidas: [
            {
              idCliente: 15,
              nombreCliente: 'Cliente Demo',
              idInstalacion: 25,
              idDispositivo: 18,
              imei: '123456789012345',
              numeroSerie: 'NS-001',
              placas: 'ABC123',
              economico: 'ECO-01',
              idGeocerca: 10,
              nombreGeocerca: 'Zona Norte',
              fechaSalida: '2026-10-15T10:30:00',
              latSalida: 18.921,
              lngSalida: -99.234,
              ultimaPosicionDentro: {
                idPosicion: 1001,
                fechaHora: '2026-10-15T10:29:00',
                lat: 18.92,
                lng: -99.235,
              },
              primeraPosicionFuera: {
                idPosicion: 1002,
                fechaHora: '2026-10-15T10:30:00',
                lat: 18.921,
                lng: -99.234,
              },
              fechaReingreso: '2026-10-15T11:20:00',
              duracionFueraSegundos: 3000,
              tiempoAcumuladoSegundos: 3000,
              tiempoAcumuladoHasta: '2026-10-15T11:20:00',
              estadoEvento: 'REINGRESO_DETECTADO',
            },
          ],
        },
        paginated: { total: 2, page: 1, limit: 20, totalPages: 1 },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Fechas inválidas / filtro inválido / validación del body',
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado (JWT ausente o inválido)' })
  @ApiForbiddenResponse({ description: 'Cliente fuera de alcance' })
  @ApiNotFoundResponse({
    description: 'Una o más geocercas no encontradas o de otro cliente',
  })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor' })
  async salidasGeocerca(
    @Body() dto: ReporteSalidasGeocercaDto,
    @Request() req,
  ) {
    return this.service.salidasGeocerca(
      dto,
      Number(req.user.idCliente),
      Number(req.user.rol),
    );
  }

  @Post('salidas-geocerca-instalacion')
  @ApiOperation({
    summary: 'Salidas de geocerca por instalación',
    description: [
      'Genera el reporte histórico de salidas de geocerca para una instalación específica utilizando sus posiciones GPS de monitoreo.',
      '',
      'Variante por **una sola instalación** del reporte de salidas de geocerca, pensada para',
      'la pantalla de Reportes donde el usuario selecciona una unidad específica.',
      'Detecta transiciones **DENTRO → FUERA** en las posiciones históricas GPS de esa',
      'instalación, respetando clientes, roles y permisos del usuario autenticado.',
      'Es histórico y de solo lectura: no calcula nada en el cliente, no altera el monitoreo',
      'en tiempo real ni envía alertas.',
      '',
      '**Dispositivo en el periodo:** el dispositivo consultado es el asociado a la instalación',
      'en cada tramo del periodo, resuelto desde `Instalaciones.VigenteDesde` y la cadena de',
      '`HistoricoInstalaciones` (`VigenteDesde`/`VigenteHasta`). Si hubo cambio de dispositivo,',
      'cada tramo consulta solo posiciones de su IMEI dentro de su vigencia (ver',
      '`data.dispositivosEnPeriodo`); no se asume que el dispositivo actual estuvo todo el periodo',
      'ni se mezclan posiciones de otros dispositivos.',
      '',
      '**Body:**',
      '- `idInstalacion` **obligatoria** (una sola; no se aceptan listas de instalaciones).',
      '  El cliente se deriva de la instalación y se valida contra el alcance del token.',
      '- `fechaInicio` / `fechaFinal` (inclusive, hora de pared como `Posiciones.FechaHora`).',
      '- `idsGeocerca` opcional (1..N): geocercas del cliente de la instalación, activas y',
      '  asociadas a esta instalación. Sin `idsGeocerca` → todas las asociadas a la instalación.',
      '',
      '**Respuesta:**',
      '- `data.instalacion`: cabecera de la unidad (`imei`, `numeroSerie`, `placas`, `economico`,',
      '  producto) para mostrar junto al cliente (`idCliente`, `nombreCliente`) y el periodo.',
      '- `data.resumen`: `totalSalidas`, `totalGeocercas` (geocercas involucradas) y `geocercasEvaluadas`.',
      '- `data.salidas[]`: `nombreGeocerca` (vía `idGeocerca`), `fechaSalida`, `fechaReingreso`,',
      '  `duracionFueraSegundos`, `estadoEvento` y, para el detalle en mapa, `geocercaGeometria`',
      '  (polígono GeoJSON), `ultimaPosicionDentro`, `primeraPosicionFuera` y `posicionReingreso`.',
      '  No se dibujan trayectorias: solo esos puntos reales y el polígono.',
      '',
      '**Estados del evento (`estadoEvento`):**',
      '- `REINGRESO_DETECTADO`: volvió a entrar; incluye `fechaReingreso`, `posicionReingreso` y duración.',
      '- `SIN_REINGRESO`: no volvió a entrar en el periodo; esos campos van en `null`.',
      '',
      '**Exclusiones:** instalaciones inactivas, sin dispositivo/IMEI o panel de alarma → sin salidas.',
    ].join('\n'),
  })
  @ApiBody({
    type: ReporteSalidasGeocercaInstalacionDto,
    examples: {
      ejemplo: {
        summary: 'Salidas de una instalación en el periodo',
        value: {
          idInstalacion: 125,
          fechaInicio: '2026-10-01 00:00:00',
          fechaFinal: '2026-10-20 23:59:59',
          idsGeocerca: [10, 15],
        },
      },
    },
  })
  @ApiOkResponse({
    description:
      'Reporte por instalación (`data.instalacion` + `data.resumen` + `data.salidas`)',
    schema: {
      example: {
        data: {
          idCliente: 15,
          nombreCliente: 'Cliente Demo',
          fechaInicio: '2026-10-01 00:00:00',
          fechaFinal: '2026-10-20 23:59:59',
          instalacion: {
            idInstalacion: 125,
            idDispositivo: 18,
            imei: '123456789012345',
            numeroSerie: 'NS-001',
            placas: 'ABC123',
            economico: 'ECO-01',
            idProducto: 40,
            nombreProducto: 'Unidad 01',
          },
          dispositivosEnPeriodo: [
            {
              idDispositivo: 18,
              idProducto: 40,
              imei: '123456789012345',
              numeroSerie: 'NS-001',
              placas: 'ABC123',
              economico: 'ECO-01',
              vigenteDesde: '2026-09-15 09:00:00',
              vigenteHasta: null,
              desde: '2026-10-01 00:00:00',
              hasta: '2026-10-20 23:59:59',
            },
          ],
          resumen: {
            totalSalidas: 2,
            totalGeocercas: 1,
            geocercasEvaluadas: 2,
          },
          salidas: [
            {
              idCliente: 15,
              nombreCliente: 'Cliente Demo',
              idInstalacion: 125,
              idDispositivo: 18,
              imei: '123456789012345',
              numeroSerie: 'NS-001',
              placas: 'ABC123',
              economico: 'ECO-01',
              idGeocerca: 10,
              nombreGeocerca: 'Zona Norte',
              geocercaGeometria: {
                type: 'Polygon',
                coordinates: [
                  [
                    [-99.14, 19.43],
                    [-99.13, 19.43],
                    [-99.13, 19.44],
                    [-99.14, 19.44],
                    [-99.14, 19.43],
                  ],
                ],
              },
              fechaSalida: '2026-10-15T10:30:00',
              latSalida: 18.921,
              lngSalida: -99.234,
              ultimaPosicionDentro: {
                idPosicion: 1001,
                fechaHora: '2026-10-15T10:29:00',
                lat: 18.92,
                lng: -99.235,
              },
              primeraPosicionFuera: {
                idPosicion: 1002,
                fechaHora: '2026-10-15T10:30:00',
                lat: 18.921,
                lng: -99.234,
              },
              fechaReingreso: '2026-10-15T11:20:00',
              posicionReingreso: {
                idPosicion: 1010,
                fechaHora: '2026-10-15T11:20:00',
                lat: 18.92,
                lng: -99.235,
              },
              duracionFueraSegundos: 3000,
              estadoEvento: 'REINGRESO_DETECTADO',
            },
          ],
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'Fechas inválidas / validación del body / geocerca no asociada a la instalación',
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado (JWT ausente o inválido)' })
  @ApiForbiddenResponse({
    description: 'El cliente de la instalación está fuera del alcance del token',
  })
  @ApiNotFoundResponse({
    description: 'Instalación no encontrada / geocerca no encontrada o de otro cliente',
  })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor' })
  async salidasGeocercaInstalacion(
    @Body() dto: ReporteSalidasGeocercaInstalacionDto,
    @Request() req,
  ) {
    return this.service.obtenerSalidasGeocercaPorInstalacion(
      dto,
      Number(req.user.idCliente),
      Number(req.user.rol),
    );
  }

  @Post('salidas-geocerca-instalacion/recorrido')
  @ApiOperation({
    summary: 'Recorrido posterior a una salida de geocerca por instalación',
    description: [
      'Detalle de recorrido de **una** salida del listado `salidas-geocerca-instalacion`:',
      'devuelve las posiciones GPS cronológicas de la instalación desde el evento seleccionado',
      'hasta `fechaFinal` (o la última disponible con `hastaUltimaPosicion=true`), **sin cortarse',
      'en el primer reingreso**: incluye posiciones dentro, fuera, reingresos y nuevas salidas.',
      'El listado de eventos no cambia: cada transición DENTRO → FUERA sigue siendo un evento.',
      '',
      '**Identificación del evento:** clave compuesta (`idInstalacion`, `idGeocerca`, `fechaSalida`',
      'e `idPosicionSalida` opcional, del listado). El backend re-ejecuta el mismo detector de',
      'salidas y verifica que el evento exista y sea de esa instalación/geocerca; una fecha',
      'arbitraria sin salida real → 404. El recorrido siempre inicia en la salida verificada,',
      'nunca en una fecha anterior enviada por el cliente (`fechaInicio` solo aporta contexto).',
      '',
      '**Posiciones:** registros GPS reales (sin interpolar), orden `fechaHora` ASC + `id` ASC,',
      'con `estadoRespectoGeocerca` (`DENTRO`/`FUERA`) calculado respecto a **esta** geocerca con',
      'su geometría —no se usa el estado global de la posición—. Se omiten coordenadas inválidas',
      'y duplicadas, contabilizadas en `avisos`. Si la instalación cambió de dispositivo, cada',
      'tramo se consulta solo dentro de su vigencia (`HistoricoInstalaciones`).',
      '',
      '**Paginación por cursor:** `limite` (1..1000, def. 500) y `cursor` opaco de la respuesta',
      'anterior (`paginacion.cursorSiguiente`). Seguir el cursor devuelve todos los lotes sin',
      'saltos ni truncamiento silencioso (`paginacion.hayMas`).',
      '',
      '**Tiempo y última posición:** las fechas son hora de pared como `Posiciones.FechaHora`.',
      '`ultimaPosicion` es el último GPS del rango, no el estado actual en tiempo real:',
      '`avisos.ultimaPosicionDesactualizada` y `segundosSinTransmisionAlFinDelRango` lo indican.',
      'En eventos `SIN_REINGRESO`, `duracionFueraSegundos` es `null` y no debe interpretarse como',
      'tiempo transcurrido hasta `fechaFinal` ni hasta hoy.',
      '',
      '**Limitación:** no existe historial de geometrías de geocercas; el estado por posición usa',
      'la geometría actual almacenada, que puede diferir de la vigente en fechas pasadas si la',
      'geocerca fue editada. `UsuariosGeocerca` es una asociación administrativa y no otorga',
      'visibilidad por usuario: la autorización es el alcance de cliente del token + geocerca',
      'aplicable a la instalación.',
    ].join('\n'),
  })
  @ApiBody({
    type: RecorridoSalidaGeocercaDto,
    examples: {
      ejemplo: {
        summary: 'Recorrido desde la salida seleccionada hasta fin del día',
        value: {
          idInstalacion: 125,
          idGeocerca: 10,
          fechaSalida: '2026-10-20 16:22:24',
          fechaInicio: '2026-10-20 16:22:24',
          fechaFinal: '2026-10-20 23:59:59',
        },
      },
      hastaUltima: {
        summary: 'Hasta la última posición disponible (modo explícito)',
        value: {
          idInstalacion: 125,
          idGeocerca: 10,
          fechaSalida: '2026-10-20 16:22:24',
          idPosicionSalida: 1001,
          hastaUltimaPosicion: true,
          limite: 500,
        },
      },
    },
  })
  @ApiOkResponse({
    description:
      'Recorrido (`data.posiciones` paginadas por cursor + `transiciones`, `ultimaPosicion` y `avisos`)',
    schema: {
      example: {
        data: {
          instalacion: {
            idInstalacion: 125,
            idDispositivo: 18,
            imei: '123456789012345',
            numeroSerie: 'NS-001',
            placas: 'ABC123',
            economico: 'ECO-01',
            idProducto: 40,
            nombreProducto: 'Unidad 01',
          },
          geocerca: { idGeocerca: 10, nombre: 'Prueba', geometria: null },
          eventoSeleccionado: {
            fechaSalida: '2026-10-20T16:22:24',
            fechaReingreso: null,
            estadoEvento: 'SIN_REINGRESO',
          },
          rangoEfectivo: {
            fechaInicio: '2026-10-20 16:22:24',
            fechaFinal: '2026-10-20 23:59:59',
            hastaUltimaPosicion: false,
          },
          posiciones: [
            {
              idPosicion: 1001,
              fechaHora: '2026-10-20T16:22:24',
              lat: 18.92,
              lng: -99.23,
              estadoRespectoGeocerca: 'FUERA',
            },
            {
              idPosicion: 1002,
              fechaHora: '2026-10-20T16:30:24',
              lat: 18.93,
              lng: -99.24,
              estadoRespectoGeocerca: 'FUERA',
            },
          ],
          transiciones: [
            {
              tipo: 'SALIDA',
              fechaHora: '2026-10-20T16:22:24',
              idPosicion: 1001,
              idGeocerca: 10,
            },
          ],
          ultimaPosicion: {
            idPosicion: 1002,
            fechaHora: '2026-10-20T16:30:24',
            lat: 18.93,
            lng: -99.24,
          },
          paginacion: { limite: 500, devueltas: 2, hayMas: false, cursorSiguiente: null },
          avisos: {
            posicionesInvalidasOmitidas: 0,
            posicionesDuplicadasOmitidas: 0,
            huecosTransmision: [],
            ultimaPosicionDesactualizada: true,
            segundosSinTransmisionAlFinDelRango: 26975,
            limitaciones: ['La última posición es el último GPS dentro del rango.'],
          },
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'Fechas inválidas o invertidas / falta fechaFinal sin modo hasta-última / cursor inválido / geocerca no asociada o sin geometría',
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado (JWT ausente o inválido)' })
  @ApiForbiddenResponse({
    description: 'El cliente de la instalación está fuera del alcance del token',
  })
  @ApiNotFoundResponse({
    description:
      'Instalación o geocerca no encontradas, o evento de salida inexistente para esa clave',
  })
  @ApiInternalServerErrorResponse({ description: 'Error interno del servidor' })
  async recorridoSalidaGeocercaInstalacion(
    @Body() dto: RecorridoSalidaGeocercaDto,
    @Request() req,
  ) {
    return this.service.obtenerRecorridoSalidaGeocerca(
      dto,
      Number(req.user.idCliente),
      Number(req.user.rol),
    );
  }
}
