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
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiBody,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiNotFoundResponse,
} from '@nestjs/swagger';
import { SimsService } from './sims.service';
import { CreateSimsDto } from './dto/create-sims.dto';
import { UpdateSimsDto } from './dto/update-sims.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { EstatusEnum } from 'src/common/estatus.enum';

const SIM_ITEM_EXAMPLE = {
  id: 5,
  imei: '356938035643809',
  numeroTelefono: '5512345678',
  idTelefonia: 1,
  idPlanTelefonia: 3,
  idCliente: 11,
  fechaActivacion: '2026-01-15',
  fechaVencimiento: '2027-01-15',
  notas: 'SIM asignada a unidad 45',
  fechaCreacion: '2026-01-15T18:30:00.000Z',
  fechaActualizacion: '2026-01-15T18:30:00.000Z',
  estatus: EstatusEnum.ACTIVO,
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
      'Registra un nuevo SIM para el cliente autenticado. ' +
      'Valida que `idTelefonia` (CatTelefonia) e `idPlanTelefonia` (CatPlanesTelefonia) existan. ' +
      'El `idCliente` se toma del token, no del body.',
  })
  @ApiBody({ type: CreateSimsDto })
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
    description: 'Datos inválidos o FK inexistente (IdTelefonia / IdPlanTelefonia)',
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async create(
    @Body() dto: CreateSimsDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idCliente = req.user.idCliente;
    const idUser = req.user.userId;
    return this.simsService.create(dto, idCliente, idUser);
  }

  @Get('list')
  @ApiOperation({
    summary: 'Lista completa de SIMs',
    description:
      'Devuelve únicamente los SIMs activos (`Estatus = 1`). ' +
      'El alcance de los registros depende del rol y del cliente del token.',
  })
  @ApiOkResponse({
    description: 'Lista obtenida correctamente',
    schema: {
      example: { data: [SIM_ITEM_EXAMPLE] },
    },
  })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async findAllList(@Request() req): Promise<ApiResponseCommon> {
    const idCliente = req.user.idCliente;
    const rol = req.user.rol;
    return this.simsService.findAllList(idCliente, rol);
  }

  @Get(':page/:limit')
  @ApiOperation({
    summary: 'Lista paginada de SIMs',
    description:
      'Devuelve SIMs activos e inactivos de forma paginada. ' +
      'El alcance de los registros depende del rol y del cliente del token.',
  })
  @ApiParam({ name: 'page', description: 'Número de página (base 1)', example: 1 })
  @ApiParam({ name: 'limit', description: 'Registros por página', example: 10 })
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
    description: 'Recupera un SIM del cliente autenticado por su identificador.',
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

  @Patch(':id')
  @ApiOperation({
    summary: 'Actualizar SIM',
    description:
      'Actualiza parcialmente un SIM del cliente autenticado. ' +
      'Solo se modifican los campos enviados en el body. ' +
      'Si se envían `idTelefonia` o `idPlanTelefonia`, se valida que existan.',
  })
  @ApiParam({ name: 'id', description: 'ID del SIM', example: 5 })
  @ApiBody({ type: UpdateSimsDto })
  @ApiOkResponse({
    description: 'SIM actualizado',
    schema: {
      example: {
        status: 'success',
        message: 'SIM actualizado correctamente',
        data: { id: 5, nombre: '5512345678' },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Datos inválidos o FK inexistente (IdTelefonia / IdPlanTelefonia)',
  })
  @ApiNotFoundResponse({ description: 'SIM no encontrado' })
  @ApiUnauthorizedResponse({ description: 'No autorizado' })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSimsDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idCliente = req.user.idCliente;
    const idUser = req.user.userId;
    return this.simsService.update(id, dto, idCliente, idUser);
  }

  @Patch('estatus/:id')
  @ApiOperation({
    summary: 'Cambiar estatus del SIM',
    description:
      'Alterna el estatus del SIM: si está activo (1) pasa a inactivo (0) y viceversa. ' +
      'No requiere body; el backend calcula el nuevo valor a partir del actual.',
  })
  @ApiParam({ name: 'id', description: 'ID del SIM', example: 5 })
  @ApiOkResponse({
    description: 'Estatus actualizado',
    schema: {
      example: {
        status: 'success',
        message: 'Estatus actualizado correctamente',
        estatus: { estatus: EstatusEnum.INACTIVO },
        data: { id: 5, nombre: '5512345678' },
      },
    },
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
}
