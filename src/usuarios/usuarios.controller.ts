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
import { UpdateMiPinDto } from './dto/update-mi-pin.dto';
import { SetFaceAuthDto } from './dto/set-face-auth.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ApiResponseCommon, ApiCrudResponse } from 'src/common/ApiResponse';
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
  constructor(private readonly usuariosService: UsuariosService) {}

  // ==================== POST ====================

  @Post()
  @Roles(1)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(usuariosFileFieldsInterceptor())
  @ApiOperation({
    summary: 'Crear un nuevo usuario',
    description: [
      'Registra un nuevo usuario con `multipart/form-data` y asigna en una sola transacción:',
      '- **UsuariosPermisos** desde `permisosIds` (obligatorio, puede ser `[]`)',
      '- **UsuariosInstalaciones** desde `instalacionesIds` (opcional)',
      '- **UsuarioPanelAlarma** desde `panelesAlarmaIds` (opcional)',
      '- **AsignacionSoluciones** desde `solucionesIds` (opcional)',
      '',
      'Los arreglos se envían como JSON en texto (`"[1,2,3]"`). `fotoPerfil` opcional: URL en texto o archivo PNG/JPEG.',
      'Si un arreglo opcional se omite, se interpreta como `[]`. Los IDs duplicados se eliminan antes de insertar.',
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
      '- Una o más instalaciones proporcionadas no existen',
      '- Uno o más paneles de alarma proporcionados no existen',
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
    return await this.usuariosService.createUsuario(
      createUsuarioDto,
      idUser,
      files?.fotoPerfil?.[0],
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
    description:
      'Actualiza la información con `multipart/form-data`. No permite modificar la contraseña; use PATCH /usuarios/actualizar/contrasena. Arreglos como JSON; campo omitido = no modificar relaciones; `[]` = desactivar todas. Si adjunta `fotoPerfil`, reemplaza la imagen en S3.',
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
    return await this.usuariosService.updateUsuario(
      id,
      updateUsuarioDto,
      idUser,
      files?.fotoPerfil?.[0],
    );
  }

}
