import {
  BadRequestException,
  ConflictException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { EstatusEnumBitcora } from 'src/common/ApiResponse';
import { EstatusEnum } from 'src/common/estatus.enum';
import { CatPlanesTelefonia } from 'src/entities/CatPlanesTelefonia';
import { CatTelefonia } from 'src/entities/CatTelefonia';
import { CreateCatPlanesTelefoniaDto } from './dto/create-cat-planes-telefonia.dto';
import { FilterCatPlanesTelefoniaDto } from './dto/filter-cat-planes-telefonia.dto';
import { UpdateCatPlanesTelefoniaDto } from './dto/update-cat-planes-telefonia.dto';

const ID_MODULO_SIMS = 14;

interface TelefoniaBasicaResponse {
  id: number;
  nombreTelefonia: string;
  nombreAsesor: string | null;
  numeroAsesor: string | null;
  estatus: number;
}

export interface PlanTelefoniaResponse {
  id: number;
  descripcion: string | null;
  idTelefonia: number;
  datos: string | null;
  smsIncluidos: string | null;
  vozIncluidos: string | null;
  costoMensual: string | null;
  fechaInicioVigencia: string | null;
  fechaFinVigencia: string | null;
  estatus: number;
  fechaCreacion: Date;
  fechaActualizacion: Date;
  telefonia: TelefoniaBasicaResponse | null;
}

@Injectable()
export class CatPlanesTelefoniaService {
  constructor(
    @InjectRepository(CatPlanesTelefonia)
    private readonly repository: Repository<CatPlanesTelefonia>,
    @InjectRepository(CatTelefonia)
    private readonly telefoniaRepository: Repository<CatTelefonia>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  private mapTelefonia(
    telefonia: CatTelefonia | undefined,
  ): TelefoniaBasicaResponse | null {
    if (!telefonia) return null;
    return {
      id: Number(telefonia.id),
      nombreTelefonia: telefonia.nombreTelefonia,
      nombreAsesor: telefonia.nombreAsesor,
      numeroAsesor: telefonia.numeroAsesor,
      estatus: telefonia.estatus,
    };
  }

  private mapPlan(entity: CatPlanesTelefonia): PlanTelefoniaResponse {
    return {
      id: Number(entity.id),
      descripcion: entity.descripcion,
      idTelefonia: Number(entity.idTelefonia),
      datos: entity.datos,
      smsIncluidos: entity.smsIncluidos,
      vozIncluidos: entity.vozIncluidos,
      costoMensual: entity.costoMensual,
      fechaInicioVigencia: entity.fechaInicioVigencia,
      fechaFinVigencia: entity.fechaFinVigencia,
      estatus: entity.estatus,
      fechaCreacion: entity.fechaCreacion,
      fechaActualizacion: entity.fechaActualizacion,
      telefonia: this.mapTelefonia(entity.telefonia),
    };
  }

  private validarFechas(
    fechaInicio: string | null | undefined,
    fechaFin: string | null | undefined,
  ): void {
    if (fechaInicio && fechaFin && fechaFin < fechaInicio) {
      throw new BadRequestException(
        'La fecha de fin de vigencia no puede ser menor que la fecha de inicio.',
      );
    }
  }

  private async obtenerTelefoniaActiva(idTelefonia: number) {
    const telefonia = await this.telefoniaRepository.findOne({
      where: { id: idTelefonia },
    });
    if (!telefonia) {
      throw new NotFoundException('Telefonía no encontrada.');
    }
    if (telefonia.estatus !== 1) {
      throw new ConflictException('La telefonía seleccionada se encuentra inactiva.');
    }
    return telefonia;
  }

  private async log(
    accion: string,
    descripcion: string,
    query: object,
    idUser: number,
    estatus: EstatusEnumBitcora,
    error?: string,
  ): Promise<void> {
    await this.bitacoraLogger.logToBitacora(
      'CatPlanesTelefonia',
      descripcion,
      accion,
      query,
      idUser,
      ID_MODULO_SIMS,
      estatus,
      error,
    );
  }

  async create(dto: CreateCatPlanesTelefoniaDto, idUser: number) {
    try {
      await this.obtenerTelefoniaActiva(dto.idTelefonia);
      this.validarFechas(dto.fechaInicioVigencia, dto.fechaFinVigencia);
      const saved = await this.repository.save(
        this.repository.create({
          descripcion: dto.descripcion ?? null,
          idTelefonia: dto.idTelefonia,
          datos: dto.datos === undefined ? '0' : dto.datos,
          smsIncluidos: dto.smsIncluidos ?? '0',
          vozIncluidos: dto.vozIncluidos ?? '0',
          costoMensual: dto.costoMensual ?? null,
          fechaInicioVigencia: dto.fechaInicioVigencia ?? null,
          fechaFinVigencia: dto.fechaFinVigencia ?? null,
          estatus: EstatusEnum.ACTIVO,
        }),
      );
      const result = await this.repository.findOneOrFail({
        where: { id: saved.id },
        relations: { telefonia: true },
      });
      await this.log(
        'CREATE',
        `Se creó el plan de telefonía ID: ${saved.id}`,
        { dto },
        idUser,
        EstatusEnumBitcora.SUCCESS,
      );
      return {
        status: 'success',
        message: 'Plan de telefonía creado correctamente.',
        data: this.mapPlan(result),
      };
    } catch (error) {
      await this.log(
        'CREATE',
        'Error al crear el plan de telefonía',
        { dto },
        idUser,
        EstatusEnumBitcora.ERROR,
        (error as Error).message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'No fue posible crear el plan de telefonía.',
      );
    }
  }

  async findAll(filters: FilterCatPlanesTelefoniaDto) {
    if (
      filters.costoMensualMin !== undefined &&
      filters.costoMensualMax !== undefined &&
      filters.costoMensualMax < filters.costoMensualMin
    ) {
      throw new BadRequestException(
        'El costo mensual máximo no puede ser menor que el mínimo.',
      );
    }

    const qb = this.repository
      .createQueryBuilder('plan')
      .leftJoinAndSelect('plan.telefonia', 'telefonia')
      .orderBy('plan.id', 'DESC')
      .skip((filters.page - 1) * filters.limit)
      .take(filters.limit);

    if (filters.idTelefonia !== undefined) {
      qb.andWhere('plan.idTelefonia = :idTelefonia', {
        idTelefonia: filters.idTelefonia,
      });
    }
    if (filters.descripcion) {
      qb.andWhere('plan.descripcion LIKE :descripcion', {
        descripcion: `%${filters.descripcion}%`,
      });
    }
    if (filters.estatus !== undefined) {
      qb.andWhere('plan.estatus = :estatus', { estatus: filters.estatus });
    }
    if (filters.fechaInicioVigencia) {
      qb.andWhere('plan.fechaInicioVigencia >= :fechaInicio', {
        fechaInicio: filters.fechaInicioVigencia,
      });
    }
    if (filters.fechaFinVigencia) {
      qb.andWhere('plan.fechaFinVigencia <= :fechaFin', {
        fechaFin: filters.fechaFinVigencia,
      });
    }
    if (filters.costoMensualMin !== undefined) {
      qb.andWhere(
        'CAST(plan.costoMensual AS DECIMAL(10,2)) >= :costoMin',
        { costoMin: filters.costoMensualMin },
      );
    }
    if (filters.costoMensualMax !== undefined) {
      qb.andWhere(
        'CAST(plan.costoMensual AS DECIMAL(10,2)) <= :costoMax',
        { costoMax: filters.costoMensualMax },
      );
    }
    if (filters.vigentes) {
      qb.andWhere('plan.estatus = 1')
        .andWhere(
          '(plan.fechaInicioVigencia IS NULL OR plan.fechaInicioVigencia <= CURDATE())',
        )
        .andWhere(
          '(plan.fechaFinVigencia IS NULL OR plan.fechaFinVigencia >= CURDATE())',
        );
    }

    try {
      const [entities, total] = await qb.getManyAndCount();
      return {
        data: entities.map((entity) => this.mapPlan(entity)),
        pagination: {
          total,
          currentPage: filters.page,
          pageSize: filters.limit,
          totalPages: Math.ceil(total / filters.limit),
        },
      };
    } catch (error) {
      const detail = (error as Error)?.message;
      throw new InternalServerErrorException(
        detail
          ? `No fue posible consultar los planes de telefonía: ${detail}`
          : 'No fue posible consultar los planes de telefonía.',
      );
    }
  }

  async findAllList(soloActivos = true, idTelefonia?: number) {
    const result = await this.findAll({
      page: 1,
      limit: 100,
      ...(soloActivos ? { estatus: 1 } : {}),
      ...(idTelefonia !== undefined ? { idTelefonia } : {}),
    });
    return { data: result.data };
  }

  async findOne(id: number) {
    try {
      const entity = await this.repository.findOne({
        where: { id },
        relations: { telefonia: true },
      });
      if (!entity) {
        throw new NotFoundException('Plan de telefonía no encontrado.');
      }
      return { data: this.mapPlan(entity) };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'No fue posible consultar el plan de telefonía.',
      );
    }
  }

  async update(id: number, dto: UpdateCatPlanesTelefoniaDto, idUser: number) {
    try {
      const entity = await this.repository.findOne({ where: { id } });
      if (!entity) {
        throw new NotFoundException('Plan de telefonía no encontrado.');
      }
      if (dto.idTelefonia !== undefined) {
        await this.obtenerTelefoniaActiva(dto.idTelefonia);
      } else if (dto.estatus === 1) {
        await this.obtenerTelefoniaActiva(entity.idTelefonia);
      }
      const fechaInicio =
        dto.fechaInicioVigencia !== undefined
          ? dto.fechaInicioVigencia
          : entity.fechaInicioVigencia;
      const fechaFin =
        dto.fechaFinVigencia !== undefined
          ? dto.fechaFinVigencia
          : entity.fechaFinVigencia;
      this.validarFechas(fechaInicio, fechaFin);

      const updateData: Partial<CatPlanesTelefonia> = {};
      if (dto.descripcion !== undefined) updateData.descripcion = dto.descripcion;
      if (dto.idTelefonia !== undefined) updateData.idTelefonia = dto.idTelefonia;
      if (dto.datos !== undefined) updateData.datos = dto.datos;
      if (dto.smsIncluidos !== undefined) updateData.smsIncluidos = dto.smsIncluidos;
      if (dto.vozIncluidos !== undefined) updateData.vozIncluidos = dto.vozIncluidos;
      if (dto.costoMensual !== undefined) updateData.costoMensual = dto.costoMensual;
      if (dto.fechaInicioVigencia !== undefined)
        updateData.fechaInicioVigencia = dto.fechaInicioVigencia;
      if (dto.fechaFinVigencia !== undefined)
        updateData.fechaFinVigencia = dto.fechaFinVigencia;
      if (dto.estatus !== undefined) updateData.estatus = dto.estatus;

      if (Object.keys(updateData).length > 0) {
        await this.repository.update(id, updateData);
      }
      const updated = await this.repository.findOneOrFail({
        where: { id },
        relations: { telefonia: true },
      });
      await this.log(
        'UPDATE',
        `Se actualizó el plan de telefonía ID: ${id}`,
        { id, dto },
        idUser,
        EstatusEnumBitcora.SUCCESS,
      );
      return {
        status: 'success',
        message: 'Plan de telefonía actualizado correctamente.',
        data: this.mapPlan(updated),
      };
    } catch (error) {
      await this.log(
        'UPDATE',
        `Error al actualizar el plan de telefonía ID: ${id}`,
        { id, dto },
        idUser,
        EstatusEnumBitcora.ERROR,
        (error as Error).message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'No fue posible actualizar el plan de telefonía.',
      );
    }
  }

  async updateEstatus(id: number, idUser: number) {
    try {
      const entity = await this.repository.findOne({
        where: { id },
        relations: { telefonia: true },
      });
      if (!entity) {
        throw new NotFoundException('Plan de telefonía no encontrado.');
      }
      const estatusAnterior = Number(entity.estatus) === 1 ? 1 : 0;
      const estatus = estatusAnterior === 1 ? 0 : 1;
      await this.repository.update(id, { estatus });
      entity.estatus = estatus;
      await this.log(
        'UPDATE',
        `Se cambió el estatus del plan de telefonía ID: ${id} a ${estatus}`,
        { id, estatusAnterior, estatus },
        idUser,
        EstatusEnumBitcora.SUCCESS,
      );
      return {
        status: 'success',
        message: 'Estatus actualizado correctamente.',
        estatus: { estatus },
        data: this.mapPlan(entity),
      };
    } catch (error) {
      await this.log(
        'UPDATE',
        `Error al cambiar el estatus del plan de telefonía ID: ${id}`,
        { id },
        idUser,
        EstatusEnumBitcora.ERROR,
        (error as Error).message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'No fue posible cambiar el estatus del plan de telefonía.',
      );
    }
  }
}
