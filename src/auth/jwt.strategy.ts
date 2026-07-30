import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  validate(payload: any) {
    if (payload?.type !== 'access') {
      this.logger.warn(
        `JWT rechazado — type inválido (type=${payload?.type ?? 'undefined'})`,
      );
      throw new UnauthorizedException('Token de acceso inválido');
    }

    this.logger.debug(`JWT access aceptado (userId=${payload?.id ?? 'desconocido'})`);
    return {
      userId: payload.id,
      email: payload.email,
      idCliente: payload.idCliente,
      rol: payload.rol,
      idOperador: payload.idOperador,
      ...(typeof payload.face === 'number' ? { face: payload.face } : {}),
    };
  }
}
