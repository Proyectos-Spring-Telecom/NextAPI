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
import { CatPlanesTelefonia } from 'src/entities/CatPlanesTelefonia';
import { CatTelefonia } from 'src/entities/CatTelefonia';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { CreateCatPlanesTelefoniaDto } from './dto/create-cat-planes-telefonia.dto';
import { UpdateCatPlanesTelefoniaDto } from './dto/update-cat-planes-telefonia.dto';
import { UpdateCatPlanesTelefoniaEstatusDto } from './dto/update-cat-planes-telefonia-estatus.dto';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';

const ID_MODULO_SIMS = 14;

@Injectable()
export class CatPlanesTelefoniaService {
  constructor(
    @InjectRepository(CatPlanesTelefonia)
    private readonly repository: Repository<CatPlanesTelefonia>,
    @InjectRepository(CatTelefonia)
    private readonly telefoniaRepository: Repository<CatTelefonia>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  private toDate(value: string | null | undefined): Date | null {
    if (value == null || value === '') return null;
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  async create(
    dto: CreateCatPlanesTelefoniaDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const telefoniaExiste = await this.telefoniaRepository.findOne({
        where: { id: dto.idTelefonia },
      });
      if (!telefoniaExiste) {
        throw new BadRequestException('El operador de telefonía no existe');
      }

      const entity = this.repository.create({
        nombre: dto.nombre,
        descripcion: dto.descripcion ?? null,
        idTelefonia: dto.idTelefonia,
        datosMB: dto.datosMB ?? null,
        smsIncluidos: dto.smsIncluidos ?? 0,
        vozMinutos: dto.vozMinutos ?? 0,
        tecnologiaRed: dto.tecnologiaRed ?? null,
        apn: dto.apn ?? null,
        tipoRed: dto.tipoRed ?? 'M2M',
        costoMensual: dto.costoMensual?.toString() ?? null,
        costoActivacion: (dto.costoActivacion ?? 0).toString(),
        costoExcedenteMB: dto.costoExcedenteMB?.toString() ?? null,
        moneda: dto.moneda ?? 'MXN',
        vigenciaDias: dto.vigenciaDias ?? 30,
        renovacionAutomatica: dto.renovacionAutomatica ?? 1,
        fechaInicioVigencia: this.toDate(dto.fechaInicioVigencia),
        fechaFinVigencia: this.toDate(dto.fechaFinVigencia),
        estatus: dto.estatus ?? 1,
      });
      const saved = await this.repository.save(entity);

      await this.bitacoraLogger.logToBitacora(
        'CatPlanesTelefonia',
        `Se creó el plan de telefonía: ${dto.nombre}`,
        'CREATE',
        { dto },
        idUser,
        ID_MODULO_SIMS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Plan de telefonía creado correctamente',
        data: { id: Number(saved.id), nombre: saved.nombre },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'CatPlanesTelefonia',
        `Error al crear plan de telefonía: ${dto.nombre}`,
        'CREATE',
        { dto },
        idUser,
        ID_MODULO_SIMS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findAllList(
    soloActivos = true,
    idTelefonia?: number,
  ): Promise<ApiResponseCommon> {
    try {
      const where: { estatus?: number; idTelefonia?: number } =
        soloActivos ? { estatus: 1 } : {};
      if (idTelefonia !== undefined && idTelefonia !== null) {
        where.idTelefonia = idTelefonia;
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
    idTelefonia?: number,
  ): Promise<ApiResponseCommon> {
    try {
      const where: { estatus?: number; idTelefonia?: number } =
        soloActivos ? { estatus: 1 } : {};
      if (idTelefonia !== undefined && idTelefonia !== null) {
        where.idTelefonia = idTelefonia;
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

  async findOne(id: number): Promise<{ data: CatPlanesTelefonia }> {
    try {
      const entity = await this.repository.findOne({
        where: { id },
        relations: ['idTelefonia2'],
      });
      if (!entity) {
        throw new NotFoundException('Plan de telefonía no encontrado');
      }
      const data = {
        ...entity,
        id: Number(entity.id),
        idTelefonia2: entity.idTelefonia2
          ? ({
              ...entity.idTelefonia2,
              id: Number(entity.idTelefonia2.id),
            } as CatTelefonia)
          : entity.idTelefonia2,
      };
      return { data } as { data: CatPlanesTelefonia };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { message: 'Error al buscar el plan de telefonía' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(
    id: number,
    dto: UpdateCatPlanesTelefoniaDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({ where: { id } });
      if (!entity) {
        throw new NotFoundException('Plan de telefonía no encontrado');
      }

      const idTelefonia = dto.idTelefonia ?? entity.idTelefonia;
      if (dto.idTelefonia !== undefined) {
        const telefoniaExiste = await this.telefoniaRepository.findOne({
          where: { id: idTelefonia },
        });
        if (!telefoniaExiste) {
          throw new BadRequestException(
            'El operador de telefonía no existe',
          );
        }
      }

      const updateData: Record<string, unknown> = { ...dto };
      if (dto.fechaInicioVigencia !== undefined) {
        updateData.fechaInicioVigencia = this.toDate(dto.fechaInicioVigencia);
      }
      if (dto.fechaFinVigencia !== undefined) {
        updateData.fechaFinVigencia = this.toDate(dto.fechaFinVigencia);
      }
      if (dto.costoMensual !== undefined) {
        updateData.costoMensual = dto.costoMensual?.toString() ?? null;
      }
      if (dto.costoActivacion !== undefined) {
        updateData.costoActivacion = dto.costoActivacion.toString();
      }
      if (dto.costoExcedenteMB !== undefined) {
        updateData.costoExcedenteMB = dto.costoExcedenteMB?.toString() ?? null;
      }
      Object.keys(updateData).forEach(
        (key) =>
          updateData[key] === undefined && delete updateData[key],
      );

      await this.repository.update(id, updateData);

      await this.bitacoraLogger.logToBitacora(
        'CatPlanesTelefonia',
        `Se actualizó el plan de telefonía ID: ${id}`,
        'UPDATE',
        { id, dto },
        idUser,
        ID_MODULO_SIMS,
        EstatusEnumBitcora.SUCCESS,
      );

      const updated = await this.repository.findOne({ where: { id } });
      return {
        status: 'success',
        message: 'Plan de telefonía actualizado correctamente',
        data: { id, nombre: updated?.nombre ?? entity.nombre },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'CatPlanesTelefonia',
        `Error al actualizar plan de telefonía ID: ${id}`,
        'UPDATE',
        { id, dto },
        idUser,
        ID_MODULO_SIMS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async updateEstatus(
    id: number,
    dto: UpdateCatPlanesTelefoniaEstatusDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({ where: { id } });
      if (!entity) {
        throw new NotFoundException('Plan de telefonía no encontrado');
      }
      await this.repository.update(id, { estatus: dto.estatus });

      await this.bitacoraLogger.logToBitacora(
        'CatPlanesTelefonia',
        `Se actualizó estatus de plan de telefonía ID: ${id} a ${dto.estatus}`,
        'UPDATE',
        { id, estatus: dto.estatus },
        idUser,
        ID_MODULO_SIMS,
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
        'CatPlanesTelefonia',
        `Error al actualizar estatus de plan de telefonía ID: ${id}`,
        'UPDATE',
        { id, dto },
        idUser,
        ID_MODULO_SIMS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Error al cambiar estatus del plan de telefonía',
      );
    }
  }
}
