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
  Res,
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
import type { Response } from 'express';
import * as multer from 'multer';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { ApiCrudResponse } from 'src/common/ApiResponse';
import { Roles } from 'src/common/decorators/roles.decorator';
import { RolesGuard } from 'src/guard/roles.guard';
import { CreateOrdenServicioDto } from './dto/create-orden-servicio.dto';
import {
  CancelarOrdenDto,
  CompartirOrdenDto,
  DecisionAutorizacionDto,
  EnviarCorreoOrdenDto,
  IniciarOrdenDto,
  MotivoOrdenDto,
  ProgramarOrdenDto,
  ReprogramarOrdenDto,
  SolicitarAutorizacionDto,
  SolicitarPruebaDto,
  ValidarCodigoDto,
  ValidarPruebaDto,
} from './dto/flujo-orden-servicio.dto';
import { OrdenesServicioPdfService } from './ordenes-servicio-pdf.service';
import { FilterOrdenesServicioDto } from './dto/filter-ordenes-servicio.dto';
import { UpdateOrdenServicioDto } from './dto/update-orden-servicio.dto';
import { OrdenesServicioService } from './ordenes-servicio.service';
import { OrdenesFlujoService } from './ordenes-flujo.service';
import { ROLES_ADMIN, ROLES_AUTORIZAN, ROLES_ESCRIBEN, ROLES_LEEN, ROLES_TURNO } from './ordenes-servicio.acceso';

// Roles y pertenencia: ordenes-servicio.acceso.ts (un solo lugar).
const ESCRIBEN = [...ROLES_ESCRIBEN];
const LEEN = [...ROLES_LEEN];
const OPERACION = [...ROLES_ADMIN];
const ROLES_CODIGO = [...ROLES_TURNO];
const uploadMax = Number(process.env.UPLOAD_MAX_SIZE) || 10 * 1024 * 1024;

@ApiTags('Órdenes de servicio')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ordenes-servicio')
export class OrdenesServicioController {
  constructor(
    private readonly service: OrdenesServicioService,
    private readonly flujo: OrdenesFlujoService,
    private readonly pdfService: OrdenesServicioPdfService,
  ) {}

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

  @Get('motivos')
  @Roles(...LEEN)
  @ApiOperation({
    summary: 'Motivos de no cumplida y cancelación',
    description: 'Catálogo homologado entre la app, el front y el CRM: a qué resultado lleva, quién lo aplica y si es cobrable por defecto.',
  })
  motivos() {
    return this.flujo.motivos();
  }

  @Get('codigos-pendientes')
  @Roles(...ROLES_CODIGO)
  @ApiOperation({
    summary: 'Códigos de verificación por dictar',
    description: 'Mantenimientos con código vigente, con cliente, placa, económico y técnico. El código se abre con POST /:id/codigo/ver.',
  })
  codigosPendientes() {
    return this.flujo.codigosPendientes();
  }

  @Get('autorizaciones-pendientes')
  @Roles(...ROLES_CODIGO)
  @ApiOperation({ summary: 'Altas que esperan autorización para desinstalar el equipo existente' })
  autorizacionesPendientes() {
    return this.flujo.autorizacionesPendientes();
  }

  @Get('pruebas-pendientes')
  @Roles(...ROLES_CODIGO)
  @ApiOperation({
    summary: 'Pruebas que esperan al operador',
    description: 'Transmisión, pánico y paro de motor pedidos por el técnico, con cliente, placa y técnico. El operador las verifica con POST /:id/pruebas/:clave/validar.',
  })
  pruebasPendientes() {
    return this.flujo.pruebasPendientes();
  }

  @Post('programar')
  @Roles(...OPERACION)
  @ApiOperation({
    summary: 'Programar orden(es) desde el front (operación)',
    description:
      'Para trabajos que no pasan por el CRM. Queda con origen `next`; el CRM la recibe en su consulta de cambios para pagarla y cobrarla. ' +
      'Alta de N unidades = N órdenes independientes.',
  })
  programar(@Body() dto: ProgramarOrdenDto, @Request() req) {
    return this.flujo.programar(dto, { tipo: 'usuario', user: req.user });
  }

  @Get('paginado/:page/:limit')
  @Roles(...LEEN)
  @ApiOperation({
    summary: 'Órdenes de servicio paginadas',
    description:
      'Filtros opcionales por query. `idProducto` da el historial completo de la unidad. El técnico (rol 8) solo ve sus órdenes. ' +
      'Con `estatus=programada` se ordena por cita (la agenda del técnico).',
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
    summary: 'Crear orden en borrador desde la app (etapa 1, en transición)',
    description:
      'Crea la orden en `borrador` con folio `OS-000001`. El técnico es el usuario del token. ' +
      'El cliente debe existir y estar activo. `idInstalacion` es obligatorio salvo en `instalacion` (alta). ' +
      'Idempotente por `claveApp`: reenviar con la misma clave devuelve la orden existente. ' +
      'En la etapa 2 la app usa las órdenes programadas y POST /:id/iniciar.',
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
  @ApiOperation({
    summary: 'Cancelar orden',
    description:
      'Programada: operación, con `claveMotivo`. Iniciada: solo operación (el técnico usa no cumplida). ' +
      'Las órdenes de la etapa 1 (sin origen) el técnico las cancela en borrador sin motivo. No toca la instalación.',
  })
  @ApiParam({ name: 'id' })
  cancelar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelarOrdenDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.flujo.cancelar(id, dto ?? {}, { tipo: 'usuario', user: req.user });
  }

  @Patch(':id/reprogramar')
  @Roles(...OPERACION)
  @ApiOperation({ summary: 'Reprogramar cita, técnico o vehículo (solo `programada`)' })
  @ApiParam({ name: 'id' })
  reprogramar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReprogramarOrdenDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.flujo.reprogramar(id, dto, { tipo: 'usuario', user: req.user });
  }

  @Post(':id/iniciar')
  @Roles(...ESCRIBEN)
  @ApiOperation({
    summary: 'Iniciar en campo una orden programada',
    description:
      'Pasa a `borrador`. El técnico confirma o corrige el tipo (solo entre mantenimientos) y el vehículo; se guarda lo programado y lo real. ' +
      'Idempotente por `claveApp`.',
  })
  @ApiParam({ name: 'id' })
  iniciar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: IniciarOrdenDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.flujo.iniciar(id, dto, req.user);
  }

  @Post(':id/codigo')
  @Roles(...ESCRIBEN)
  @ApiOperation({
    summary: 'Pedir código de verificación (mantenimientos)',
    description: '6 dígitos, 15 min, 5 intentos. Lo ve cualquier operador en turno; el técnico lo recibe dictado.',
  })
  @ApiParam({ name: 'id' })
  solicitarCodigo(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.flujo.solicitarCodigo(id, req.user);
  }

  @Post(':id/codigo/ver')
  @Roles(...ROLES_CODIGO)
  @ApiOperation({ summary: 'Ver el código para dictarlo (registra quién lo vio)' })
  @ApiParam({ name: 'id' })
  verCodigo(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.flujo.verCodigo(id, req.user);
  }

  @Post(':id/codigo/validar')
  @Roles(...ESCRIBEN)
  @ApiOperation({ summary: 'Validar el código dictado por el operador' })
  @ApiParam({ name: 'id' })
  validarCodigo(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ValidarCodigoDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.flujo.validarCodigo(id, dto, req.user);
  }

  @Post(':id/autorizacion')
  @Roles(...ESCRIBEN)
  @ApiOperation({
    summary: 'Pedir autorización para desinstalar el equipo existente (alta)',
    description: 'La orden no se puede cerrar hasta la decisión. Foto con la clave `equipo_existente`.',
  })
  @ApiParam({ name: 'id' })
  solicitarAutorizacion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SolicitarAutorizacionDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.flujo.solicitarAutorizacion(id, dto, req.user);
  }

  @Post(':id/autorizacion/decision')
  @Roles(...ROLES_AUTORIZAN)
  @ApiOperation({
    summary: 'Autorizar o rechazar la desinstalación',
    description: 'Autorizada: al cerrar se da de baja la instalación existente y se hace el alta. Rechazada: la orden queda no cumplida, cobrable.',
  })
  @ApiParam({ name: 'id' })
  decidirAutorizacion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DecisionAutorizacionDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.flujo.decidirAutorizacion(id, dto, { tipo: 'usuario', user: req.user });
  }

  @Post(':id/pruebas/:clave/solicitar')
  @Roles(...ESCRIBEN)
  @ApiOperation({
    summary: 'Pedir al operador una prueba (o el paro de motor)',
    description:
      '`clave` de la sección `pruebas` del catálogo: `transmision`, `boton_panico`, `paro_motor`. En las órdenes programadas el resultado lo pone el operador; volver a pedirla la reabre.',
  })
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'clave', example: 'paro_motor' })
  solicitarPrueba(
    @Param('id', ParseIntPipe) id: number,
    @Param('clave') clave: string,
    @Body() dto: SolicitarPruebaDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.flujo.solicitarPrueba(id, clave, dto ?? {}, req.user);
  }

  @Post(':id/pruebas/:clave/validar')
  @Roles(...ROLES_CODIGO)
  @ApiOperation({
    summary: 'El operador valida una prueba',
    description: 'Queda quién y cuándo, y el resultado se guarda como respuesta de la sección pruebas.',
  })
  @ApiParam({ name: 'id' })
  @ApiParam({ name: 'clave', example: 'transmision' })
  validarPrueba(
    @Param('id', ParseIntPipe) id: number,
    @Param('clave') clave: string,
    @Body() dto: ValidarPruebaDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.flujo.validarPrueba(id, clave, dto, req.user);
  }

  @Get(':id/pdf')
  @Roles(...LEEN)
  @ApiOperation({ summary: 'PDF de la orden', description: 'Datos, checklist, pruebas con quién las validó, observaciones y firmas.' })
  @ApiParam({ name: 'id' })
  async pdf(@Param('id', ParseIntPipe) id: number, @Request() req, @Res() res: Response) {
    const { nombre, buffer } = await this.pdfService.pdf(id, req.user);
    res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${nombre}"` });
    res.send(buffer);
  }

  @Post(':id/compartir')
  @Roles(...ESCRIBEN)
  @ApiOperation({
    summary: 'Enlace del PDF para WhatsApp',
    description: 'Solo cerrada o no cumplida. Devuelve `url` (7 días) y `whatsapp` (wa.me con el texto; con `telefono` abre ese chat).',
  })
  @ApiParam({ name: 'id' })
  compartir(@Param('id', ParseIntPipe) id: number, @Body() dto: CompartirOrdenDto, @Request() req) {
    return this.pdfService.compartir(id, dto?.telefono, req.user);
  }

  @Post(':id/enviar-correo')
  @Roles(...ESCRIBEN)
  @ApiOperation({ summary: 'Enviar el PDF por correo (hasta 5 destinatarios)', description: 'Solo cerrada o no cumplida.' })
  @ApiParam({ name: 'id' })
  enviarCorreo(@Param('id', ParseIntPipe) id: number, @Body() dto: EnviarCorreoOrdenDto, @Request() req) {
    return this.pdfService.enviarCorreo(id, dto.correos, req.user);
  }

  @Post(':id/no-cumplida')
  @Roles(...ESCRIBEN)
  @ApiOperation({
    summary: 'Cerrar sin hacer el trabajo, con motivo',
    description: 'Técnico u operación. El motivo define si es cobrable; solo operación lo puede cambiar (`cobrable`).',
  })
  @ApiParam({ name: 'id' })
  noCumplida(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: MotivoOrdenDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.flujo.noCumplida(id, dto, req.user);
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
