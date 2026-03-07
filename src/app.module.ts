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
import { CatEstatusInstalacionModule } from './cat-estatus-instalacion/cat-estatus-instalacion.module';
import { CatEstatusOperadorModule } from './cat-estatus-operador/cat-estatus-operador.module';
import { CatEstatusSimModule } from './cat-estatus-sim/cat-estatus-sim.module';
import { CatEstatusVehiculoModule } from './cat-estatus-vehiculo/cat-estatus-vehiculo.module';
import Joi from 'joi';

@Module({
  imports: [
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

    CatEstatusInstalacionModule,

    CatEstatusOperadorModule,

    CatEstatusSimModule,

    CatEstatusVehiculoModule,
  ],
})
export class AppModule {}
