import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CatTipoDispositivoService } from './cat-tipo-dispositivo.service';

@ApiTags('Catálogos - Tipo Dispositivo')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('cat-tipo-dispositivo')
export class CatTipoDispositivoController {
  constructor(private readonly service: CatTipoDispositivoService) {}

  @Get('list')
  @ApiOperation({
    summary: 'Lista completa de tipos de dispositivo',
    description: 'Catálogo `CatTipoDispositivo` (1 Rastreador, 2 Panel alarma, 3 AVL, 4 Teléfono, 5 TrackCam, 6 TrackGas).',
  })
  @ApiQuery({
    name: 'soloActivos',
    required: false,
    description: 'Si true (default), solo retorna registros activos (estatus=1)',
  })
  @ApiResponse({ status: 200, description: 'Lista obtenida correctamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAllList(
    @Query('soloActivos') soloActivos?: string,
  ): Promise<ApiResponseCommon> {
    return this.service.findAllList(soloActivos !== 'false');
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener tipo de dispositivo por ID' })
  @ApiParam({ name: 'id', description: 'ID del tipo de dispositivo' })
  @ApiResponse({ status: 200, description: 'Registro encontrado' })
  @ApiResponse({ status: 404, description: 'No encontrado' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }
}
