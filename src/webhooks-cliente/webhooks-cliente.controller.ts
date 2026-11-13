import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { EnumRoles } from 'src/common/estatus.enum';
import { CrearWebhookDto } from './dto/crear-webhook.dto';
import { WebhooksClienteService } from './webhooks-cliente.service';

const usuarioDe = (req: {
  user: { idCliente: unknown; rol: unknown; userId: unknown };
}) => ({
  idClienteToken: Number(req.user.idCliente),
  rol: Number(req.user.rol),
  idUsuario: Number(req.user.userId),
});

const CONTRATO = [
  '**Envío:** `POST` JSON a la URL, con los encabezados `X-Next-Evento`, `X-Next-Envio` (id, para descartar repetidos),',
  '`X-Next-Timestamp` (segundos Unix) y `X-Next-Firma: sha256=<hex>` = HMAC-SHA256(secreto, `<timestamp>.<cuerpo>`).',
  'Cuerpo: `{ "evento", "fecha", "idCliente", "data" }`. Responder 2xx; si no, reintenta 1, 2, 4… min hasta 6 h, 10 intentos.',
  '',
  '**Eventos:** `alerta.abierta` (incidente automático), `geocerca.entrada`, `geocerca.salida`,',
  '`jornada.cerrada` (resumen del día anterior, poco después de medianoche) y `prueba`.',
];

@ApiTags('Webhooks de cliente')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(EnumRoles.SA, EnumRoles.DEV, EnumRoles.ADMIN)
@Controller('webhooks-cliente')
export class WebhooksClienteController {
  constructor(private readonly service: WebhooksClienteService) {}

  @Post()
  @ApiOperation({
    summary:
      'Suscribe la URL de un cliente a eventos de Next (el secreto se muestra una vez)',
    description: [
      ...CONTRATO,
      '',
      'Solo SA, Dev y Admin. Queda en bitácora. No toca ShiftControl.',
    ].join('\n'),
  })
  @ApiCreatedResponse({
    schema: {
      example: {
        data: {
          id: 1,
          idCliente: 15,
          nombre: 'Torre de Control Fis Fiber',
          url: 'https://torre.fisfiber.mx/next/eventos',
          eventos: ['alerta.abierta', 'geocerca.entrada', 'geocerca.salida'],
          secreto: '9f2c…',
          aviso:
            'Guarda el secreto ahora: no se vuelve a mostrar. Sirve para verificar X-Next-Firma.',
        },
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Cliente fuera de alcance' })
  async crear(@Body() dto: CrearWebhookDto, @Request() req) {
    return this.service.crear(dto, usuarioDe(req));
  }

  @Get()
  @ApiOperation({
    summary: 'Lista las suscripciones (sin el secreto), con envíos pendientes y fallidos',
  })
  @ApiQuery({ name: 'idCliente', required: false, type: Number })
  @ApiOkResponse({ description: '`data[]`' })
  async listar(@Query('idCliente') idCliente: string | undefined, @Request() req) {
    const id = idCliente != null && idCliente !== '' ? Number(idCliente) : undefined;
    return this.service.listar(Number.isFinite(id) ? id : undefined, usuarioDe(req));
  }

  @Get(':id/envios')
  @ApiOperation({
    summary:
      'Últimos 50 envíos de una suscripción (estatus, intentos, código HTTP, error)',
  })
  @ApiNotFoundResponse({ description: 'Suscripción no encontrada' })
  async envios(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.envios(id, usuarioDe(req));
  }

  @Post(':id/prueba')
  @ApiOperation({ summary: 'Encola un evento `prueba` para esta suscripción' })
  @ApiNotFoundResponse({ description: 'Suscripción no encontrada' })
  async probar(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.probar(id, usuarioDe(req));
  }

  @Patch(':id/revocar')
  @ApiOperation({
    summary: 'Revoca la suscripción (los envíos pendientes se cierran como fallidos)',
  })
  @ApiNotFoundResponse({ description: 'Suscripción no encontrada' })
  async revocar(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.revocar(id, usuarioDe(req));
  }
}
