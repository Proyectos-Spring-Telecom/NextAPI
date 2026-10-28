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
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import * as multer from 'multer';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { ApiCrudResponse } from 'src/common/ApiResponse';
import { EnumRoles } from 'src/common/estatus.enum';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/guard/roles.guard';
import { CreateOrdenServicioDto } from './dto/create-orden-servicio.dto';
import { FilterOrdenesServicioDto } from './dto/filter-ordenes-servicio.dto';
import { UpdateOrdenServicioDto } from './dto/update-orden-servicio.dto';
import { OrdenesServicioService } from './ordenes-servicio.service';

const ESCRIBEN = [EnumRoles.SA, EnumRoles.DEV, EnumRoles.ADMIN, EnumRoles.TECNICO];
const LEEN = [...ESCRIBEN, EnumRoles.JEFE_MONITOREO, EnumRoles.MONITOREO];
const uploadMax = Number(process.env.UPLOAD_MAX_SIZE) || 10 * 1024 * 1024;

@ApiTags('Órdenes de servicio')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ordenes-servicio')
export class OrdenesServicioController {
  constructor(private readonly service: OrdenesServicioService) {}

  @Get('catalogo')
  @Roles(...LEEN)
  @ApiOperation({
    summary: 'Catálogo de la orden de servicio',
    description:
      'Opciones activas por sección (`vehiculo_cuenta_con`, `funcionamiento_vehiculo`, `fallas_equipo`, `pruebas`, `fotos`, `firmas`) y monitoristas activos (rol 4/5). La app arma las pantallas con esto en lugar de listas fijas.',
  })
  catalogo() {
    return this.service.catalogo();
  }

  @Get('paginado/:page/:limit')
  @Roles(...LEEN)
  @ApiOperation({
    summary: 'Órdenes de servicio paginadas',
    description:
      'Filtros opcionales por query. `idProducto` da el historial completo de la unidad. El técnico (rol 8) solo ve sus órdenes.',
  })
  findPaginado(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Query() filtros: FilterOrdenesServicioDto,
    @Request() req,
  ) {
    return this.service.findPaginado(page, limit, filtros, req.user);
  }

  @Post()
  @Roles(...ESCRIBEN)
  @ApiOperation({
    summary: 'Iniciar orden de servicio (borrador)',
    description:
      'Crea la orden en `borrador` con folio `OS-000001`. El técnico es el usuario del token. ' +
      'El cliente debe existir y estar activo. `idInstalacion` es obligatorio salvo en `instalacion` (alta). ' +
      'Idempotente por `claveApp`: reenviar con la misma clave devuelve la orden existente.',
  })
  @ApiResponse({ status: 201, description: 'Orden creada (o existente con la misma claveApp)' })
  create(@Body() dto: CreateOrdenServicioDto, @Request() req): Promise<ApiCrudResponse> {
    return this.service.create(dto, req.user);
  }

  @Patch(':id')
  @Roles(...ESCRIBEN)
  @ApiOperation({
    summary: 'Guardado parcial de la orden',
    description:
      'Solo en `borrador`. Cambia lo que se envía; las respuestas se agregan o reemplazan por (seccion, clave). ' +
      'Los campos que no aplican al tipo de servicio se rechazan.',
  })
  @ApiParam({ name: 'id' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrdenServicioDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.service.update(id, dto, req.user);
  }

  @Post(':id/archivos/:clave')
  @Roles(...ESCRIBEN)
  @UseInterceptors(
    FileInterceptor('file', { storage: multer.memoryStorage(), limits: { fileSize: uploadMax } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } } },
  })
  @ApiOperation({
    summary: 'Subir foto o firma',
    description:
      '`clave` de `fotos` o `firmas` del catálogo (p. ej. `tablero_inicio`, `firma_cliente`). PNG o JPG. ' +
      'Volver a subir la misma clave la reemplaza.',
  })
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'clave', example: 'tablero_inicio' })
  subirArchivo(
    @Param('id', ParseIntPipe) id: number,
    @Param('clave') clave: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.service.subirArchivo(id, clave, file, req.user);
  }

  @Post(':id/cerrar')
  @Roles(...ESCRIBEN)
  @ApiOperation({
    summary: 'Cerrar orden y aplicar el movimiento en la instalación',
    description:
      'En una transacción: valida que esté completa (si no, 400 con `faltantes`) y aplica según el tipo: ' +
      '`instalacion` → alta; `c_equipo` / `c_sim` → nueva versión de la instalación (la anterior se archiva como baja por reemplazo); ' +
      '`desinstalacion` → baja (0/5); `revision` → sin cambio. Repetir el cierre devuelve el mismo resultado.',
  })
  @ApiParam({ name: 'id' })
  cerrar(@Param('id', ParseIntPipe) id: number, @Request() req): Promise<ApiCrudResponse> {
    return this.service.cerrar(id, req.user);
  }

  @Post(':id/cancelar')
  @Roles(...ESCRIBEN)
  @ApiOperation({ summary: 'Cancelar orden en borrador (no toca la instalación)' })
  @ApiParam({ name: 'id' })
  cancelar(@Param('id', ParseIntPipe) id: number, @Request() req): Promise<ApiCrudResponse> {
    return this.service.cancelar(id, req.user);
  }

  @Get(':id')
  @Roles(...LEEN)
  @ApiOperation({
    summary: 'Detalle de la orden',
    description:
      'Orden, respuestas, archivos con URL firmada (5 min) y, en borrador, `faltantesParaCerrar`.',
  })
  @ApiParam({ name: 'id' })
  findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.service.findOne(id, req.user);
  }
}
