import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Not, Repository } from 'typeorm';
import { Sims } from 'src/entities/Sims';
import { CatTelefonia } from 'src/entities/CatTelefonia';
import { CatPlanesTelefonia } from 'src/entities/CatPlanesTelefonia';
import { Clientes } from 'src/entities/Clientes';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { CreateSimsDto } from './dto/create-sims.dto';
import { UpdateSimsDto } from './dto/update-sims.dto';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';
import {
  EnumEstatusRecurso,
  EnumModulos,
} from 'src/common/estatus.enum';
import { assertEstatusNoAsignado } from 'src/common/assert-estatus-no-asignado.util';

@Injectable()
export class SimsService {
  constructor(
    @InjectRepository(Sims)
    private readonly repository: Repository<Sims>,
    @InjectRepository(CatTelefonia)
    private readonly catTelefoniaRepo: Repository<CatTelefonia>,
    @InjectRepository(CatPlanesTelefonia)
    private readonly catPlanesTelefoniaRepo: Repository<CatPlanesTelefonia>,
    @InjectRepository(Clientes)
    private readonly clientesRepo: Repository<Clientes>,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly tenantFilter: TenantFilterService,
  ) { }

  private async validarFks(dto: {
    idCliente?: number;
    idTelefonia?: number;
    idPlanTelefonia?: number;
  }): Promise<void> {
    if (dto.idCliente !== undefined) {
      const cliente = await this.clientesRepo.findOne({
        where: { id: dto.idCliente },
      });
      if (!cliente) {
        throw new BadRequestException('IdCliente no existe');
      }
    }
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
  }

  private async assertImeiDisponible(
    imei: string | null | undefined,
    excludeId?: number,
  ): Promise<void> {
    const valor = imei?.trim();
    if (!valor) return;

    const where: FindOptionsWhere<Sims> = { imei: valor };
    if (excludeId !== undefined) {
      where.id = Not(excludeId);
    }

    const existente = await this.repository.findOne({ where });
    if (existente) {
      throw new ConflictException('El IMEI ya está registrado');
    }
  }

  async create(
    dto: CreateSimsDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      await this.validarFks({
        idCliente: dto.idCliente,
        idTelefonia: dto.idTelefonia,
        idPlanTelefonia: dto.idPlanTelefonia,
      });
      await this.assertImeiDisponible(dto.imei);

      const entity = this.repository.create({
        imei: dto.imei ?? null,
        numeroTelefono: dto.numeroTelefono ?? null,
        idTelefonia: dto.idTelefonia,
        idPlanTelefonia: dto.idPlanTelefonia,
        idCliente: dto.idCliente,
        notas: dto.notas ?? null,
        estatus: EnumEstatusRecurso.DISPONIBLE,
      });

      const saved = await this.repository.save(entity);
      const nombreSim =
        saved.numeroTelefono ?? saved.imei ?? `SIM ${saved.id}`;

      await this.bitacoraLogger.logToBitacora(
        'Sims',
        `Se creó el SIM ID: ${saved.id}`,
        'CREATE',
        { dto },
        idUser,
        EnumModulos.SIMS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'SIM creado correctamente',
        data: { id: Number(saved.id), nombre: nombreSim },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Sims',
        `Error al crear SIM`,
        'CREATE',
        { dto },
        idUser,
        EnumModulos.SIMS,
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
        estatus: EnumEstatusRecurso.DISPONIBLE,
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
        where: { id },
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
        where: { id },
      });
      if (!entity) {
        throw new NotFoundException('SIM no encontrado');
      }

      await this.validarFks({
        idCliente: dto.idCliente,
        idTelefonia: dto.idTelefonia,
        idPlanTelefonia: dto.idPlanTelefonia,
      });
      if (dto.imei !== undefined) {
        await this.assertImeiDisponible(dto.imei, id);
      }

      const updateData: Partial<Sims> = {};
      if (dto.imei !== undefined) updateData.imei = dto.imei;
      if (dto.numeroTelefono !== undefined)
        updateData.numeroTelefono = dto.numeroTelefono;
      if (dto.idCliente !== undefined) updateData.idCliente = dto.idCliente;
      if (dto.idTelefonia !== undefined) updateData.idTelefonia = dto.idTelefonia;
      if (dto.idPlanTelefonia !== undefined)
        updateData.idPlanTelefonia = dto.idPlanTelefonia;
      if (dto.notas !== undefined) updateData.notas = dto.notas;
      await this.repository.update(id, updateData);

      await this.bitacoraLogger.logToBitacora(
        'Sims',
        `Se actualizó el SIM ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        EnumModulos.SIMS,
        EstatusEnumBitcora.SUCCESS,
      );

      const updated = await this.repository.findOne({ where: { id } });
      const nombreSim =
        updated?.numeroTelefono ??
        updated?.imei ??
        entity.numeroTelefono ??
        entity.imei ??
        `SIM ${id}`;
      return {
        status: 'success',
        message: 'SIM actualizado correctamente',
        data: {
          id,
          nombre: nombreSim,
        },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Sims',
        `Error al actualizar SIM ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        EnumModulos.SIMS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async updateEstatus(
    id: number,
    idCliente: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({
        where: { id },
      });
      if (!entity) {
        throw new NotFoundException('SIM no encontrado');
      }

      assertEstatusNoAsignado(Number(entity.estatus), 'SIM');

      const estatusAnterior =
        Number(entity.estatus) === EnumEstatusRecurso.DISPONIBLE
          ? EnumEstatusRecurso.DISPONIBLE
          : EnumEstatusRecurso.BAJA;
      const estatus =
        estatusAnterior === EnumEstatusRecurso.DISPONIBLE
          ? EnumEstatusRecurso.BAJA
          : EnumEstatusRecurso.DISPONIBLE;
      await this.repository.update(id, { estatus });

      await this.bitacoraLogger.logToBitacora(
        'Sims',
        `Se actualizó estatus de SIM ID: ${id} a ${estatus}`,
        'UPDATE',
        { id, estatusAnterior, estatus, idCliente },
        idUser,
        EnumModulos.SIMS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Estatus actualizado correctamente',
        estatus: { estatus },
        data: {
          id,
          nombre:
            entity.numeroTelefono ?? entity.imei ?? `SIM ${id}`,
        },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Sims',
        `Error al actualizar estatus de SIM ID: ${id}`,
        'UPDATE',
        { id, idCliente },
        idUser,
        EnumModulos.SIMS,
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
