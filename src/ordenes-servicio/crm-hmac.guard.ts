import {
  CanActivate,
  ExecutionContext,
  Injectable,
  RawBodyRequest,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { verifyGatewayRequest } from 'src/alarmas/gateway/verify-gateway-request';

/**
 * Entrada del CRM (`/integracion/*`). Mismo esquema que el CRM usa con
 * springContactAPI: headers `x-crm-timestamp` (ms) y `x-crm-signature`, hex de
 * HMAC-SHA256 sobre `${timestamp}.${cuerpo}`. Sin cuerpo (GET) se firma
 * `${METODO} ${ruta}`, con la ruta tal como la pidió el CRM: con o sin el
 * prefijo `/api` (p. ej. `GET /integracion/ordenes-servicio/cambios?desde=…`).
 */
@Injectable()
export class CrmHmacGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<RawBodyRequest<Request>>();
    const secret = this.config.get<string>('CRM_HMAC_SECRET')?.trim() ?? '';
    if (secret.length < 16) {
      throw new ServiceUnavailableException('Integración con el CRM no configurada (CRM_HMAC_SECRET)');
    }
    const timestamp = header(req, 'x-crm-timestamp');
    const firma = header(req, 'x-crm-signature');
    const rawBody = req.rawBody?.toString('utf8') ?? '';
    const ruta = req.originalUrl;
    const candidatos = rawBody
      ? [rawBody]
      : [`${req.method} ${ruta}`, `${req.method} ${ruta.replace(/^\/api(?=\/)/, '')}`];
    const ok = candidatos.some(
      (cuerpo) => verifyGatewayRequest({ secret, timestampHeader: timestamp, signatureHeader: firma, rawBody: cuerpo }).ok,
    );
    if (!ok) {
      throw new UnauthorizedException('Firma del CRM inválida, ausente o expirada');
    }
    return true;
  }
}

function header(req: Request, name: string): string | null {
  const value = req.headers[name];
  return (Array.isArray(value) ? value[0] : value) ?? null;
}
