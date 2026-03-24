import {
  BadRequestException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';

const uploadMax =
  Number(process.env.UPLOAD_MAX_SIZE) || 10 * 1024 * 1024;

/**
 * Interceptor del módulo Clientes: Multer en memoria + fileFilter por fieldname (PDF vs imagen).
 * Ver docs/FLUJO-CLIENTES-FORM-DATA-DOCUMENTOS.md
 */
export function clientesFileFieldsInterceptor() {
  return FileFieldsInterceptor(
    [
      { name: 'actaConstitutiva', maxCount: 1 },
      { name: 'comprobanteDomicilio', maxCount: 1 },
      { name: 'constanciaSituacionFiscal', maxCount: 1 },
      { name: 'logotipo', maxCount: 1 },
    ],
    {
      storage: multer.memoryStorage(),
      limits: { fileSize: uploadMax },
      fileFilter: (req, file, cb) => {
        const pdfFields = [
          'actaConstitutiva',
          'comprobanteDomicilio',
          'constanciaSituacionFiscal',
        ];
        const imageMime = ['image/png', 'image/jpeg', 'image/jpg'];
        if (pdfFields.includes(file.fieldname)) {
          if (file.mimetype !== 'application/pdf') {
            return cb(
              new BadRequestException(`${file.fieldname}: solo PDF`),
              false,
            );
          }
        } else if (file.fieldname === 'logotipo') {
          if (!imageMime.includes(file.mimetype)) {
            return cb(
              new BadRequestException('logotipo: solo PNG o JPEG'),
              false,
            );
          }
        }
        cb(null, true);
      },
    },
  );
}
