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
import { CatModeloDispositivo } from 'src/entities/CatModeloDispositivo';
import { CatMarcaDispositivo } from 'src/entities/CatMarcaDispositivo';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { CreateCatModeloDispositivoDto } from './dto/create-cat-modelo-dispositivo.dto';
import { UpdateCatModeloDispositivoDto } from './dto/update-cat-modelo-dispositivo.dto';
import { UpdateCatModeloDispositivoEstatusDto } from './dto/update-cat-modelo-dispositivo-estatus.dto';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';

const ID_MODULO_DISPOSITIVOS = 15;

@Injectable()
export class CatModeloDispositivoService {
  constructor(
    @InjectRepository(CatModeloDispositivo)
    private readonly repository: Repository<CatModeloDispositivo>,
    @InjectRepository(CatMarcaDispositivo)
    private readonly marcaRepository: Repository<CatMarcaDispositivo>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  async create(
    dto: CreateCatModeloDispositivoDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const marcaExiste = await this.marcaRepository.findOne({
        where: { id: dto.idMarcaDispositivo },
      });
      if (!marcaExiste) {
        throw new BadRequestException('La marca de dispositivo no existe');
      }

      const existe = await this.repository.findOne({
        where: {
          idMarcaDispositivo: dto.idMarcaDispositivo,
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
        'CatModeloDispositivo',
        `Se creó el modelo de dispositivo: ${dto.nombre}`,
        'CREATE',
        { dto },
        idUser,
        ID_MODULO_DISPOSITIVOS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Modelo de dispositivo creado correctamente',
        data: { id: Number(saved.id), nombre: saved.nombre },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'CatModeloDispositivo',
        `Error al crear modelo de dispositivo: ${dto.nombre}`,
        'CREATE',
        { dto },
        idUser,
        ID_MODULO_DISPOSITIVOS,
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
      const where: { estatus?: number; idMarcaDispositivo?: number } =
        soloActivos ? { estatus: 1 } : {};
      if (idMarca !== undefined && idMarca !== null) {
        where.idMarcaDispositivo = idMarca;
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
      const where: { estatus?: number; idMarcaDispositivo?: number } =
        soloActivos ? { estatus: 1 } : {};
      if (idMarca !== undefined && idMarca !== null) {
        where.idMarcaDispositivo = idMarca;
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

  async findOne(id: number): Promise<{ data: CatModeloDispositivo }> {
    try {
      const entity = await this.repository.findOne({
        where: { id },
        relations: ['idMarcaDispositivo2'],
      });
      if (!entity) {
        throw new NotFoundException('Modelo de dispositivo no encontrado');
      }
      const data = {
        ...entity,
        id: Number(entity.id),
        idMarcaDispositivo2: entity.idMarcaDispositivo2
          ? ({
              ...entity.idMarcaDispositivo2,
              id: Number(entity.idMarcaDispositivo2.id),
            } as CatMarcaDispositivo)
          : entity.idMarcaDispositivo2,
      };
      return { data } as { data: CatModeloDispositivo };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { message: 'Error al buscar el modelo de dispositivo' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(
    id: number,
    dto: UpdateCatModeloDispositivoDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({ where: { id } });
      if (!entity) {
        throw new NotFoundException('Modelo de dispositivo no encontrado');
      }

      if (dto.idMarcaDispositivo !== undefined) {
        const marcaExiste = await this.marcaRepository.findOne({
          where: { id: dto.idMarcaDispositivo },
        });
        if (!marcaExiste) {
          throw new BadRequestException('La marca de dispositivo no existe');
        }
      }

      const idMarca = dto.idMarcaDispositivo ?? entity.idMarcaDispositivo;
      const nombre = dto.nombre ?? entity.nombre;

      if (
        (dto.nombre && dto.nombre !== entity.nombre) ||
        (dto.idMarcaDispositivo && dto.idMarcaDispositivo !== entity.idMarcaDispositivo)
      ) {
        const existe = await this.repository.findOne({
          where: {
            idMarcaDispositivo: idMarca,
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
        'CatModeloDispositivo',
        `Se actualizó el modelo de dispositivo ID: ${id}`,
        'UPDATE',
        { id, dto },
        idUser,
        ID_MODULO_DISPOSITIVOS,
        EstatusEnumBitcora.SUCCESS,
      );

      const updated = await this.repository.findOne({ where: { id } });
      return {
        status: 'success',
        message: 'Modelo de dispositivo actualizado correctamente',
        data: { id, nombre: updated?.nombre ?? entity.nombre },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'CatModeloDispositivo',
        `Error al actualizar modelo de dispositivo ID: ${id}`,
        'UPDATE',
        { id, dto },
        idUser,
        ID_MODULO_DISPOSITIVOS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async updateEstatus(
    id: number,
    dto: UpdateCatModeloDispositivoEstatusDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({ where: { id } });
      if (!entity) {
        throw new NotFoundException('Modelo de dispositivo no encontrado');
      }
      await this.repository.update(id, { estatus: dto.estatus });

      await this.bitacoraLogger.logToBitacora(
        'CatModeloDispositivo',
        `Se actualizó estatus de modelo de dispositivo ID: ${id} a ${dto.estatus}`,
        'UPDATE',
        { id, estatus: dto.estatus },
        idUser,
        ID_MODULO_DISPOSITIVOS,
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
        'CatModeloDispositivo',
        `Error al actualizar estatus de modelo de dispositivo ID: ${id}`,
        'UPDATE',
        { id, dto },
        idUser,
        ID_MODULO_DISPOSITIVOS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        `Error al cambiar estatus del modelo de dispositivo`,
      );
    }
  }
}
