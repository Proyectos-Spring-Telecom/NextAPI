import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtOLlaveApiGuard } from 'src/llaves-api/jwt-o-llave-api.guard';
import { AceptaLlaveApi } from 'src/llaves-api/acepta-llave-api.decorator';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { GeocercasEventosDto, JornadaDto, ParadasDto } from './dto/jornada.dto';
import { GeocercasEventosService } from './geocercas-eventos.service';
import { JornadaService, usuarioDe } from './jornada.service';

const REGLAS = [
  '**Reglas (iguales en los tres reportes):**',
  '- Día de **00:00 a 23:59**, hora de pared como `Posiciones.FechaHora`. Un tramo que cruza la medianoche se parte.',
  '- **Semáforo:** detenida con velocidad menor a 5 km/h o con la ignición apagada (el mismo umbral del `Estado` 0 del socket).',
  '- Tipos de tramo: `movimiento` (≥ 5 km/h), `detenido_encendido` (< 5 km/h, ignición 1),',
  '  `apagado` (ignición 0), `detenido` (< 5 km/h en equipos sin ignición: teléfono, reloj) y',
  '  `sin_datos` (hueco mayor al doble del intervalo de reporte con motor encendido, mínimo 10 min).',
  '  Apagada, los reportes espaciados (p. ej. cada 2 h) siguen contando como apagado.',
  '- Distancia: solo entre coordenadas medidas (las posiciones sin GPS no suman).',
  '- Ciclo de motor: del encendido al apagado; un hueco `sin_datos` entre tramos encendidos queda dentro.',
  '- El día en curso termina en la hora actual; los días futuros no se devuelven.',
  '- Mismo alcance que distancia: cliente + hijos, usuarios limitados a sus unidades, cambios de equipo.',
  '- Máximo 31 días por consulta.',
];

const BODY_EJEMPLO = {
  unaUnidad: {
    summary: 'Una unidad, un día',
    value: {
      idCliente: 15,
      filtro: 'placa',
      valores: ['PXP613F'],
      fechaInicio: '2026-11-12',
    },
  },
  flota: {
    summary: 'Toda la flota del cliente, una semana',
    value: { idCliente: 15, fechaInicio: '2026-11-06', fechaFinal: '2026-11-12' },
  },
};

const RESUMEN_EJEMPLO = {
  fecha: '2026-11-12',
  primerEncendido: '2026-11-12T07:02:10',
  ultimoApagado: '2026-11-12T19:41:55',
  encendidoDesdeDiaAnterior: false,
  terminaEncendido: false,
  primerMovimiento: '2026-11-12T07:03:00',
  ultimoMovimiento: '2026-11-12T19:40:30',
  jornadaMin: 759.8,
  km: 184.6,
  horasMotor: 7.88,
  velocidadMax: 96,
  velocidadPromedio: 41,
  tiempos: {
    movimientoMin: 412,
    detenidoEncendidoMin: 61,
    apagadoMin: 949,
    detenidoMin: 0,
    sinDatosMin: 18,
  },
  ciclosMotor: 7,
  excesosVelocidad: 3,
  posiciones: 1290,
  reportaIgnicion: true,
};

const UNIDAD_EJEMPLO = {
  idInstalacion: 1000325,
  idProducto: 812,
  placas: 'PXP613F',
  economico: 'ECO-14',
  descripcion: 'Camioneta reparto 14',
  imeis: ['2300007434'],
};

@ApiTags('Reportes')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtOLlaveApiGuard, RolesGuard)
@Roles()
@AceptaLlaveApi()
@ApiSecurity('api-key')
@Controller('reportes')
export class JornadaController {
  constructor(
    private readonly service: JornadaService,
    private readonly geocercas: GeocercasEventosService,
  ) {}

  @Post('jornada')
  @ApiOperation({
    summary: 'Jornada por unidad y día: encendido, apagado, tramos y cambios de estado',
    description: [
      'Por unidad y día: primer encendido, último apagado, km, tiempos por estado, horas de motor,',
      'la **línea de tiempo** (`tramos[]`) para pintar la barra del día, los **ciclos de motor**,',
      'los **cambios de `Estado`** y los **eventos** (excesos, alertas; sin los informativos).',
      '',
      ...REGLAS,
    ].join('\n'),
  })
  @ApiBody({ type: JornadaDto, examples: BODY_EJEMPLO })
  @ApiOkResponse({
    description: '`data.unidades[].jornadas[]`, una por día',
    schema: {
      example: {
        data: {
          idCliente: 15,
          fechaInicio: '2026-11-12',
          fechaFinal: '2026-11-12',
          total: 1,
          unidades: [
            {
              ...UNIDAD_EJEMPLO,
              jornadas: [
                {
                  ...RESUMEN_EJEMPLO,
                  tramos: [
                    {
                      tipo: 'apagado',
                      inicio: '2026-11-12T00:00:00',
                      fin: '2026-11-12T07:02:10',
                      min: 422.2,
                      km: 0,
                      velocidadMax: null,
                      velocidadPromedio: null,
                      lat: 18.9533,
                      lng: -99.2358,
                    },
                    {
                      tipo: 'movimiento',
                      inicio: '2026-11-12T07:03:00',
                      fin: '2026-11-12T07:48:30',
                      min: 45.5,
                      km: 31.2,
                      velocidadMax: 88,
                      velocidadPromedio: 46,
                      lat: 18.9533,
                      lng: -99.2358,
                    },
                  ],
                  ciclos: [
                    {
                      encendido: '2026-11-12T07:02:10',
                      apagado: '2026-11-12T09:15:00',
                      min: 132.8,
                      km: 58.4,
                      velocidadMax: 96,
                      detenidoEncendidoMin: 12.5,
                      sinDatosMin: 0,
                      continuaDelDiaAnterior: false,
                    },
                  ],
                  cambiosEstado: [
                    { fechaHora: '2026-11-12T07:03:00', estado: 1, nombre: 'Movimiento' },
                    {
                      fechaHora: '2026-11-12T08:10:12',
                      estado: 7,
                      nombre: 'Exceso de velocidad',
                    },
                  ],
                  eventos: [
                    {
                      fechaHora: '2026-11-12T08:10:12',
                      idEvento: 6,
                      nombre: 'Exceso de velocidad',
                      estado: 7,
                      lat: 18.91,
                      lng: -99.2,
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Fechas inválidas, periodo mayor a 31 días o filtro inválido',
  })
  @ApiForbiddenResponse({ description: 'Cliente fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async jornada(@Body() dto: JornadaDto, @Request() req) {
    return this.service.jornada(dto, usuarioDe(req));
  }

  @Post('motor')
  @ApiOperation({
    summary: 'Medición de motor on/off: ciclos de encendido y horas de motor',
    description: [
      'Por unidad: horas de motor y km del periodo, el resumen por día (primer encendido, último',
      'apagado, horas, ciclos) y la lista de **ciclos** (encendido → apagado) con su duración, km,',
      'velocidad máxima y minutos detenido con motor encendido.',
      '',
      'Equipos sin ignición (`reportaIgnicion: false`): sin ciclos ni horas de motor.',
      '',
      ...REGLAS,
    ].join('\n'),
  })
  @ApiBody({ type: JornadaDto, examples: BODY_EJEMPLO })
  @ApiOkResponse({
    description: '`data.unidades[]` con `ciclos[]` y `porDia[]`',
    schema: {
      example: {
        data: {
          idCliente: 15,
          fechaInicio: '2026-11-12',
          fechaFinal: '2026-11-12',
          total: 1,
          unidades: [
            {
              ...UNIDAD_EJEMPLO,
              horasMotor: 7.88,
              km: 184.6,
              ciclosMotor: 7,
              reportaIgnicion: true,
              porDia: [
                {
                  fecha: '2026-11-12',
                  primerEncendido: '2026-11-12T07:02:10',
                  ultimoApagado: '2026-11-12T19:41:55',
                  horasMotor: 7.88,
                  ciclosMotor: 7,
                  km: 184.6,
                },
              ],
              ciclos: [
                {
                  fecha: '2026-11-12',
                  encendido: '2026-11-12T07:02:10',
                  apagado: '2026-11-12T09:15:00',
                  min: 132.8,
                  km: 58.4,
                  velocidadMax: 96,
                  detenidoEncendidoMin: 12.5,
                  sinDatosMin: 0,
                  continuaDelDiaAnterior: false,
                },
              ],
            },
          ],
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Fechas inválidas, periodo mayor a 31 días o filtro inválido',
  })
  @ApiForbiddenResponse({ description: 'Cliente fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async motor(@Body() dto: JornadaDto, @Request() req) {
    return this.service.motor(dto, usuarioDe(req));
  }

  @Post('flota-dia')
  @ApiOperation({
    summary: 'Flota del día: una fila por unidad y día con el resumen de jornada',
    description: [
      'Tabla de la flota: el resumen de `POST /reportes/jornada` sin listas (sin tramos, ciclos,',
      'cambios ni eventos). Incluye las unidades sin posiciones (todo el día en `sin_datos`).',
      'Pensado como vista inicial; el detalle de una unidad sale de `jornada`.',
      '',
      ...REGLAS,
    ].join('\n'),
  })
  @ApiBody({ type: JornadaDto, examples: BODY_EJEMPLO })
  @ApiOkResponse({
    description: '`data.filas[]`, una por unidad y día',
    schema: {
      example: {
        data: {
          idCliente: 15,
          fechaInicio: '2026-11-12',
          fechaFinal: '2026-11-12',
          total: 1,
          filas: [{ ...UNIDAD_EJEMPLO, ...RESUMEN_EJEMPLO }],
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Fechas inválidas, periodo mayor a 31 días o filtro inválido',
  })
  @ApiForbiddenResponse({ description: 'Cliente fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async flotaDia(@Body() dto: JornadaDto, @Request() req) {
    return this.service.flotaDia(dto, usuarioDe(req));
  }

  @Post('paradas')
  @ApiOperation({
    summary: 'Paradas por unidad: duración, motor y lugar',
    description: [
      'Cada racha de tramos detenidos o apagados es una parada (regla del semáforo, sin mínimo;',
      '`minutosMinimos` es un filtro opcional). Un hueco `sin_datos` corta la parada.',
      '',
      'Por parada: `inicio`, `fin`, `min`, `motor` (`encendido` | `apagado` | `mixto` | `sin_ignicion`),',
      '`motorEncendidoMin`, `apagadoMin`, `lat` / `lng` (la dirección la resuelve el front con OpenStreetMap),',
      'las **geocercas** que la contienen y el **punto de interés** más cercano dentro de su radio',
      '(solo los ligados al vehículo). Una parada que cruza la medianoche sale en los dos días',
      '(`continuaDelDiaAnterior` / `continuaAlDiaSiguiente`).',
      '',
      ...REGLAS,
    ].join('\n'),
  })
  @ApiBody({
    type: ParadasDto,
    examples: {
      ...BODY_EJEMPLO,
      cincoMinutos: {
        summary: 'Solo paradas de 5 min o más',
        value: {
          idCliente: 15,
          filtro: 'placa',
          valores: ['PXP613F'],
          fechaInicio: '2026-11-12',
          minutosMinimos: 5,
        },
      },
    },
  })
  @ApiOkResponse({
    description: '`data.unidades[].paradas[]`',
    schema: {
      example: {
        data: {
          idCliente: 15,
          fechaInicio: '2026-11-12',
          fechaFinal: '2026-11-12',
          total: 1,
          unidades: [
            {
              ...UNIDAD_EJEMPLO,
              total: 1,
              minutos: 36.4,
              paradas: [
                {
                  fecha: '2026-11-12',
                  inicio: '2026-11-12T15:39:58',
                  fin: '2026-11-12T16:16:24',
                  min: 36.4,
                  motor: 'mixto',
                  motorEncendidoMin: 3.8,
                  apagadoMin: 32.7,
                  lat: 20.562212,
                  lng: -100.413589,
                  continuaDelDiaAnterior: false,
                  continuaAlDiaSiguiente: false,
                  geocercas: [{ id: 12, nombre: 'Base Querétaro' }],
                  puntoInteres: { id: 40, nombre: 'Cliente Norte', distanciaM: 35 },
                },
              ],
            },
          ],
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Fechas inválidas, periodo mayor a 31 días o filtro inválido',
  })
  @ApiForbiddenResponse({ description: 'Cliente fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async paradas(@Body() dto: ParadasDto, @Request() req) {
    return this.service.paradas(dto, usuarioDe(req));
  }

  @Post('geocercas/eventos')
  @ApiOperation({
    summary: 'Entradas y salidas de geocerca por unidad, con el tiempo dentro',
    description: [
      'Visitas a las geocercas ligadas al vehículo (`ProductosGeocerca`), registradas en vivo en',
      '`EventosGeocerca` a partir del despliegue (las salidas anteriores siguen en `salidas-geocerca`).',
      '',
      '- Entra al cruzar la orilla; sale al alejarse más de 15 m (el ruido del GPS no repite eventos).',
      '- `entrada: null`: ya estaba dentro al empezar el periodo. `salida: null`: seguía dentro al terminar.',
      '- `minFueraAntes`: minutos desde la salida anterior de la misma geocerca.',
      '- No cambia el `Estado` 8 ni los incidentes por geocerca.',
      '- Solo unidades con eventos en el periodo; máximo 31 días.',
    ].join('\n'),
  })
  @ApiBody({
    type: GeocercasEventosDto,
    examples: {
      ...BODY_EJEMPLO,
      unaGeocerca: {
        summary: 'Una geocerca, una semana',
        value: { idCliente: 15, fechaInicio: '2026-11-06', fechaFinal: '2026-11-12', idsGeocerca: [12] },
      },
    },
  })
  @ApiOkResponse({
    description: '`data.unidades[].visitas[]`',
    schema: {
      example: {
        data: {
          idCliente: 15,
          fechaInicio: '2026-11-12',
          fechaFinal: '2026-11-12',
          total: 1,
          unidades: [
            {
              idInstalacion: 1000325,
              idProducto: 1000309,
              placas: 'PXP613F',
              economico: 'PXP613F',
              descripcion: 'PXP613F',
              entradas: 1,
              salidas: 2,
              visitas: [
                {
                  idGeocerca: 12,
                  nombreGeocerca: 'Base Querétaro',
                  entrada: null,
                  salida: '2026-11-12T15:33:09',
                  minDentro: null,
                  minFueraAntes: null,
                },
                {
                  idGeocerca: 12,
                  nombreGeocerca: 'Base Querétaro',
                  entrada: '2026-11-12T16:23:24',
                  salida: '2026-11-12T19:17:02',
                  minDentro: 173.6,
                  minFueraAntes: 50.3,
                },
              ],
            },
          ],
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Fechas inválidas, periodo mayor a 31 días o filtro inválido' })
  @ApiForbiddenResponse({ description: 'Cliente fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async geocercasEventos(@Body() dto: GeocercasEventosDto, @Request() req) {
    return this.geocercas.eventos(dto, usuarioDe(req));
  }
}
