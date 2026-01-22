//Modulo Usuario
import { Module } from '@nestjs/common';
import { UsuariosService } from './usuarios.service';
import { UsuariosController } from './usuarios.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuarios } from 'src/entities/Usuarios';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { ClientesModule } from 'src/clientes/clientes.module';
import { PermisosModule } from 'src/permisos/permisos.module';
import { UsuariosPermisos } from 'src/entities/UsuariosPermisos';
import { MailModule } from 'src/mail/mail.module';
import { AuthModule } from 'src/auth/auth.module';
import { Clientes } from 'src/entities/Clientes';

@Module({
  imports: [
    TypeOrmModule.forFeature([Usuarios, UsuariosPermisos, Clientes]),
    BitacoraModule,
    ClientesModule,
    PermisosModule,
    MailModule,
    AuthModule
  ],
  controllers: [UsuariosController],
  providers: [UsuariosService],
})
export class UsuariosModule { }
