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
import { CreateCatModelosDto } from './dto/create-cat-modelos.dto';
import { UpdateCatModelosDto } from './dto/update-cat-modelos.dto';

@Injectable()
export class CatModelosService {
  constructor(
    @InjectRepository(CatModelos)
    private readonly repository: Repository<CatModelos>,
    @InjectRepository(CatMarcas)
    private readonly catMarcasRepo: Repository<CatMarcas>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  private mapModelo(item: CatModelos) {
    const { idCatMarcas2, ...modelo } = item;
    return {
      ...modelo,
      id: Number(item.id),
      idCatMarcas: Number(item.idCatMarcas),
      marca: idCatMarcas2
        ? {
            id: Number(idCatMarcas2.id),
            nombre: idCatMarcas2.nombre,
            idProducto: Number(idCatMarcas2.idProducto),
          }
        : null,
    };
  }

  private async assertMarcaExiste(idCatMarcas: number): Promise<void> {
    const marca = await this.catMarcasRepo.findOne({
      where: { id: idCatMarcas },
    });
    if (!marca) {
      throw new BadRequestException('IdCatMarcas no existe');
    }
  }

  private async assertNombreDisponibleEnMarca(
    nombre: string,
    idCatMarcas: number,
    excludeId?: number,
  ): Promise<void> {
    const existente = await this.repository.findOne({
      where: { nombre, idCatMarcas },
    });
    if (existente && existente.id !== excludeId) {
      throw new ConflictException(
        'El modelo ya existe para esta marca',
      );
    }
  }

  async create(
    dto: CreateCatModelosDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      await this.assertMarcaExiste(dto.idCatMarcas);
      await this.assertNombreDisponibleEnMarca(dto.nombre, dto.idCatMarcas);

      const saved = await this.repository.save(
        this.repository.create({
          nombre: dto.nombre,
          descripcion: dto.descripcion ?? null,
          idCatMarcas: dto.idCatMarcas,
          estatus: EstatusEnum.ACTIVO,
        }),
      );

      await this.bitacoraLogger.logToBitacora(
        'CatModelos',
        `Se creó el modelo: ${dto.nombre}`,
        'CREATE',
        { dto },
        idUser,
        EnumModulos.VEHICULOS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Modelo creado correctamente',
        data: { id: Number(saved.id), nombre: saved.nombre },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'CatModelos',
        `Error al crear modelo: ${dto.nombre}`,
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

  async findAllList(idCatMarcas?: number): Promise<ApiResponseCommon> {
    try {
      const where: FindOptionsWhere<CatModelos> = {
        estatus: 1,
        ...(idCatMarcas != null ? { idCatMarcas } : {}),
      };
      const data = await this.repository.find({
        where,
        relations: ['idCatMarcas2'],
        order: { id: 'ASC' },
      });
      return { data: data.map((item) => this.mapModelo(item)) };
    } catch (error) {
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findAll(
    page: number,
    limit: number,
    idCatMarcas?: number,
  ): Promise<ApiResponseCommon> {
    try {
      const where: FindOptionsWhere<CatModelos> = {
        ...(idCatMarcas != null ? { idCatMarcas } : {}),
      };
      const [data, total] = await this.repository.findAndCount({
        where,
        relations: ['idCatMarcas2'],
        skip: (page - 1) * limit,
        take: limit,
        order: { id: 'ASC' },
      });
      return {
        data: data.map((item) => this.mapModelo(item)),
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
        relations: ['idCatMarcas2'],
      });
      if (!entity) {
        throw new NotFoundException('Modelo no encontrado');
      }
      return { data: this.mapModelo(entity) };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Error al buscar el modelo');
    }
  }

  async update(
    id: number,
    dto: UpdateCatModelosDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({ where: { id } });
      if (!entity) {
        throw new NotFoundException('Modelo no encontrado');
      }
      const idCatMarcas = dto.idCatMarcas ?? entity.idCatMarcas;
      if (dto.idCatMarcas !== undefined) {
        await this.assertMarcaExiste(dto.idCatMarcas);
      }
      if (
        (dto.nombre && dto.nombre !== entity.nombre) ||
        (dto.idCatMarcas !== undefined &&
          dto.idCatMarcas !== entity.idCatMarcas)
      ) {
        await this.assertNombreDisponibleEnMarca(
          dto.nombre ?? entity.nombre,
          idCatMarcas,
          id,
        );
      }

      await this.repository.update(id, dto);
      const updated = await this.repository.findOne({ where: { id } });

      await this.bitacoraLogger.logToBitacora(
        'CatModelos',
        `Se actualizó el modelo ID: ${id}`,
        'UPDATE',
        { id, dto },
        idUser,
        EnumModulos.VEHICULOS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Modelo actualizado correctamente',
        data: { id, nombre: updated?.nombre ?? entity.nombre },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'CatModelos',
        `Error al actualizar modelo ID: ${id}`,
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
        throw new NotFoundException('Modelo no encontrado');
      }
      const estatusAnterior = Number(entity.estatus) === 1 ? 1 : 0;
      const estatus = estatusAnterior === 1 ? 0 : 1;
      await this.repository.update(id, { estatus });

      await this.bitacoraLogger.logToBitacora(
        'CatModelos',
        `Se actualizó estatus de modelo ID: ${id} a ${estatus}`,
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
        'CatModelos',
        `Error al actualizar estatus de modelo ID: ${id}`,
        'UPDATE',
        { id },
        idUser,
        EnumModulos.VEHICULOS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Error al cambiar estatus del modelo',
      );
    }
  }
}
