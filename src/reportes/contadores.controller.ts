import {
  BadRequestException,
  Body,
  Controller,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { EnumRoles } from 'src/common/estatus.enum';
import {
  AjusteContadoresDto,
  ContadoresDto,
  MAX_DIAS_ODOMETRO,
  OdometroDto,
} from './dto/contadores.dto';
import { ContadoresService } from './contadores.service';
import { usuarioDe } from './jornada.service';
import { ResumenDiarioService } from './resumen-diario.service';
import { diasDelPeriodo } from './helpers/jornada.helpers';
import { nowMexicoCityAsUtcDate } from 'src/utils/datetime-mexico.util';
import { JornadaDto, MAX_DIAS_JORNADA } from './dto/jornada.dto';

const BASE_EJEMPLO = { valor: 215097, fecha: '2026-11-13 08:00:00', fuente: 'captura' };

const REGLAS_CONTADORES = [
  '**Cómo se calcula:**',
  '- **Base:** la última lectura del tablero capturada (`PUT /reportes/contadores/:idProducto`, `fuente: captura`).',
  '  Sin ella, el odómetro parte de `Vehiculos.KM` y las horas de 0, en la fecha de alta del vehículo (`fuente: alta_vehiculo`).',
  '- **Más:** km y horas de motor de cada día **posterior** a la base, de la tabla de resumen diario',
  '  (mismo cálculo que `POST /reportes/jornada`), y el día en curso calculado al consultar.',
  '- `historialCompleto: false` → el resumen diario no cubre desde la base: el acumulado se queda corto.',
  '  El resumen se llena solo cada noche y completa hacia atrás un día cada 10 min (60 días por defecto).',
  '- `odometroEquipo`: lo que reporta el equipo (cámara), sin ajustar; puede no venir.',
];

@ApiTags('Reportes')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('reportes')
export class ContadoresController {
  constructor(
    private readonly service: ContadoresService,
    private readonly resumen: ResumenDiarioService,
  ) {}

  @Post('contadores')
  @ApiOperation({
    summary: 'Odómetro y horas de motor acumulados por vehículo',
    description: [
      'Valor actual del odómetro y de las horas de motor de cada vehículo del alcance.',
      '',
      ...REGLAS_CONTADORES,
    ].join('\n'),
  })
  @ApiBody({
    type: ContadoresDto,
    examples: { unaUnidad: { value: { filtro: 'placa', valores: ['PXP613F'] } } },
  })
  @ApiOkResponse({
    description: '`data.vehiculos[]`',
    schema: {
      example: {
        data: {
          idCliente: null,
          calculadoAl: '2026-11-13 10:15:00',
          total: 1,
          vehiculos: [
            {
              idProducto: 1000309,
              placas: 'PXP613F',
              economico: 'PXP613F',
              descripcion: 'PXP613F',
              imeis: ['2300007434'],
              odometro: {
                valor: 215110.4,
                base: BASE_EJEMPLO,
                desdeBase: 13.4,
                historialCompleto: true,
              },
              horasMotor: {
                valor: 5121.4,
                base: { ...BASE_EJEMPLO, valor: 5120.5 },
                desdeBase: 0.9,
                historialCompleto: true,
              },
              historialDesde: '2026-09-14',
              odometroEquipo: null,
            },
          ],
        },
      },
    },
  })
  @ApiBadRequestResponse({ description: 'Filtro inválido' })
  @ApiForbiddenResponse({ description: 'Cliente fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async contadores(@Body() dto: ContadoresDto, @Request() req) {
    return this.service.contadores(dto, usuarioDe(req));
  }

  @Post('odometro')
  @ApiOperation({
    summary: 'Km y horas de motor por día, con el odómetro al cierre de cada día',
    description: [
      `Por vehículo y día: \`km\`, \`odometroAlCierre\`, \`horasMotor\`, \`horasMotorAlCierre\`. Máximo ${MAX_DIAS_ODOMETRO} días.`,
      '',
      ...REGLAS_CONTADORES,
    ].join('\n'),
  })
  @ApiBody({
    type: OdometroDto,
    examples: {
      mes: {
        value: {
          filtro: 'placa',
          valores: ['PXP613F'],
          fechaInicio: '2026-11-01',
          fechaFinal: '2026-11-13',
        },
      },
    },
  })
  @ApiOkResponse({
    description: '`data.vehiculos[].porDia[]`',
    schema: {
      example: {
        data: {
          idCliente: null,
          fechaInicio: '2026-11-12',
          fechaFinal: '2026-11-13',
          total: 1,
          vehiculos: [
            {
              idProducto: 1000309,
              placas: 'PXP613F',
              economico: 'PXP613F',
              descripcion: 'PXP613F',
              imeis: ['2300007434'],
              baseOdometro: {
                valor: 215000,
                fecha: '2026-11-11 08:00:00',
                fuente: 'captura',
              },
              baseHorasMotor: {
                valor: 0,
                fecha: '2026-09-14 10:00:00',
                fuente: 'alta_vehiculo',
              },
              km: 13.23,
              horasMotor: 0.89,
              porDia: [
                {
                  fecha: '2026-11-12',
                  km: 13.23,
                  odometroAlCierre: 215013.23,
                  horasMotor: 0.89,
                  horasMotorAlCierre: 120.4,
                },
                {
                  fecha: '2026-11-13',
                  km: 0,
                  odometroAlCierre: 215013.23,
                  horasMotor: 0,
                  horasMotorAlCierre: 120.4,
                },
              ],
            },
          ],
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: `Fechas inválidas o periodo mayor a ${MAX_DIAS_ODOMETRO} días`,
  })
  @ApiForbiddenResponse({ description: 'Cliente fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async odometro(@Body() dto: OdometroDto, @Request() req) {
    return this.service.odometro(dto, usuarioDe(req));
  }

  @Put('contadores/:idProducto')
  @Roles(EnumRoles.SA, EnumRoles.DEV, EnumRoles.ADMIN, EnumRoles.CLIENTE)
  @ApiOperation({
    summary: 'Captura la lectura del tablero (odómetro y/o horas de motor)',
    description: [
      'Nueva base del contador: desde el día siguiente a `fecha` se suma lo calculado.',
      'Queda en bitácora. Solo vehículos del alcance del token.',
    ].join('\n'),
  })
  @ApiBody({ type: AjusteContadoresDto })
  @ApiOkResponse({ description: 'Las bases vigentes del vehículo (`km` y `horas`)' })
  @ApiBadRequestResponse({ description: 'Sin km ni horasMotor, o fecha futura' })
  @ApiForbiddenResponse({ description: 'Vehículo fuera de alcance' })
  @ApiNotFoundResponse({ description: 'Vehículo no encontrado' })
  async ajustar(
    @Param('idProducto', ParseIntPipe) idProducto: number,
    @Body() dto: AjusteContadoresDto,
    @Request() req,
  ) {
    return this.service.ajustar(idProducto, dto, usuarioDe(req));
  }

  @Post('resumen-diario/recalcular')
  @Roles(EnumRoles.SA, EnumRoles.DEV)
  @ApiOperation({
    summary: 'Recalcula el resumen diario de días completos (todas las instalaciones)',
    description: [
      'Para corregir días ya guardados (p. ej. tras cargar posiciones atrasadas). Solo SA y Dev.',
      `Solo días anteriores a hoy; máximo ${MAX_DIAS_JORNADA} días. Tarda: un día de toda la flota por vuelta.`,
      'Ignora `filtro`/`valores`/`idCliente`: el resumen es de toda la flota.',
    ].join('\n'),
  })
  @ApiBody({
    type: JornadaDto,
    examples: { unDia: { value: { fechaInicio: '2026-11-12' } } },
  })
  @ApiOkResponse({ description: '`data.dias[]` con las unidades guardadas por día' })
  async recalcular(@Body() dto: JornadaDto) {
    const dias = diasDelPeriodo(dto.fechaInicio, dto.fechaFinal ?? dto.fechaInicio);
    if (!dias.length || dias.length > MAX_DIAS_JORNADA) {
      throw new BadRequestException(`Periodo inválido (1 a ${MAX_DIAS_JORNADA} días)`);
    }
    const hoy = nowMexicoCityAsUtcDate().toISOString().slice(0, 10);
    const resultado: Array<{ fecha: string; unidades: number }> = [];
    for (const fecha of dias.filter((d) => d < hoy)) {
      resultado.push({ fecha, unidades: await this.resumen.calcularDia(fecha) });
    }
    return { data: { dias: resultado } };
  }
}
