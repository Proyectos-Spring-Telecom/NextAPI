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
  datosMB: number | null;
  smsIncluidos: number;
  vozIncluidos: number;
  costoMensual: number | null;
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
      datosMB: entity.datosMB,
      smsIncluidos: entity.smsIncluidos,
      vozIncluidos: entity.vozIncluidos,
      costoMensual: entity.costoMensual == null ? null : Number(entity.costoMensual),
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
      await this.obtenerTelefoniaActiva(dto.IdTelefonia);
      this.validarFechas(dto.FechaInicioVigencia, dto.FechaFinVigencia);
      const saved = await this.repository.save(
        this.repository.create({
          descripcion: dto.Descripcion ?? null,
          idTelefonia: dto.IdTelefonia,
          datosMB: dto.DatosMB === undefined ? 0 : dto.DatosMB,
          smsIncluidos: dto.SMSIncluidos ?? 0,
          vozIncluidos: dto.VozIncluidos ?? 0,
          costoMensual: dto.CostoMensual?.toString() ?? null,
          fechaInicioVigencia: dto.FechaInicioVigencia ?? null,
          fechaFinVigencia: dto.FechaFinVigencia ?? null,
          estatus: dto.Estatus ?? 1,
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
      filters.CostoMensualMin !== undefined &&
      filters.CostoMensualMax !== undefined &&
      filters.CostoMensualMax < filters.CostoMensualMin
    ) {
      throw new BadRequestException(
        'El costo mensual máximo no puede ser menor que el mínimo.',
      );
    }

    const qb = this.repository
      .createQueryBuilder('plan')
      .leftJoinAndSelect('plan.telefonia', 'telefonia')
      .orderBy('plan.Id', 'DESC')
      .skip((filters.page - 1) * filters.limit)
      .take(filters.limit);

    if (filters.IdTelefonia !== undefined) {
      qb.andWhere('plan.IdTelefonia = :idTelefonia', {
        idTelefonia: filters.IdTelefonia,
      });
    }
    if (filters.Descripcion) {
      qb.andWhere('plan.Descripcion LIKE :descripcion', {
        descripcion: `%${filters.Descripcion}%`,
      });
    }
    if (filters.Estatus !== undefined) {
      qb.andWhere('plan.Estatus = :estatus', { estatus: filters.Estatus });
    }
    if (filters.FechaInicioVigencia) {
      qb.andWhere('plan.FechaInicioVigencia >= :fechaInicio', {
        fechaInicio: filters.FechaInicioVigencia,
      });
    }
    if (filters.FechaFinVigencia) {
      qb.andWhere('plan.FechaFinVigencia <= :fechaFin', {
        fechaFin: filters.FechaFinVigencia,
      });
    }
    if (filters.CostoMensualMin !== undefined) {
      qb.andWhere('plan.CostoMensual >= :costoMin', {
        costoMin: filters.CostoMensualMin,
      });
    }
    if (filters.CostoMensualMax !== undefined) {
      qb.andWhere('plan.CostoMensual <= :costoMax', {
        costoMax: filters.CostoMensualMax,
      });
    }
    if (filters.vigentes) {
      qb.andWhere('plan.Estatus = 1')
        .andWhere(
          '(plan.FechaInicioVigencia IS NULL OR plan.FechaInicioVigencia <= CURDATE())',
        )
        .andWhere(
          '(plan.FechaFinVigencia IS NULL OR plan.FechaFinVigencia >= CURDATE())',
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
    } catch {
      throw new InternalServerErrorException(
        'No fue posible consultar los planes de telefonía.',
      );
    }
  }

  async findAllList(soloActivos = true, idTelefonia?: number) {
    const result = await this.findAll({
      page: 1,
      limit: 100,
      ...(soloActivos ? { Estatus: 1 } : {}),
      ...(idTelefonia !== undefined ? { IdTelefonia: idTelefonia } : {}),
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
      if (dto.IdTelefonia !== undefined) {
        await this.obtenerTelefoniaActiva(dto.IdTelefonia);
      } else if (dto.Estatus === 1) {
        await this.obtenerTelefoniaActiva(entity.idTelefonia);
      }
      const fechaInicio =
        dto.FechaInicioVigencia !== undefined
          ? dto.FechaInicioVigencia
          : entity.fechaInicioVigencia;
      const fechaFin =
        dto.FechaFinVigencia !== undefined
          ? dto.FechaFinVigencia
          : entity.fechaFinVigencia;
      this.validarFechas(fechaInicio, fechaFin);

      const updateData: Partial<CatPlanesTelefonia> = {};
      if (dto.Descripcion !== undefined) updateData.descripcion = dto.Descripcion;
      if (dto.IdTelefonia !== undefined) updateData.idTelefonia = dto.IdTelefonia;
      if (dto.DatosMB !== undefined) updateData.datosMB = dto.DatosMB;
      if (dto.SMSIncluidos !== undefined) updateData.smsIncluidos = dto.SMSIncluidos;
      if (dto.VozIncluidos !== undefined) updateData.vozIncluidos = dto.VozIncluidos;
      if (dto.CostoMensual !== undefined)
        updateData.costoMensual = dto.CostoMensual.toString();
      if (dto.FechaInicioVigencia !== undefined)
        updateData.fechaInicioVigencia = dto.FechaInicioVigencia;
      if (dto.FechaFinVigencia !== undefined)
        updateData.fechaFinVigencia = dto.FechaFinVigencia;
      if (dto.Estatus !== undefined) updateData.estatus = dto.Estatus;

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
