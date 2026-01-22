import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  ParseIntPipe,
  Request,
  Put,
  UseGuards,
  Res,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRolDto } from './dto/create-rol.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { ApiCrudResponse, ApiResponseCommon } from 'src/common/ApiResponse';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UpdateRolEstatusDto } from './dto/update-rol.dto';
import type { Response } from 'express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Roles')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(1, 2, 3) // Todos los roles pueden acceder por defecto
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @Roles(1) // Solo SuperAdministrador puede crear roles
  create(@Body() createRoleDto: CreateRolDto, @Request() req) {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.rolesService.create(idUser, createRoleDto);
  }

  @Get(':page/:limit')
  async findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Request() req
  ): Promise<ApiResponseCommon> {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return await this.rolesService.findAll(+rol, page, limit);
  }

  @Get('list')
  async findAllList(@Request() req): Promise<ApiResponseCommon> {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return await this.rolesService.findAllList(+rol);
  }


  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.rolesService.findOne(id);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateRoleDto: UpdateRoleDto,
    @Request() req,
  ) {
    const idUser = req.user.userId;
    return this.rolesService.update(id, idUser, updateRoleDto);
  }

  @Patch('estatus/:id')
  async updateEstatus(
    @Param('id', ParseIntPipe) id: number,
    @Request() req,
    @Body() updateRolEstatusDto: UpdateRolEstatusDto,
  ): Promise<ApiCrudResponse> {
    const idUser = req.user.userId;
    return await this.rolesService.updateEstatus(
      id,
      idUser,
      updateRolEstatusDto,
    );
  }

  @Delete(':id')
  @Roles(1) // Solo SuperAdministrador puede eliminar roles
  remove(@Param('id') id: string, @Request() req) {
    const idUser = req.user.userId;
    return this.rolesService.remove(+id, idUser);
  }
}
