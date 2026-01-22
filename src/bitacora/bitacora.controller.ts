import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Param,
  ParseIntPipe,
  Request,
} from '@nestjs/common';
import { BitacoraLoggerService } from './bitacora.service';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { ApiResponseCommon } from 'src/common/ApiResponse';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Bitácora')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(1, 2, 3) // Todos los roles pueden acceder a la bitácora
@Controller('bitacora')
export class BitacoraController {
  constructor(private readonly bitacoraService: BitacoraLoggerService) {}

  @Get('list') //Obseleto
  async findAllListBitacora(@Request() req): Promise<ApiResponseCommon> {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return await this.bitacoraService.findAllListBitacora(+cliente, +rol);
  }

  @Get(':page/:limit')
  findAll(
    @Param('page', ParseIntPipe) page: number,
    @Param('limit', ParseIntPipe) limit: number,
    @Request() req,
  ): Promise<ApiResponseCommon> {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return this.bitacoraService.findAll(+cliente, +rol, page, limit);
  }

  @Get(':id')
  async findOne(@Param('id', ParseIntPipe) id: number, @Request() req) {
    const idUser = req.user.userId;
    const cliente = req.user.cliente;
    const rol = req.user.rol;
    return await this.bitacoraService.findOne(id);
  }
}
