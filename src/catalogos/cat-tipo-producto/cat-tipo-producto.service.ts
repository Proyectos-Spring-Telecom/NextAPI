import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatTipoProducto } from 'src/entities/CatTipoProducto';
import { ApiResponseCommon } from 'src/common/ApiResponse';

/** Catálogo de solo lectura (1 Vehículo, 2 Activo, 3 Inmueble, 4 Persona). */
@Injectable()
export class CatTipoProductoService {
  constructor(
    @InjectRepository(CatTipoProducto)
    private readonly repository: Repository<CatTipoProducto>,
  ) {}

  async findAllList(soloActivos = true): Promise<ApiResponseCommon> {
    try {
      const data = await this.repository.find({
        where: soloActivos ? { estatus: 1 } : {},
        order: { id: 'ASC' },
      });
      return { data: data.map((item) => ({ ...item, id: Number(item.id) })) };
    } catch (error) {
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findOne(id: number): Promise<{ data: CatTipoProducto }> {
    try {
      const item = await this.repository.findOne({ where: { id } });
      if (!item) {
        throw new NotFoundException('Tipo de producto no encontrado');
      }
      return { data: { ...item, id: Number(item.id) } };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }
}
