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
import * as multer from 'multer';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { Roles } from 'src/common/decorators/roles.decorator';
import {
  EnumRoles,
  EstatusIncidente,
  TipoOrigenIncidente,
} from 'src/common/estatus.enum';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { CreateIncidenteDto } from './dto/create-incidente.dto';
import { CreateSeguimientoIncidenteDto } from './dto/create-seguimiento-incidente.dto';
import { FinalizarIncidenteDto } from './dto/finalizar-incidente.dto';
import { EnviarCorreoIncidenteDto } from './dto/enviar-correo-incidente.dto';
import { UpdateIncidenteDto } from './dto/update-incidente.dto';
import { IncidentesService } from './incidentes.service';

const ITEM_EXAMPLE = {
  id: 10,
  idCliente: 1,
  nombreCliente: 'Next',
  tipoOrigen: TipoOrigenIncidente.POSICION,
  idPosicion: 2356,
  idPosicionOrigen: 2356,
  idEventoAlarma: null,
  idEventoAlarmaOrigen: null,
  datosOrigen: {
    id: 2356,
    imei: '123456789012345',
    lat: 19.4326,
    lng: -99.1332,
    idEvento: 5,
  },
  idUsuario: 8,
  nombreUsuario: 'Ana Monitorista',
  descripcion: 'Help Me',
  fechaInicio: '2026-09-18T22:13:00.000Z',
  fechaCierre: null,
  estatus: EstatusIncidente.ABIERTO,
  fechaCreacion: '2026-09-18T22:13:00.000Z',
  fechaActualizacion: '2026-09-18T22:13:00.000Z',
};

@ApiTags('Incidentes')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('incidentes')
export class IncidentesController {
  constructor(private readonly service: IncidentesService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear incidente',
    description: [
      'Alta manual con `estatus = ABIERTO (1)`.',
      '',
      'El front solo indica el origen. El backend carga la fila, resuelve `idCliente`, copia los IDs `*Origen` y construye `datosOrigen`.',
      '',
      '**tipoOrigen = 1 (POSICION):** enviar `idPosicion`. No enviar `idEventoAlarma`.',
      '**tipoOrigen = 2 (EVENTO_ALARMA):** enviar `idEventoAlarma`. No enviar `idPosicion`.',
      '',
      '`idCliente` se toma del dispositivo (IMEI) o del evento; no se acepta en el body.',
    ].join('\n'),
  })
  @ApiBody({ type: CreateIncidenteDto })
  @ApiCreatedResponse({ description: 'Creado correctamente' })
  @ApiBadRequestResponse({
    description: 'Datos inválidos / origen sin cliente / combinación de IDs',
  })
  @ApiForbiddenResponse({ description: 'Cliente del origen fuera de alcance' })
  @ApiNotFoundResponse({ description: 'Posición o evento no encontrado' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async create(
    @Body() dto: CreateIncidenteDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.service.create(
      dto,
      Number(req.user.idCliente),
      Number(req.user.rol),
      Number(req.user.userId),
    );
  }

  @Get('list')
  @ApiOperation({
    summary: 'Lista de incidentes abiertos',
    description:
      'Solo `estatus = 1`. Alcance por rol. Query opcional `idCliente` y `tipoOrigen`.',
  })
  @ApiQuery({ name: 'idCliente', required: false, type: Number })
  @ApiQuery({
    name: 'tipoOrigen',
    required: false,
    enum: TipoOrigenIncidente,
  })
  @ApiOkResponse({
    description: 'Lista obtenida',
    schema: { example: { data: [ITEM_EXAMPLE] } },
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async findAllList(
    @Request() req,
    @Query('idCliente') idCliente?: string,
    @Query('tipoOrigen') tipoOrigen?: string,
  ): Promise<ApiResponseCommon> {
    return this.service.findAllList(
      Number(req.user.idCliente),
      Number(req.user.rol),
      Number(req.user.userId),
      this.parseOptionalInt(idCliente),
      this.parseOptionalInt(tipoOrigen),
    );
  }

  @Get('cliente/:idCliente')
  @ApiOperation({
    summary: 'Incidentes abiertos por idCliente',
    description:
      'Solo `estatus = 1`. El `idCliente` debe estar en el alcance del rol.',
  })
  @ApiParam({ name: 'idCliente', type: Number })
  @ApiQuery({
    name: 'tipoOrigen',
    required: false,
    enum: TipoOrigenIncidente,
  })
  @ApiOkResponse({
    description: 'Lista por cliente',
    schema: { example: { data: [ITEM_EXAMPLE] } },
  })
  @ApiForbiddenResponse({ description: 'Cliente fuera de alcance' })
  @ApiBadRequestResponse({ description: 'idCliente inválido / no existe' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async findByIdCliente(
    @Param('idCliente', ParseIntPipe) idCliente: number,
    @Request() req,
    @Query('tipoOrigen') tipoOrigen?: string,
  ): Promise<ApiResponseCommon> {
    return this.service.findByIdCliente(
      idCliente,
      Number(req.user.idCliente),
      Number(req.user.rol),
      Number(req.user.userId),
      this.parseOptionalInt(tipoOrigen),
    );
  }

  @Get()
  @ApiOperation({
    summary: 'Lista paginada de incidentes',
    description: 'Incluye abiertos y cerrados. Alcance por rol del token.',
  })
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiQuery({
    name: 'tipoOrigen',
    required: false,
    enum: TipoOrigenIncidente,
  })
  @ApiQuery({
    name: 'estatus',
    required: false,
    enum: EstatusIncidente,
    description: '1 = activos (abiertos), 0 = concluidos. Sin valor: ambos.',
  })
  @ApiQuery({
    name: 'idCliente',
    required: false,
    type: Number,
    description: 'Debe estar en el alcance del rol; fuera de alcance → lista vacía.',
  })
  @ApiOkResponse({ description: 'Lista paginada' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async findAll(
    @Request() req,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('tipoOrigen') tipoOrigen?: string,
    @Query('estatus') estatus?: string,
    @Query('idCliente') idCliente?: string,
  ): Promise<ApiResponseCommon> {
    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.min(200, Math.max(1, Number(limit) || 20));
    const estatusNum = this.parseOptionalInt(estatus);
    return this.service.findAll(
      Number(req.user.idCliente),
      Number(req.user.rol),
      Number(req.user.userId),
      pageNum,
      limitNum,
      this.parseOptionalInt(tipoOrigen),
      estatusNum === EstatusIncidente.ABIERTO ||
        estatusNum === EstatusIncidente.CERRADO
        ? estatusNum
        : undefined,
      this.parseOptionalInt(idCliente),
    );
  }

  @Patch(':id/finalizar')
  @ApiOperation({
    summary: 'Finalizar reporte',
    description: [
      'Cierra el incidente (`estatus = 0`, `fechaCierre`) y ya no admite seguimientos.',
      '`descripcion` reemplaza la descripción; `resultado` y `conclusion` se registran',
      'como seguimientos con medio "Resultado final" y "Cierre". Ya finalizado → 400.',
    ].join('\n'),
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: FinalizarIncidenteDto })
  @ApiOkResponse({ description: 'Reporte finalizado' })
  @ApiBadRequestResponse({ description: 'El reporte ya fue finalizado' })
  @ApiNotFoundResponse({ description: 'No encontrado o fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async finalizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: FinalizarIncidenteDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.service.finalizar(
      id,
      dto,
      Number(req.user.idCliente),
      Number(req.user.rol),
      Number(req.user.userId),
    );
  }

  @Post(':id/enviar-correo')
  @Roles(EnumRoles.SA, EnumRoles.DEV, EnumRoles.ADMIN, EnumRoles.JEFE_MONITOREO, EnumRoles.MONITOREO)
  @UseInterceptors(
    // 11 MB: el servicio responde 400 "más de 10 MB" en lugar del 413 de multer.
    FileInterceptor('file', { storage: multer.memoryStorage(), limits: { fileSize: 11 * 1024 * 1024 } }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'correos'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'PDF "Reporte de incidencia" generado por Consola, máx. 10 MB' },
        correos: { type: 'string', example: 'cliente@empresa.com, otro@empresa.com' },
        asunto: { type: 'string', maxLength: 200 },
        mensaje: { type: 'string', maxLength: 4000 },
      },
    },
  })
  @ApiOperation({
    summary: 'Enviar el reporte de incidencia (PDF) por correo',
    description:
      'Roles 1–5. Solo finalizado y visible para el usuario. Hasta 5 destinatarios (coma o punto y coma). ' +
      'El mensaje es texto plano con saltos de línea. Queda un seguimiento "Correo" con los destinatarios.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ description: 'Reporte enviado' })
  @ApiBadRequestResponse({ description: 'Sin PDF, más de 10 MB, correos inválidos o más de 5, o incidente abierto' })
  @ApiForbiddenResponse({ description: 'Rol distinto de 1 a 5' })
  @ApiNotFoundResponse({ description: 'No encontrado o fuera de alcance' })
  async enviarCorreo(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: EnviarCorreoIncidenteDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.service.enviarCorreo(
      id,
      file,
      dto,
      Number(req.user.idCliente),
      Number(req.user.rol),
      Number(req.user.userId),
    );
  }

  @Get(':id/seguimientos')
  @ApiOperation({ summary: 'Seguimientos de un incidente' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ description: 'Lista de seguimientos' })
  @ApiNotFoundResponse({ description: 'Incidente no encontrado o fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async findSeguimientos(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    return this.service.findSeguimientos(
      id,
      Number(req.user.idCliente),
      Number(req.user.rol),
      Number(req.user.userId),
    );
  }

  @Post(':id/seguimientos')
  @ApiOperation({
    summary: 'Registrar seguimiento',
    description: '`idUsuario` se toma del token. `fechaHora` opcional.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: CreateSeguimientoIncidenteDto })
  @ApiCreatedResponse({ description: 'Seguimiento registrado' })
  @ApiNotFoundResponse({ description: 'Incidente no encontrado o fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async createSeguimiento(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateSeguimientoIncidenteDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.service.createSeguimiento(
      id,
      dto,
      Number(req.user.idCliente),
      Number(req.user.rol),
      Number(req.user.userId),
    );
  }

  @Get(':id/evidencias')
  @ApiOperation({
    summary: 'Fotos y videos de la unidad alrededor de la alarma',
    description: [
      'Junta por IMEI y hora la ráfaga de fotos y el clip de evidencia que el gateway toma al',
      'dispararse la alarma (llegan como posiciones aparte, evento Cámara). Ventana: de `antesMin`',
      '(2 por defecto, máx. 60) antes a `despuesMin` (5 por defecto, máx. 120) después del inicio.',
      'Mismo alcance que el detalle. Sin IMEI en el origen (paneles), listas vacías.',
    ].join('\n'),
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiQuery({ name: 'antesMin', required: false, type: Number })
  @ApiQuery({ name: 'despuesMin', required: false, type: Number })
  @ApiOkResponse({
    schema: {
      example: {
        data: {
          idIncidente: 321,
          imei: '2300007434',
          desde: '2026-11-13 15:31:00',
          hasta: '2026-11-13 15:38:00',
          fotos: [{ id: 9001, url: 'https://springtelecom.mx/trackcam/data/trackcam/fotos/…/ch1.jpg', fechaHora: '2026-11-13T15:33:04' }],
          videos: [{ id: 120, url: 'https://springtelecom.mx/trackcam/data/trackcam/videos/…/ch1.mp4', fechaHora: '2026-11-13T15:33:25' }],
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'No encontrado o fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async evidencias(
    @Param('id', ParseIntPipe) id: number,
    @Query('antesMin') antesMin: string | undefined,
    @Query('despuesMin') despuesMin: string | undefined,
    @Request() req,
  ) {
    const minutos = (v: string | undefined, def: number, max: number) => {
      const n = Number(v);
      return v == null || v === '' || !Number.isFinite(n) ? def : Math.min(Math.max(0, n), max);
    };
    return this.service.evidencias(
      id,
      Number(req.user.idCliente),
      Number(req.user.rol),
      Number(req.user.userId),
      minutos(antesMin, 2, 60),
      minutos(despuesMin, 5, 120),
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un incidente' })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({
    description: 'Detalle con `datosOrigen` y seguimientos',
    schema: {
      example: {
        data: {
          ...ITEM_EXAMPLE,
          seguimientos: [
            {
              id: 1,
              actividad: 'Se realiza llamada a recepción',
              medio: 'Llamada',
            },
          ],
        },
      },
    },
  })
  @ApiNotFoundResponse({ description: 'No encontrado o fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<{ data: unknown }> {
    return this.service.findOne(
      id,
      Number(req.user.idCliente),
      Number(req.user.rol),
      Number(req.user.userId),
    );
  }

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Alternar estatus (abierto ↔ cerrado)',
    description:
      'Sin body. `1 → 0` cierra y llena `fechaCierre`. `0 → 1` reabre y deja `fechaCierre` en null.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiOkResponse({ description: 'Estatus alternado' })
  @ApiNotFoundResponse({ description: 'No encontrado o fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.service.updateEstatus(
      id,
      Number(req.user.idCliente),
      Number(req.user.rol),
      Number(req.user.userId),
    );
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar incidente',
    description: 'Solo `descripcion`. No se puede cambiar origen ni snapshot.',
  })
  @ApiParam({ name: 'id', type: Number })
  @ApiBody({ type: UpdateIncidenteDto })
  @ApiOkResponse({ description: 'Actualizado' })
  @ApiNotFoundResponse({ description: 'No encontrado o fuera de alcance' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateIncidenteDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.service.update(
      id,
      dto,
      Number(req.user.idCliente),
      Number(req.user.rol),
      Number(req.user.userId),
    );
  }

  private parseOptionalInt(value?: string): number | undefined {
    if (value == null || value === '') {
      return undefined;
    }
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  }
}
