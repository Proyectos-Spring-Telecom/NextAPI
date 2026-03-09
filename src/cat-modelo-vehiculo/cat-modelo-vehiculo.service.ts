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
import { CatModeloVehiculo } from 'src/entities/CatModeloVehiculo';
import { CatMarcaVehiculo } from 'src/entities/CatMarcaVehiculo';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { CreateCatModeloVehiculoDto } from './dto/create-cat-modelo-vehiculo.dto';
import { UpdateCatModeloVehiculoDto } from './dto/update-cat-modelo-vehiculo.dto';
import { UpdateCatModeloVehiculoEstatusDto } from './dto/update-cat-modelo-vehiculo-estatus.dto';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';

const ID_MODULO_VEHICULOS = 16;

@Injectable()
export class CatModeloVehiculoService {
  constructor(
    @InjectRepository(CatModeloVehiculo)
    private readonly repository: Repository<CatModeloVehiculo>,
    @InjectRepository(CatMarcaVehiculo)
    private readonly marcaRepository: Repository<CatMarcaVehiculo>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  async create(
    dto: CreateCatModeloVehiculoDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const marcaExiste = await this.marcaRepository.findOne({
        where: { id: dto.idMarcaVehiculo },
      });
      if (!marcaExiste) {
        throw new BadRequestException('La marca de vehículo no existe');
      }

      const existe = await this.repository.findOne({
        where: {
          idMarcaVehiculo: dto.idMarcaVehiculo,
          nombre: dto.nombre,
        },
      });
      if (existe) {
        throw new BadRequestException(
          'Ya existe un modelo con ese nombre para la marca seleccionada',
        );
      }

      const entity = this.repository.create({
        ...dto,
        estatus: dto.estatus ?? 1,
      });
      const saved = await this.repository.save(entity);

      await this.bitacoraLogger.logToBitacora(
        'CatModeloVehiculo',
        `Se creó el modelo de vehículo: ${dto.nombre}`,
        'CREATE',
        { dto },
        idUser,
        ID_MODULO_VEHICULOS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Modelo de vehículo creado correctamente',
        data: { id: Number(saved.id), nombre: saved.nombre },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'CatModeloVehiculo',
        `Error al crear modelo de vehículo: ${dto.nombre}`,
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

  async findAllList(
    soloActivos = true,
    idMarca?: number,
  ): Promise<ApiResponseCommon> {
    try {
      const where: { estatus?: number; idMarcaVehiculo?: number } =
        soloActivos ? { estatus: 1 } : {};
      if (idMarca !== undefined && idMarca !== null) {
        where.idMarcaVehiculo = idMarca;
      }
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
    idMarca?: number,
  ): Promise<ApiResponseCommon> {
    try {
      const where: { estatus?: number; idMarcaVehiculo?: number } =
        soloActivos ? { estatus: 1 } : {};
      if (idMarca !== undefined && idMarca !== null) {
        where.idMarcaVehiculo = idMarca;
      }
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

  async findOne(id: number): Promise<{ data: CatModeloVehiculo }> {
    try {
      const entity = await this.repository.findOne({
        where: { id },
        relations: ['idMarcaVehiculo2'],
      });
      if (!entity) {
        throw new NotFoundException('Modelo de vehículo no encontrado');
      }
      const data = {
        ...entity,
        id: Number(entity.id),
        idMarcaVehiculo2: entity.idMarcaVehiculo2
          ? ({
              ...entity.idMarcaVehiculo2,
              id: Number(entity.idMarcaVehiculo2.id),
            } as CatMarcaVehiculo)
          : entity.idMarcaVehiculo2,
      };
      return { data } as { data: CatModeloVehiculo };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { message: 'Error al buscar el modelo de vehículo' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(
    id: number,
    dto: UpdateCatModeloVehiculoDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({ where: { id } });
      if (!entity) {
        throw new NotFoundException('Modelo de vehículo no encontrado');
      }

      if (dto.idMarcaVehiculo !== undefined) {
        const marcaExiste = await this.marcaRepository.findOne({
          where: { id: dto.idMarcaVehiculo },
        });
        if (!marcaExiste) {
          throw new BadRequestException('La marca de vehículo no existe');
        }
      }

      const idMarca = dto.idMarcaVehiculo ?? entity.idMarcaVehiculo;
      const nombre = dto.nombre ?? entity.nombre;

      if (
        (dto.nombre && dto.nombre !== entity.nombre) ||
        (dto.idMarcaVehiculo &&
          dto.idMarcaVehiculo !== entity.idMarcaVehiculo)
      ) {
        const existe = await this.repository.findOne({
          where: {
            idMarcaVehiculo: idMarca,
            nombre,
          },
        });
        if (existe) {
          throw new BadRequestException(
            'Ya existe un modelo con ese nombre para la marca seleccionada',
          );
        }
      }

      await this.repository.update(id, dto);

      await this.bitacoraLogger.logToBitacora(
        'CatModeloVehiculo',
        `Se actualizó el modelo de vehículo ID: ${id}`,
        'UPDATE',
        { id, dto },
        idUser,
        ID_MODULO_VEHICULOS,
        EstatusEnumBitcora.SUCCESS,
      );

      const updated = await this.repository.findOne({ where: { id } });
      return {
        status: 'success',
        message: 'Modelo de vehículo actualizado correctamente',
        data: { id, nombre: updated?.nombre ?? entity.nombre },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'CatModeloVehiculo',
        `Error al actualizar modelo de vehículo ID: ${id}`,
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
    dto: UpdateCatModeloVehiculoEstatusDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({ where: { id } });
      if (!entity) {
        throw new NotFoundException('Modelo de vehículo no encontrado');
      }
      await this.repository.update(id, { estatus: dto.estatus });

      await this.bitacoraLogger.logToBitacora(
        'CatModeloVehiculo',
        `Se actualizó estatus de modelo de vehículo ID: ${id} a ${dto.estatus}`,
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
        'CatModeloVehiculo',
        `Error al actualizar estatus de modelo de vehículo ID: ${id}`,
        'UPDATE',
        { id, dto },
        idUser,
        ID_MODULO_VEHICULOS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        `Error al cambiar estatus del modelo de vehículo`,
      );
    }
  }
}
