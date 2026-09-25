import { BadRequestException } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';

const uploadMax = Number(process.env.UPLOAD_MAX_SIZE) || 10 * 1024 * 1024;

const ALLOWED_MIME = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'application/pdf',
] as const;

/** Solo el campo `licencia` (documento escaneado). */
export function licenciaFileFieldsInterceptor() {
  return FileFieldsInterceptor([{ name: 'licencia', maxCount: 1 }], {
    storage: multer.memoryStorage(),
    limits: { fileSize: uploadMax },
    fileFilter: (_req, file, cb) => {
      if (file.fieldname !== 'licencia') {
        return cb(null, true);
      }
      if (!ALLOWED_MIME.includes(file.mimetype as (typeof ALLOWED_MIME)[number])) {
        return cb(
          new BadRequestException('licencia: solo PNG, JPEG o PDF'),
          false,
        );
      }
      cb(null, true);
    },
  });
}
