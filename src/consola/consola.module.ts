import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Instalaciones } from 'src/entities/Instalaciones';
import { Posiciones } from 'src/entities/Posiciones';
import { UsuariosInstalaciones } from 'src/entities/UsuariosInstalaciones';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { ConsolaGaleriaController } from './galeria/consola-galeria.controller';
import { ConsolaGaleriaService } from './galeria/consola-galeria.service';
import { ConsolaAlcanceService } from './shared/consola-alcance.service';
import { ConsolaTransmisionesController } from './transmisiones/consola-transmisiones.controller';
import { ConsolaTransmisionesService } from './transmisiones/consola-transmisiones.service';
import { UltimaPosicion } from 'src/entities/UltimaPosicion';
import { ConsolaSinTransmisionController } from './sin-transmision/consola-sin-transmision.controller';
import { ConsolaSinTransmisionService } from './sin-transmision/consola-sin-transmision.service';

/** Consola: Galería de fotos, Transmisiones por IMEI y Sin Transmisión (solo lectura). */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Instalaciones,
      Posiciones,
      UsuariosInstalaciones,
      UltimaPosicion,
    ]),
    TenantFilterModule,
  ],
  controllers: [
    ConsolaGaleriaController,
    ConsolaTransmisionesController,
    ConsolaSinTransmisionController,
  ],
  providers: [
    ConsolaAlcanceService,
    ConsolaGaleriaService,
    ConsolaTransmisionesService,
    ConsolaSinTransmisionService,
  ],
})
export class ConsolaModule {}
