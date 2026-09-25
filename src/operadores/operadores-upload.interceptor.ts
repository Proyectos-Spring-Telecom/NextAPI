import { BadRequestException } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';

const uploadMax = Number(process.env.UPLOAD_MAX_SIZE) || 10 * 1024 * 1024;

const DOC_FIELDS = [
  'identificacion',
  'foto',
  'comprobanteDomicilio',
  'certificadoMedico',
  'antecedentesNoPenales',
  'licencia',
] as const;

const ALLOWED_MIME = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/pdf',
] as const;

/**
 * Multer en memoria + fileFilter: imagen o PDF en campos de documentos del operador.
 */
export function operadoresFileFieldsInterceptor() {
  return FileFieldsInterceptor(
    DOC_FIELDS.map((name) => ({ name, maxCount: 1 })),
    {
      storage: multer.memoryStorage(),
      limits: { fileSize: uploadMax },
      fileFilter: (_req, file, cb) => {
        if (!DOC_FIELDS.includes(file.fieldname as (typeof DOC_FIELDS)[number])) {
          return cb(null, true);
        }
        if (!ALLOWED_MIME.includes(file.mimetype as (typeof ALLOWED_MIME)[number])) {
          return cb(
            new BadRequestException(
              `${file.fieldname}: solo PNG, JPEG o PDF`,
            ),
            false,
          );
        }
        cb(null, true);
      },
    },
  );
}

export { DOC_FIELDS as OPERADORES_DOC_FIELDS };
