import { Module } from '@nestjs/common';
import { CatTipoCombustibleModule } from './cat-tipo-combustible/cat-tipo-combustible.module';
import { CatTipoVehiculoModule } from './cat-tipo-vehiculo/cat-tipo-vehiculo.module';
import { CatEstatusVehiculoModule } from './cat-estatus-vehiculo/cat-estatus-vehiculo.module';
import { CatMarcaVehiculoModule } from './cat-marca-vehiculo/cat-marca-vehiculo.module';
import { CatModeloVehiculoModule } from './cat-modelo-vehiculo/cat-modelo-vehiculo.module';
import { CatTipoLicenciaModule } from './cat-tipo-licencia/cat-tipo-licencia.module';
import { CatCategoriaLicenciaModule } from './cat-categoria-licencia/cat-categoria-licencia.module';
import { CatTipoAlertaModule } from './cat-tipo-alerta/cat-tipo-alerta.module';
import { CatTipoGeocercaModule } from './cat-tipo-geocerca/cat-tipo-geocerca.module';
import { CatTipoVerificacionesModule } from './cat-tipo-verificaciones/cat-tipo-verificaciones.module';
import { CatReferenciaServicioModule } from './cat-referencia-servicio/cat-referencia-servicio.module';
import { CatEstatusOperadorModule } from './cat-estatus-operador/cat-estatus-operador.module';
import { CatEstatusSimModule } from './cat-estatus-sim/cat-estatus-sim.module';
import { CatEstatusInstalacionModule } from './cat-estatus-instalacion/cat-estatus-instalacion.module';
import { CatEstatusDispositivoModule } from './cat-estatus-dispositivo/cat-estatus-dispositivo.module';
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
    CatTipoVehiculoModule,
    CatEstatusVehiculoModule,
    CatMarcaVehiculoModule,
    CatModeloVehiculoModule,
    CatTipoLicenciaModule,
    CatCategoriaLicenciaModule,
    CatTipoAlertaModule,
    CatTipoGeocercaModule,
    CatTipoVerificacionesModule,
    CatReferenciaServicioModule,
    CatEstatusOperadorModule,
    CatEstatusSimModule,
    CatEstatusInstalacionModule,
    CatEstatusDispositivoModule,
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
