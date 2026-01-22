import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
} from '@nestjs/common';
import { Response } from 'express';

@Catch(HttpException)
export class HttpStringResponseFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    const status = exception.getStatus();
    const res = exception.getResponse();

    // Extraer solo el mensaje (si es objeto o string)
    const message =
      typeof res === 'string'
        ? res
        : typeof res === 'object' && 'message' in res
        ? (res as any).message
        : 'Error desconocido';

    response.status(status).send(
      Array.isArray(message) ? message.join(', ') : message,
    );
  }
}
