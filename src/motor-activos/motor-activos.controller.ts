import { Controller, Get, NotFoundException, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { EnumRoles } from 'src/common/estatus.enum';
import { Dispositivos } from 'src/entities/Dispositivos';
import { Sims } from 'src/entities/Sims';
import { Productos } from 'src/entities/Productos';
import { MotorActivosService } from './motor-activos.service';
import type { TipoRecurso } from './estatus-recurso';
import { FiltroSinInstalacionDto } from './dto/filtro-sin-instalacion.dto';

/** El historial cruza clientes (dónde estuvo el equipo): solo roles con visibilidad global. */
const ROLES_HISTORIAL = [
  EnumRoles.SA,
  EnumRoles.DEV,
  EnumRoles.ADMIN,
  EnumRoles.JEFE_MONITOREO,
  EnumRoles.MONITOREO,
  EnumRoles.TECNICO,
];

const HISTORIAL_EXAMPLE = {
  data: [
    {
      id: 12,
      fecha: '2026-10-31T10:15:00.000Z',
      accion: 'baja',
      estatusAnterior: 2,
      estatusNuevo: 3,
      idClienteAnterior: 15,
      idClienteNuevo: 15,
      idInstalacion: 1000123,
      idOrdenServicio: 88,
      motivo: 'Orden de servicio OS-000088 (desinstalacion)',
      idUsuario: 7,
      origen: 'orden',
    },
  ],
};

@ApiTags('Motor de activos')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class MotorActivosController {
  constructor(
    private readonly motor: MotorActivosService,
    private readonly dataSource: DataSource,
  ) {}

  @Get('estatus-recurso')
  @Roles()
  @ApiOperation({
    summary: 'Catálogo de estatus de dispositivos y SIM',
    description:
      'Estatus 0–5 con los cambios permitidos a mano (`transicionesManuales`) y los estatus a los que puede ir ' +
      'un componente que sale de una instalación (`salidaDeInstalacion`). El 2 (instalado) solo lo pone una instalación.',
  })
  @ApiOkResponse({
    schema: {
      example: {
        data: [{ id: 3, codigo: 'POR_REVISAR', nombre: 'Por revisar', descripcion: '…', transicionesManuales: [1, 4, 5, 0] }],
        salidaDeInstalacion: [3, 4, 5],
      },
    },
  })
  catalogo() {
    return this.motor.catalogo();
  }

  @Get('dispositivos/sin-instalacion')
  @Roles(EnumRoles.SA, EnumRoles.DEV, EnumRoles.ADMIN)
  @ApiOperation({
    summary: 'Equipos que transmiten sin instalación',
    description:
      'Equipos con transmisión reciente y sin instalación activa (estatus 0, 1, 3, 4 o 5): se instaló sin darse de alta, ' +
      'o hay que revisarlo. Lo que transmiten se guarda pero no lo ve ningún cliente. Trae la última transmisión y la ' +
      'última instalación de la que salió. Un inservible que transmite además abre un incidente. Roles 1–3.',
  })
  @ApiQuery({ name: 'desde', required: false, description: 'Última transmisión desde (hora de México). Por omisión, 30 días atrás.', example: '2026-10-01 00:00:00' })
  @ApiQuery({ name: 'estatus', required: false, description: 'Solo un estatus del equipo (0–5)', example: 5 })
  @ApiOkResponse({
    schema: {
      example: {
        data: [
          {
            idDispositivo: 1000060,
            numeroSerie: '6907850461',
            imei: '863269078504617',
            idTipoDispositivo: 1,
            tipoDispositivo: 'GPS',
            estatus: 5,
            nombreEstatus: 'Inservible',
            idCliente: 20,
            cliente: 'Transportes del Sur',
            ultimaTransmision: '2026-10-30 18:40:12',
            ultimoRegistro: '2026-10-30 18:40:15',
            lat: 18.92,
            lng: -99.23,
            ultimaInstalacion: { idInstalacion: 1000079, idCliente: 20, hasta: '2026-10-19 16:35:52', accion: 'Baja' },
          },
        ],
      },
    },
  })
  @ApiForbiddenResponse({ description: 'Solo roles 1–3' })
  sinInstalacion(@Query() q: FiltroSinInstalacionDto) {
    return this.motor.equiposSinInstalacion({ desde: q.desde, estatus: q.estatus });
  }

  @Get('dispositivos/:id/historial')
  @Roles(...ROLES_HISTORIAL)
  @ApiOperation({ summary: 'Historial de vida del dispositivo', description: 'Cada cambio de estatus o cliente, con su instalación, orden y usuario. Más reciente primero.' })
  @ApiParam({ name: 'id', example: 1000001 })
  @ApiOkResponse({ schema: { example: HISTORIAL_EXAMPLE } })
  @ApiForbiddenResponse({ description: 'Solo roles 1–5 y 8' })
  @ApiNotFoundResponse({ description: 'No existe' })
  historialDispositivo(@Param('id', ParseIntPipe) id: number) {
    return this.historial('dispositivo', id);
  }

  @Get('sims/:id/historial')
  @Roles(...ROLES_HISTORIAL)
  @ApiOperation({ summary: 'Historial de vida de la SIM' })
  @ApiParam({ name: 'id', example: 5 })
  @ApiOkResponse({ schema: { example: HISTORIAL_EXAMPLE } })
  @ApiForbiddenResponse({ description: 'Solo roles 1–5 y 8' })
  @ApiNotFoundResponse({ description: 'No existe' })
  historialSim(@Param('id', ParseIntPipe) id: number) {
    return this.historial('sim', id);
  }

  @Get('productos/:id/historial')
  @Roles(...ROLES_HISTORIAL)
  @ApiOperation({ summary: 'Historial de vida del producto (vehículo, persona, inmueble, activo)' })
  @ApiParam({ name: 'id', example: 1000001 })
  @ApiOkResponse({ schema: { example: HISTORIAL_EXAMPLE } })
  @ApiForbiddenResponse({ description: 'Solo roles 1–5 y 8' })
  @ApiNotFoundResponse({ description: 'No existe' })
  historialProducto(@Param('id', ParseIntPipe) id: number) {
    return this.historial('producto', id);
  }

  private async historial(tipo: TipoRecurso, id: number) {
    const entidad = { dispositivo: Dispositivos, sim: Sims, producto: Productos }[tipo];
    if (!(await this.dataSource.manager.exists(entidad, { where: { id } }))) {
      throw new NotFoundException('Recurso no encontrado');
    }
    return this.motor.historial(tipo, id);
  }
}
