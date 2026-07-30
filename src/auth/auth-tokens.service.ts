import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'crypto';
import { Usuarios } from 'src/entities/Usuarios';
import { toJwtExpiresIn } from 'src/common/jwt-expires.util';

export type AccessTokenPayload = {
  id: number;
  email: string;
  idCliente: number | null;
  rol: number | null;
  type: 'access';
  face?: number;
};

export type RefreshTokenPayload = {
  id: number;
  type: 'refresh';
  jti: string;
};

export type SignedRefreshToken = {
  token: string;
  jti: string;
  expiresAt: Date;
};

function durationToMs(raw: string, fallbackMs: number): number {
  const match = /^(\d+)([smhd])$/.exec(raw);
  if (!match) return fallbackMs;
  const n = parseInt(match[1], 10);
  const u = match[2];
  if (u === 's') return n * 1000;
  if (u === 'm') return n * 60 * 1000;
  if (u === 'h') return n * 60 * 60 * 1000;
  if (u === 'd') return n * 24 * 60 * 60 * 1000;
  return fallbackMs;
}

export function jwtExpiresInSeconds(): number {
  const raw = process.env.JWT_EXPIRES_IN ?? '15m';
  const match = /^(\d+)([smhd])$/.exec(raw);
  if (!match) return 900;
  const n = parseInt(match[1], 10);
  const u = match[2];
  if (u === 's') return n;
  if (u === 'm') return n * 60;
  if (u === 'h') return n * 3600;
  if (u === 'd') return n * 86400;
  return 900;
}

@Injectable()
export class AuthTokensService {
  private readonly logger = new Logger(AuthTokensService.name);

  constructor(private readonly jwtService: JwtService) {}

  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  buildAccessPayload(
    user: Pick<Usuarios, 'id' | 'userName' | 'idCliente' | 'idRol' | 'idFaceAuth'>,
    faceClaim?: number,
  ): AccessTokenPayload {
    const payload: AccessTokenPayload = {
      id: Number(user.id),
      email: user.userName,
      idCliente: user.idCliente != null ? Number(user.idCliente) : null,
      rol: user.idRol != null ? Number(user.idRol) : null,
      type: 'access',
    };
    if (faceClaim != null && Number.isFinite(faceClaim)) {
      payload.face = faceClaim;
    }
    return payload;
  }

  signAccessToken(
    user: Pick<Usuarios, 'id' | 'userName' | 'idCliente' | 'idRol' | 'idFaceAuth'>,
    faceClaim?: number,
  ): string {
    return this.jwtService.sign(this.buildAccessPayload(user, faceClaim));
  }

  signRefreshToken(userId: number): SignedRefreshToken {
    const jwtSecret = process.env.JWT_SECRET;
    const refreshExpiresIn = process.env.JWT_REFRESH_EXPIRES_IN ?? '7d';
    if (!jwtSecret) {
      this.logger.error('AuthTokens: falta variable JWT_SECRET');
      throw new InternalServerErrorException({
        message: 'Falta JWT_SECRET.',
      });
    }

    const jti = randomUUID();
    const payload: RefreshTokenPayload = {
      id: Number(userId),
      type: 'refresh',
      jti,
    };
    const token = this.jwtService.sign(payload, {
      secret: jwtSecret,
      expiresIn: toJwtExpiresIn(refreshExpiresIn, '7d'),
    });

    const decoded = this.jwtService.decode(token) as { exp?: number } | null;
    const expiresAt =
      decoded?.exp != null
        ? new Date(decoded.exp * 1000)
        : new Date(Date.now() + durationToMs(refreshExpiresIn, 7 * 24 * 60 * 60 * 1000));

    return { token, jti, expiresAt };
  }

  verifyRefreshToken(token: string): RefreshTokenPayload {
    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new InternalServerErrorException({
        message: 'Falta JWT_SECRET.',
      });
    }
    return this.jwtService.verify(token, {
      secret: jwtSecret,
    }) as RefreshTokenPayload;
  }
}
