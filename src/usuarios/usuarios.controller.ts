import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  ParseIntPipe,
  Request,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
  ApiParam,
  ApiBody,
  ApiCreatedResponse,
} from '@nestjs/swagger';
import { UsuariosService } from './usuarios.service';
import { CreateUsuarioDto, CREATE_USUARIO_SWAGGER_EXAMPLE } from './dto/create-usuario.dto';
import { CreateUsuarioResponseDto } from './dto/create-usuario-response.dto';
import { UpdateUsuarioDto } from './dto/update-usuario.dto';
import { UpdateUsuarioEstatusDto } from './dto/update-usuario-estatus.dto';
import { UpdateUsuarioContrasena } from './dto/update-usuario-contrasena.dto';
import { UpdateMiPinDto } from './dto/update-mi-pin.dto';
import { SetFaceAuthDto } from './dto/set-face-auth.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ApiResponseCommon, ApiCrudResponse } from 'src/common/ApiResponse';

@ApiTags('Usuarios')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles() // Todos los roles pueden acceder por defecto
@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) { }

  // ==================== POST ====================

  @Post()
  @Roles(1)
  @ApiOperation({
    summary: 'Crear un nuevo usuario',
    description: [
      'Registra un nuevo usuario y asigna en una sola transacción:',
      '- **UsuariosPermisos** desde `permisosIds` (obligatorio, puede ser `[]`)',
      '- **UsuariosInstalaciones** desde `instalacionesIds` (opcional)',
      '- **UsuarioPanelAlarma** desde `panelesAlarmaIds` (opcional)',
      '- **AsignacionSoluciones** desde `solucionesIds` (opcional)',
      '',
      'Si un arreglo opcional se omite, se interpreta como `[]`. Los IDs duplicados se eliminan antes de insertar. Ante cualquier error en las asignaciones se ejecuta rollback completo.',
    ].join('\n'),
  })
  @ApiBody({
    type: CreateUsuarioDto,
    description:
      'Datos del usuario y arreglos de IDs para asignar permisos, instalaciones, paneles y soluciones. `emailConfirmado` y `estatus` se asignan automáticamente con valor 1 en el servidor.',
    examples: {
      ejemploCompleto: {
        summary: 'Todos los atributos del DTO',
        description:
          'Incluye: userName, passwordHash, nombre, apellidoPaterno, apellidoMaterno, telefono, fotoPerfil, idRol, idCliente, permisosIds, instalacionesIds, panelesAlarmaIds, solucionesIds.',
        value: { ...CREATE_USUARIO_SWAGGER_EXAMPLE },
      },
      soloPermisos: {
        summary: 'Solo campos obligatorios + permisos',
        description:
          'Compatibilidad sin instalacionesIds, panelesAlarmaIds ni solucionesIds.',
        value: {
          userName: 'usuario@empresa.com',
          passwordHash: 'P@ssword123',
          nombre: 'Juan',
          apellidoPaterno: 'Pérez',
          idRol: 3,
          idCliente: 6,
          permisosIds: [3, 7],
        },
      },
      sinAsignaciones: {
        summary: 'Sin relaciones',
        value: {
          userName: 'basico@empresa.com',
          passwordHash: 'P@ssword123',
          nombre: 'Ana',
          apellidoPaterno: 'Ruiz',
          idRol: 3,
          idCliente: 6,
          permisosIds: [],
        },
      },
    },
  })
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
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.usuariosService.createUsuario(createUsuarioDto, idUser);
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
    description: 'Obtiene todos los usuarios sin paginación según el rol y permisos'
  })
  @ApiResponse({
    status: 200,
    description: 'Lista completa de usuarios obtenida exitosamente',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado'
  })
  async findAllList(@Request() req): Promise<ApiResponseCommon> {
    const idCliente = req.user.idCliente;
    const rol = req.user.rol;
    return await this.usuariosService.getAllListUsuarios(+idCliente, +rol);
  }

  @Get('list/cliente/:id')
  @ApiOperation({
    summary: 'Obtener usuarios por cliente específico',
    description: 'Obtiene la lista de usuarios asociados a un cliente específico'
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: 'ID del cliente',
    example: 1
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de usuarios del cliente obtenida exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Cliente no encontrado'
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado'
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
    description: 'Obtiene una lista paginada de usuarios según los parámetros especificados'
  })
  @ApiParam({
    name: 'page',
    type: 'number',
    description: 'Número de página',
    example: 1
  })
  @ApiParam({
    name: 'limit',
    type: 'number',
    description: 'Cantidad de registros por página',
    example: 10
  })
  @ApiResponse({
    status: 200,
    description: 'Usuarios obtenidos exitosamente con paginación',
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado'
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
    description: 'Obtiene la información detallada de un usuario específico por su ID'
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: 'ID del usuario',
    example: 1
  })
  @ApiResponse({
    status: 200,
    description: 'Usuario encontrado exitosamente'
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado'
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado'
  })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req
  ) {
    const idCliente = req.user.idCliente;
    const rol = req.user.rol;
    return this.usuariosService.getUsuarioByID(+id, +idCliente, +rol);
  }

  // ==================== PATCH ====================

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Cambiar estatus del usuario',
    description: 'Actualiza el estatus de un usuario (activar/desactivar)'
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: 'ID del usuario',
    example: 1
  })
  @ApiBody({ type: UpdateUsuarioEstatusDto })
  @ApiResponse({
    status: 200,
    description: 'Estatus actualizado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado'
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado'
  })
  async changeUsuarioEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUsuarioEstatusDto: UpdateUsuarioEstatusDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.usuariosService.updateUsuarioEstatus(
      id,
      updateUsuarioEstatusDto,
      idUser,
    );
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
    return await this.usuariosService.updateContrasena(
      +idUser,
      updateUsuarioContrasena,
    );
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
  @ApiOperation({
    summary: 'Actualizar datos del usuario',
    description:
      'Actualiza la información de un usuario existente. No permite modificar la contraseña; use PATCH /usuarios/actualizar/contrasena.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: 'ID del usuario',
    example: 1
  })
  @ApiBody({ type: UpdateUsuarioDto })
  @ApiResponse({
    status: 200,
    description: 'Usuario actualizado exitosamente',
  })
  @ApiResponse({
    status: 400,
    description: 'Datos inválidos'
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado'
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado'
  })
  async updateUsuario(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateUsuarioDto: UpdateUsuarioDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.usuariosService.updateUsuario(
      id,
      updateUsuarioDto,
      idUser,
    );
  }

  // ==================== DELETE ====================

  @Delete(':id')
  @Roles(1) // Solo SuperAdministrador puede eliminar usuarios
  @ApiOperation({
    summary: 'Eliminar usuario',
    description: 'Elimina un usuario del sistema'
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: 'ID del usuario a eliminar',
    example: 1
  })
  @ApiResponse({
    status: 200,
    description: 'Usuario eliminado exitosamente',
  })
  @ApiResponse({
    status: 404,
    description: 'Usuario no encontrado'
  })
  @ApiResponse({
    status: 400,
    description: 'No se puede eliminar el usuario'
  })
  @ApiResponse({
    status: 401,
    description: 'No autorizado'
  })
  @ApiResponse({
    status: 403,
    description: 'Acceso denegado - Solo SuperAdministrador puede eliminar usuarios'
  })
  async deleteUsuario(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.usuariosService.deleteUsuario(id, idUser);
  }
}