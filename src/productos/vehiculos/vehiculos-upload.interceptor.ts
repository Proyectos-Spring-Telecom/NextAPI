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

export const VEHICULO_IMAGE_FIELDS = [
  'foto',
  'fotoFrente',
  'fotoTrasera',
  'fotoDerecha',
  'fotoIzquierda',
  'fotoExtra',
] as const;

export const VEHICULO_DOCUMENT_FIELDS = [
  'tarjetaCirculacion',
  'polizaSeguro',
  'permisoCarga',
] as const;

export type VehiculoFileField =
  | (typeof VEHICULO_IMAGE_FIELDS)[number]
  | (typeof VEHICULO_DOCUMENT_FIELDS)[number];

export type VehiculosUploadFiles = Partial<
  Record<VehiculoFileField, Express.Multer.File[]>
>;

const uploadMax = Number(process.env.UPLOAD_MAX_SIZE) || 10 * 1024 * 1024;
const imageMimeTypes = ['image/png', 'image/jpeg', 'image/jpg'];
const documentMimeTypes = [...imageMimeTypes, 'application/pdf'];

export function vehiculosFileFieldsInterceptor() {
  const fields = [
    ...VEHICULO_IMAGE_FIELDS,
    ...VEHICULO_DOCUMENT_FIELDS,
  ].map((name) => ({ name, maxCount: 1 }));

  return FileFieldsInterceptor(fields, {
    storage: multer.memoryStorage(),
    limits: { fileSize: uploadMax },
    fileFilter: (_req, file, callback) => {
      const isImageField = VEHICULO_IMAGE_FIELDS.includes(
        file.fieldname as (typeof VEHICULO_IMAGE_FIELDS)[number],
      );
      const allowedMimeTypes = isImageField
        ? imageMimeTypes
        : documentMimeTypes;

      if (!allowedMimeTypes.includes(file.mimetype)) {
        const allowed = isImageField ? 'PNG o JPEG' : 'PNG, JPEG o PDF';
        return callback(
          new BadRequestException(
            `${file.fieldname}: formato no permitido. Use ${allowed}.`,
          ),
          false,
        );
      }

      callback(null, true);
    },
  });
}

/**
 * Swagger envía campos de archivo vacíos (`foto=`) como string en el body.
 * Multer no los toma como archivo y ValidationPipe los rechaza.
 */
@Injectable()
export class StripEmptyVehiculoFileFieldsInterceptor
  implements NestInterceptor
{
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const body = req.body;
    if (!body || typeof body !== 'object') {
      return next.handle();
    }

    const fileFields = [
      ...VEHICULO_IMAGE_FIELDS,
      ...VEHICULO_DOCUMENT_FIELDS,
    ];
    for (const field of fileFields) {
      delete body[field];
    }

    return next.handle();
  }
}
