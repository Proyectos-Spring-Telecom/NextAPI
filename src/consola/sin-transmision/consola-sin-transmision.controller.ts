import {
  Body,
  Controller,
  HttpCode,
  Post,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ConsolaSinTransmisionService } from './consola-sin-transmision.service';
import { SinTransmisionDto } from './dto/sin-transmision.dto';

@ApiTags('Consola - Sin Transmisión')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('consola/sin-transmision')
export class ConsolaSinTransmisionController {
  constructor(private readonly service: ConsolaSinTransmisionService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Unidades que no han transmitido en N días',
    description: [
      'Lista las unidades **activas** (con dispositivo, sin paneles) cuya última transmisión',
      '(`UltimaPosicion`, una fila por IMEI) es anterior a **ahora − `dias`**, o que **nunca**',
      'han transmitido. Solo lectura.',
      '',
      '**Body:** `dias` (1..365, obligatorio), `idCliente?` (opcional, debe estar en el alcance).',
      '',
      '**Respuesta:** `{ dias, fechaConsulta, fechaCorte, totalUnidades, total, data[] }`.',
      'Cada unidad trae cliente, etiqueta, placas, económico, marca/modelo, IMEI, tipo de equipo,',
      '`ultimaTransmision`, `diasSinTransmitir`, `minutosSinTransmitir`, `nuncaTransmitio`,',
      '`lat`/`lng` de la última posición, `estado` e `ignicion`.',
      'Orden: más tiempo sin transmitir primero; las que nunca transmitieron al final.',
      '',
      '**Alcance por rol:** globales (1–5, 8) todas; Cliente (6) su jerarquía;',
      'Operador (7) / Usuario (9) solo sus unidades asignadas (`UsuariosInstalaciones`).',
    ].join('\n'),
  })
  @ApiBody({
    type: SinTransmisionDto,
    examples: {
      unDia: { summary: 'Más de 1 día sin transmitir', value: { dias: 1 } },
      porCliente: { summary: 'Un cliente, 7 días', value: { dias: 7, idCliente: 15 } },
    },
  })
  @ApiOkResponse({
    schema: {
      example: {
        dias: 1,
        fechaConsulta: '2026-10-26 16:00:00',
        fechaCorte: '2026-10-25 16:00:00',
        totalUnidades: 295,
        total: 1,
        data: [
          {
            idInstalacion: 25,
            idCliente: 15,
            nombreCliente: 'Lord Logistic',
            etiqueta: 'NU8261A',
            placas: 'NU8261A',
            economico: '18',
            marca: 'International',
            modelo: 'Tracto',
            anio: 2015,
            descripcion: 'Tracto 18',
            imei: '950148268',
            idTipoDispositivo: 3,
            nombreTipoDispositivo: 'AVL',
            ultimaTransmision: '2026-10-23T09:12:40',
            nuncaTransmitio: false,
            minutosSinTransmitir: 4667,
            diasSinTransmitir: 3,
            lat: 18.9445,
            lng: -99.2361,
            estado: 0,
            ignicion: 0,
          },
        ],
      },
    },
  })
  @ApiBadRequestResponse({ description: 'dias fuera de rango (1..365)' })
  @ApiForbiddenResponse({ description: 'Cliente fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async consultar(@Body() dto: SinTransmisionDto, @Request() req) {
    return this.service.consultar(
      dto,
      Number(req.user.userId),
      Number(req.user.idCliente),
      Number(req.user.rol),
    );
  }
}
