import { BadRequestException, ConflictException } from '@nestjs/common';
import { HttpStringResponseFilter } from './http-string-response.filter';

function host() {
  const res: any = { status: jest.fn(() => res), send: jest.fn(), json: jest.fn() };
  return { res, h: { switchToHttp: () => ({ getResponse: () => res }) } as any };
}

describe('HttpStringResponseFilter', () => {
  it('responde solo el mensaje como texto', () => {
    const { res, h } = host();
    new HttpStringResponseFilter().catch(new BadRequestException('Falta el RFC'), h);
    expect(res.send).toHaveBeenCalledWith('Falta el RFC');
  });

  it('con datos además del mensaje (faltantes al cerrar) responde JSON', () => {
    const { res, h } = host();
    new HttpStringResponseFilter().catch(new BadRequestException({ message: 'La orden está incompleta', faltantes: ['Falta el monitorista'] }), h);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: 'La orden está incompleta', faltantes: ['Falta el monitorista'] });
  });

  it('409 con el Id para ligar', () => {
    const { res, h } = host();
    new HttpStringResponseFilter().catch(new ConflictException({ message: 'Ya existe', idCliente: 12 }), h);
    expect(res.json).toHaveBeenCalledWith({ message: 'Ya existe', idCliente: 12 });
  });
});
