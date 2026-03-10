import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CatTipoLicencia } from 'src/entities/CatTipoLicencia';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { CreateCatTipoLicenciaDto } from './dto/create-cat-tipo-licencia.dto';
import { UpdateCatTipoLicenciaDto } from './dto/update-cat-tipo-licencia.dto';
import { UpdateCatTipoLicenciaEstatusDto } from './dto/update-cat-tipo-licencia-estatus.dto';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';

const ID_MODULO_LICENCIAS = 19;

@Injectable()
export class CatTipoLicenciaService {
  constructor(
    @InjectRepository(CatTipoLicencia)
    private readonly repository: Repository<CatTipoLicencia>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  async create(
    dto: CreateCatTipoLicenciaDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const existe = await this.repository.findOne({
        where: { nombre: dto.nombre },
      });
      if (existe) {
        throw new BadRequestException('El tipo de licencia ya existe');
      }
      const entity = this.repository.create({
        ...dto,
        estatus: dto.estatus ?? 1,
      });
      const saved = await this.repository.save(entity);

      await this.bitacoraLogger.logToBitacora(
        'CatTipoLicencia',
        `Se creó el tipo de licencia: ${dto.nombre}`,
        'CREATE',
        { dto },
        idUser,
        ID_MODULO_LICENCIAS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Tipo de licencia creado correctamente',
        data: { id: Number(saved.id), nombre: saved.nombre },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'CatTipoLicencia',
        `Error al crear tipo de licencia: ${dto.nombre}`,
        'CREATE',
        { dto },
        idUser,
        ID_MODULO_LICENCIAS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findAllList(soloActivos = true): Promise<ApiResponseCommon> {
    try {
      const where = soloActivos ? { estatus: 1 } : {};
      const data = await this.repository.find({
        where,
        order: { id: 'ASC' },
      });
      const dataNormalizada = data.map((item) => ({
        ...item,
        id: Number(item.id),
      }));
      return { data: dataNormalizada };
    } catch (error) {
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findAll(
    page: number,
    limit: number,
    soloActivos = false,
  ): Promise<ApiResponseCommon> {
    try {
      const where = soloActivos ? { estatus: 1 } : {};
      const [data, total] = await this.repository.findAndCount({
        where,
        skip: (page - 1) * limit,
        take: limit,
        order: { id: 'ASC' },
      });
      const dataNormalizada = data.map((item) => ({
        ...item,
        id: Number(item.id),
      }));
      return {
        data: dataNormalizada,
        paginated: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findOne(id: number): Promise<{ data: CatTipoLicencia }> {
    try {
      const entity = await this.repository.findOne({ where: { id } });
      if (!entity) {
        throw new NotFoundException('Tipo de licencia no encontrado');
      }
      return {
        data: { ...entity, id: Number(entity.id) },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { message: 'Error al buscar el tipo de licencia' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(
    id: number,
    dto: UpdateCatTipoLicenciaDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({ where: { id } });
      if (!entity) {
        throw new NotFoundException('Tipo de licencia no encontrado');
      }
      if (dto.nombre && dto.nombre !== entity.nombre) {
        const existe = await this.repository.findOne({
          where: { nombre: dto.nombre },
        });
        if (existe) {
          throw new BadRequestException('El tipo de licencia ya existe');
        }
      }
      await this.repository.update(id, dto);

      await this.bitacoraLogger.logToBitacora(
        'CatTipoLicencia',
        `Se actualizó el tipo de licencia ID: ${id}`,
        'UPDATE',
        { id, dto },
        idUser,
        ID_MODULO_LICENCIAS,
        EstatusEnumBitcora.SUCCESS,
      );

      const updated = await this.repository.findOne({ where: { id } });
      return {
        status: 'success',
        message: 'Tipo de licencia actualizado correctamente',
        data: { id, nombre: updated?.nombre ?? entity.nombre },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'CatTipoLicencia',
        `Error al actualizar tipo de licencia ID: ${id}`,
        'UPDATE',
        { id, dto },
        idUser,
        ID_MODULO_LICENCIAS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async updateEstatus(
    id: number,
    dto: UpdateCatTipoLicenciaEstatusDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({ where: { id } });
      if (!entity) {
        throw new NotFoundException('Tipo de licencia no encontrado');
      }
      await this.repository.update(id, { estatus: dto.estatus });

      await this.bitacoraLogger.logToBitacora(
        'CatTipoLicencia',
        `Se actualizó estatus de tipo de licencia ID: ${id} a ${dto.estatus}`,
        'UPDATE',
        { id, estatus: dto.estatus },
        idUser,
        ID_MODULO_LICENCIAS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Estatus actualizado correctamente',
        estatus: { estatus: dto.estatus },
        data: { id, nombre: entity.nombre },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'CatTipoLicencia',
        `Error al actualizar estatus de tipo de licencia ID: ${id}`,
        'UPDATE',
        { id, dto },
        idUser,
        ID_MODULO_LICENCIAS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        `Error al cambiar estatus del tipo de licencia`,
      );
    }
  }
}
