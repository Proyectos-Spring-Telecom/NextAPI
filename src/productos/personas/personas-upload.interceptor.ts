import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Observable } from 'rxjs';
import * as multer from 'multer';

/** Carpeta propia de Personas en el bucket S3. */
export const PERSONAS_S3_FOLDER = 'personas';

export type PersonasUploadFiles = Partial<Record<'foto', Express.Multer.File[]>>;
/** Mismo archivo `foto` para Activos e Inmuebles. */
export type ProductoFotoUploadFiles = PersonasUploadFiles;
export const ACTIVOS_S3_FOLDER = 'activos';
export const INMUEBLES_S3_FOLDER = 'inmuebles';

const uploadMax = Number(process.env.UPLOAD_MAX_SIZE) || 10 * 1024 * 1024;
const imageMimeTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

/** Mismo esquema que Vehículos: archivo multipart `foto` (opcional). */
export function personasFotoInterceptor() {
  return FileFieldsInterceptor([{ name: 'foto', maxCount: 1 }], {
    storage: multer.memoryStorage(),
    limits: { fileSize: uploadMax },
    fileFilter: (_req, file, callback) => {
      if (!imageMimeTypes.includes(file.mimetype)) {
        return callback(
          new BadRequestException('foto: formato no permitido. Use PNG, JPEG o WEBP.'),
          false,
        );
      }
      callback(null, true);
    },
  });
}

/**
 * Swagger envía el campo de archivo vacío (`foto=`) como string en el body;
 * se quita para que ValidationPipe no lo rechace.
 */
@Injectable()
export class StripEmptyPersonaFotoInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const body = context.switchToHttp().getRequest().body;
    if (body && typeof body === 'object') delete body.foto;
    return next.handle();
  }
}

const personaProperties = {
  nombre: { type: 'string', maxLength: 250, example: 'Juan Pérez' },
  telefono: { type: 'string', maxLength: 20, example: '5512345678' },
  foto: {
    type: 'string',
    format: 'binary',
    description: 'Foto de la persona PNG/JPEG/WEBP (se guarda en S3, carpeta `personas`).',
  },
};

export const personasCreateMultipartApiBody = {
  description:
    'Crea el producto (tipo PERSONA) y la persona. `foto` es opcional y se sube al bucket S3 ' +
    '(carpeta `personas`).',
  schema: {
    type: 'object',
    required: ['idCliente', 'nombre'],
    properties: {
      idCliente: { type: 'integer', example: 11, description: 'ID del cliente/tenant. Obligatorio.' },
      ...personaProperties,
    },
  },
} as const;

export const personasUpdateMultipartApiBody = {
  description:
    'Actualización parcial. Una `foto` nueva reemplaza la anterior en S3; si no se envía, se conserva.',
  schema: { type: 'object', properties: personaProperties },
} as const;
