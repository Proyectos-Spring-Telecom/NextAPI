import { Injectable } from '@nestjs/common';
import { CatTipoCombustibleService } from './cat-tipo-combustible/cat-tipo-combustible.service';
import { CatEstatusOperadorService } from './cat-estatus-operador/cat-estatus-operador.service';
import { CatTelefoniaService } from './cat-telefonia/cat-telefonia.service';
import { CatPlanesTelefoniaService } from './cat-planes-telefonia/cat-planes-telefonia.service';

@Injectable()
export class CatalogosRegistry {
  private services: Record<string, { findAllList: (soloActivos?: boolean) => Promise<any> }> = {};

  constructor(
    private readonly catTipoCombustibleService: CatTipoCombustibleService,
    private readonly catEstatusOperadorService: CatEstatusOperadorService,
    private readonly catTelefoniaService: CatTelefoniaService,
    private readonly catPlanesTelefoniaService: CatPlanesTelefoniaService,
  ) {
    this.services['cat-tipo-combustible'] = catTipoCombustibleService;
    this.services['cat-estatus-operador'] = catEstatusOperadorService;
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
