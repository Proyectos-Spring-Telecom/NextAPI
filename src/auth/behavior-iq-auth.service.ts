import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { ValidateFaceDto } from './dto/validate-face.dto';

function extractBehaviorIqAccessToken(payload: unknown): string | null {
  const pick = (obj: Record<string, unknown>): string | null => {
    for (const key of ['access_token', 'accessToken', 'token', 'access']) {
      const v = obj[key];
      if (typeof v === 'string' && v.length > 0) return v;
    }
    const nested = obj.data;
    if (nested && typeof nested === 'object') {
      return pick(nested as Record<string, unknown>);
    }
    return null;
  };
  if (!payload || typeof payload !== 'object') return null;
  return pick(payload as Record<string, unknown>);
}

@Injectable()
export class BehaviorIqAuthService {
  private readonly logger = new Logger(BehaviorIqAuthService.name);

  constructor(private readonly config: ConfigService) {}

  private normalizeBaseUrl(raw: string): string {
    return raw.replace(/\/+$/, '');
  }

  /** Login con BEHAVIORIQ_USER_NAME / BEHAVIORIQ_PASSWORD (solo servidor). */
  async loginWithEnvCredentials(): Promise<string> {
    const baseRaw = this.config.get<string>('BEHAVIORIQ_BASE_URL');
    const usuario = this.config.get<string>('BEHAVIORIQ_USER_NAME');
    const contrasena = this.config.get<string>('BEHAVIORIQ_PASSWORD');
    if (!baseRaw?.trim() || !usuario?.trim() || contrasena === undefined) {
      throw new InternalServerErrorException({
        message: 'Faltan variables de entorno BehaviorIQ.',
      });
    }
    const base = this.normalizeBaseUrl(baseRaw.trim());
    const url = `${base}/auth/login`;
    const timeout = Number(
      this.config.get<string>('BEHAVIORIQ_LOGIN_TIMEOUT_MS') ?? '30000',
    );

    try {
      const res = await axios.post(
        url,
        { usuario, contrasena },
        {
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          timeout,
          validateStatus: () => true,
        },
      );

      if (res.status < 200 || res.status >= 300) {
        this.logger.warn(`BehaviorIQ login respondió HTTP ${res.status}`);
        throw new UnauthorizedException('No se pudo autenticar con BehaviorIQ.');
      }

      const token = extractBehaviorIqAccessToken(res.data);
      if (!token) {
        this.logger.warn('BehaviorIQ login: cuerpo sin token reconocible');
        throw new InternalServerErrorException({
          message: 'Respuesta de login BehaviorIQ sin token.',
        });
      }
      return token;
    } catch (e) {
      if (e instanceof UnauthorizedException || e instanceof InternalServerErrorException) {
        throw e;
      }
      this.logger.error(`BehaviorIQ login error: ${(e as Error)?.message}`);
      throw new InternalServerErrorException({
        message: 'Error de red al contactar BehaviorIQ.',
        error: (e as Error)?.message,
      });
    }
  }

  /** POST /auth/validateFace/:idCliente en BehaviorIQ (incluye login previo). */
  async validateFace(
    idCliente: number,
    dto: ValidateFaceDto,
  ): Promise<{ status: number; data: unknown }> {
    const token = await this.loginWithEnvCredentials();
    const baseRaw = this.config.get<string>('BEHAVIORIQ_BASE_URL');
    if (!baseRaw?.trim()) {
      throw new InternalServerErrorException({
        message: 'Falta BEHAVIORIQ_BASE_URL.',
      });
    }
    const base = this.normalizeBaseUrl(baseRaw.trim());
    const url = `${base}/auth/validateFace/${encodeURIComponent(String(idCliente))}`;
    const timeout = Number(
      this.config.get<string>('BEHAVIORIQ_VALIDATE_TIMEOUT_MS') ?? '120000',
    );

    const body: Record<string, unknown> = {
      embeddings: dto.embeddings,
      latitud: dto.latitud,
      longitud: dto.longitud,
      idSolucion: 2,
    };

    try {
      const res = await axios.post(url, body, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        timeout,
        validateStatus: () => true,
      });
      return { status: res.status, data: res.data };
    } catch (e) {
      this.logger.error(`BehaviorIQ validateFace error: ${(e as Error)?.message}`);
      throw new InternalServerErrorException({
        message: 'Error de red al validar rostro en BehaviorIQ.',
        error: (e as Error)?.message,
      });
    }
  }
}
