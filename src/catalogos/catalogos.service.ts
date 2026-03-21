import { Injectable, NotFoundException } from '@nestjs/common';
import { CatalogosRegistry } from './catalogos.registry';

@Injectable()
export class CatalogosService {
  constructor(private readonly registry: CatalogosRegistry) {}

  async findCatalogo(nombreCatalogo: string) {
    const service = this.registry.getService(nombreCatalogo);
    if (!service) {
      throw new NotFoundException(`Catálogo ${nombreCatalogo} no encontrado.`);
    }
    return service.findAllList();
  }
}
