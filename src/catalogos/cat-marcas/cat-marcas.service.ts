import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import { EnumModulos, EstatusEnum } from 'src/common/estatus.enum';
import { CatMarcas } from 'src/entities/CatMarcas';
import { CatModelos } from 'src/entities/CatModelos';
import { CatProductos } from 'src/entities/CatProductos';
import { CreateCatMarcasDto } from './dto/create-cat-marcas.dto';
import { UpdateCatMarcasDto } from './dto/update-cat-marcas.dto';

@Injectable()
export class CatMarcasService {
  constructor(
    @InjectRepository(CatMarcas)
    private readonly repository: Repository<CatMarcas>,
    @InjectRepository(CatProductos)
    private readonly catProductosRepo: Repository<CatProductos>,
    @InjectRepository(CatModelos)
    private readonly catModelosRepo: Repository<CatModelos>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  private mapMarca(item: CatMarcas) {
    const { idProducto2, ...marca } = item;
    return {
      ...marca,
      id: Number(item.id),
      idProducto: Number(item.idProducto),
      producto: idProducto2
        ? {
            id: Number(idProducto2.id),
            nombre: idProducto2.nombre,
          }
        : null,
    };
  }

  private async assertProductoExiste(idProducto: number): Promise<void> {
    const producto = await this.catProductosRepo.findOne({
      where: { id: idProducto },
    });
    if (!producto) {
      throw new BadRequestException('IdProducto no existe en CatProductos');
    }
  }

  private async assertNombreDisponible(
    nombre: string,
    excludeId?: number,
  ): Promise<void> {
    const existente = await this.repository.findOne({ where: { nombre } });
    if (existente && existente.id !== excludeId) {
      throw new ConflictException('El nombre de la marca ya existe');
    }
  }

  async create(
    dto: CreateCatMarcasDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      await this.assertProductoExiste(dto.idProducto);
      await this.assertNombreDisponible(dto.nombre);

      const saved = await this.repository.save(
        this.repository.create({
          nombre: dto.nombre,
          idProducto: dto.idProducto,
          estatus: EstatusEnum.ACTIVO,
        }),
      );

      await this.bitacoraLogger.logToBitacora(
        'CatMarcas',
        `Se creó la marca: ${dto.nombre}`,
        'CREATE',
        { dto },
        idUser,
        EnumModulos.VEHICULOS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Marca creada correctamente',
        data: { id: Number(saved.id), nombre: saved.nombre },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'CatMarcas',
        `Error al crear marca: ${dto.nombre}`,
        'CREATE',
        { dto },
        idUser,
        EnumModulos.VEHICULOS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findAllList(idProducto?: number): Promise<ApiResponseCommon> {
    try {
      const where: FindOptionsWhere<CatMarcas> = {
        estatus: 1,
        ...(idProducto != null ? { idProducto } : {}),
      };
      const data = await this.repository.find({
        where,
        relations: ['idProducto2'],
        order: { id: 'ASC' },
      });
      return { data: data.map((item) => this.mapMarca(item)) };
    } catch (error) {
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findAll(
    page: number,
    limit: number,
    idProducto?: number,
  ): Promise<ApiResponseCommon> {
    try {
      const where: FindOptionsWhere<CatMarcas> = {
        ...(idProducto != null ? { idProducto } : {}),
      };
      const [data, total] = await this.repository.findAndCount({
        where,
        relations: ['idProducto2'],
        skip: (page - 1) * limit,
        take: limit,
        order: { id: 'ASC' },
      });
      return {
        data: data.map((item) => this.mapMarca(item)),
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

  async findOne(id: number) {
    try {
      const entity = await this.repository.findOne({
        where: { id },
        relations: ['idProducto2'],
      });
      if (!entity) {
        throw new NotFoundException('Marca no encontrada');
      }
      return { data: this.mapMarca(entity) };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Error al buscar la marca');
    }
  }

  async findModelosByMarca(id: number, soloActivos = true) {
    await this.findOne(id);
    const where: FindOptionsWhere<CatModelos> = {
      idCatMarcas: id,
      ...(soloActivos ? { estatus: 1 } : {}),
    };
    const data = await this.catModelosRepo.find({
      where,
      order: { id: 'ASC' },
    });
    return {
      data: data.map((item) => ({
        ...item,
        id: Number(item.id),
        idCatMarcas: Number(item.idCatMarcas),
      })),
    };
  }

  async update(
    id: number,
    dto: UpdateCatMarcasDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({ where: { id } });
      if (!entity) {
        throw new NotFoundException('Marca no encontrada');
      }
      if (dto.idProducto !== undefined) {
        await this.assertProductoExiste(dto.idProducto);
      }
      if (dto.nombre && dto.nombre !== entity.nombre) {
        await this.assertNombreDisponible(dto.nombre, id);
      }

      await this.repository.update(id, dto);
      const updated = await this.repository.findOne({ where: { id } });

      await this.bitacoraLogger.logToBitacora(
        'CatMarcas',
        `Se actualizó la marca ID: ${id}`,
        'UPDATE',
        { id, dto },
        idUser,
        EnumModulos.VEHICULOS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Marca actualizada correctamente',
        data: { id, nombre: updated?.nombre ?? entity.nombre },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'CatMarcas',
        `Error al actualizar marca ID: ${id}`,
        'UPDATE',
        { id, dto },
        idUser,
        EnumModulos.VEHICULOS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async updateEstatus(id: number, idUser: number): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({ where: { id } });
      if (!entity) {
        throw new NotFoundException('Marca no encontrada');
      }
      const estatusAnterior = Number(entity.estatus) === 1 ? 1 : 0;
      const estatus = estatusAnterior === 1 ? 0 : 1;
      await this.repository.update(id, { estatus });

      await this.bitacoraLogger.logToBitacora(
        'CatMarcas',
        `Se actualizó estatus de marca ID: ${id} a ${estatus}`,
        'UPDATE',
        { id, estatusAnterior, estatus },
        idUser,
        EnumModulos.VEHICULOS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Estatus actualizado correctamente',
        estatus: { estatus },
        data: { id, nombre: entity.nombre },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'CatMarcas',
        `Error al actualizar estatus de marca ID: ${id}`,
        'UPDATE',
        { id },
        idUser,
        EnumModulos.VEHICULOS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Error al cambiar estatus de la marca',
      );
    }
  }
}
