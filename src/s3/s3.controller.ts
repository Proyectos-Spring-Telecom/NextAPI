import {
  Controller,
  Post,
  Patch,
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

}
