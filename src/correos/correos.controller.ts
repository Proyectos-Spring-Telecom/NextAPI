import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import * as multer from 'multer';
import { Roles } from 'src/common/decorators/roles.decorator';
import { EnumRoles } from 'src/common/estatus.enum';
import { UsuarioAlcance } from 'src/common/tenant-filter/tenant-filter.service';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { CorreosService } from './correos.service';
import { AvisoMasivoDto, EnviarCorreoLibreDto } from './dto/correos.dto';

// 11 MB: el servicio responde 400 "más de 10 MB" en lugar del 413 de multer.
const ARCHIVO = FileInterceptor('archivo', { storage: multer.memoryStorage(), limits: { fileSize: 11 * 1024 * 1024 } });
const TIPOS = 'PDF, JPG, PNG, WEBP, Word (.doc, .docx), Excel (.xls, .xlsx) o CSV, máx. 10 MB';

function alcanceDe(req: { user: { userId: unknown; idCliente: unknown; rol: unknown } }): UsuarioAlcance {
  return { userId: Number(req.user.userId), idCliente: Number(req.user.idCliente), rol: Number(req.user.rol) };
}

@ApiTags('Correos')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('correos')
export class CorreosController {
  constructor(private readonly service: CorreosService) {}

  @Post('enviar')
  @Roles(EnumRoles.SA, EnumRoles.DEV, EnumRoles.ADMIN, EnumRoles.JEFE_MONITOREO, EnumRoles.MONITOREO)
  @UseInterceptors(ARCHIVO)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['correos', 'origen'],
      properties: {
        correos: { type: 'string', example: 'ana@cliente.com,luis@cliente.com' },
        asunto: { type: 'string', maxLength: 200 },
        mensaje: { type: 'string', maxLength: 4000 },
        archivo: { type: 'string', format: 'binary', description: TIPOS },
        origen: { type: 'string', example: 'informe-sucesos' },
        idReferencia: { type: 'integer' },
      },
    },
  })
  @ApiOperation({
    summary: 'Correo libre (Informe De Sucesos)',
    description:
      'Roles 1–5. De 1 a 5 correos; con más de uno van en CCO. Adjunto opcional (' + TIPOS + '). ' +
      'Asunto vacío: "Aviso de Spring Telecom". Queda en bitácora (sin el archivo). Docs: `docs/front-next.md` §35.',
  })
  @ApiBadRequestResponse({ description: 'Correos inválidos o más de 5, archivo de más de 10 MB o de tipo no permitido' })
  @ApiForbiddenResponse({ description: 'Rol distinto de 1 a 5' })
  async enviar(@UploadedFile() archivo: Express.Multer.File | undefined, @Body() dto: EnviarCorreoLibreDto, @Request() req) {
    return this.service.enviarLibre(archivo, dto, Number(req.user.userId));
  }

  @Post('aviso-masivo')
  @Roles(EnumRoles.SA, EnumRoles.DEV, EnumRoles.ADMIN, EnumRoles.JEFE_MONITOREO)
  @UseInterceptors(ARCHIVO)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['idUsuarios'],
      properties: {
        idUsuarios: { type: 'string', example: '12,45,78,101' },
        asunto: { type: 'string', maxLength: 200 },
        mensaje: { type: 'string', maxLength: 4000 },
        archivo: { type: 'string', format: 'binary', description: TIPOS },
      },
    },
  })
  @ApiOperation({
    summary: 'Aviso masivo por correo a usuarios de la lista',
    description: [
      'Roles 1–4. Responde enseguida; el envío sigue en segundo plano por lotes en CCO.',
      'Solo usuarios activos visibles para quien envía (mismo filtro que `GET /usuarios/list`), con correo válido en `UserName`; los demás cuentan en `omitidos`.',
      'Límites (variables `AVISO_MASIVO_*`): máximo 300 usuarios por aviso, lotes de 50 cada 60 s, 2 avisos por usuario por hora (429).',
      'Avance: `GET /correos/aviso-masivo/:idEnvio`. Docs: `docs/front-next.md` §35.',
    ].join('\n'),
  })
  @ApiBadRequestResponse({ description: 'Sin usuarios, más del máximo, ninguno con correo o archivo inválido' })
  @ApiForbiddenResponse({ description: 'Rol distinto de 1 a 4' })
  async avisoMasivo(@UploadedFile() archivo: Express.Multer.File | undefined, @Body() dto: AvisoMasivoDto, @Request() req) {
    return this.service.avisoMasivo(archivo, dto, alcanceDe(req));
  }

  @Get('aviso-masivo/:idEnvio')
  @Roles(EnumRoles.SA, EnumRoles.DEV, EnumRoles.ADMIN, EnumRoles.JEFE_MONITOREO)
  @ApiOperation({
    summary: 'Avance de un aviso masivo',
    description: 'Total, enviados, fallidos, pendientes y el detalle de los fallidos. Lo ve quien lo mandó o los roles 1–3.',
  })
  async estado(@Param('idEnvio', ParseIntPipe) idEnvio: number, @Request() req) {
    return this.service.estadoAviso(idEnvio, alcanceDe(req));
  }
}
