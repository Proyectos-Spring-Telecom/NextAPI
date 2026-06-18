import { Injectable } from '@nestjs/common';
import { CatTipoCombustibleService } from './cat-tipo-combustible/cat-tipo-combustible.service';
import { CatMarcaVehiculoService } from './cat-marca-vehiculo/cat-marca-vehiculo.service';
import { CatModeloVehiculoService } from './cat-modelo-vehiculo/cat-modelo-vehiculo.service';
import { CatTipoLicenciaService } from './cat-tipo-licencia/cat-tipo-licencia.service';
import { CatCategoriaLicenciaService } from './cat-categoria-licencia/cat-categoria-licencia.service';
import { CatEstatusOperadorService } from './cat-estatus-operador/cat-estatus-operador.service';
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
    private readonly catMarcaVehiculoService: CatMarcaVehiculoService,
    private readonly catModeloVehiculoService: CatModeloVehiculoService,
    private readonly catTipoLicenciaService: CatTipoLicenciaService,
    private readonly catCategoriaLicenciaService: CatCategoriaLicenciaService,
    private readonly catEstatusOperadorService: CatEstatusOperadorService,
    private readonly catTipoDispositivoService: CatTipoDispositivoService,
    private readonly catMarcaDispositivoService: CatMarcaDispositivoService,
    private readonly catModeloDispositivoService: CatModeloDispositivoService,
    private readonly catTelefoniaService: CatTelefoniaService,
    private readonly catPlanesTelefoniaService: CatPlanesTelefoniaService,
  ) {
    this.services['cat-tipo-combustible'] = catTipoCombustibleService;
    this.services['cat-marca-vehiculo'] = catMarcaVehiculoService;
    this.services['cat-modelo-vehiculo'] = catModeloVehiculoService;
    this.services['cat-tipo-licencia'] = catTipoLicenciaService;
    this.services['cat-categoria-licencia'] = catCategoriaLicenciaService;
    this.services['cat-estatus-operador'] = catEstatusOperadorService;
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
