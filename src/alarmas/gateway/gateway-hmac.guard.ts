import {
  CanActivate,
  ExecutionContext,
  Injectable,
  RawBodyRequest,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { verifyGatewayRequest } from './verify-gateway-request';

@Injectable()
export class GatewayHmacGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<RawBodyRequest<Request>>();

    const secret = this.config.get<string>('GATEWAY_HMAC_SECRET') ?? '';
    const apiKeyExpected = this.config.get<string>('GATEWAY_API_KEY')?.trim();

    const rawBody = req.rawBody?.toString('utf8') ?? '';
    if (!rawBody) {
      throw new UnauthorizedException('Body vacío o no disponible para firma');
    }

    const result = verifyGatewayRequest({
      secret,
      timestampHeader: header(req, 'x-gateway-timestamp'),
      signatureHeader: header(req, 'x-gateway-signature'),
      rawBody,
      apiKeyExpected: apiKeyExpected || undefined,
      apiKeyHeader: header(req, 'x-gateway-key'),
    });

    if (!result.ok) {
      throw new UnauthorizedException(result.error);
    }

    return true;
  }
}

function header(req: Request, name: string): string | null {
  const value = req.headers[name];
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}
