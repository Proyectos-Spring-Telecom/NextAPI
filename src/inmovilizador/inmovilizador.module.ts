import { Module } from '@nestjs/common';
import { BitacoraModule } from 'src/bitacora/bitacora.module';
import { ComandosModule } from 'src/comandos/comandos.module';
import { TenantFilterModule } from 'src/common/tenant-filter/tenant-filter.module';
import { InmovilizadorController } from './inmovilizador.controller';
import { InmovilizadorService } from './inmovilizador.service';

/** Paro y reanudación de motor por la cola de comandos (docs/fis-fiber, ruta del back §3.10). */
@Module({
  imports: [ComandosModule, TenantFilterModule, BitacoraModule],
  controllers: [InmovilizadorController],
  providers: [InmovilizadorService],
})
export class InmovilizadorModule {}
