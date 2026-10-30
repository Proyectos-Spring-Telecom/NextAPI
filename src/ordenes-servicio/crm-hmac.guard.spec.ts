import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomUUID } from 'crypto';
import { CrmHmacGuard } from './crm-hmac.guard';

const SECRETO = 'secreto-de-prueba-crm-1234';
const firmar = (ts: string, nonce: string, metodo: string, ruta: string, cuerpo: string) =>
  createHmac('sha256', SECRETO).update(`${ts}.${nonce}.${metodo} ${ruta}\n${cuerpo}`).digest('hex');

function contexto(req: Record<string, unknown>) {
  return { switchToHttp: () => ({ getRequest: () => req }) } as never;
}
const guard = (secret = SECRETO) => new CrmHmacGuard({ get: () => secret } as never);
const peticion = (metodo: string, ruta: string, cuerpo: string, firmaRuta = ruta, ts = String(Date.now()), nonce = randomUUID()) => ({
  method: metodo,
  originalUrl: ruta,
  rawBody: cuerpo ? Buffer.from(cuerpo) : undefined,
  headers: { 'x-crm-firma': 'v2', 'x-crm-timestamp': ts, 'x-crm-nonce': nonce, 'x-crm-signature': firmar(ts, nonce, metodo, firmaRuta, cuerpo) },
});

describe('CrmHmacGuard (firma v2)', () => {
  it('acepta POST y GET firmados con método, ruta y cuerpo', () => {
    expect(guard().canActivate(contexto(peticion('POST', '/api/integracion/ordenes-servicio', '{"a":1}')))).toBe(true);
    expect(guard().canActivate(contexto(peticion('GET', '/api/integracion/ordenes-servicio/cambios?limite=5', '')))).toBe(true);
  });

  it('una firma de una orden no sirve para otra', () => {
    const req = peticion('POST', '/api/integracion/ordenes-servicio/2/cancelar', '{}', '/api/integracion/ordenes-servicio/1/cancelar');
    expect(() => guard().canActivate(contexto(req))).toThrow(UnauthorizedException);
  });

  it('una firma no se acepta dos veces; dos peticiones iguales con nonces distintos sí', () => {
    const ts = String(Date.now());
    const req = peticion('POST', '/api/integracion/ordenes-servicio/9/cancelar', '{"x":2}', undefined, ts);
    expect(guard().canActivate(contexto(req))).toBe(true);
    expect(() => guard().canActivate(contexto(req))).toThrow('ya usada');
    const otra = peticion('POST', '/api/integracion/ordenes-servicio/9/cancelar', '{"x":2}', undefined, ts);
    expect(guard().canActivate(contexto(otra))).toBe(true);
  });

  it('rechaza la firma v1, el timestamp vencido y el secreto sin configurar', () => {
    const v1 = { ...peticion('POST', '/x', '{}'), headers: { 'x-crm-timestamp': String(Date.now()), 'x-crm-signature': 'aa' } };
    expect(() => guard().canActivate(contexto(v1))).toThrow('versión 2');
    const vieja = peticion('POST', '/x', '{}', '/x', String(Date.now() - 10 * 60_000));
    expect(() => guard().canActivate(contexto(vieja))).toThrow(UnauthorizedException);
    expect(() => guard('').canActivate(contexto(vieja))).toThrow(ServiceUnavailableException);
  });
});
