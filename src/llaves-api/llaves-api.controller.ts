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
import { CrearLlaveApiDto } from './dto/crear-llave-api.dto';
import { LlavesApiService } from './llaves-api.service';

const usuarioDe = (req: {
  user: { idCliente: unknown; rol: unknown; userId: unknown };
}) => ({
  idClienteToken: Number(req.user.idCliente),
  rol: Number(req.user.rol),
  idUsuario: Number(req.user.userId),
});

@ApiTags('Llaves de API')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(EnumRoles.SA, EnumRoles.DEV, EnumRoles.ADMIN)
@Controller('llaves-api')
export class LlavesApiController {
  constructor(private readonly service: LlavesApiService) {}

  @Post()
  @ApiOperation({
    summary: 'Crea una llave de API para un cliente (se muestra una sola vez)',
    description: [
      'El sistema del cliente la manda en el encabezado `X-Api-Key` en lugar del JWT.',
      'Solo sirve en las rutas de solo lectura de reportes (jornada, motor, flota del día, paradas,',
      'geocercas, contadores, odómetro, posiciones, distancia, velocidad, última posición, salidas de geocerca).',
      'Actúa como un usuario Cliente del cliente indicado y sus hijos. Solo SA, Dev y Admin. Queda en bitácora.',
    ].join('\n'),
  })
  @ApiCreatedResponse({
    schema: {
      example: {
        data: {
          id: 1,
          idCliente: 15,
          nombre: 'Torre de Control Fis Fiber',
          prefijo: '3fa9c210',
          fechaExpiracion: null,
          llave: 'nxt_3fa9c210_Qm9...',
          aviso: 'Guarda la llave ahora: no se vuelve a mostrar.',
        },
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Cliente fuera de alcance' })
  async crear(@Body() dto: CrearLlaveApiDto, @Request() req) {
    return this.service.crear(dto, usuarioDe(req));
  }

  @Get()
  @ApiOperation({
    summary: 'Lista las llaves (sin el secreto): prefijo, último uso y si está activa',
  })
  @ApiQuery({ name: 'idCliente', required: false, type: Number })
  @ApiOkResponse({ description: '`data[]`' })
  async listar(@Query('idCliente') idCliente: string | undefined, @Request() req) {
    const id = idCliente != null && idCliente !== '' ? Number(idCliente) : undefined;
    return this.service.listar(Number.isFinite(id) ? id : undefined, usuarioDe(req));
  }

  @Patch(':id/revocar')
  @ApiOperation({
    summary: 'Revoca una llave (deja de servir en a lo más 1 min). Queda en bitácora.',
  })
  @ApiOkResponse({ schema: { example: { data: { id: 1, revocada: true } } } })
  @ApiNotFoundResponse({ description: 'Llave no encontrada' })
  @ApiForbiddenResponse({ description: 'Cliente fuera de alcance' })
  async revocar(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.revocar(id, usuarioDe(req));
  }
}
