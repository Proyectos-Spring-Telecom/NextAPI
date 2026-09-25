import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * Si viene archivo pero no parte de texto para el mismo fieldname,
 * asigna un marcador para que `@IsNotEmpty()` del DTO pase; el servicio
 * sustituye por la URL de S3.
 */
@Injectable()
export class OperadoresMultipartDocumentsPlaceholderInterceptor
  implements NestInterceptor
{
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const files = req.files as
      | Record<string, Express.Multer.File[]>
      | undefined;
    const ensure = (field: string) => {
      const hasFile = !!files?.[field]?.[0];
      const v = req.body[field];
      if (hasFile && (v === undefined || v === '' || v === null)) {
        req.body[field] = ' ';
      }
    };
    ensure('identificacion');
    ensure('foto');
    ensure('comprobanteDomicilio');
    ensure('certificadoMedico');
    ensure('antecedentesNoPenales');
    ensure('licencia');
    return next.handle();
  }
}
