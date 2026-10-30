import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatTipoDispositivo } from 'src/entities/CatTipoDispositivo';
import { ApiResponseCommon } from 'src/common/ApiResponse';

/** Catálogo de solo lectura (1 Rastreador, 2 Panel alarma, 3 AVL, 4 Teléfono, 5 TrackCam, 6 TrackGas). */
@Injectable()
export class CatTipoDispositivoService {
  constructor(
    @InjectRepository(CatTipoDispositivo)
    private readonly repository: Repository<CatTipoDispositivo>,
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

  async findOne(id: number): Promise<{ data: CatTipoDispositivo }> {
    try {
      const item = await this.repository.findOne({ where: { id } });
      if (!item) {
        throw new NotFoundException('Tipo de dispositivo no encontrado');
      }
      return { data: { ...item, id: Number(item.id) } };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }
}
