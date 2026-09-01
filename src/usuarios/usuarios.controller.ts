import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  ParseIntPipe,
  Request,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiCreatedResponse,
  ApiConsumes,
} from '@nestjs/swagger';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto } from './dto/create-usuario.dto';
import { CreateUsuarioResponseDto } from './dto/create-usuario-response.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UpdateUsuarioContrasena } from './dto/update-usuario-contrasena.dto';
import { ResetUsuarioContrasenaDto } from './dto/reset-usuario-contrasena.dto';
import { UpdateMiPinDto } from './dto/update-mi-pin.dto';
import { SetFaceAuthDto } from './dto/set-face-auth.dto';
import { AsignarUsuarioInstalacionesDto } from './dto/asignar-usuario-instalaciones.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ApiResponseCommon, ApiCrudResponse } from 'src/common/ApiResponse';
import {
  esRolCambioContrasenaOtroUsuario,
  EnumRoles,
} from 'src/common/estatus.enum';
import { usuariosFileFieldsInterceptor } from './usuarios-upload.interceptor';
import {
  usuariosCreateMultipartApiBody,
  usuariosUpdateMultipartApiBody,
} from './usuarios-swagger-multipart';

@ApiTags('Usuarios')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles() // Todos los roles pueden acceder por defecto
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) { }

  // ==================== POST ====================

  @Post()
  @Roles()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(usuariosFileFieldsInterceptor())
  @ApiOperation({
    summary: 'Crear un nuevo usuario',
    description: [
      'Registra un nuevo usuario con `multipart/form-data` y asigna **UsuariosPermisos** desde `permisosIds` (obligatorio, puede ser `[]`).',
      'Opcionalmente asigna **AsignacionSoluciones** desde `solucionesIds` (omitir = sin relaciones).',
      '',
      'Si quien crea tiene rol **Cliente (6)** o **Usuario (9)**, el nuevo usuario recibe rol **Usuario (9)** automáticamente (`idRol` del body se ignora).',
      '',
      'Los arreglos se envían como JSON en texto (`"[1,2,3]"`). `fotoPerfil` opcional: URL en texto o archivo PNG/JPEG.',
    ].join('\n'),
  })
  @ApiBody(usuariosCreateMultipartApiBody)
  @ApiCreatedResponse({
    description: 'Usuario creado exitosamente',
    type: CreateUsuarioResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: [
      'Solicitud inválida. Posibles causas:',
      '- Validación del DTO (contraseña, campos obligatorios, etc.)',
      '- El usuario ya se encuentra registrado',
      '- idRol obligatorio para roles distintos de Cliente y Usuario',
      '- Una o más soluciones proporcionadas no existen',
    ].join('\n'),
  })
  @ApiResponse({
    status: 401,
    description: 'Token JWT ausente o inválido',
  })
  @ApiResponse({
    status: 403,
    description: 'Acceso denegado — solo SuperAdministrador (rol 1) puede crear usuarios',
  })
  @ApiResponse({
    status: 500,
    description: 'Error interno al crear el usuario',
  })
  async createUsuario(
    @Body() createUsuarioDto: CreateUsuarioDto,
    @UploadedFiles()
    files: { fotoPerfil?: Express.Multer.File[] },
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    const creatorRol = Number(req.user.rol);
    return await this.usuariosService.createUsuario(
      createUsuarioDto,
      idUser,
      files?.fotoPerfil?.[0],
      creatorRol,
    );
  }

  @Post('asignacion/instalaciones')
  @ApiOperation({
    summary: 'Asignar instalaciones a un usuario',
    description: [
      'Sincroniza **UsuariosInstalaciones** para el `idUsuario` indicado (obligatorio en body).',
      '',
      '`instalacionesIds` es la lista **definitiva** de instalaciones activas: crea, reactiva o desactiva relaciones por `estatus`.',
      'Enviar `[]` desactiva todas las asignaciones.',
      '',
      'Validaciones: cada instalación debe existir, tener `estatus = 1` y pertenecer al mismo `idCliente` del usuario destino.',
      'Quien asigna debe tener acceso al usuario según tenant (cualquier rol autenticado con visibilidad).',
    ].join('\n'),
  })
  @ApiBody({ type: AsignarUsuarioInstalacionesDto })
  @ApiResponse({
    status: 200,
    description: 'Instalaciones asignadas correctamente',
  })
  @ApiResponse({
    status: 400,
    description:
      'Instalación inválida, inactiva o de otro cliente; o datos del DTO incorrectos',
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado o sin acceso',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async asignarInstalacionesUsuario(
    @Body() dto: AsignarUsuarioInstalacionesDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return await this.usuariosService.asignarInstalacionesUsuario(
      dto,
      +req.user.idCliente,
      +req.user.rol,
      +req.user.userId,
    );
  }

  @Post('face-auth')
  @ApiOperation({
    summary: 'Registrar IdFaceAuth',
    description:
      'Actualiza únicamente IdFaceAuth del usuario autenticado (ID desde token).',
  })
  @ApiBody({ type: SetFaceAuthDto })
  @ApiResponse({
    status: 201,
    description: 'IdFaceAuth registrado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
  })
  @ApiResponse({
    status: 400,
    description: 'El usuario ya tiene IdFaceAuth registrado (rostro afiliado)',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async setFaceAuth(
    @Body() dto: SetFaceAuthDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.usuariosService.setIdFaceAuth(+idUser, dto);
  }

  // ==================== GET ====================

  @Get('list')
  @ApiOperation({
    summary: 'Obtener lista completa de usuarios',
    description: 'Obtiene todos los usuarios sin paginación según el rol y permisos',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista completa de usuarios obtenida exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async findAllList(@Request() req): Promise<ApiResponseCommon> {
    const idCliente = req.user.idCliente;
    const rol = req.user.rol;
    return await this.usuariosService.getAllListUsuarios(+idCliente, +rol);
  }

  @Get('list/cliente/:id')
  @ApiOperation({
    summary: 'Obtener usuarios por cliente específico',
    description: 'Obtiene la lista de usuarios asociados a un cliente específico',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: 'ID del cliente',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de usuarios del cliente obtenida exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Cliente no encontrado',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async findAllListUsuarioCliente(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    const idCliente = req.user.idCliente;
    return await this.usuariosService.getAllListUsuariosCliente(id, +idCliente);
  }

  @Get(':id/instalaciones')
  @ApiOperation({
    summary: 'Obtener instalaciones asignadas a un usuario',
    description:
      'Lista las instalaciones vinculadas al usuario en `UsuariosInstalaciones` (relación activa). ' +
      'El formato de cada instalación es el mismo que en el paginado del módulo instalaciones.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: 'ID del usuario',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Instalaciones del usuario obtenidas exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado o sin acceso',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async findInstalacionesByUsuario(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    const idCliente = req.user.idCliente;
    const rol = req.user.rol;
    return await this.usuariosService.getInstalacionesByUsuario(
      id,
      +idCliente,
      +rol,
    );
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Obtener usuarios con paginación',
    description:
      'Obtiene una lista paginada de usuarios según los parámetros especificados',
  })
  @ApiParam({
    name: 'page',
    type: 'number',
    description: 'Número de página',
    example: 1,
  })
  @ApiParam({
    name: 'limit',
    type: 'number',
    description: 'Cantidad de registros por página',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Usuarios obtenidos exitosamente con paginación',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    const idCliente = req.user.idCliente;
    const rol = req.user.rol;
    const idUser = req.user.userId;
    return await this.usuariosService.getAllUsuario(
      +idUser,
      +idCliente,
      +rol,
      page,
      limit,
    );
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener usuario por ID',
    description: 'Obtiene la información detallada de un usuario específico por su ID',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: 'ID del usuario',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Usuario encontrado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    const idCliente = req.user.idCliente;
    const rol = req.user.rol;
    return this.usuariosService.getUsuarioByID(+id, +idCliente, +rol);
  }

  // ==================== PATCH ====================

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Cambiar estatus del usuario',
    description:
      'Alterna el estatus: si está activo (1) pasa a inactivo (0) y viceversa. No requiere body.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: 'ID del usuario',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Estatus actualizado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async changeUsuarioEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.usuariosService.updateUsuarioEstatus(id, idUser);
  }

  @Patch('actualizar/contrasena')
  @ApiOperation({
    summary: 'Cambiar mi contraseña',
    description: 'Actualiza la contraseña del usuario autenticado (ID desde token)',
  })
  @ApiBody({ type: UpdateUsuarioContrasena })
  @ApiResponse({
    status: 200,
    description: 'Contraseña actualizada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Contraseña inválida',
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async updateContrasena(
    @Body() updateUsuarioContrasena: UpdateUsuarioContrasena,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.usuariosService.updateContrasena(+idUser, updateUsuarioContrasena);
  }


  @Post('cambiar/accesso')
  @ApiOperation({
    summary: 'Cambiar contraseña (sin contraseña actual)',
    description:
      'Actualiza la contraseña del usuario autenticado (ID desde token) o, si el rol es SA, Admin o Jefe de Monitoreo, del usuario indicado en idUsuario.',
  })
  @ApiBody({ type: ResetUsuarioContrasenaDto })
  @ApiResponse({
    status: 200,
    description: 'Contraseña actualizada exitosamente',
  })
  @ApiResponse({
    status: 400,
    description:
      'Contraseña inválida, idUsuario faltante (SA, Admin, Jefe de Monitoreo) o igual a la anterior',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async resetContrasena(
    @Body() dto: ResetUsuarioContrasenaDto,
    @Request() req,
  ): Promise<string> {
    const rol = Number(req.user.rol);
    const idActor = Number(req.user.userId);
    const targetUserId = esRolCambioContrasenaOtroUsuario(rol)
      ? this.resolveTargetUserIdAdmin(dto.idUsuario)
      : idActor;

    return await this.usuariosService.resetContrasena(
      targetUserId,
      idActor,
      dto,
    );
  }

  private resolveTargetUserIdAdmin(idUsuario?: number): number {
    if (idUsuario == null || !Number.isFinite(Number(idUsuario))) {
      throw new BadRequestException(
        'idUsuario es obligatorio para roles SA, Admin y Jefe de Monitoreo.',
      );
    }
    return Number(idUsuario);
  }

  @Patch('mi-nip')
  @ApiOperation({
    summary: 'Crear o actualizar mi NIP',
    description: 'Crea o actualiza el NIP del usuario autenticado (ID desde token)',
  })
  @ApiBody({ type: UpdateMiPinDto })
  @ApiResponse({
    status: 200,
    description: 'NIP actualizado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async createMyPin(
    @Body() updateMiPinDto: UpdateMiPinDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.usuariosService.createMyPin(+idUser, updateMiPinDto);
  }

  @Patch(':id')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(usuariosFileFieldsInterceptor())
  @ApiOperation({
    summary: 'Actualizar datos del usuario',
    description: [
      'Actualiza con `multipart/form-data`. No modifica contraseña (use PATCH /usuarios/actualizar/contrasena).',
      'Solo sincroniza **UsuariosPermisos** vía `permisosIds` y **AsignacionSoluciones** vía `solucionesIds` (omitir = no cambiar; `[]` = desactivar todos).',
      'Si quien actualiza tiene rol **Cliente (6)** o **Usuario (9)** y envía `idRol`, se fuerza **Usuario (9)**.',
      'Adjuntar `fotoPerfil` reemplaza la imagen en S3.',
    ].join(' '),
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: 'ID del usuario',
    example: 1,
  })
  @ApiBody(usuariosUpdateMultipartApiBody)
  @ApiResponse({
    status: 200,
    description: 'Usuario actualizado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos',
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado',
  })
  async updateUsuario(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUsuarioDto: UpdateUsuarioDto,
    @UploadedFiles()
    files: { fotoPerfil?: Express.Multer.File[] },
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    const creatorRol = Number(req.user.rol);
    return await this.usuariosService.updateUsuario(
      id,
      updateUsuarioDto,
      idUser,
      files?.fotoPerfil?.[0],
      creatorRol,
    );
  }

}
