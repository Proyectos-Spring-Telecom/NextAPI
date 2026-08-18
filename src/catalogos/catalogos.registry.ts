import { Injectable } from '@nestjs/common';
import { CatTipoCombustibleService } from './cat-tipo-combustible/cat-tipo-combustible.service';
import { CatTelefoniaService } from './cat-telefonia/cat-telefonia.service';
import { CatPlanesTelefoniaService } from './cat-planes-telefonia/cat-planes-telefonia.service';
import { CatMarcasService } from './cat-marcas/cat-marcas.service';
import { CatModelosService } from './cat-modelos/cat-modelos.service';

@Injectable()
export class CatalogosRegistry {
  private services: Record<string, { findAllList: () => Promise<any> }> = {};

  constructor(
    private readonly catTipoCombustibleService: CatTipoCombustibleService,
    private readonly catTelefoniaService: CatTelefoniaService,
    private readonly catPlanesTelefoniaService: CatPlanesTelefoniaService,
    private readonly catMarcasService: CatMarcasService,
    private readonly catModelosService: CatModelosService,
  ) {
    this.services['cat-tipo-combustible'] = catTipoCombustibleService;
    this.services['cat-telefonia'] = catTelefoniaService;
    this.services['cat-planes-telefonia'] = catPlanesTelefoniaService;
    this.services['cat-marcas'] = catMarcasService;
    this.services['cat-modelos'] = catModelosService;
  }

  getService(nombre: string) {
    return this.services[nombre];
  }

  getRegisteredCatalogs(): string[] {
    return Object.keys(this.services);
  }
}
