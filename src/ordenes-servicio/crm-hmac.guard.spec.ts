import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { CrmHmacGuard } from './crm-hmac.guard';

const SECRETO = 'secreto-de-prueba-crm-1234';
const firmar = (ts: string, cuerpo: string) => createHmac('sha256', SECRETO).update(`${ts}.${cuerpo}`).digest('hex');

function contexto(req: Record<string, unknown>) {
  return { switchToHttp: () => ({ getRequest: () => req }) } as never;
}
const guard = (secret = SECRETO) => new CrmHmacGuard({ get: () => secret } as never);

describe('CrmHmacGuard', () => {
  it('acepta un POST firmado sobre el cuerpo', () => {
    const ts = String(Date.now());
    const cuerpo = '{"tipo":"instalacion"}';
    const req = { method: 'POST', originalUrl: '/api/integracion/ordenes-servicio', rawBody: Buffer.from(cuerpo),
      headers: { 'x-crm-timestamp': ts, 'x-crm-signature': firmar(ts, cuerpo) } };
    expect(guard().canActivate(contexto(req))).toBe(true);
  });

  it('acepta un GET firmado con o sin el prefijo /api, como lo hace el CRM', () => {
    const ts = String(Date.now());
    const url = '/api/integracion/ordenes-servicio/cambios?desde=2026-10-30T00:00:00Z';
    for (const ruta of [url, url.replace('/api', '')]) {
      const req = { method: 'GET', originalUrl: url, headers: { 'x-crm-timestamp': ts, 'x-crm-signature': firmar(ts, `GET ${ruta}`) } };
      expect(guard().canActivate(contexto(req))).toBe(true);
    }
  });

  it('rechaza firma alterada, timestamp viejo o secreto sin configurar', () => {
    const viejo = String(Date.now() - 10 * 60_000);
    const cuerpo = '{}';
    const mala = { method: 'POST', originalUrl: '/x', rawBody: Buffer.from(cuerpo), headers: { 'x-crm-timestamp': viejo, 'x-crm-signature': firmar(viejo, cuerpo) } };
    expect(() => guard().canActivate(contexto(mala))).toThrow(UnauthorizedException);
    expect(() => guard('').canActivate(contexto(mala))).toThrow(ServiceUnavailableException);
  });
});
