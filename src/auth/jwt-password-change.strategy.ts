import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

/**
 * Access (logueado) o password_reset (enlace del correo).
 * Solo para cambio de contraseña — no reemplaza la strategy `jwt` global.
 */
@Injectable()
export class JwtPasswordChangeStrategy extends PassportStrategy(
  Strategy,
  'jwt-password-change',
) {
  private readonly logger = new Logger(JwtPasswordChangeStrategy.name);

  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  validate(payload: {
    id?: number | string;
    email?: string;
    idCliente?: number | null;
    rol?: number | null;
    type?: string;
  }) {
    if (payload?.type !== 'access' && payload?.type !== 'password_reset') {
      this.logger.warn(
        `JWT password-change rechazado — type inválido (type=${payload?.type ?? 'undefined'})`,
      );
      throw new UnauthorizedException('Token de acceso inválido');
    }

    this.logger.debug(
      `JWT password-change aceptado (type=${payload.type}, userId=${payload?.id ?? 'desconocido'})`,
    );
    return {
      userId: Number(payload.id),
      email: payload.email,
      idCliente: payload.idCliente,
      rol: payload.rol,
      tokenType: payload.type,
    };
  }
}
