import { Module } from '@nestjs/common';
import { PermisosService } from './permisos.service';
import { PermisosController } from './permisos.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Permisos } from 'src/entities/Permisos';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { UsuariosPermisos } from 'src/entities/UsuariosPermisos';
import { UsuariosInstalaciones } from 'src/entities/UsuariosInstalaciones';
import { UsuarioPanelAlarma } from 'src/entities/UsuarioPanelAlarma';
import { AsignacionSoluciones } from 'src/entities/AsignacionSoluciones';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Permisos,
      UsuariosPermisos,
      UsuariosInstalaciones,
      UsuarioPanelAlarma,
      AsignacionSoluciones,
    ]),
    BitacoraModule,
  ],
  controllers: [PermisosController],
  providers: [PermisosService],
})
export class PermisosModule {}
