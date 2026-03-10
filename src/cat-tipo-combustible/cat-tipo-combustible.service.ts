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
import { CatTipoCombustible } from 'src/entities/CatTipoCombustible';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { CreateCatTipoCombustibleDto } from './dto/create-cat-tipo-combustible.dto';
import { UpdateCatTipoCombustibleDto } from './dto/update-cat-tipo-combustible.dto';
import { UpdateCatTipoCombustibleEstatusDto } from './dto/update-cat-tipo-combustible-estatus.dto';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';

const ID_MODULO_VEHICULOS = 16;

@Injectable()
export class CatTipoCombustibleService {
  constructor(
    @InjectRepository(CatTipoCombustible)
    private readonly repository: Repository<CatTipoCombustible>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  async create(
    dto: CreateCatTipoCombustibleDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const existe = await this.repository.findOne({
        where: { nombre: dto.nombre },
      });
      if (existe) {
        throw new BadRequestException('El tipo de combustible ya existe');
      }
      const entity = this.repository.create({
        ...dto,
        estatus: dto.estatus ?? 1,
      });
      const saved = await this.repository.save(entity);

      await this.bitacoraLogger.logToBitacora(
        'CatTipoCombustible',
        `Se creó el tipo de combustible: ${dto.nombre}`,
        'CREATE',
        { dto },
        idUser,
        ID_MODULO_VEHICULOS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Tipo de combustible creado correctamente',
        data: { id: Number(saved.id), nombre: saved.nombre },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'CatTipoCombustible',
        `Error al crear tipo de combustible: ${dto.nombre}`,
        'CREATE',
        { dto },
        idUser,
        ID_MODULO_VEHICULOS,
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

  async findOne(id: number): Promise<{ data: CatTipoCombustible }> {
    try {
      const entity = await this.repository.findOne({ where: { id } });
      if (!entity) {
        throw new NotFoundException('Tipo de combustible no encontrado');
      }
      return {
        data: { ...entity, id: Number(entity.id) },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { message: 'Error al buscar el tipo de combustible' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(
    id: number,
    dto: UpdateCatTipoCombustibleDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({ where: { id } });
      if (!entity) {
        throw new NotFoundException('Tipo de combustible no encontrado');
      }
      if (dto.nombre && dto.nombre !== entity.nombre) {
        const existe = await this.repository.findOne({
          where: { nombre: dto.nombre },
        });
        if (existe) {
          throw new BadRequestException('El tipo de combustible ya existe');
        }
      }
      await this.repository.update(id, dto);

      await this.bitacoraLogger.logToBitacora(
        'CatTipoCombustible',
        `Se actualizó el tipo de combustible ID: ${id}`,
        'UPDATE',
        { id, dto },
        idUser,
        ID_MODULO_VEHICULOS,
        EstatusEnumBitcora.SUCCESS,
      );

      const updated = await this.repository.findOne({ where: { id } });
      return {
        status: 'success',
        message: 'Tipo de combustible actualizado correctamente',
        data: { id, nombre: updated?.nombre ?? entity.nombre },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'CatTipoCombustible',
        `Error al actualizar tipo de combustible ID: ${id}`,
        'UPDATE',
        { id, dto },
        idUser,
        ID_MODULO_VEHICULOS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async updateEstatus(
    id: number,
    dto: UpdateCatTipoCombustibleEstatusDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({ where: { id } });
      if (!entity) {
        throw new NotFoundException('Tipo de combustible no encontrado');
      }
      await this.repository.update(id, { estatus: dto.estatus });

      await this.bitacoraLogger.logToBitacora(
        'CatTipoCombustible',
        `Se actualizó estatus de tipo de combustible ID: ${id} a ${dto.estatus}`,
        'UPDATE',
        { id, estatus: dto.estatus },
        idUser,
        ID_MODULO_VEHICULOS,
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
        'CatTipoCombustible',
        `Error al actualizar estatus de tipo de combustible ID: ${id}`,
        'UPDATE',
        { id, dto },
        idUser,
        ID_MODULO_VEHICULOS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        `Error al cambiar estatus del tipo de combustible`,
      );
    }
  }
}
