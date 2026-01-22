import { Module } from '@nestjs/common';
import { PermisosService } from './permisos.service';
import { PermisosController } from './permisos.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permisos } from 'src/entities/Permisos';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { UsuariosPermisos } from 'src/entities/UsuariosPermisos';

@Module({
  imports: [
    TypeOrmModule.forFeature([Permisos, UsuariosPermisos]),
    BitacoraModule,
  ],
  controllers: [PermisosController],
  providers: [PermisosService],
})
export class PermisosModule {}
