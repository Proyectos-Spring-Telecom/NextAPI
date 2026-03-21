import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsuariosModule } from './usuarios/usuarios.module';
import { AuthModule } from './auth/auth.module';
import { BitacoraModule } from './bitacora/bitacora.module';
import { ClientesModule } from './clientes/clientes.module';
import { ModulosModule } from './modulos/modulos.module';
import { PermisosModule } from './permisos/permisos.module';
import { RolesModule } from './roles/roles.module';
import { S3Module } from './s3/s3.module';
import { MailModule } from './mail/mail.module';
import { CatalogosModule } from './catalogos/catalogos.module';
import { SimsModule } from './sims/sims.module';
import { DispositivosModule } from './dispositivos/dispositivos.module';
import { InstalacionesModule } from './instalaciones/instalaciones.module';
import { OperadoresModule } from './operadores/operadores.module';
import { VehiculosModule } from './vehiculos/vehiculos.module';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import Joi from 'joi';
import * as jwt from 'jsonwebtoken';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60000, limit: 100 }],
      // Evita rate limiting por IP: genera una clave por usuario.
      // Orden de prioridad:
      // 1) JWT access token (Authorization Bearer) -> userId
      // 2) userName en body (login/verify/recuperación)
      // 3) JWT refresh token en body -> userId
      // 4) fallback a IP
      keyGenerator: (req: any) => {
        try {
          const authHeader = req?.headers?.authorization as string | undefined;
          if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.slice('Bearer '.length);
            const decoded: any = jwt.decode(token);
            return `userId:${decoded?.id ?? decoded?.userId ?? 'unknown'}`;
          }
        } catch {}

        const userName = req?.body?.userName;
        if (userName) return `userName:${userName}`;

        const refreshToken = req?.body?.refreshToken;
        if (refreshToken) {
          try {
            const decoded: any = jwt.decode(refreshToken);
            return `userId:${decoded?.id ?? decoded?.userId ?? 'unknown'}`;
          } catch {}
        }

        return `ip:${req?.ip ?? 'unknown'}`;
      },
    } as any),
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        DB_HOST: Joi.string().required(),
        DB_PORT: Joi.number().default(3306),
        DB_USER: Joi.string().required(),
        DB_PASSWORD: Joi.string().allow(''), // Puede estar vacío si no hay pass
        DB_DATABASE: Joi.string().required(),
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRES_IN: Joi.string().required(),
        JWT_REFRESH_SECRET: Joi.string().required(),
        JWT_REFRESH_EXPIRES_IN: Joi.string().required(),
        // Throttling (Auth) - defaults alineados a FLUJO-SEGURIDAD-AUTH.md
        THROTTLE_LOGIN_LIMIT: Joi.number().required(),
        THROTTLE_LOGIN_TTL_MS: Joi.number().required(),
        THROTTLE_PIN_LIMIT: Joi.number().required(),
        THROTTLE_PIN_TTL_MS: Joi.number().required(),
        THROTTLE_VERIFY_LIMIT: Joi.number().required(),
        THROTTLE_VERIFY_TTL_MS: Joi.number().required(),
        THROTTLE_RECUPERACION_LIMIT: Joi.number().required(),
        THROTTLE_RECUPERACION_TTL_MS: Joi.number().required(),
        THROTTLE_RECUPERACION_CONFIRMACION_LIMIT: Joi.number().required(),
        THROTTLE_RECUPERACION_CONFIRMACION_TTL_MS: Joi.number().required(),
        THROTTLE_REFRESH_LIMIT: Joi.number().required(),
        THROTTLE_REFRESH_TTL_MS: Joi.number().required(),
        THROTTLE_LOGOUT_LIMIT: Joi.number().required(),
        THROTTLE_LOGOUT_TTL_MS: Joi.number().required(),
        AWS_REGION: Joi.string().required(),
        AWS_ACCESS_KEY_ID: Joi.string().required(),
        AWS_SECRET_ACCESS_KEY: Joi.string().required(),
        AWS_S3_BUCKET: Joi.string().required(),
        UPLOAD_MAX_SIZE: Joi.string().required(),
        HOST: Joi.string().required(),
        SMTP: Joi.number().required(),
        E_MAIL: Joi.string().required(),
        MAIL_PASSWORD: Joi.string().required(),
        MAIL_FRONTEND_URL: Joi.string().optional(),
      }),
    }),

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'mysql',
        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT'),
        username: config.get<string>('DB_USER'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_DATABASE'),
        autoLoadEntities: false,
        entities: [__dirname + '/entities/*{.ts,.js}'],
        synchronize: false, //Nunca poner en true
        dateStrings: false,
        timezone: '-06:00',
        extra: {
          // Evita que bigint se devuelvan como string
          decimalNumbers: true,
        },
      }),
    }),

    UsuariosModule,

    AuthModule,

    BitacoraModule,

    ClientesModule,

    PermisosModule,

    RolesModule,

    S3Module,

    MailModule,

    ModulosModule,

    CatalogosModule,

    SimsModule,

    DispositivosModule,

    InstalacionesModule,

    OperadoresModule,

    VehiculosModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
