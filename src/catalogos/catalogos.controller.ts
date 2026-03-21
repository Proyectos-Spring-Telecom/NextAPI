import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CatalogosService } from './catalogos.service';

@ApiTags('Catálogos')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('catalogos')
export class CatalogosController {
  constructor(private readonly catalogosService: CatalogosService) {}

  @Get(':nombreCatalogo')
  @ApiOperation({ summary: 'Obtener catálogo por nombre' })
  @ApiParam({
    name: 'nombreCatalogo',
    description: 'Nombre del catálogo',
    example: 'cat-tipo-combustible',
  })
  findCatalogo(@Param('nombreCatalogo') nombreCatalogo: string) {
    return this.catalogosService.findCatalogo(nombreCatalogo);
  }
}
