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

    const texto = Array.isArray(message) ? message.join(', ') : message;
    // Si el error trae datos además del mensaje (p. ej. `faltantes` al cerrar
    // una orden de servicio, `idCliente` del 409 de /integracion/clientes), van
    // como JSON para que la app o el CRM los usen.
    const extra =
      typeof res === 'object' && res !== null
        ? Object.fromEntries(
            Object.entries(res).filter(([k]) => !['message', 'error', 'statusCode'].includes(k)),
          )
        : {};
    if (Object.keys(extra).length) {
      response.status(status).json({ message: texto, ...extra });
      return;
    }

    response.status(status).send(texto);
  }
}
