import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from 'src/common/decorators/roles.decorator';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { TelemetriaHuerfanosService } from './telemetria-huerfanos.service';

/** Sin cliente asociado: solo los roles que ven toda la flota (1–3). */
@ApiTags('Telemetría - Equipos sin alta')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(1, 2, 3)
@Controller('telemetria/huerfanos')
export class TelemetriaHuerfanosController {
  constructor(private readonly service: TelemetriaHuerfanosService) {}

  @Get(':page/:limit')
  @ApiQuery({ name: 'protocolo', required: false, enum: ['jt808', 'jimi', 'axpro', 'fa100s'] })
  @ApiQuery({ name: 'horas', required: false, description: 'Solo los vistos en las últimas N horas' })
  findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Query('protocolo') protocolo?: string,
    @Query('horas') horas?: string,
  ) {
    return this.service.findAll(page, limit, {
      protocolo: protocolo?.trim() || undefined,
      horas: horas != null ? Number(horas) : undefined,
    });
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
