import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatProductos } from 'src/entities/CatProductos';
import { ApiResponseCommon } from 'src/common/ApiResponse';

/** Catálogo de solo lectura `CatProductos` (producto al que pertenece cada marca). Sin columna Estatus. */
@Injectable()
export class CatProductosService {
  constructor(
    @InjectRepository(CatProductos)
    private readonly repository: Repository<CatProductos>,
  ) {}

  async findAllList(): Promise<ApiResponseCommon> {
    try {
      const data = await this.repository.find({
        order: { id: 'ASC' },
      });
      return { data: data.map((item) => ({ ...item, id: Number(item.id) })) };
    } catch (error) {
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findOne(id: number): Promise<{ data: CatProductos }> {
    try {
      const item = await this.repository.findOne({ where: { id } });
      if (!item) {
        throw new NotFoundException('Producto no encontrado');
      }
      return { data: { ...item, id: Number(item.id) } };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }
}
