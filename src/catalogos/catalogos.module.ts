import { Module } from '@nestjs/common';
import { CatTipoCombustibleModule } from './cat-tipo-combustible/cat-tipo-combustible.module';
import { CatTelefoniaModule } from './cat-telefonia/cat-telefonia.module';
import { CatPlanesTelefoniaModule } from './cat-planes-telefonia/cat-planes-telefonia.module';
import { CatMarcasModule } from './cat-marcas/cat-marcas.module';
import { CatModelosModule } from './cat-modelos/cat-modelos.module';
import { CatalogosController } from './catalogos.controller';
import { CatalogosService } from './catalogos.service';
import { CatalogosRegistry } from './catalogos.registry';

@Module({
  imports: [
    CatTipoCombustibleModule,
    CatTelefoniaModule,
    CatPlanesTelefoniaModule,
    CatMarcasModule,
    CatModelosModule,
  ],
  controllers: [CatalogosController],
  providers: [CatalogosService, CatalogosRegistry],
  exports: [CatalogosService],
})
export class CatalogosModule {}
