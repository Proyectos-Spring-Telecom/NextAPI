import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Request,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
  ApiConflictResponse,
} from '@nestjs/swagger';
import { SimsService } from './sims.service';
import { CreateSimsDto } from './dto/create-sims.dto';
import { UpdateSimsDto } from './dto/update-sims.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { EnumEstatusRecurso } from 'src/common/estatus.enum';

const SIM_ITEM_EXAMPLE = {
  id: 5,
  imei: '356938035643809',
  numeroTelefono: '5512345678',
  idTelefonia: 1,
  idPlanTelefonia: 3,
  idCliente: 11,
  notas: 'SIM asignada a unidad 45',
  fechaCreacion: '2026-01-15T18:30:00.000Z',
  fechaActualizacion: '2026-01-15T18:30:00.000Z',
  estatus: EnumEstatusRecurso.DISPONIBLE,
};

const CREATE_BODY_EXAMPLE: CreateSimsDto = {
  imei: '356938035643809',
  numeroTelefono: '5512345678',
  idCliente: 11,
  idTelefonia: 1,
  idPlanTelefonia: 3,
  notas: 'SIM asignada a unidad 45',
};

const UPDATE_BODY_EXAMPLE: UpdateSimsDto = {
  imei: '356938035643809',
  numeroTelefono: '5598765432',
  idCliente: 11,
  idTelefonia: 1,
  idPlanTelefonia: 4,
  notas: 'Cambio de plan',
};

@ApiTags('Sims')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('sims')
export class SimsController {
  constructor(private readonly simsService: SimsService) {}

  @Post()
  @ApiOperation({
    summary: 'Crear SIM',
    description:
      'Registra un nuevo SIM.\n\n' +
      '- Obligatorios: `idCliente`, `idTelefonia`, `idPlanTelefonia`.\n' +
      '- Opcionales: `imei`, `numeroTelefono`, `notas`.\n' +
      '- `estatus` se asigna automáticamente como `EnumEstatusRecurso.DISPONIBLE`.\n' +
      '- `IMEI` es único (`UQ_Sims_IMEI`).\n' +
      '- Valida que existan `idCliente`, `idTelefonia` e `idPlanTelefonia`.',
  })
  @ApiBody({
    type: CreateSimsDto,
    examples: {
      ejemplo: {
        summary: 'Alta de SIM',
        value: CREATE_BODY_EXAMPLE,
      },
    },
  })
  @ApiCreatedResponse({
    description: 'SIM creado correctamente',
    schema: {
      example: {
        status: 'success',
        message: 'SIM creado correctamente',
        data: { id: 5, nombre: '5512345678' },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'Datos inválidos o FK inexistente (`IdCliente` / `IdTelefonia` / `IdPlanTelefonia`)',
  })
  @ApiConflictResponse({ description: 'El IMEI ya está registrado' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async create(
    @Body() dto: CreateSimsDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return this.simsService.create(dto, idUser);
  }

  @Get('list')
  @ApiOperation({
    summary: 'Lista completa de SIMs',
    description:
      'Devuelve únicamente los SIMs disponibles (`estatus = EnumEstatusRecurso.DISPONIBLE`). ' +
      'Opcionalmente filtra por `idCliente`. Si se omite, aplica el alcance del rol del token.',
  })
  @ApiQuery({
    name: 'idCliente',
    required: false,
    type: Number,
    description:
      'Filtrar por cliente. Si se omite, aplica el alcance del rol del token.',
  })
  @ApiOkResponse({
    description: 'Lista obtenida correctamente',
    schema: {
      example: { data: [SIM_ITEM_EXAMPLE] },
    },
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async findAllList(
    @Request() req,
    @Query('idCliente') idCliente?: string,
  ): Promise<ApiResponseCommon> {
    const clienteFiltro = idCliente ? Number(idCliente) : undefined;
    return this.simsService.findAllList(
      req.user.idCliente,
      req.user.rol,
      Number.isFinite(clienteFiltro) ? clienteFiltro : undefined,
    );
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Lista paginada de SIMs',
    description:
      'Devuelve SIMs activos e inactivos de forma paginada. ' +
      'El alcance depende del rol y del cliente del token.',
  })
  @ApiParam({
    name: 'page',
    description: 'Número de página (base 1)',
    example: 1,
  })
  @ApiParam({
    name: 'limit',
    description: 'Registros por página',
    example: 10,
  })
  @ApiOkResponse({
    description: 'Lista paginada obtenida',
    schema: {
      example: {
        data: [SIM_ITEM_EXAMPLE],
        paginated: { total: 1, page: 1, limit: 10, totalPages: 1 },
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    const idCliente = req.user.idCliente;
    const rol = req.user.rol;
    return this.simsService.findAll(idCliente, rol, page, limit);
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Obtener SIM por ID',
    description:
      'Recupera un SIM del cliente autenticado por su identificador. ' +
      'Campos de respuesta: `id`, `imei`, `numeroTelefono`, `idTelefonia`, ' +
      '`idPlanTelefonia`, `idCliente`, `notas`, `fechaCreacion`, ' +
      '`fechaActualizacion`, `estatus`.',
  })
  @ApiParam({ name: 'id', description: 'ID del SIM', example: 5 })
  @ApiOkResponse({
    description: 'SIM encontrado',
    schema: {
      example: { data: SIM_ITEM_EXAMPLE },
    },
  })
  @ApiNotFoundResponse({ description: 'SIM no encontrado' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ) {
    const idCliente = req.user.idCliente;
    return this.simsService.findOne(id, idCliente);
  }

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Cambiar estatus',
    description:
      'Alterna el estatus 1 ↔ 0. No requiere body. ' +
      'Si el estatus actual es 2 (asignado a una instalación), la operación se rechaza.',
  })
  @ApiParam({ name: 'id', description: 'ID del SIM', example: 5 })
  @ApiOkResponse({
    description: 'Estatus actualizado',
    schema: {
      example: {
        status: 'success',
        message: 'Estatus actualizado correctamente',
        estatus: { estatus: EnumEstatusRecurso.BAJA },
        data: { id: 5, nombre: '5512345678' },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'SIM asignado a una instalación',
  })
  @ApiNotFoundResponse({ description: 'SIM no encontrado' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idCliente = req.user.idCliente;
    const idUser = req.user.userId;
    return this.simsService.updateEstatus(id, idCliente, idUser);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar SIM',
    description:
      'Actualización parcial de un SIM (`application/json`, propiedades en **camelCase**).\n\n' +
      '**Campos opcionales** (omitir = conservar valor actual):\n' +
      '- `imei` — string, máx. 25; único en BD (`UQ_Sims_IMEI`).\n' +
      '- `numeroTelefono` — string, máx. 20.\n' +
      '- `idCliente` — reasigna el tenant propietario (debe existir en `Clientes`).\n' +
      '- `idTelefonia` — FK a `CatTelefonia`.\n' +
      '- `idPlanTelefonia` — FK a `CatPlanesTelefonia`.\n' +
      '- `notas` — string, máx. 500.\n\n' +
      '**No incluido:** `estatus`. Para cambiarlo usa `PATCH /api/sims/estatus/{id}` ' +
      '(toggle `DISPONIBLE` ↔ `BAJA`, sin body).\n\n' +
      '**Validaciones:** FKs enviadas deben existir; si cambia `imei`, no puede estar duplicado.',
  })
  @ApiParam({
    name: 'id',
    description: 'ID del SIM a actualizar',
    example: 5,
  })
  @ApiBody({
    type: UpdateSimsDto,
    description:
      'Body parcial en camelCase. Solo se actualizan los campos enviados.',
    examples: {
      cambioPlan: {
        summary: 'Cambiar plan y teléfono',
        value: {
          numeroTelefono: '5598765432',
          idPlanTelefonia: 4,
          notas: 'Cambio de plan',
        },
      },
      cambioImei: {
        summary: 'Actualizar IMEI',
        value: {
          imei: '356938035643809',
        },
      },
      cambioCliente: {
        summary: 'Reasignar cliente',
        value: {
          idCliente: 12,
        },
      },
      cambioTelefoniaPlan: {
        summary: 'Cambiar compañía y plan',
        value: {
          idTelefonia: 2,
          idPlanTelefonia: 5,
        },
      },
      cambioCompleto: {
        summary: 'Actualización de varios campos',
        value: UPDATE_BODY_EXAMPLE,
      },
    },
  })
  @ApiOkResponse({
    description: 'SIM actualizado correctamente',
    schema: {
      example: {
        status: 'success',
        message: 'SIM actualizado correctamente',
        data: { id: 5, nombre: '5598765432' },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'Datos inválidos o FK inexistente (`idCliente` / `idTelefonia` / `idPlanTelefonia`)',
  })
  @ApiConflictResponse({
    description: 'El IMEI ya está registrado (`UQ_Sims_IMEI`)',
  })
  @ApiNotFoundResponse({ description: 'SIM no encontrado' })
  @ApiUnauthorizedResponse({ description: 'No autorizado (JWT Bearer)' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSimsDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idCliente = req.user.idCliente;
    const idUser = req.user.userId;
    return this.simsService.update(id, dto, idCliente, idUser);
  }
}
