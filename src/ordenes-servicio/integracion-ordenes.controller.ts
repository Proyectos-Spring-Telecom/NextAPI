import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiCrudResponse } from 'src/common/ApiResponse';
import { CrmHmacGuard } from './crm-hmac.guard';
import {
  CambiosOrdenesDto,
  CancelarOrdenDto,
  DecisionAutorizacionDto,
  ProgramarOrdenCrmDto,
  ReprogramarOrdenDto,
} from './dto/flujo-orden-servicio.dto';
import { OrdenesFlujoService } from './ordenes-flujo.service';

/**
 * Órdenes de servicio para el CRM (docs/ordenes-servicio.md §12.9). Sin JWT:
 * firma HMAC (`CRM_HMAC_SECRET`). Nginx no debe publicar `/api/integracion/`;
 * el CRM corre en el mismo servidor y llama por localhost.
 */
@ApiTags('Integración CRM · Órdenes de servicio')
@ApiHeader({ name: 'x-crm-timestamp', description: 'Milisegundos desde epoch' })
@ApiHeader({ name: 'x-crm-signature', description: 'HMAC-SHA256 hex de `${timestamp}.${cuerpo}` (GET: `${METODO} ${ruta}`)' })
@SkipThrottle()
@UseGuards(CrmHmacGuard)
@Controller('integracion/ordenes-servicio')
export class IntegracionOrdenesController {
  constructor(private readonly flujo: OrdenesFlujoService) {}

  @Get('cambios')
  @ApiOperation({
    summary: 'Órdenes creadas o modificadas desde una fecha',
    description:
      'De cualquier origen (CRM o Next), ordenadas por `fechaActualizacion`. Pasar el `hasta` de la respuesta como `desde` de la siguiente; ' +
      'puede repetir la última orden (desde es inclusivo): deduplicar por `id`. `hayMas` = pedir otra página.',
  })
  cambios(@Query() dto: CambiosOrdenesDto) {
    return this.flujo.cambios(dto);
  }

  @Get('motivos')
  @ApiOperation({ summary: 'Catálogo de motivos de no cumplida y cancelación' })
  motivos() {
    return this.flujo.motivos();
  }

  @Post()
  @ApiOperation({
    summary: 'Programar orden(es)',
    description:
      'Alta de N unidades = N órdenes `programada` independientes. Idempotente por (`referenciaCrm`, unidad): reenviar devuelve las mismas.',
  })
  programar(@Body() dto: ProgramarOrdenCrmDto) {
    return this.flujo.programar(dto, { tipo: 'crm', nombre: dto.usuario ?? null });
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Reprogramar cita, técnico o vehículo (solo `programada`; si no, 409)' })
  @ApiParam({ name: 'id' })
  reprogramar(@Param('id', ParseIntPipe) id: number, @Body() dto: ReprogramarOrdenDto): Promise<ApiCrudResponse> {
    return this.flujo.reprogramar(id, dto, { tipo: 'crm', nombre: dto.usuario ?? null });
  }

  @Post(':id/cancelar')
  @ApiOperation({ summary: 'Cancelar con motivo (solo `programada`; iniciada → 409, la cierra operación)' })
  @ApiParam({ name: 'id' })
  cancelar(@Param('id', ParseIntPipe) id: number, @Body() dto: CancelarOrdenDto): Promise<ApiCrudResponse> {
    return this.flujo.cancelar(id, dto, { tipo: 'crm', nombre: dto.usuario ?? null });
  }

  @Post(':id/autorizacion/decision')
  @ApiOperation({ summary: 'Autorizar o rechazar la desinstalación del equipo existente' })
  @ApiParam({ name: 'id' })
  decidir(@Param('id', ParseIntPipe) id: number, @Body() dto: DecisionAutorizacionDto): Promise<ApiCrudResponse> {
    return this.flujo.decidirAutorizacion(id, dto, { tipo: 'crm', nombre: dto.usuario ?? null });
  }
}
