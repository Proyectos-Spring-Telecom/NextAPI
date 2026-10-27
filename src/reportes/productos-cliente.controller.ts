import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
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
import { ProductosClienteDto } from './dto/productos-cliente.dto';
import { ProductosClienteService } from './productos-cliente.service';

@ApiTags('Reportes')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('reportes')
export class ProductosClienteController {
  constructor(private readonly service: ProductosClienteService) {}

  @Post('productos-cliente')
  @ApiOperation({
    summary: 'Productos del cliente con su última ubicación',
    description: [
      'Lista todo lo que el cliente tiene instalado (instalaciones activas):',
      'vehículos, activos, inmuebles, personas y **paneles de alarma**.',
      '',
      '**Body:**',
      '- `idCliente` (obligatorio, dentro del alcance del token).',
      '- `idUsuario` opcional: solo lo asignado a ese usuario del cliente',
      '  (`UsuariosInstalaciones`, también para paneles).',
      '- Roles Operador (7) / Usuario (9): siempre solo lo asignado al usuario del token.',
      '',
      '**Ubicación (`lat`/`lng`, `origenUbicacion`):**',
      '- Unidades con IMEI → `UltimaPosicion` (`estado`, `velocidad`, `ignicion`, `fechaHora`).',
      '- Paneles / sin posición → coordenadas del inmueble, si las tiene.',
      '',
      '**Paneles:** `cuentaSia`, `nombrePanel`, `panelEnLinea`, `ultimoHeartbeat`',
      'y el último evento (`ultimoEvento*`).',
      '',
      '`usuarios` = nombres de los usuarios del cliente que tienen asignado el producto.',
    ].join('\n'),
  })
  @ApiBody({ type: ProductosClienteDto })
  @ApiOkResponse({
    description: '`data.productos[]` plano + `data.total`',
  })
  @ApiBadRequestResponse({ description: 'Body inválido' })
  @ApiForbiddenResponse({ description: 'Cliente fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async productosCliente(@Body() dto: ProductosClienteDto, @Request() req) {
    return this.service.productosCliente(
      dto,
      Number(req.user.idCliente),
      Number(req.user.userId),
      Number(req.user.rol),
    );
  }
}
