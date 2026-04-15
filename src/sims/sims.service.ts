import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Sims } from 'src/entities/Sims';
import { CatTelefonia } from 'src/entities/CatTelefonia';
import { CatPlanesTelefonia } from 'src/entities/CatPlanesTelefonia';
import { CatEstatusSim } from 'src/entities/CatEstatusSim';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { CreateSimsDto } from './dto/create-sims.dto';
import { UpdateSimsDto } from './dto/update-sims.dto';
import { UpdateSimsEstatusDto } from './dto/update-sims-estatus.dto';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';

const ID_MODULO_SIMS = 14;

@Injectable()
export class SimsService {
  constructor(
    @InjectRepository(Sims)
    private readonly repository: Repository<Sims>,
    @InjectRepository(CatTelefonia)
    private readonly catTelefoniaRepo: Repository<CatTelefonia>,
    @InjectRepository(CatPlanesTelefonia)
    private readonly catPlanesTelefoniaRepo: Repository<CatPlanesTelefonia>,
    @InjectRepository(CatEstatusSim)
    private readonly catEstatusSimRepo: Repository<CatEstatusSim>,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly tenantFilter: TenantFilterService,
  ) {}

  private async validarFks(dto: {
    idTelefonia?: number;
    idPlanTelefonia?: number;
    idEstatusSim?: number;
  }): Promise<void> {
    if (dto.idTelefonia !== undefined) {
      const tel = await this.catTelefoniaRepo.findOne({
        where: { id: dto.idTelefonia },
      });
      if (!tel) {
        throw new BadRequestException('IdTelefonia no existe');
      }
    }
    if (dto.idPlanTelefonia !== undefined) {
      const plan = await this.catPlanesTelefoniaRepo.findOne({
        where: { id: dto.idPlanTelefonia },
      });
      if (!plan) {
        throw new BadRequestException('IdPlanTelefonia no existe');
      }
    }
    if (dto.idEstatusSim !== undefined) {
      const est = await this.catEstatusSimRepo.findOne({
        where: { id: dto.idEstatusSim },
      });
      if (!est) {
        throw new BadRequestException('IdEstatusSim no existe');
      }
    }
  }

  async create(
    dto: CreateSimsDto,
    idCliente: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const existeIcc = await this.repository.findOne({
        where: { icc: dto.icc },
      });
      if (existeIcc) {
        throw new BadRequestException('El ICC ya existe');
      }

      await this.validarFks({
        idTelefonia: dto.idTelefonia,
        idPlanTelefonia: dto.idPlanTelefonia,
        idEstatusSim: dto.idEstatusSim ?? 1,
      });

      const entity = this.repository.create({
        icc: dto.icc,
        imei: dto.imei ?? null,
        numeroTelefono: dto.numeroTelefono ?? null,
        ipEstatica: dto.ipEstatica ?? null,
        idTelefonia: dto.idTelefonia,
        idPlanTelefonia: dto.idPlanTelefonia,
        idCliente,
        idEstatusSim: dto.idEstatusSim ?? 1,
        fechaActivacion: dto.fechaActivacion
          ? new Date(dto.fechaActivacion)
          : null,
        fechaVencimiento: dto.fechaVencimiento
          ? new Date(dto.fechaVencimiento)
          : null,
        notas: dto.notas ?? null,
        estatus: dto.estatus ?? 1,
      });

      const saved = await this.repository.save(entity);

      await this.bitacoraLogger.logToBitacora(
        'Sims',
        `Se creó el SIM ICC: ${dto.icc}`,
        'CREATE',
        { dto, idCliente },
        idUser,
        ID_MODULO_SIMS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'SIM creado correctamente',
        data: { id: Number(saved.id), nombre: saved.icc },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Sims',
        `Error al crear SIM ICC: ${dto.icc}`,
        'CREATE',
        { dto, idCliente },
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
    idCliente: number,
    rol: number,
  ): Promise<ApiResponseCommon> {
    try {
      const tenant = await this.tenantFilter.forTypeOrmIdCliente(
        rol,
        idCliente,
      );
      if (tenant.sinAcceso) {
        return { data: [] };
      }
      const where: FindOptionsWhere<Sims> = {
        estatus: 1,
        ...(tenant.idCliente !== undefined
          ? { idCliente: tenant.idCliente }
          : {}),
      };
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
    idCliente: number,
    rol: number,
    page: number,
    limit: number,
  ): Promise<ApiResponseCommon> {
    try {
      const tenant = await this.tenantFilter.forTypeOrmIdCliente(
        rol,
        idCliente,
      );
      if (tenant.sinAcceso) {
        return {
          data: [],
          paginated: {
            total: 0,
            page,
            limit,
            totalPages: 0,
          },
        };
      }
      const where: FindOptionsWhere<Sims> = {
        ...(tenant.idCliente !== undefined
          ? { idCliente: tenant.idCliente }
          : {}),
      };
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

  async findOne(id: number, idCliente: number): Promise<{ data: Sims }> {
    try {
      const entity = await this.repository.findOne({
        where: { id, idCliente },
      });
      if (!entity) {
        throw new NotFoundException('SIM no encontrado');
      }
      return {
        data: { ...entity, id: Number(entity.id) },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { message: 'Error al buscar el SIM' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(
    id: number,
    dto: UpdateSimsDto,
    idCliente: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({
        where: { id, idCliente },
      });
      if (!entity) {
        throw new NotFoundException('SIM no encontrado');
      }

      if (dto.icc && dto.icc !== entity.icc) {
        const existeIcc = await this.repository.findOne({
          where: { icc: dto.icc },
        });
        if (existeIcc) {
          throw new BadRequestException('El ICC ya existe');
        }
      }

      await this.validarFks({
        idTelefonia: dto.idTelefonia,
        idPlanTelefonia: dto.idPlanTelefonia,
        idEstatusSim: dto.idEstatusSim,
      });

      const updateData: Partial<Sims> = {};
      if (dto.icc !== undefined) updateData.icc = dto.icc;
      if (dto.imei !== undefined) updateData.imei = dto.imei;
      if (dto.numeroTelefono !== undefined)
        updateData.numeroTelefono = dto.numeroTelefono;
      if (dto.ipEstatica !== undefined) updateData.ipEstatica = dto.ipEstatica;
      if (dto.idTelefonia !== undefined) updateData.idTelefonia = dto.idTelefonia;
      if (dto.idPlanTelefonia !== undefined)
        updateData.idPlanTelefonia = dto.idPlanTelefonia;
      if (dto.idEstatusSim !== undefined)
        updateData.idEstatusSim = dto.idEstatusSim;
      if (dto.fechaActivacion !== undefined)
        updateData.fechaActivacion = dto.fechaActivacion
          ? new Date(dto.fechaActivacion)
          : null;
      if (dto.fechaVencimiento !== undefined)
        updateData.fechaVencimiento = dto.fechaVencimiento
          ? new Date(dto.fechaVencimiento)
          : null;
      if (dto.notas !== undefined) updateData.notas = dto.notas;
      if (dto.estatus !== undefined) updateData.estatus = dto.estatus;

      await this.repository.update(id, updateData);

      await this.bitacoraLogger.logToBitacora(
        'Sims',
        `Se actualizó el SIM ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        ID_MODULO_SIMS,
        EstatusEnumBitcora.SUCCESS,
      );

      const updated = await this.repository.findOne({ where: { id } });
      return {
        status: 'success',
        message: 'SIM actualizado correctamente',
        data: {
          id,
          nombre: updated?.icc ?? entity.icc,
        },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Sims',
        `Error al actualizar SIM ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
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
    dto: UpdateSimsEstatusDto,
    idCliente: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({
        where: { id, idCliente },
      });
      if (!entity) {
        throw new NotFoundException('SIM no encontrado');
      }

      await this.repository.update(id, { estatus: dto.estatus });

      await this.bitacoraLogger.logToBitacora(
        'Sims',
        `Se actualizó estatus de SIM ID: ${id} a ${dto.estatus}`,
        'UPDATE',
        { id, estatus: dto.estatus, idCliente },
        idUser,
        ID_MODULO_SIMS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Estatus actualizado correctamente',
        estatus: { estatus: dto.estatus },
        data: { id, nombre: entity.icc },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Sims',
        `Error al actualizar estatus de SIM ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        ID_MODULO_SIMS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Error al cambiar estatus del SIM',
      );
    }
  }
}
