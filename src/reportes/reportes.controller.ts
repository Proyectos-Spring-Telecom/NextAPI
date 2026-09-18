import { Body, Controller, Post, Request, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { PasoPorPoiDto } from './dto/paso-por-poi.dto';
import { VelocidadDto } from './dto/velocidad.dto';
import { ReportePosicionesDto } from './dto/reporte-posiciones.dto';
import { UltimaPosicionDto } from './dto/ultima-posicion.dto';
import { ReportesService } from './reportes.service';

@ApiTags('Reportes')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('reportes')
export class ReportesController {
  constructor(private readonly service: ReportesService) {}

  @Post('paso-por-poi')
  @ApiOperation({
    summary: 'Dispositivos que pasaron por uno o más puntos de interés',
    description: [
      'Por cada POI cuenta **dispositivos distintos** (instalaciones) con al menos una posición',
      'dentro de su radio (`PuntosInteres.RadioMetros`) en el periodo indicado.',
      '',
      '**Body:**',
      '- `idCliente` + `idsPuntoInteres` (1..N; todos deben ser del cliente).',
      '- `fechaInicio` / `fechaFinal` (inclusive, hora de pared como `Posiciones.FechaHora`).',
      '- `filtro` + `valores` opcionales para acotar instalaciones:',
      '  - `imei` / `numeroSerie` → busca en `Dispositivos`.',
      '  - `placa` / `economico` → busca en `Vehiculos`.',
      '  - Sin `filtro` → todas las instalaciones **activas** del cliente con dispositivo e IMEI.',
      '  - Con filtro sin coincidencias → respuesta vacía (0 dispositivos/posiciones).',
      '',
      '**Respuesta:** `data.puntos[]` (detalle por POI) y `data.totalDispositivosUnicos`',
      '(unión de dispositivos que pasaron por al menos un POI).',
      'En cada POI: `dispositivos` (resumen) y `posiciones` (filas planas con campos de',
      '`Posiciones` + producto: base + vehículo (placa/eco/marca/modelo/anio/foto)',
      '+ activo + persona; sin atributos de inmueble).',
      '',
      '**Exclusiones:** tipo panel de alarma (`idTipoDispositivo = 2`).',
      '',
      '**Alcance:** `idCliente` debe estar visible según el rol del token.',
    ].join('\n'),
  })
  @ApiBody({ type: PasoPorPoiDto })
  @ApiOkResponse({
    description:
      'Reporte generado (`data.puntos` con `dispositivos`, `posiciones` planas + producto, y `totalDispositivosUnicos`)',
  })
  @ApiBadRequestResponse({
    description: 'Fechas inválidas / filtro inválido / POI de otro cliente',
  })
  @ApiForbiddenResponse({ description: 'Cliente fuera de alcance' })
  @ApiNotFoundResponse({
    description: 'Uno o más puntos de interés no encontrados',
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async pasoPorPuntoInteres(@Body() dto: PasoPorPoiDto, @Request() req) {
    return this.service.pasoPorPuntoInteres(
      dto,
      Number(req.user.idCliente),
      Number(req.user.rol),
    );
  }

  @Post('velocidad')
  @ApiOperation({
    summary: 'Posiciones de vehículos con velocidad mínima',
    description: [
      'Obtiene posiciones de **productos vehículo** cuya `Posiciones.Velocidad`',
      'sea **>=** al umbral `velocidad` en el periodo indicado.',
      '',
      '**Body:**',
      '- `idCliente` + `velocidad` (mínima, inclusive).',
      '- `fechaInicio` / `fechaFinal` (inclusive, hora de pared como `Posiciones.FechaHora`).',
      '- `filtro` + `valores` opcionales (misma lógica que paso-por-poi):',
      '  - `imei` / `numeroSerie` → `Dispositivos`.',
      '  - `placa` / `economico` → `Vehiculos`.',
      '  - Sin `filtro` → todas las instalaciones activas de vehículos del cliente.',
      '  - Con filtro sin coincidencias → respuesta vacía.',
      '',
      '**Respuesta:** `data.posiciones[]` con campos de `Posiciones` + vehículo:',
      '`imei`, `id` (posición), `placas`, `economico`, `descripcion`, `lat`, `lng`,',
      '`estado`, `ignicion`, `velocidad`, `fechaHora`, `modelo`, `numeroSerie`,',
      '`imagen`, `idProducto`.',
      '',
      '**Exclusiones:** paneles de alarma; productos que no sean vehículo.',
      '',
      '**Alcance:** `idCliente` debe estar visible según el rol del token.',
    ].join('\n'),
  })
  @ApiBody({ type: VelocidadDto })
  @ApiOkResponse({
    description:
      'Reporte de velocidad (`data.posiciones` + `data.total`)',
  })
  @ApiBadRequestResponse({
    description: 'Fechas inválidas / filtro inválido / velocidad inválida',
  })
  @ApiForbiddenResponse({ description: 'Cliente fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async velocidad(@Body() dto: VelocidadDto, @Request() req) {
    return this.service.velocidad(
      dto,
      Number(req.user.idCliente),
      Number(req.user.rol),
    );
  }

  @Post('posiciones')
  @ApiOperation({
    summary: 'Posiciones por cliente y periodo',
    description: [
      'Obtiene filas de `Posiciones` en el periodo indicado para las instalaciones',
      'resueltas con `filtro` / `valores` (misma lógica que los demás reportes).',
      '',
      '**Body:**',
      '- `idCliente` + `fechaInicio` / `fechaFinal`.',
      '- `filtro` + `valores` opcionales:',
      '  - `imei` / `numeroSerie` → `Dispositivos`.',
      '  - `placa` / `economico` → `Vehiculos`.',
      '  - Sin `filtro` → todas las instalaciones activas del cliente con dispositivo e IMEI.',
      '  - Con filtro sin coincidencias → respuesta vacía.',
      '',
      '**Respuesta:** `data.posiciones[]` con los campos de la tabla `Posiciones`.',
      '',
      '**Exclusiones:** tipo panel de alarma (`idTipoDispositivo = 2`).',
      '',
      '**Alcance:** `idCliente` debe estar visible según el rol del token.',
    ].join('\n'),
  })
  @ApiBody({ type: ReportePosicionesDto })
  @ApiOkResponse({
    description: 'Reporte de posiciones (`data.posiciones` + `data.total`)',
  })
  @ApiBadRequestResponse({
    description: 'Fechas inválidas / filtro inválido',
  })
  @ApiForbiddenResponse({ description: 'Cliente fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async posiciones(@Body() dto: ReportePosicionesDto, @Request() req) {
    return this.service.posiciones(
      dto,
      Number(req.user.idCliente),
      Number(req.user.rol),
    );
  }

  @Post('ultima-posicion')
  @ApiOperation({
    summary: 'Última posición por cliente y periodo',
    description: [
      'Misma lógica que `posiciones`, pero consulta `UltimaPosicion`',
      '(una fila por IMEI) filtrada por `FechaHora` en el periodo.',
      '',
      '**Body:**',
      '- `idCliente` + `fechaInicio` / `fechaFinal`.',
      '- `filtro` + `valores` opcionales:',
      '  - `imei` / `numeroSerie` → `Dispositivos`.',
      '  - `placa` / `economico` → `Vehiculos`.',
      '  - Sin `filtro` → todas las instalaciones activas del cliente con dispositivo e IMEI.',
      '  - Con filtro sin coincidencias → respuesta vacía.',
      '',
      '**Respuesta:** `data.posiciones[]` con los campos de `UltimaPosicion`.',
      'Orden: `fechaHora` DESC, `id` DESC.',
      '',
      '**Exclusiones:** tipo panel de alarma (`idTipoDispositivo = 2`).',
      '',
      '**Alcance:** `idCliente` debe estar visible según el rol del token.',
    ].join('\n'),
  })
  @ApiBody({ type: UltimaPosicionDto })
  @ApiOkResponse({
    description:
      'Reporte de última posición (`data.posiciones` + `data.total`)',
  })
  @ApiBadRequestResponse({
    description: 'Fechas inválidas / filtro inválido',
  })
  @ApiForbiddenResponse({ description: 'Cliente fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async ultimaPosicion(@Body() dto: UltimaPosicionDto, @Request() req) {
    return this.service.ultimaPosicion(
      dto,
      Number(req.user.idCliente),
      Number(req.user.rol),
    );
  }
}
