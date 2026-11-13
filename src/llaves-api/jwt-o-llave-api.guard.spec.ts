import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { EnumRoles } from 'src/common/estatus.enum';
import { JwtOLlaveApiGuard } from './jwt-o-llave-api.guard';

function contexto(headers: Record<string, string>, acepta: boolean) {
  const req: { headers: Record<string, string>; user?: unknown } = { headers };
  const reflector = { getAllAndOverride: jest.fn().mockReturnValue(acepta) } as unknown as Reflector;
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  };
  return { req, reflector, ctx: ctx as never };
}

describe('JwtOLlaveApiGuard', () => {
  const llaves = { validar: jest.fn() };
  let jwt: jest.SpyInstance;

  beforeEach(() => {
    llaves.validar.mockReset();
    jwt = jest.spyOn(JwtAuthGuard.prototype, 'canActivate').mockResolvedValue(true as never);
  });
  afterEach(() => jwt.mockRestore());

  it('sin X-Api-Key usa el JWT de siempre y no toca las llaves', async () => {
    const { reflector, ctx } = contexto({ authorization: 'Bearer x' }, true);
    await expect(new JwtOLlaveApiGuard(reflector, llaves as never).canActivate(ctx)).resolves.toBe(true);
    expect(jwt).toHaveBeenCalled();
    expect(llaves.validar).not.toHaveBeenCalled();
  });

  it('una ruta no marcada rechaza la llave aunque sea válida', async () => {
    llaves.validar.mockResolvedValue({ idLlave: 1, idCliente: 15, idUsuario: 7 });
    const { reflector, ctx } = contexto({ 'x-api-key': 'nxt_x' }, false);
    await expect(new JwtOLlaveApiGuard(reflector, llaves as never).canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(llaves.validar).not.toHaveBeenCalled();
    expect(jwt).not.toHaveBeenCalled();
  });

  it('una llave inválida, vencida o revocada da 401', async () => {
    llaves.validar.mockResolvedValue(null);
    const { reflector, ctx } = contexto({ 'x-api-key': 'nxt_x' }, true);
    await expect(new JwtOLlaveApiGuard(reflector, llaves as never).canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('una llave válida entra como usuario Cliente del cliente de la llave', async () => {
    llaves.validar.mockResolvedValue({ idLlave: 3, idCliente: 15, idUsuario: 7 });
    const { req, reflector, ctx } = contexto({ 'x-api-key': 'nxt_x' }, true);
    await expect(new JwtOLlaveApiGuard(reflector, llaves as never).canActivate(ctx)).resolves.toBe(true);
    expect(req.user).toEqual({ userId: 7, idCliente: 15, rol: EnumRoles.CLIENTE, llaveApi: 3 });
    expect(jwt).not.toHaveBeenCalled();
  });
});
