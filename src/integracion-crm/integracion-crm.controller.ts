import { Body, Controller, Get, Param, ParseIntPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { CreateClienteDto } from 'src/clientes/dto/create-cliente.dto';
import { CrmHmacGuard } from 'src/ordenes-servicio/crm-hmac.guard';
import { IntegracionCrmService } from './integracion-crm.service';

/** Lista de enteros separados por coma (`?clientes=1,2,3`); vacío o ausente = undefined. */
const ids = (v?: string) =>
  v == null || v === '' ? undefined : v.split(',').map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0);

/**
 * Lo que el CRM lee o da de alta en Next (§14 de docs/ordenes-servicio.md).
 * Misma firma HMAC que `/integracion/ordenes-servicio`; solo por localhost.
 */
@ApiTags('Integración CRM')
@ApiHeader({ name: 'x-crm-timestamp', description: 'Milisegundos desde epoch' })
@ApiHeader({ name: 'x-crm-firma', description: 'v2' })
@ApiHeader({ name: 'x-crm-nonce', description: 'UUID por petición; cada uno se acepta una sola vez en la ventana de 5 min' })
@ApiHeader({ name: 'x-crm-signature', description: 'HMAC-SHA256 hex de `${timestamp}.${nonce}.${MÉTODO} ${ruta}\n${cuerpo}` (ruta con /api y query)' })
@SkipThrottle()
@UseGuards(CrmHmacGuard)
@Controller('integracion')
export class IntegracionCrmController {
  constructor(private readonly service: IntegracionCrmService) {}

  @Get('clientes')
  @ApiOperation({ summary: 'Clientes activos con sus unidades activas' })
  clientes() {
    return this.service.clientes();
  }

  @Get('clientes/:id')
  @ApiOperation({ summary: 'Datos de alta de un cliente' })
  cliente(@Param('id', ParseIntPipe) id: number) {
    return this.service.cliente(id);
  }

  @Post('clientes')
  @ApiOperation({
    summary: 'Alta del cliente formalizado',
    description:
      'Mismo cuerpo que POST /clientes (JSON, sin archivos), con al menos un contacto de emergencia. RFC repetido → 409 con `idCliente` para ligarlo. Requiere CRM_ID_USUARIO.',
  })
  crearCliente(@Body() dto: CreateClienteDto) {
    return this.service.crearCliente(dto);
  }

  @Get('tecnicos')
  @ApiOperation({ summary: 'Técnicos activos (rol 8)' })
  tecnicos() {
    return this.service.tecnicos();
  }

  @Get('unidades')
  @ApiOperation({ summary: 'Unidades activas de los clientes indicados' })
  @ApiQuery({ name: 'clientes', example: '12,33' })
  unidades(@Query('clientes') clientes?: string) {
    return this.service.unidades(ids(clientes) ?? []);
  }

  @Get('unidades/conteo')
  @ApiOperation({ summary: 'Unidades activas por cliente' })
  conteo() {
    return this.service.conteo();
  }

  @Get('sims')
  @ApiOperation({ summary: 'SIMs con su instalación vigente (iccid = Sims.IMEI)' })
  sims() {
    return this.service.sims();
  }

  @Get('ordenes-realizadas')
  @ApiOperation({
    summary: 'Órdenes de servicio terminadas, para pagar a los técnicos y ligar instalaciones',
    description: '`pagables=1` suma las no cumplidas cobrables. Filtros: `tecnicos`, `clientes` (ids separados por coma), `desde` (fecha), `tipo`.',
  })
  realizadas(
    @Query('tecnicos') tecnicos?: string,
    @Query('clientes') clientes?: string,
    @Query('desde') desde?: string,
    @Query('tipo') tipo?: string,
    @Query('pagables') pagables?: string,
  ) {
    return this.service.realizadas({
      idTecnicos: ids(tecnicos),
      idClientes: ids(clientes),
      desde: desde || undefined,
      tipo: tipo || undefined,
      pagables: pagables === '1' || pagables === 'true',
    });
  }
}
