import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EnumRoles } from 'src/common/estatus.enum';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { ACEPTA_LLAVE_API } from './acepta-llave-api.decorator';
import { LlavesApiService } from './llaves-api.service';

/**
 * Sin `X-Api-Key`, exactamente el `JwtAuthGuard` de siempre. Con ella, solo en
 * rutas marcadas con `@AceptaLlaveApi()`: la petición queda como un usuario
 * Cliente (rol 6) del cliente de la llave, a nombre de quien la creó.
 */
@Injectable()
export class JwtOLlaveApiGuard implements CanActivate {
  private readonly jwt = new JwtAuthGuard();

  constructor(
    private readonly reflector: Reflector,
    private readonly llaves: LlavesApiService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const header = req.headers?.['x-api-key'];
    if (header == null || header === '') {
      return (await this.jwt.canActivate(ctx)) as boolean;
    }
    const acepta = this.reflector.getAllAndOverride<boolean>(ACEPTA_LLAVE_API, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (!acepta) throw new UnauthorizedException('Esta ruta no acepta llave de API');
    const llave = await this.llaves.validar(
      String(Array.isArray(header) ? header[0] : header),
    );
    if (!llave)
      throw new UnauthorizedException('Llave de API inválida, vencida o revocada');
    req.user = {
      userId: llave.idUsuario,
      idCliente: llave.idCliente,
      rol: EnumRoles.CLIENTE,
      llaveApi: llave.idLlave,
    };
    return true;
  }
}
