import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
  Req,
  Put,
  ParseIntPipe,
  Request,
} from '@nestjs/common';
import { PermisosService } from './permisos.service';
import { CreatePermisoDto } from './dto/create-permiso.dto';
import { UpdatePermisoDto } from './dto/update-permiso.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

@ApiTags('Permisos')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(1, 2, 3) // Todos los roles pueden acceder por defecto
@Controller('permisos')
export class PermisosController {
  constructor(private readonly permisosService: PermisosService) {}

  @Post()
  @Roles(1) // Solo SuperAdministrador puede crear permisos
  async createPermioso(
    @Body() createPermiso: CreatePermisoDto,
    @Req() req,
  ): Promise<ApiCrudResponse> {
    const idUsuario = req.user.userId;
    return this.permisosService.createPermiso(createPermiso, idUsuario);
  }

  @Get(':page/:limit')
  async findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
  ): Promise<ApiResponseCommon> {
    return await this.permisosService.findAll(page, limit);
  }

  @Get('list')
  async findAllList(): Promise<ApiResponseCommon> {
    return await this.permisosService.findAllList();
  }

  @Get('permisosAgrupados')
  async findAllAgrupado(@Req() req): Promise<any> {
    const idUsuario = req.user.userId;
    const permiso = await this.permisosService.obtenerPermisosAgrupados(idUsuario);
    return permiso;
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return await this.permisosService.findOne(+id);
  }

  @Put(':id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updatePermisoDto: UpdatePermisoDto,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.permisosService.update(id, updatePermisoDto, idUser);
  }

  @Patch(':id/estatus')
  @ApiOperation({
    summary: 'Cambiar estatus del permiso',
    description:
      'Alterna el estatus: si está activo (1) pasa a inactivo (0) y viceversa. No requiere body.',
  })
  @ApiParam({ name: 'id', type: Number })
  async updatePermisoEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.permisosService.updateEstatus(id, idUser);
  }

}
