import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class LicenciaMultipartPlaceholderInterceptor
  implements NestInterceptor
{
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const files = req.files as
      | Record<string, Express.Multer.File[]>
      | undefined;
    const hasFile = !!files?.licencia?.[0];
    const v = req.body?.licencia;
    if (hasFile && (v === undefined || v === '' || v === null)) {
      req.body.licencia = ' ';
    }
    return next.handle();
  }
}
