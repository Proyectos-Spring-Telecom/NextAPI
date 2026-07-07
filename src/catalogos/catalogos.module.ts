import { Module } from '@nestjs/common';
import { CatTipoCombustibleModule } from './cat-tipo-combustible/cat-tipo-combustible.module';
import { CatEstatusOperadorModule } from './cat-estatus-operador/cat-estatus-operador.module';
import { CatTelefoniaModule } from './cat-telefonia/cat-telefonia.module';
import { CatPlanesTelefoniaModule } from './cat-planes-telefonia/cat-planes-telefonia.module';
import { CatalogosController } from './catalogos.controller';
import { CatalogosService } from './catalogos.service';
import { CatalogosRegistry } from './catalogos.registry';

@Module({
  imports: [
    CatTipoCombustibleModule,
    CatEstatusOperadorModule,
    CatTelefoniaModule,
    CatPlanesTelefoniaModule,
  ],
  controllers: [CatalogosController],
  providers: [CatalogosService, CatalogosRegistry],
  exports: [CatalogosService],
})
export class CatalogosModule {}
