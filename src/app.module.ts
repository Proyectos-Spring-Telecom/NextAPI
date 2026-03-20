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
import { CatCategoriaLicenciaModule } from './cat-categoria-licencia/cat-categoria-licencia.module';
import { CatEstatusDispositivoModule } from './cat-estatus-dispositivo/cat-estatus-dispositivo.module';
import { CatMarcaDispositivoModule } from './cat-marca-dispositivo/cat-marca-dispositivo.module';
import { CatModeloDispositivoModule } from './cat-modelo-dispositivo/cat-modelo-dispositivo.module';
import { CatEstatusInstalacionModule } from './cat-estatus-instalacion/cat-estatus-instalacion.module';
import { CatEstatusOperadorModule } from './cat-estatus-operador/cat-estatus-operador.module';
import { CatEstatusSimModule } from './cat-estatus-sim/cat-estatus-sim.module';
import { CatTelefoniaModule } from './cat-telefonia/cat-telefonia.module';
import { CatPlanesTelefoniaModule } from './cat-planes-telefonia/cat-planes-telefonia.module';
import { CatEstatusVehiculoModule } from './cat-estatus-vehiculo/cat-estatus-vehiculo.module';
import { CatMarcaVehiculoModule } from './cat-marca-vehiculo/cat-marca-vehiculo.module';
import { CatModeloVehiculoModule } from './cat-modelo-vehiculo/cat-modelo-vehiculo.module';
import { CatReferenciaServicioModule } from './cat-referencia-servicio/cat-referencia-servicio.module';
import { CatTipoAlertaModule } from './cat-tipo-alerta/cat-tipo-alerta.module';
import { CatTipoCombustibleModule } from './cat-tipo-combustible/cat-tipo-combustible.module';
import { CatTipoDispositivoModule } from './cat-tipo-dispositivo/cat-tipo-dispositivo.module';
import { CatTipoGeocercaModule } from './cat-tipo-geocerca/cat-tipo-geocerca.module';
import { CatTipoLicenciaModule } from './cat-tipo-licencia/cat-tipo-licencia.module';
import { CatTipoVehiculoModule } from './cat-tipo-vehiculo/cat-tipo-vehiculo.module';
import { CatTipoVerificacionesModule } from './cat-tipo-verificaciones/cat-tipo-verificaciones.module';
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
            const decoded: any = jwt.verify(
              token,
              process.env.JWT_SECRET as string,
            );
            return `userId:${decoded?.id ?? decoded?.userId ?? 'unknown'}`;
          }
        } catch {}

        const userName = req?.body?.userName;
        if (userName) return `userName:${userName}`;

        const refreshToken = req?.body?.refreshToken;
        if (refreshToken) {
          try {
            const decoded: any = jwt.verify(
              refreshToken,
              process.env.JWT_REFRESH_SECRET as string,
            );
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
        timezone: 'Z',
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

    CatCategoriaLicenciaModule,

    CatEstatusDispositivoModule,

    CatMarcaDispositivoModule,

    CatModeloDispositivoModule,

    CatEstatusInstalacionModule,

    CatEstatusOperadorModule,

    CatEstatusSimModule,

    CatTelefoniaModule,

    CatPlanesTelefoniaModule,

    CatEstatusVehiculoModule,

    CatMarcaVehiculoModule,

    CatModeloVehiculoModule,

    CatReferenciaServicioModule,

    CatTipoAlertaModule,

    CatTipoCombustibleModule,

    CatTipoDispositivoModule,

    CatTipoGeocercaModule,

    CatTipoLicenciaModule,

    CatTipoVehiculoModule,

    CatTipoVerificacionesModule,

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
