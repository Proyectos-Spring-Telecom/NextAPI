import { Module } from '@nestjs/common';
import { ModulosService } from './modulos.service';
import { ModulosController } from './modulos.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Modulos } from 'src/entities/Modulos';
import { Permisos } from 'src/entities/Permisos';
import { BitacoraModule } from 'src/bitacora/bitacora.module';

@Module({
  imports:[TypeOrmModule.forFeature([Modulos,Permisos]),BitacoraModule],
  controllers: [ModulosController],
  providers: [ModulosService],
})
export class ModulosModule {}
