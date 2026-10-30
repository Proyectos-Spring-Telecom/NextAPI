import {
  CanActivate,
  ExecutionContext,
  Injectable,
  RawBodyRequest,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { Request } from 'express';

/** Tolerancia del reloj entre el CRM y NextAPI. */
const VENTANA_MS = 5 * 60 * 1000;

/**
 * Nonces ya usados dentro de la ventana: una petición capturada no se puede
 * repetir. En memoria basta: NextAPI corre en un solo proceso (si se escala a
 * varios, moverlo a la base o a Redis).
 */
const usadas = new Map<string, number>();

function purgar(ahora: number): void {
  for (const [nonce, vence] of usadas) if (vence < ahora) usadas.delete(nonce);
}

/**
 * Entrada del CRM (`/integracion/*`), firma v2: headers `x-crm-firma: v2`,
 * `x-crm-timestamp` (ms), `x-crm-nonce` (único por petición, 16–64 caracteres)
 * y `x-crm-signature` = HMAC-SHA256 hex de
 * `${timestamp}.${nonce}.${MÉTODO} ${ruta}\n${cuerpo}`, con la ruta tal como
 * llega (incluye `/api` y la query). Cubre método, ruta y cuerpo: una firma de
 * una orden no sirve para otra, y cada nonce se acepta una sola vez (dos
 * peticiones legítimas iguales llevan nonces distintos).
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
    if (header(req, 'x-crm-firma') !== 'v2') {
      throw new UnauthorizedException('Firma del CRM: se requiere la versión 2');
    }
    const ts = header(req, 'x-crm-timestamp');
    const nonce = header(req, 'x-crm-nonce');
    const firma = header(req, 'x-crm-signature');
    if (!nonce || nonce.length < 16 || nonce.length > 64) {
      throw new UnauthorizedException('Firma del CRM: falta el nonce');
    }
    const ahora = Date.now();
    if (!ts || !firma || !Number.isFinite(Number(ts)) || Math.abs(ahora - Number(ts)) > VENTANA_MS) {
      throw new UnauthorizedException('Firma del CRM inválida, ausente o expirada');
    }
    const cuerpo = req.rawBody?.toString('utf8') ?? '';
    const esperada = createHmac('sha256', secret).update(`${ts}.${nonce}.${req.method} ${req.originalUrl}\n${cuerpo}`).digest('hex');
    const a = Buffer.from(firma, 'utf8');
    const b = Buffer.from(esperada, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new UnauthorizedException('Firma del CRM inválida, ausente o expirada');
    }
    purgar(ahora);
    if (usadas.has(nonce)) {
      throw new UnauthorizedException('Firma del CRM ya usada');
    }
    usadas.set(nonce, Number(ts) + VENTANA_MS);
    return true;
  }
}

function header(req: Request, name: string): string | null {
  const value = req.headers[name];
  return (Array.isArray(value) ? value[0] : value) ?? null;
}
