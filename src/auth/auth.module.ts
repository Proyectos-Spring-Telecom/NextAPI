import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { AuthFaceController } from './auth-face.controller';
import { BehaviorIqAuthService } from './behavior-iq-auth.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuarios } from 'src/entities/Usuarios';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { UsuariosPermisos } from 'src/entities/UsuariosPermisos';
import { JwtStrategy } from './jwt.strategy';
import { UsuariosModule } from 'src/usuarios/usuarios.module';
import { MailModule } from 'src/mail/mail.module';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { CodigoAutenticacion } from 'src/entities/CodigoAutenticacion';
import { Soluciones } from 'src/entities/Soluciones';
import { AsignacionSoluciones } from 'src/entities/AsignacionSoluciones';
import { toJwtExpiresIn } from 'src/common/jwt-expires.util';

@Module({
  imports: [
    MailModule,
    BitacoraModule,
    ConfigModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: toJwtExpiresIn(config.get<string>('JWT_EXPIRES_IN'), '15m'),
        },
      }),
    }),
    TypeOrmModule.forFeature([
      Usuarios,
      UsuariosPermisos,
      CodigoAutenticacion,
      Soluciones,
      AsignacionSoluciones,
    ]),
  ],
  controllers: [AuthController, AuthFaceController],
  providers: [AuthService, JwtStrategy, BehaviorIqAuthService],
  exports: [JwtModule],
})
export class AuthModule {}
