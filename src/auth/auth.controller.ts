import {
  Controller,
  Post,
  Body,
  HttpCode,
  Get,
  Query,
  UseGuards,
  Patch,
  Request,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginAuthDto } from './dto/login-auth.dto';
import { LoginAuthPinDto } from './dto/login-pin.dto';
import { LoginAuthConfirmacionDto } from './dto/login-confirmacion.dto';
import { LoginAuthResetDto } from './dto/login-recuperacion.dto';
import { JwtAuthGuard } from 'src/guard/jwt-auth.guard';
import { CodigoPasajeroAutenticacion } from './dto/login-autenticacion.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Autenticación')
@ApiBearerAuth('bearer-token')
@Controller('login')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ========================================
  // 🔹 POST ROUTES - Rutas específicas primero
  // ========================================

  @Post('usuario/solicitud/recuperacion')
  async solicitudRecuperacion(
    @Body() loginAuthConfirmacionDto: LoginAuthConfirmacionDto,
  ) {
    return await this.authService.recuperarContrasena(loginAuthConfirmacionDto);
  }

  @Post('recuperar/confirmacion')
  async recuperacionConfirmacion(
    @Body() loginAuthConfirmacionDto: LoginAuthConfirmacionDto,
  ) {
    return await this.authService.recuperarConfirmacion(
      loginAuthConfirmacionDto,
    );
  }

  @Post('operador/accesso/nip')
  @HttpCode(200)
  async loginPin(@Body() loginAuthPinDto: LoginAuthPinDto) {
    return this.authService.signInPin(loginAuthPinDto);
  }

  @Post()
  @HttpCode(200)
  async login(@Body() loginAuthDto: LoginAuthDto) {
    return this.authService.signIn(loginAuthDto);
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
    return await this.authService.resetPassword(+idUser, loginAuthResetDto);
  }

  @Patch('verify')
  @HttpCode(200)
  async verifyUser(
    @Body() codigoPasajeroAutenticacion: CodigoPasajeroAutenticacion,
  ) {
    return await this.authService.verifyUser(codigoPasajeroAutenticacion);
  }
}
