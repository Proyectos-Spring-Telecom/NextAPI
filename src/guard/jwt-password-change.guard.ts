import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Acepta JWT `access` o `password_reset` (correo de recuperación). */
@Injectable()
export class JwtPasswordChangeGuard extends AuthGuard('jwt-password-change') {}
