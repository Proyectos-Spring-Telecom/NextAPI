import {
  Controller,
  Post,
  Patch,
  Delete,
  UploadedFile,
  UseInterceptors,
  Body,
  BadRequestException,
  UseGuards,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import { S3Service } from './s3.service';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { RolesGuard } from 'src/guard/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UploadDto } from './dto/update-s3.dto';
import { UpdateFileDto } from './dto/update-file.dto';
import { DeleteFileDto } from './dto/delete-file.dto';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

@ApiTags('S3 - archivos')
@ApiBearerAuth('bearer-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles()
@Controller('s3')
export class S3Controller {
  constructor(private readonly s3Service: S3Service) {}

  @Post('upload')
  @ApiOperation({
    summary: 'Subir archivo nuevo al bucket S3',
    description:
      'Sube un archivo y devuelve la URL para persistirla en base de datos.\n\n' +
      '**Body:** `multipart/form-data`\n' +
      '- **file** (obligatorio): binario.\n' +
      '- **folder** y **idModule**: campos de texto del formulario.\n\n' +
      '**Autenticación obligatoria:** `Authorization: Bearer <accessToken>`. ' +
      'El usuario registrado en bitácora es el del token (userId del JWT), no se envía por body.\n\n' +
      '**Roles:** ',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Formulario multipart: archivo + metadatos de carpeta y módulo.',
    schema: {
      type: 'object',
      required: ['file', 'folder', 'idModule'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description:
            'Archivo a subir. Tipos: PNG, JPEG, PDF. Tamaño máximo según UPLOAD_MAX_SIZE (típicamente 10 MB).',
        },
        folder: {
          type: 'string',
          enum: [
            'clientes',
            'operadores',
            'usuarios',
            'vehiculos',
            'pasajeros',
          ],
          description:
            'Carpeta lógica dentro del bucket (prefijo de la key). Valores permitidos: clientes, operadores, usuarios, vehiculos, pasajeros.',
          example: 'clientes',
        },
        idModule: {
          type: 'string',
          description:
            'ID numérico del módulo para bitácora. Ejemplos: 1 Clientes, 2 Usuarios, 9 Operadores, 10 Vehículos. Enviar como string en form-data.',
          example: '1',
        },
      },
    },
  })
  @ApiOkResponse({
    description:
      'Objeto subido correctamente. Guarda `url` en tu entidad (VARCHAR ~500).',
    schema: {
      type: 'object',
      required: ['url'],
      properties: {
        url: {
          type: 'string',
          example:
            'https://mi-bucket.s3.us-east-1.amazonaws.com/clientes/uuid.png',
          description: 'URL pública del objeto (bucket virtual-hosted-style).',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'Archivo faltante, tipo no permitido, tamaño excedido o validación de folder/idModule.',
  })
  @ApiUnauthorizedResponse({
    description: 'Token ausente, inválido o expirado.',
  })
  @ApiForbiddenResponse({
    description:
      'El rol del usuario no está autorizado (se requiere rol 1, 2 o 3).',
  })
  @ApiInternalServerErrorResponse({
    description: 'Error al comunicarse con S3 o error interno no controlado.',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/png', 'image/jpeg', 'application/pdf'];
        if (!allowedTypes.includes(file.mimetype)) {
          return cb(
            new Error('Solo se permiten PNG, JPG, JPEG o PDF'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadDto,
    @Request() req,
  ) {
    const { folder, idModule } = body;
    const idUser = req.user.userId;

    if (!file) throw new BadRequestException('Archivo requerido');

    return this.s3Service.uploadFile(file, folder, idUser, Number(idModule));
  }

  @Patch('update')
  @ApiOperation({
    summary:
      'Actualizar archivo (sube uno nuevo y opcionalmente borra el anterior)',
    description:
      '1. Sube el archivo nuevo (misma validación que POST /upload).\n' +
      '2. Si envías **oldUrl**, intenta eliminar el objeto anterior en S3 en segundo plano. ' +
      'Si el borrado falla, igual recibes la nueva `url`; revisa bitácora.\n\n' +
      'Sin **oldUrl**, equivale a una subida adicional sin borrar nada.\n\n' +
      '**Autenticación obligatoria:** `Authorization: Bearer <accessToken>`. ' +
      'El usuario en bitácora es el del token.\n\n' +
      '**Roles:** ',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description:
      'Multipart: campo archivo `file` + texto `folder`, `idModule` y opcionalmente `oldUrl`.',
    schema: {
      type: 'object',
      required: ['file', 'folder', 'idModule'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description:
            'Archivo nuevo. Tipos: PNG, JPEG, PDF. Máximo según UPLOAD_MAX_SIZE.',
        },
        oldUrl: {
          type: 'string',
          description:
            'URL del archivo a sustituir (opcional). Debe ser la URL guardada previamente en BD.',
          example:
            'https://mi-bucket.s3.us-east-1.amazonaws.com/vehiculos/abc.png',
        },
        folder: {
          type: 'string',
          enum: [
            'clientes',
            'operadores',
            'usuarios',
            'vehiculos',
            'pasajeros',
          ],
          description:
            'Carpeta lógica en el bucket. Debe coincidir con la convención del recurso.',
          example: 'vehiculos',
        },
        idModule: {
          type: 'string',
          description:
            'ID del módulo para bitácora. Ejemplos: 1 Clientes, 10 Vehículos. String en form-data.',
          example: '10',
        },
      },
    },
  })
  @ApiOkResponse({
    description:
      'Objeto subido correctamente. Guarda `url` en tu entidad (VARCHAR ~500).',
    schema: {
      type: 'object',
      required: ['url'],
      properties: {
        url: {
          type: 'string',
          example:
            'https://mi-bucket.s3.us-east-1.amazonaws.com/vehiculos/uuid.png',
          description: 'URL pública del nuevo objeto.',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description:
      'Sin archivo, tipo/tamaño inválido o error de validación en folder/idModule.',
  })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido.' })
  @ApiForbiddenResponse({ description: 'Rol no autorizado.' })
  @ApiInternalServerErrorResponse({
    description:
      'Error al subir a S3 (el borrado del viejo no cambia este código).',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/png', 'image/jpeg', 'application/pdf'];
        if (!allowedTypes.includes(file.mimetype)) {
          return cb(
            new Error('Solo se permiten PNG, JPG, JPEG o PDF'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async updateFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UpdateFileDto,
    @Request() req,
  ) {
    if (!file) throw new BadRequestException('Archivo requerido');
    const idUser = req.user.userId;
    return this.s3Service.updateFile(
      body.oldUrl,
      file,
      body.folder,
      idUser,
      Number(body.idModule),
    );
  }

  @Delete('delete')
  @ApiOperation({
    summary: 'Eliminar un archivo del bucket por su URL',
    description:
      'Elimina el objeto en S3 usando la URL completa almacenada en BD. ' +
      'El servicio extrae la key del path (formato: `https://{bucket}.s3.{region}.amazonaws.com/{key}`).\n\n' +
      '**Body JSON:** `fileUrl` + `idModule` (para bitácora).\n\n' +
      '**Autenticación obligatoria:** Bearer JWT; el usuario en bitácora es el del token.\n\n' +
      '**Nota:** algunos clientes no envían body en DELETE; usa Postman o fetch con body.\n\n' +
      '**Roles:** ',
  })
  @ApiBody({
    type: DeleteFileDto,
    description:
      'JSON con la URL del objeto y el id de módulo para registrar la acción en bitácora.',
  })
  @ApiOkResponse({
    description:
      'Si `deleted` es false, no se ejecutó DeleteObject (URL vacía o key no extraíble).',
    schema: {
      type: 'object',
      properties: {
        deleted: {
          type: 'boolean',
          example: true,
          description: 'true si se envió DeleteObject a S3 con éxito.',
        },
        key: {
          type: 'string',
          example:
            'vehiculos/a1b2c3d4-e5f6-7890-abcd-ef1234567890.png',
          description: 'Key del objeto eliminado (solo si deleted=true).',
        },
      },
    },
  })
  @ApiBadRequestResponse({
    description: 'Validación fallida (campos requeridos o formato).',
  })
  @ApiUnauthorizedResponse({ description: 'Token ausente o inválido.' })
  @ApiForbiddenResponse({ description: 'Rol no autorizado.' })
  @ApiInternalServerErrorResponse({
    description: 'Error al eliminar en S3 o error interno.',
  })
  async deleteFile(
    @Body() body: DeleteFileDto,
    @Request() req: { user: { userId: number } },
  ) {
    const idUser = req.user.userId;
    return this.s3Service.deleteFile(
      body.fileUrl,
      idUser,
      Number(body.idModule),
    );
  }
}
