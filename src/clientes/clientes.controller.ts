import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  UseGuards,
  Request,
  ParseIntPipe,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { ClientesService } from './clientes.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { clientesFileFieldsInterceptor } from './clientes-upload.interceptor';
import { ClientesMultipartDocumentsPlaceholderInterceptor } from './clientes-multipart-placeholder.interceptor';
import {
  clientesCreateMultipartApiBody,
  clientesUpdateMultipartApiBody,
} from './clientes-swagger-multipart';

@ApiTags('Clientes')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles() // Todos los roles pueden acceder por defecto
@Controller('clientes')
export class ClientesController {
  constructor(private readonly clientesService: ClientesService) {}

  // ==================== POST ====================

  @Post()
  @Roles(1, 2, 3, 6) // SA, Dev y Admin con cualquier padre; Cliente (6) solo dentro de su árbol
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    clientesFileFieldsInterceptor(),
    ClientesMultipartDocumentsPlaceholderInterceptor,
  )
  @ApiOperation({
    summary: 'Crear un nuevo cliente',
    description:
      'Crea un cliente con `multipart/form-data`. Acta, comprobante y constancia son opcionales (URL o PDF). ' +
      'Es **obligatorio** `numerosEmergencia` (JSON string, mínimo 1 contacto). Logotipo opcional. ' +
      'Solo roles **SA (1)**, **Dev (2)**, **Admin (3)** y **Cliente (6)**. Roles 1–3: `idPadre` opcional (por defecto 1). ' +
      'Rol 6: el cliente se crea como hijo de un cliente de su árbol (`idPadre` opcional, por defecto su propio cliente); fuera de su árbol → 403.',
  })
  @ApiBody(clientesCreateMultipartApiBody)
  @ApiResponse({
    status: 201,
    description: 'Cliente creado exitosamente',
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({
    status: 403,
    description: 'Rol sin permiso para crear clientes o `idPadre` fuera del alcance de quien crea',
  })
  async createCliente(
    @Body() createClienteDto: CreateClienteDto,
    @UploadedFiles()
    files: {
      actaConstitutiva?: Express.Multer.File[];
      comprobanteDomicilio?: Express.Multer.File[];
      constanciaSituacionFiscal?: Express.Multer.File[];
      logotipo?: Express.Multer.File[];
    },
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.clientesService.createCliente(
      createClienteDto,
      idUser,
      files?.actaConstitutiva?.[0],
      files?.comprobanteDomicilio?.[0],
      files?.constanciaSituacionFiscal?.[0],
      files?.logotipo?.[0],
      req.user,
    );
  }

  // ==================== GET ====================

  @Get('list')
  @ApiOperation({
    summary: 'Obtener lista completa de clientes',
    description: 'Obtiene todos los clientes según el rol y permisos del usuario',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de clientes obtenida exitosamente',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async getAllListClientes(@Request() req): Promise<ApiResponseCommon> {
    const idCliente = req.user.idCliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.clientesService.getAllListClientes(+idUser, +idCliente, +rol);
  }

  @Get('jerarquia')
  @ApiOperation({
    summary: 'Jerarquía de clientes (spGetClientes)',
    description:
      'Ejecuta el procedimiento almacenado `spGetClientes` con la raíz indicada. Por defecto usa `IdCliente` del JWT. Roles 1 y 2 pueden enviar `idClienteRaiz` para otra raíz.',
  })
  @ApiQuery({
    name: 'idClienteRaiz',
    required: false,
    type: Number,
    description: 'Opcional. ID cliente raíz del árbol. Solo permitido para roles 1 y 2.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista jerárquica (raíz + hijos recursivos)',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({
    status: 403,
    description: 'idClienteRaiz no permitido para este rol',
  })
  async getJerarquiaClientesSp(
    @Request() req,
    @Query('idClienteRaiz') idClienteRaizRaw?: string,
  ): Promise<ApiResponseCommon> {
    const idClienteToken = Number(req.user.idCliente);
    const rol = Number(req.user.rol);
    let idClienteRaizOpcional: number | undefined;
    if (idClienteRaizRaw !== undefined && idClienteRaizRaw !== '') {
      const parsed = Number(idClienteRaizRaw);
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new BadRequestException('idClienteRaiz inválido');
      }
      idClienteRaizOpcional = parsed;
    }
    return this.clientesService.getJerarquiaClientesSp(
      idClienteToken,
      rol,
      idClienteRaizOpcional,
    );
  }

  @Get('list/:cliente')
  @ApiOperation({
    summary: 'Obtener lista de clientes por ID de cliente',
    description:
      'Obtiene el cliente indicado y sus hijos (spGetClientes). El cliente debe estar en el alcance del usuario (rol 6: su árbol; roles 7 y 9: su cliente); si no, 404.',
  })
  @ApiParam({
    name: 'cliente',
    type: 'number',
    description: 'ID del cliente',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de clientes obtenida exitosamente',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado o fuera de tu alcance' })
  async getAllListClientesId(
    @Param('cliente', ParseIntPipe) idCliente: number,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    const idUser = req.user.userId;
    return this.clientesService.getAllListClientesId(+idUser, +idCliente, req.user);
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Obtener clientes con paginación',
    description:
      'Obtiene una lista paginada de clientes según los parámetros especificados',
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
    description: 'Clientes obtenidos exitosamente con paginación',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async getAllClientes(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    const idCliente = req.user.idCliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.clientesService.getAllClientes(+idUser, +idCliente, +rol, page, limit);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener un cliente específico',
    description: 'Obtiene la información detallada de un cliente por su ID',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: 'ID del cliente',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Cliente obtenido exitosamente',
  })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  async getOneCliente(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return this.clientesService.getOneCliente(id, req.user);
  }

  // ==================== PATCH ====================

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Cambiar estatus de un cliente',
    description:
      'Alterna el estatus del cliente padre y sus hijos: 1 ↔ 0. No requiere body.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: 'ID del cliente',
    example: 1,
  })
  @ApiResponse({
    status: 200,
    description: 'Estatus actualizado exitosamente',
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  async updateEstatusClientes(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.clientesService.updateClienteStatus(id, idUser, req.user);
  }

  @Patch(':id')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    clientesFileFieldsInterceptor(),
    ClientesMultipartDocumentsPlaceholderInterceptor,
  )
  @ApiOperation({
    summary: 'Actualizar datos de un cliente',
    description:
      'Actualización con `multipart/form-data`. Si adjunta un archivo nuevo, se sube a S3 y se elimina el anterior en segundo plano (`updateFile`).',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: 'ID del cliente',
    example: 1,
  })
  @ApiBody(clientesUpdateMultipartApiBody)
  @ApiResponse({
    status: 200,
    description: 'Cliente actualizado exitosamente',
  })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Cliente no encontrado' })
  async updateCliente(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
    @Body() updateClienteDto: UpdateClienteDto,
    @UploadedFiles()
    files: {
      actaConstitutiva?: Express.Multer.File[];
      comprobanteDomicilio?: Express.Multer.File[];
      constanciaSituacionFiscal?: Express.Multer.File[];
      logotipo?: Express.Multer.File[];
    },
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.clientesService.updateCliente(
      id,
      idUser,
      req.user,
      updateClienteDto,
      files?.actaConstitutiva?.[0],
      files?.comprobanteDomicilio?.[0],
      files?.constanciaSituacionFiscal?.[0],
      files?.logotipo?.[0],
    );
  }

}
