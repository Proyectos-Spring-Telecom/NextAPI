import {
  Controller,
  Post,
  Body,
  HttpCode,
  Get,
  UseGuards,
  Patch,
  Request,
  Query,
  Logger,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginAuthDto } from './dto/login-auth.dto';
import { LoginAuthPinDto } from './dto/login-pin.dto';
import { LoginAuthConfirmacionDto } from './dto/login-confirmacion.dto';
import { LoginAuthResetDto } from './dto/login-recuperacion.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { CodigoPasajeroAutenticacion } from './dto/login-autenticacion.dto';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { LoginRefreshTokenDto } from './dto/login-refresh-token.dto';

const THROTTLE_LOGIN_LIMIT = Number(process.env.THROTTLE_LOGIN_LIMIT ?? 5);
const THROTTLE_LOGIN_TTL_MS = Number(
  process.env.THROTTLE_LOGIN_TTL_MS ?? 60000,
);
const THROTTLE_PIN_LIMIT = Number(process.env.THROTTLE_PIN_LIMIT ?? 5);
const THROTTLE_PIN_TTL_MS = Number(process.env.THROTTLE_PIN_TTL_MS ?? 60000);
const THROTTLE_VERIFY_LIMIT = Number(process.env.THROTTLE_VERIFY_LIMIT ?? 3);
const THROTTLE_VERIFY_TTL_MS = Number(
  process.env.THROTTLE_VERIFY_TTL_MS ?? 60000,
);
const THROTTLE_RECUPERACION_LIMIT = Number(
  process.env.THROTTLE_RECUPERACION_LIMIT ?? 2,
);
const THROTTLE_RECUPERACION_TTL_MS = Number(
  process.env.THROTTLE_RECUPERACION_TTL_MS ?? 60000,
);
const THROTTLE_RECUPERACION_CONFIRMACION_LIMIT = Number(
  process.env.THROTTLE_RECUPERACION_CONFIRMACION_LIMIT ?? 5,
);
const THROTTLE_RECUPERACION_CONFIRMACION_TTL_MS = Number(
  process.env.THROTTLE_RECUPERACION_CONFIRMACION_TTL_MS ?? 60000,
);
const THROTTLE_REFRESH_LIMIT = Number(process.env.THROTTLE_REFRESH_LIMIT ?? 5);
const THROTTLE_REFRESH_TTL_MS = Number(
  process.env.THROTTLE_REFRESH_TTL_MS ?? 60000,
);
const THROTTLE_LOGOUT_LIMIT = Number(process.env.THROTTLE_LOGOUT_LIMIT ?? 5);
const THROTTLE_LOGOUT_TTL_MS = Number(
  process.env.THROTTLE_LOGOUT_TTL_MS ?? 60000,
);

@ApiTags('Autenticación')
@ApiBearerAuth('bearer-token')
@Controller('login')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  @Post('usuario/solicitud/recuperacion')
  @Throttle({ default: { limit: THROTTLE_RECUPERACION_LIMIT, ttl: THROTTLE_RECUPERACION_TTL_MS } })
  async solicitudRecuperacion(
    @Body() loginAuthConfirmacionDto: LoginAuthConfirmacionDto,
  ) {
    this.logger.log(
      `HTTP POST login/usuario/solicitud/recuperacion (userName=${loginAuthConfirmacionDto.userName})`,
    );
    return await this.authService.recuperarContrasena(loginAuthConfirmacionDto);
  }

  @Post('recuperar/confirmacion')
  @Throttle({
    default: {
      limit: THROTTLE_RECUPERACION_CONFIRMACION_LIMIT,
      ttl: THROTTLE_RECUPERACION_CONFIRMACION_TTL_MS,
    },
  })
  async recuperacionConfirmacion(
    @Body() loginAuthConfirmacionDto: LoginAuthConfirmacionDto,
  ) {
    this.logger.log(
      `HTTP POST login/recuperar/confirmacion (userName=${loginAuthConfirmacionDto.userName})`,
    );
    return await this.authService.recuperarConfirmacion(
      loginAuthConfirmacionDto,
    );
  }

  @Post('operador/accesso/nip')
  @HttpCode(200)
  @Throttle({ default: { limit: THROTTLE_PIN_LIMIT, ttl: THROTTLE_PIN_TTL_MS } })
  @ApiQuery({
    name: 'Nombres',
    required: false,
    description:
      'Nombre de la solución (debe existir en Soluciones y debe estar activo). Ej.: AM, PM',
  })
  async loginPin(
    @Body() loginAuthPinDto: LoginAuthPinDto,
    @Query('Nombres') nombres?: string,
  ) {
    this.logger.log(
      `HTTP POST login/operador/accesso/nip (userName=${loginAuthPinDto.userName}, nombres=${nombres ? 'sí' : 'no'})`,
    );
    return this.authService.signInPin(loginAuthPinDto, nombres);
  }

  @Post()
  @HttpCode(200)
  @Throttle({ default: { limit: THROTTLE_LOGIN_LIMIT, ttl: THROTTLE_LOGIN_TTL_MS } })
  @ApiQuery({
    name: 'Nombres',
    required: false,
    description:
      'Nombre de la solución (debe existir en Soluciones y debe estar activo). Ej.: AM, PM',
  })
  async login(
    @Body() loginAuthDto: LoginAuthDto,
    @Query('Nombres') nombres?: string,
  ) {
    this.logger.log(
      `HTTP POST login (userName=${loginAuthDto.userName}, nombres=${nombres ? 'sí' : 'no'})`,
    );
    return this.authService.signIn(loginAuthDto, nombres ?? 'SIT');
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req: { user: { userId: number } }) {
    this.logger.log(`HTTP GET login/me (userId=${req.user.userId})`);
    return this.authService.getProfileByToken(req.user.userId);
  }

  // ========================================
  // 🔹 PATCH ROUTES - Rutas específicas primero
  // ========================================

  @Post('cambiar/accesso')
  @UseGuards(JwtAuthGuard)
  async resetPassword(
    @Body() loginAuthResetDto: LoginAuthResetDto,
    @Request() req: { user: { userId: number } },
  ) {
    const idUser = req.user.userId;
    this.logger.log(`HTTP POST login/cambiar/accesso (userId=${idUser})`);
    return await this.authService.resetPassword(+idUser, loginAuthResetDto);
  }

  @Patch('verify')
  @HttpCode(200)
  @Throttle({
    default: { limit: THROTTLE_VERIFY_LIMIT, ttl: THROTTLE_VERIFY_TTL_MS },
  })
  async verifyUser(
    @Body() codigoPasajeroAutenticacion: CodigoPasajeroAutenticacion,
  ) {
    this.logger.log(
      `HTTP PATCH login/verify (userName=${codigoPasajeroAutenticacion.userName})`,
    );
    return await this.authService.verifyUser(codigoPasajeroAutenticacion);
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({
    default: { limit: THROTTLE_REFRESH_LIMIT, ttl: THROTTLE_REFRESH_TTL_MS },
  })
  async refreshToken(@Body() dto: LoginRefreshTokenDto) {
    this.logger.log('HTTP POST login/refresh');
    return await this.authService.refreshToken(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard)
  @Throttle({
    default: { limit: THROTTLE_LOGOUT_LIMIT, ttl: THROTTLE_LOGOUT_TTL_MS },
  })
  async logout(@Request() req: { user: { userId: number } }) {
    this.logger.log(`HTTP POST login/logout (userId=${req.user.userId})`);
    return await this.authService.logout(req.user.userId);
  }
}
