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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ConsolaTransmisionesService } from './consola-transmisiones.service';
import { TransmisionesImeiDto } from './dto/transmisiones-imei.dto';

@ApiTags('Consola - Transmisiones')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('consola/transmisiones')
export class ConsolaTransmisionesController {
  constructor(private readonly service: ConsolaTransmisionesService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Últimas transmisiones de un equipo por IMEI',
    description: [
      'El usuario escribe un IMEI y una cantidad; recibe las últimas N posiciones',
      'de ese equipo (de la más reciente a la más antigua), solo si la instalación',
      'activa está dentro de su alcance. Solo lectura.',
      '',
      '**Body:** `imei` (solo dígitos, hasta 20), `cantidad?` (1..500, default 50).',
      '',
      '**Vigencia:** no se incluyen posiciones anteriores a la primera vigencia',
      'del dispositivo en el cliente actual (`HistoricoInstalaciones` o',
      '`Instalaciones.VigenteDesde`), para no mezclar datos de un cliente anterior.',
      '',
      '**Orden:** `fechaHora` DESC, `id` DESC. Sin `COUNT` (el `total` es `data.length`).',
      '',
      '**Alcance por rol:**',
      '- Globales (1–5, 8): cualquier cliente.',
      '- Cliente (6): la unidad debe pertenecer a un cliente de su jerarquía.',
      '- Operador (7) / Usuario (9): además, la unidad debe estar asignada al usuario',
      '  del token (`UsuariosInstalaciones` activo).',
      '- Si el IMEI no existe o está fuera de alcance → **404** con el mismo mensaje',
      '  (`IMEI no encontrado o sin acceso`); no se revela si existe en otro cliente.',
    ].join('\n'),
  })
  @ApiBody({
    type: TransmisionesImeiDto,
    examples: {
      porImei: {
        summary: 'Últimas 50 transmisiones',
        value: { imei: '354442090100880', cantidad: 50 },
      },
      pocas: {
        summary: 'Últimas 10 transmisiones',
        value: { imei: '354442090100880', cantidad: 10 },
      },
    },
  })
  @ApiOkResponse({
    description: 'Transmisiones + cabecera de la unidad',
    schema: {
      example: {
        unidad: {
          idInstalacion: 25,
          imei: '354442090100880',
          idCliente: 15,
          nombreCliente: 'Lord Logistic',
          etiqueta: 'NU8261A',
          placas: 'NU8261A',
          economico: '18',
          marca: 'Toyota',
          modelo: 'Hilux',
          anio: 2024,
          idTipoDispositivo: 5,
          nombreTipoDispositivo: 'TrackCam',
        },
        cantidadSolicitada: 50,
        total: 50,
        data: [
          {
            idPosicion: 96866081,
            fechaHora: '2026-10-23T11:25:10',
            lat: 18.71,
            lng: -98.89,
            velocidad: 42,
            rumbo: 180,
            estado: 1,
            ignicion: 1,
            idEvento: 9,
            nombreEvento: 'Transmisión',
            bateria: 100,
            gps: 12,
            gsm: 25,
          },
        ],
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'IMEI inválido / cantidad fuera de rango (1..500)',
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  @ApiNotFoundResponse({
    description: 'IMEI no encontrado o sin acceso',
  })
  async porImei(@Body() dto: TransmisionesImeiDto, @Request() req) {
    return this.service.porImei(
      dto,
      Number(req.user.userId),
      Number(req.user.idCliente),
      Number(req.user.rol),
    );
  }
}
