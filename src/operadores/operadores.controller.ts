import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Request,
  ParseIntPipe,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { OperadoresService } from './operadores.service';
import { CreateOperadoresDto } from './dto/create-operadores.dto';
import { UpdateOperadoresDto } from './dto/update-operadores.dto';
import { CreateLicenciaDto } from './dto/create-licencia.dto';
import { UpdateLicenciaDto } from './dto/update-licencia.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { operadoresFileFieldsInterceptor } from './operadores-upload.interceptor';
import { OperadoresMultipartDocumentsPlaceholderInterceptor } from './operadores-multipart-placeholder.interceptor';
import { licenciaFileFieldsInterceptor } from './licencia-upload.interceptor';
import { LicenciaMultipartPlaceholderInterceptor } from './licencia-multipart-placeholder.interceptor';
import {
  operadoresCreateMultipartApiBody,
  operadoresUpdateMultipartApiBody,
} from './operadores-swagger-multipart';
import {
  licenciaCreateMultipartApiBody,
  licenciaUpdateMultipartApiBody,
} from './licencia-swagger-multipart';

@ApiTags('Operadores')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('operadores')
export class OperadoresController {
  constructor(private readonly operadoresService: OperadoresService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    operadoresFileFieldsInterceptor(),
    OperadoresMultipartDocumentsPlaceholderInterceptor,
  )
  @ApiOperation({
    summary: 'Crear operador',
    description:
      'Crea operador con `multipart/form-data`. `IdCliente` del operador se toma del **usuario** (`idUsuario`). ' +
      '`identificacion` y `licencia` son obligatorias (URL o PNG/JPEG/PDF). ' +
      'Foto, comprobante, certificado médico y antecedentes son opcionales. Incluye alta de la primera licencia.',
  })
  @ApiBody(operadoresCreateMultipartApiBody)
  @ApiResponse({ status: 201, description: 'Operador creado correctamente' })
  @ApiResponse({ status: 400, description: 'Datos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async create(
    @Body() dto: CreateOperadoresDto,
    @UploadedFiles()
    files: {
      identificacion?: Express.Multer.File[];
      foto?: Express.Multer.File[];
      comprobanteDomicilio?: Express.Multer.File[];
      certificadoMedico?: Express.Multer.File[];
      antecedentesNoPenales?: Express.Multer.File[];
      licencia?: Express.Multer.File[];
    },
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idCliente = req.user.idCliente;
    const idUser = req.user.userId;
    const rol = req.user.rol;
    return this.operadoresService.create(dto, idCliente, rol, idUser, {
      identificacion: files?.identificacion?.[0],
      foto: files?.foto?.[0],
      comprobanteDomicilio: files?.comprobanteDomicilio?.[0],
      certificadoMedico: files?.certificadoMedico?.[0],
      antecedentesNoPenales: files?.antecedentesNoPenales?.[0],
      licencia: files?.licencia?.[0],
    });
  }

  @Post(':idOperador/licencias')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    licenciaFileFieldsInterceptor(),
    LicenciaMultipartPlaceholderInterceptor,
  )
  @ApiOperation({
    summary: 'Crear licencia de un operador',
    description:
      'Alta de licencia adicional. Documento `licencia` obligatorio (URL o PNG/JPEG/PDF). ' +
      'Único por tipo de licencia por operador y por número global.',
  })
  @ApiBody(licenciaCreateMultipartApiBody)
  @ApiParam({ name: 'idOperador', description: 'ID del operador' })
  @ApiResponse({ status: 201, description: 'Licencia creada' })
  @ApiResponse({ status: 400, description: 'Datos inválidos / duplicado' })
  @ApiResponse({ status: 404, description: 'Operador no encontrado' })
  async createLicencia(
    @Param('idOperador', ParseIntPipe) idOperador: number,
    @Body() dto: CreateLicenciaDto,
    @UploadedFiles() files: { licencia?: Express.Multer.File[] },
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.operadoresService.createLicencia(
      idOperador,
      dto,
      Number(req.user.idCliente),
      Number(req.user.rol),
      Number(req.user.userId),
      files?.licencia?.[0],
    );
  }

  @Get('list')
  @ApiOperation({
    summary: 'Lista completa de operadores',
    description:
      'Solo activos (Estatus=1). Alcance según rol. Shape plano (sin `idUsuario2` anidado ni hashes).',
  })
  @ApiResponse({ status: 200, description: 'Lista obtenida correctamente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAllList(@Request() req): Promise<ApiResponseCommon> {
    const idCliente = req.user.idCliente;
    const rol = req.user.rol;
    return this.operadoresService.findAllList(idCliente, rol);
  }

  @Patch('licencias/estatus/:id')
  @ApiOperation({
    summary: 'Cambiar estatus de licencia',
    description: 'Alterna el estatus 1 ↔ 0. No requiere body.',
  })
  @ApiParam({ name: 'id', description: 'ID de la licencia' })
  @ApiResponse({ status: 200, description: 'Estatus actualizado' })
  @ApiResponse({ status: 404, description: 'Licencia no encontrada' })
  async updateLicenciaEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.operadoresService.updateLicenciaEstatus(
      id,
      Number(req.user.idCliente),
      Number(req.user.rol),
      Number(req.user.userId),
    );
  }

  @Patch('licencias/:id')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    licenciaFileFieldsInterceptor(),
    LicenciaMultipartPlaceholderInterceptor,
  )
  @ApiOperation({
    summary: 'Actualizar licencia',
    description:
      'Actualización parcial. Archivo `licencia` nuevo reemplaza en S3. ' +
      'Para estatus use `PATCH /operadores/licencias/estatus/:id`.',
  })
  @ApiBody(licenciaUpdateMultipartApiBody)
  @ApiParam({ name: 'id', description: 'ID de la licencia' })
  @ApiResponse({ status: 200, description: 'Licencia actualizada' })
  @ApiResponse({ status: 404, description: 'Licencia no encontrada' })
  async updateLicencia(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLicenciaDto,
    @UploadedFiles() files: { licencia?: Express.Multer.File[] },
    @Request() req,
  ): Promise<ApiCrudResponse> {
    return this.operadoresService.updateLicencia(
      id,
      dto,
      Number(req.user.idCliente),
      Number(req.user.rol),
      Number(req.user.userId),
      files?.licencia?.[0],
    );
  }

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Cambiar estatus del operador',
    description: 'Alterna el estatus 1 ↔ 0. No requiere body.',
  })
  @ApiParam({ name: 'id', description: 'ID del operador' })
  @ApiResponse({ status: 200, description: 'Estatus actualizado' })
  @ApiResponse({ status: 404, description: 'Operador no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idCliente = req.user.idCliente;
    const idUser = req.user.userId;
    return this.operadoresService.updateEstatus(id, idCliente, idUser);
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Lista paginada de operadores',
    description:
      'Activos e inactivos. Alcance según rol. Shape plano (sin JSON anidado de usuario ni hashes).',
  })
  @ApiParam({ name: 'page', description: 'Número de página' })
  @ApiParam({ name: 'limit', description: 'Registros por página' })
  @ApiResponse({ status: 200, description: 'Lista paginada obtenida' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    const idCliente = req.user.idCliente;
    const rol = req.user.rol;
    return this.operadoresService.findAll(idCliente, rol, page, limit);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener operador por ID',
    description:
      'Respuesta plana: operador + campos públicos del usuario (sin hashes/tokens) + `licencias[]` planas.',
  })
  @ApiParam({ name: 'id', description: 'ID del operador' })
  @ApiResponse({ status: 200, description: 'Operador encontrado' })
  @ApiResponse({ status: 404, description: 'Operador no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    return this.operadoresService.findOne(
      id,
      Number(req.user.idCliente),
      Number(req.user.rol),
    );
  }

  @Patch(':id')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    operadoresFileFieldsInterceptor(),
    OperadoresMultipartDocumentsPlaceholderInterceptor,
  )
  @ApiOperation({
    summary: 'Actualizar operador',
    description:
      'Actualización parcial con `multipart/form-data`. Archivos nuevos reemplazan en S3. ' +
      'Para estatus use `PATCH /operadores/estatus/:id`.',
  })
  @ApiBody(operadoresUpdateMultipartApiBody)
  @ApiParam({ name: 'id', description: 'ID del operador' })
  @ApiResponse({ status: 200, description: 'Operador actualizado' })
  @ApiResponse({ status: 404, description: 'Operador no encontrado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOperadoresDto,
    @UploadedFiles()
    files: {
      identificacion?: Express.Multer.File[];
      foto?: Express.Multer.File[];
      comprobanteDomicilio?: Express.Multer.File[];
      certificadoMedico?: Express.Multer.File[];
      antecedentesNoPenales?: Express.Multer.File[];
    },
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idCliente = req.user.idCliente;
    const idUser = req.user.userId;
    return this.operadoresService.update(id, dto, idCliente, idUser, {
      identificacion: files?.identificacion?.[0],
      foto: files?.foto?.[0],
      comprobanteDomicilio: files?.comprobanteDomicilio?.[0],
      certificadoMedico: files?.certificadoMedico?.[0],
      antecedentesNoPenales: files?.antecedentesNoPenales?.[0],
    });
  }
}
