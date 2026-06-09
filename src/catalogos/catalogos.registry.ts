import { Injectable } from '@nestjs/common';
import { CatTipoCombustibleService } from './cat-tipo-combustible/cat-tipo-combustible.service';
import { CatTipoVehiculoService } from './cat-tipo-vehiculo/cat-tipo-vehiculo.service';
import { CatEstatusVehiculoService } from './cat-estatus-vehiculo/cat-estatus-vehiculo.service';
import { CatMarcaVehiculoService } from './cat-marca-vehiculo/cat-marca-vehiculo.service';
import { CatModeloVehiculoService } from './cat-modelo-vehiculo/cat-modelo-vehiculo.service';
import { CatTipoLicenciaService } from './cat-tipo-licencia/cat-tipo-licencia.service';
import { CatCategoriaLicenciaService } from './cat-categoria-licencia/cat-categoria-licencia.service';
import { CatTipoAlertaService } from './cat-tipo-alerta/cat-tipo-alerta.service';
import { CatEstatusOperadorService } from './cat-estatus-operador/cat-estatus-operador.service';
import { CatEstatusInstalacionService } from './cat-estatus-instalacion/cat-estatus-instalacion.service';
import { CatTipoDispositivoService } from './cat-tipo-dispositivo/cat-tipo-dispositivo.service';
import { CatMarcaDispositivoService } from './cat-marca-dispositivo/cat-marca-dispositivo.service';
import { CatModeloDispositivoService } from './cat-modelo-dispositivo/cat-modelo-dispositivo.service';
import { CatTelefoniaService } from './cat-telefonia/cat-telefonia.service';
import { CatPlanesTelefoniaService } from './cat-planes-telefonia/cat-planes-telefonia.service';

@Injectable()
export class CatalogosRegistry {
  private services: Record<string, { findAllList: (soloActivos?: boolean) => Promise<any> }> = {};

  constructor(
    private readonly catTipoCombustibleService: CatTipoCombustibleService,
    private readonly catTipoVehiculoService: CatTipoVehiculoService,
    private readonly catEstatusVehiculoService: CatEstatusVehiculoService,
    private readonly catMarcaVehiculoService: CatMarcaVehiculoService,
    private readonly catModeloVehiculoService: CatModeloVehiculoService,
    private readonly catTipoLicenciaService: CatTipoLicenciaService,
    private readonly catCategoriaLicenciaService: CatCategoriaLicenciaService,
    private readonly catTipoAlertaService: CatTipoAlertaService,
    private readonly catEstatusOperadorService: CatEstatusOperadorService,
    private readonly catEstatusInstalacionService: CatEstatusInstalacionService,
    private readonly catTipoDispositivoService: CatTipoDispositivoService,
    private readonly catMarcaDispositivoService: CatMarcaDispositivoService,
    private readonly catModeloDispositivoService: CatModeloDispositivoService,
    private readonly catTelefoniaService: CatTelefoniaService,
    private readonly catPlanesTelefoniaService: CatPlanesTelefoniaService,
  ) {
    this.services['cat-tipo-combustible'] = catTipoCombustibleService;
    this.services['cat-tipo-vehiculo'] = catTipoVehiculoService;
    this.services['cat-estatus-vehiculo'] = catEstatusVehiculoService;
    this.services['cat-marca-vehiculo'] = catMarcaVehiculoService;
    this.services['cat-modelo-vehiculo'] = catModeloVehiculoService;
    this.services['cat-tipo-licencia'] = catTipoLicenciaService;
    this.services['cat-categoria-licencia'] = catCategoriaLicenciaService;
    this.services['cat-tipo-alerta'] = catTipoAlertaService;
    this.services['cat-estatus-operador'] = catEstatusOperadorService;
    this.services['cat-estatus-instalacion'] = catEstatusInstalacionService;
    this.services['cat-tipo-dispositivo'] = catTipoDispositivoService;
    this.services['cat-marca-dispositivo'] = catMarcaDispositivoService;
    this.services['cat-modelo-dispositivo'] = catModeloDispositivoService;
    this.services['cat-telefonia'] = catTelefoniaService;
    this.services['cat-planes-telefonia'] = catPlanesTelefoniaService;
  }

  getService(nombre: string) {
    return this.services[nombre];
  }

  getRegisteredCatalogs(): string[] {
    return Object.keys(this.services);
  }
}
