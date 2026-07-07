import { BadRequestException } from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';

const uploadMax =
  Number(process.env.UPLOAD_MAX_SIZE) || 10 * 1024 * 1024;

/**
 * Interceptor del módulo Usuarios: Multer en memoria + validación de imagen de perfil.
 * Mismo patrón que clientes-upload.interceptor.ts (logotipo).
 */
export function usuariosFileFieldsInterceptor() {
  return FileFieldsInterceptor([{ name: 'fotoPerfil', maxCount: 1 }], {
    storage: multer.memoryStorage(),
    limits: { fileSize: uploadMax },
    fileFilter: (_req, file, cb) => {
      const imageMime = ['image/png', 'image/jpeg', 'image/jpg'];
      if (!imageMime.includes(file.mimetype)) {
        return cb(
          new BadRequestException(
            'El formato de la imagen no está permitido. Solo PNG o JPEG.',
          ),
          false,
        );
      }
      cb(null, true);
    },
  });
}
