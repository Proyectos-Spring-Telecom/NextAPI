import { Body, Controller, HttpCode, Logger, Post } from '@nestjs/common';
import {
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { ValidateFaceDto } from './dto/validate-face.dto';

const THROTTLE_VALIDATE_FACE_LIMIT = Number(
  process.env.THROTTLE_VALIDATE_FACE_LIMIT ?? 10,
);
const THROTTLE_VALIDATE_FACE_TTL_MS = Number(
  process.env.THROTTLE_VALIDATE_FACE_TTL_MS ?? 60000,
);

/** Tenant fijo para validateFace (BehaviorIQ + filtro local); no expuesto en API. */
const VALIDATE_FACE_ID_CLIENTE = 2;

@ApiTags('Autenticación')
@Controller('auth')
export class AuthFaceController {
  private readonly logger = new Logger(AuthFaceController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('validateFace')
  @HttpCode(200)
  @Throttle({
    default: {
      limit: THROTTLE_VALIDATE_FACE_LIMIT,
      ttl: THROTTLE_VALIDATE_FACE_TTL_MS,
    },
  })
  @ApiOperation({
    summary: 'Login por reconocimiento facial (BehaviorIQ)',
    description:
      'Proxy BFF: IdCliente fijo = 2 en servidor (no configurable). idSolución fija interna (=2). Devuelve token, refreshToken y expiresIn; el JWT incluye claim face (idRostro). El cliente no envía credenciales BehaviorIQ.',
  })
  @ApiBody({ type: ValidateFaceDto })
  @ApiResponse({
    status: 200,
    description:
      'token, refreshToken y expiresIn; el access token incluye el claim `face` (idRostro) solo en este flujo',
  })
  @ApiResponse({ status: 401, description: 'Rostro no válido o sin autorización' })
  @ApiResponse({ status: 404, description: 'Sin vínculo local con idRostro' })
  async validateFace(@Body() dto: ValidateFaceDto) {
    this.logger.log(
      `HTTP POST auth/validateFace (idCliente fijo=${VALIDATE_FACE_ID_CLIENTE})`,
    );
    return this.authService.validateFaceLogin(VALIDATE_FACE_ID_CLIENTE, dto);
  }
}
