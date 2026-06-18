import { Module } from '@nestjs/common';
import { CatTipoCombustibleModule } from './cat-tipo-combustible/cat-tipo-combustible.module';
import { CatMarcaVehiculoModule } from './cat-marca-vehiculo/cat-marca-vehiculo.module';
import { CatModeloVehiculoModule } from './cat-modelo-vehiculo/cat-modelo-vehiculo.module';
import { CatTipoLicenciaModule } from './cat-tipo-licencia/cat-tipo-licencia.module';
import { CatCategoriaLicenciaModule } from './cat-categoria-licencia/cat-categoria-licencia.module';
import { CatEstatusOperadorModule } from './cat-estatus-operador/cat-estatus-operador.module';
import { CatTipoDispositivoModule } from './cat-tipo-dispositivo/cat-tipo-dispositivo.module';
import { CatMarcaDispositivoModule } from './cat-marca-dispositivo/cat-marca-dispositivo.module';
import { CatModeloDispositivoModule } from './cat-modelo-dispositivo/cat-modelo-dispositivo.module';
import { CatTelefoniaModule } from './cat-telefonia/cat-telefonia.module';
import { CatPlanesTelefoniaModule } from './cat-planes-telefonia/cat-planes-telefonia.module';
import { CatalogosController } from './catalogos.controller';
import { CatalogosService } from './catalogos.service';
import { CatalogosRegistry } from './catalogos.registry';

@Module({
  imports: [
    CatTipoCombustibleModule,
    CatMarcaVehiculoModule,
    CatModeloVehiculoModule,
    CatTipoLicenciaModule,
    CatCategoriaLicenciaModule,
    CatEstatusOperadorModule,
    CatTipoDispositivoModule,
    CatMarcaDispositivoModule,
    CatModeloDispositivoModule,
    CatTelefoniaModule,
    CatPlanesTelefoniaModule,
  ],
  controllers: [CatalogosController],
  providers: [CatalogosService, CatalogosRegistry],
  exports: [CatalogosService],
})
export class CatalogosModule {}
