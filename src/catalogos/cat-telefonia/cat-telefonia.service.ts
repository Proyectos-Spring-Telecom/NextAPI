import {
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
import { CreateCatTelefoniaDto } from './dto/create-cat-telefonia.dto';
import { FilterCatPlanesTelefoniaDto } from '../cat-planes-telefonia/dto/filter-cat-planes-telefonia.dto';
import { FilterCatTelefoniaDto } from './dto/filter-cat-telefonia.dto';
import { UpdateCatTelefoniaDto } from './dto/update-cat-telefonia.dto';

const ID_MODULO_SIMS = 14;

export interface TelefoniaResponse {
  id: number;
  nombreTelefonia: string;
  nombreAsesor: string | null;
  numeroAsesor: string | null;
  estatus: number;
  cantidadPlanes?: number;
  planesTelefonia?: PlanTelefoniaSimpleResponse[];
}

export interface PlanTelefoniaSimpleResponse {
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
}

@Injectable()
export class CatTelefoniaService {
  constructor(
    @InjectRepository(CatTelefonia)
    private readonly repository: Repository<CatTelefonia>,
    @InjectRepository(CatPlanesTelefonia)
    private readonly planesRepository: Repository<CatPlanesTelefonia>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  private mapPlan(plan: CatPlanesTelefonia): PlanTelefoniaSimpleResponse {
    return {
      id: Number(plan.id),
      descripcion: plan.descripcion,
      idTelefonia: Number(plan.idTelefonia),
      datosMB: plan.datosMB,
      smsIncluidos: plan.smsIncluidos,
      vozIncluidos: plan.vozIncluidos,
      costoMensual: plan.costoMensual == null ? null : Number(plan.costoMensual),
      fechaInicioVigencia: plan.fechaInicioVigencia,
      fechaFinVigencia: plan.fechaFinVigencia,
      estatus: plan.estatus,
      fechaCreacion: plan.fechaCreacion,
      fechaActualizacion: plan.fechaActualizacion,
    };
  }

  private mapTelefonia(
    entity: CatTelefonia,
    cantidadPlanes?: number,
    includePlanes = false,
  ): TelefoniaResponse {
    return {
      id: Number(entity.id),
      nombreTelefonia: entity.nombreTelefonia,
      nombreAsesor: entity.nombreAsesor,
      numeroAsesor: entity.numeroAsesor,
      estatus: entity.estatus,
      ...(cantidadPlanes !== undefined ? { cantidadPlanes } : {}),
      ...(includePlanes
        ? {
            planesTelefonia: (entity.planesTelefonia ?? []).map((plan) =>
              this.mapPlan(plan),
            ),
          }
        : {}),
    };
  }

  private async assertNombreDisponible(
    nombreTelefonia: string,
    excludeId?: number,
  ): Promise<void> {
    const qb = this.repository
      .createQueryBuilder('telefonia')
      .where('LOWER(TRIM(telefonia.NombreTelefonia)) = LOWER(:nombre)', {
        nombre: nombreTelefonia.trim(),
      });
    if (excludeId !== undefined) {
      qb.andWhere('telefonia.Id <> :excludeId', { excludeId });
    }
    if (await qb.getExists()) {
      throw new ConflictException(
        'Ya existe una telefonía registrada con el nombre proporcionado.',
      );
    }
  }

  private async assertSinPlanesActivos(idTelefonia: number): Promise<void> {
    const planesActivos = await this.planesRepository.count({
      where: { idTelefonia, estatus: 1 },
    });
    if (planesActivos > 0) {
      throw new ConflictException(
        'No se puede desactivar la telefonía porque tiene planes activos asociados.',
      );
    }
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
      'CatTelefonia',
      descripcion,
      accion,
      query,
      idUser,
      ID_MODULO_SIMS,
      estatus,
      error,
    );
  }

  async create(dto: CreateCatTelefoniaDto, idUser: number) {
    try {
      await this.assertNombreDisponible(dto.NombreTelefonia);
      const saved = await this.repository.save(
        this.repository.create({
          nombreTelefonia: dto.NombreTelefonia,
          nombreAsesor: dto.NombreAsesor ?? null,
          numeroAsesor: dto.NumeroAsesor ?? null,
          estatus: EstatusEnum.ACTIVO,
        }),
      );
      await this.log(
        'CREATE',
        `Se creó la telefonía: ${saved.nombreTelefonia}`,
        { dto },
        idUser,
        EstatusEnumBitcora.SUCCESS,
      );
      return {
        status: 'success',
        message: 'Telefonía creada correctamente.',
        data: this.mapTelefonia(saved),
      };
    } catch (error) {
      await this.log(
        'CREATE',
        `Error al crear la telefonía: ${dto.NombreTelefonia}`,
        { dto },
        idUser,
        EstatusEnumBitcora.ERROR,
        (error as Error).message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('No fue posible crear la telefonía.');
    }
  }

  async findAll(filters: FilterCatTelefoniaDto) {
    const qb = this.repository
      .createQueryBuilder('telefonia')
      .loadRelationCountAndMap('telefonia.cantidadPlanes', 'telefonia.planesTelefonia')
      .orderBy('telefonia.Id', 'DESC')
      .skip((filters.page - 1) * filters.limit)
      .take(filters.limit);

    if (filters.NombreTelefonia) {
      qb.andWhere('telefonia.NombreTelefonia LIKE :nombreTelefonia', {
        nombreTelefonia: `%${filters.NombreTelefonia}%`,
      });
    }
    if (filters.NombreAsesor) {
      qb.andWhere('telefonia.NombreAsesor LIKE :nombreAsesor', {
        nombreAsesor: `%${filters.NombreAsesor}%`,
      });
    }
    if (filters.NumeroAsesor) {
      qb.andWhere('telefonia.NumeroAsesor LIKE :numeroAsesor', {
        numeroAsesor: `%${filters.NumeroAsesor}%`,
      });
    }
    if (filters.Estatus !== undefined) {
      qb.andWhere('telefonia.Estatus = :estatus', {
        estatus: filters.Estatus,
      });
    }

    try {
      const [entities, total] = await qb.getManyAndCount();
      return {
        data: entities.map((entity) =>
          this.mapTelefonia(
            entity,
            Number(
              (entity as CatTelefonia & { cantidadPlanes?: number }).cantidadPlanes ?? 0,
            ),
          ),
        ),
        pagination: {
          total,
          currentPage: filters.page,
          pageSize: filters.limit,
          totalPages: Math.ceil(total / filters.limit),
        },
      };
    } catch {
      throw new InternalServerErrorException('No fue posible consultar las telefonías.');
    }
  }

  async findAllList(soloActivos = true) {
    const result = await this.findAll({
      page: 1,
      limit: 100,
      ...(soloActivos ? { Estatus: 1 } : {}),
    });
    return { data: result.data };
  }

  async findOne(id: number) {
    try {
      const entity = await this.repository
        .createQueryBuilder('telefonia')
        .leftJoinAndSelect(
          'telefonia.planesTelefonia',
          'plan',
          'plan.Estatus = :estatusPlan',
          { estatusPlan: 1 },
        )
        .where('telefonia.Id = :id', { id })
        .orderBy('plan.Id', 'DESC')
        .getOne();
      if (!entity) {
        throw new NotFoundException('Telefonía no encontrada.');
      }
      return { data: this.mapTelefonia(entity, undefined, true) };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('No fue posible consultar la telefonía.');
    }
  }

  async update(id: number, dto: UpdateCatTelefoniaDto, idUser: number) {
    try {
      const entity = await this.repository.findOne({ where: { id } });
      if (!entity) {
        throw new NotFoundException('Telefonía no encontrada.');
      }
      if (dto.NombreTelefonia !== undefined) {
        await this.assertNombreDisponible(dto.NombreTelefonia, id);
      }
      if (dto.Estatus === 0) {
        await this.assertSinPlanesActivos(id);
      }
      const updateData: Partial<CatTelefonia> = {};
      if (dto.NombreTelefonia !== undefined)
        updateData.nombreTelefonia = dto.NombreTelefonia;
      if (dto.NombreAsesor !== undefined && dto.NombreAsesor !== null)
        updateData.nombreAsesor = dto.NombreAsesor;
      if (dto.NumeroAsesor !== undefined && dto.NumeroAsesor !== null)
        updateData.numeroAsesor = dto.NumeroAsesor;
      if (dto.Estatus !== undefined) updateData.estatus = dto.Estatus;

      if (Object.keys(updateData).length > 0) {
        await this.repository.update(id, updateData);
      }
      const updated = await this.repository.findOneOrFail({ where: { id } });
      await this.log(
        'UPDATE',
        `Se actualizó la telefonía ID: ${id}`,
        { id, dto },
        idUser,
        EstatusEnumBitcora.SUCCESS,
      );
      return {
        status: 'success',
        message: 'Telefonía actualizada correctamente.',
        data: this.mapTelefonia(updated),
      };
    } catch (error) {
      await this.log(
        'UPDATE',
        `Error al actualizar la telefonía ID: ${id}`,
        { id, dto },
        idUser,
        EstatusEnumBitcora.ERROR,
        (error as Error).message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('No fue posible actualizar la telefonía.');
    }
  }

  async updateEstatus(id: number, idUser: number) {
    try {
      const entity = await this.repository.findOne({ where: { id } });
      if (!entity) {
        throw new NotFoundException('Telefonía no encontrada.');
      }
      const estatusAnterior = Number(entity.estatus) === 1 ? 1 : 0;
      const estatus = estatusAnterior === 1 ? 0 : 1;
      if (estatus === 0) {
        await this.assertSinPlanesActivos(id);
      }
      await this.repository.update(id, { estatus });
      entity.estatus = estatus;
      await this.log(
        'UPDATE',
        `Se cambió el estatus de la telefonía ID: ${id} a ${estatus}`,
        { id, estatusAnterior, estatus },
        idUser,
        EstatusEnumBitcora.SUCCESS,
      );
      return {
        status: 'success',
        message: 'Estatus actualizado correctamente.',
        estatus: { estatus },
        data: this.mapTelefonia(entity),
      };
    } catch (error) {
      await this.log(
        'UPDATE',
        `Error al cambiar el estatus de la telefonía ID: ${id}`,
        { id },
        idUser,
        EstatusEnumBitcora.ERROR,
        (error as Error).message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'No fue posible cambiar el estatus de la telefonía.',
      );
    }
  }

  async findPlanesByTelefonia(idTelefonia: number, filters: FilterCatPlanesTelefoniaDto) {
    const telefonia = await this.repository.findOne({
      where: { id: idTelefonia },
    });
    if (!telefonia) {
      throw new NotFoundException('Telefonía no encontrada.');
    }

    const qb = this.planesRepository
      .createQueryBuilder('plan')
      .where('plan.IdTelefonia = :idTelefonia', { idTelefonia })
      .orderBy('plan.Id', 'DESC');
    if (filters.Estatus !== undefined) {
      qb.andWhere('plan.Estatus = :estatus', { estatus: filters.Estatus });
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
    const planes = await qb.getMany();
    return { data: planes.map((plan) => this.mapPlan(plan)) };
  }
}
