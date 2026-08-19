import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiHeader,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { GatewayHmacGuard } from './gateway/gateway-hmac.guard';
import { AlarmasIngestService } from './alarmas-ingest.service';
import { IngestEventoDto } from './dto/ingest-evento.dto';
import { IngestHeartbeatDto } from './dto/ingest-heartbeat.dto';

@ApiTags('Alarmas - Ingest')
@SkipThrottle()
@UseGuards(GatewayHmacGuard)
@Controller('alarmas')
export class AlarmasIngestController {
  constructor(private readonly ingestService: AlarmasIngestService) {}

  @Post('ingest')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Ingest de evento SIA (SpringPanel)',
    description:
      'Sin JWT de usuario. HMAC sobre el body crudo. No re-parsea SIA. Responde 202 rápido.',
  })
  @ApiHeader({ name: 'X-Gateway-Timestamp', required: true })
  @ApiHeader({ name: 'X-Gateway-Signature', required: true })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiHeader({ name: 'X-Gateway-Key', required: false })
  @ApiResponse({ status: 202, description: 'Aceptado (nuevo o duplicado)' })
  @ApiResponse({ status: 401, description: 'Firma / timestamp / API key inválidos' })
  async ingestEvento(
    @Body() dto: IngestEventoDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    return this.ingestService.ingestEvento(dto, idempotencyKey ?? null);
  }

  @Post('ingest/heartbeat')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Ingest de heartbeat RP (SpringPanel)',
    description:
      'Solo actualiza PanelAlarma.UltimoHeartbeat. No inserta EventoAlarma ni UltimoEventoAlarma.',
  })
  @ApiHeader({ name: 'X-Gateway-Timestamp', required: true })
  @ApiHeader({ name: 'X-Gateway-Signature', required: true })
  @ApiHeader({ name: 'Idempotency-Key', required: true })
  @ApiHeader({ name: 'X-Gateway-Key', required: false })
  @ApiResponse({ status: 202, description: 'Aceptado (nuevo o duplicado)' })
  @ApiResponse({ status: 401, description: 'Firma / timestamp / API key inválidos' })
  async ingestHeartbeat(
    @Body() dto: IngestHeartbeatDto,
    @Headers('idempotency-key') idempotencyKey: string,
  ) {
    return this.ingestService.ingestHeartbeat(dto, idempotencyKey ?? null);
  }
}
