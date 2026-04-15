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
import { Dispositivos } from 'src/entities/Dispositivos';
import { CatModeloDispositivo } from 'src/entities/CatModeloDispositivo';
import { CatTipoDispositivo } from 'src/entities/CatTipoDispositivo';
import { CatEstatusDispositivo } from 'src/entities/CatEstatusDispositivo';
import { Sims } from 'src/entities/Sims';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { CreateDispositivosDto } from './dto/create-dispositivos.dto';
import { UpdateDispositivosDto } from './dto/update-dispositivos.dto';
import { UpdateDispositivosEstatusDto } from './dto/update-dispositivos-estatus.dto';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';

const ID_MODULO_DISPOSITIVOS = 15;

@Injectable()
export class DispositivosService {
  constructor(
    @InjectRepository(Dispositivos)
    private readonly repository: Repository<Dispositivos>,
    @InjectRepository(CatModeloDispositivo)
    private readonly catModeloDispositivoRepo: Repository<CatModeloDispositivo>,
    @InjectRepository(CatTipoDispositivo)
    private readonly catTipoDispositivoRepo: Repository<CatTipoDispositivo>,
    @InjectRepository(CatEstatusDispositivo)
    private readonly catEstatusDispositivoRepo: Repository<CatEstatusDispositivo>,
    @InjectRepository(Sims)
    private readonly simsRepo: Repository<Sims>,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly tenantFilter: TenantFilterService,
  ) {}

  private async validarFks(dto: {
    idModeloDispositivo?: number;
    idTipoDispositivo?: number;
    idEstatusDispositivo?: number;
    idSim?: number;
  }): Promise<void> {
    if (dto.idModeloDispositivo !== undefined) {
      const model = await this.catModeloDispositivoRepo.findOne({
        where: { id: dto.idModeloDispositivo },
      });
      if (!model) {
        throw new BadRequestException('IdModeloDispositivo no existe');
      }
    }
    if (dto.idTipoDispositivo !== undefined) {
      const tipo = await this.catTipoDispositivoRepo.findOne({
        where: { id: dto.idTipoDispositivo },
      });
      if (!tipo) {
        throw new BadRequestException('IdTipoDispositivo no existe');
      }
    }
    if (dto.idEstatusDispositivo !== undefined) {
      const est = await this.catEstatusDispositivoRepo.findOne({
        where: { id: dto.idEstatusDispositivo },
      });
      if (!est) {
        throw new BadRequestException('IdEstatusDispositivo no existe');
      }
    }
    if (dto.idSim !== undefined) {
      const sim = await this.simsRepo.findOne({
        where: { id: dto.idSim },
      });
      if (!sim) {
        throw new BadRequestException('IdSim no existe');
      }
    }
  }

  async create(
    dto: CreateDispositivosDto,
    idCliente: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const existeNumeroSerie = await this.repository.findOne({
        where: { numeroSerie: dto.numeroSerie },
      });
      if (existeNumeroSerie) {
        throw new BadRequestException('El número de serie ya existe');
      }

      const dispositivoConSim = await this.repository.findOne({
        where: { idSim: dto.idSim },
      });
      if (dispositivoConSim) {
        throw new BadRequestException(
          'El SIM ya está asignado a otro dispositivo',
        );
      }

      const sim = await this.simsRepo.findOne({
        where: { id: dto.idSim },
      });
      if (!sim) {
        throw new BadRequestException('IdSim no existe');
      }
      if (sim.idCliente !== idCliente) {
        throw new BadRequestException(
          'El SIM debe pertenecer al mismo cliente',
        );
      }

      await this.validarFks({
        idModeloDispositivo: dto.idModeloDispositivo,
        idTipoDispositivo: dto.idTipoDispositivo,
        idEstatusDispositivo: dto.idEstatusDispositivo ?? 1,
      });

      const entity = this.repository.create({
        numeroSerie: dto.numeroSerie,
        idModeloDispositivo: dto.idModeloDispositivo,
        idTipoDispositivo: dto.idTipoDispositivo,
        idEstatusDispositivo: dto.idEstatusDispositivo ?? 1,
        idSim: dto.idSim,
        idCliente,
        estatus: dto.estatus ?? 1,
      });

      const saved = await this.repository.save(entity);

      await this.bitacoraLogger.logToBitacora(
        'Dispositivos',
        `Se creó el dispositivo Nº serie: ${dto.numeroSerie}`,
        'CREATE',
        { dto, idCliente },
        idUser,
        ID_MODULO_DISPOSITIVOS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Dispositivo creado correctamente',
        data: { id: Number(saved.id), nombre: saved.numeroSerie },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Dispositivos',
        `Error al crear dispositivo Nº serie: ${dto.numeroSerie}`,
        'CREATE',
        { dto, idCliente },
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
      const where: FindOptionsWhere<Dispositivos> = {
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
      const where: FindOptionsWhere<Dispositivos> = {
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

  async findOne(
    id: number,
    idCliente: number,
  ): Promise<{ data: Dispositivos }> {
    try {
      const entity = await this.repository.findOne({
        where: { id, idCliente },
      });
      if (!entity) {
        throw new NotFoundException('Dispositivo no encontrado');
      }
      return {
        data: { ...entity, id: Number(entity.id) },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { message: 'Error al buscar el dispositivo' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(
    id: number,
    dto: UpdateDispositivosDto,
    idCliente: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({
        where: { id, idCliente },
      });
      if (!entity) {
        throw new NotFoundException('Dispositivo no encontrado');
      }

      if (dto.numeroSerie && dto.numeroSerie !== entity.numeroSerie) {
        const existeNumeroSerie = await this.repository.findOne({
          where: { numeroSerie: dto.numeroSerie },
        });
        if (existeNumeroSerie) {
          throw new BadRequestException('El número de serie ya existe');
        }
      }

      if (dto.idSim !== undefined && dto.idSim !== entity.idSim) {
        const dispositivoConSim = await this.repository.findOne({
          where: { idSim: dto.idSim },
        });
        if (dispositivoConSim) {
          throw new BadRequestException(
            'El SIM ya está asignado a otro dispositivo',
          );
        }
        const sim = await this.simsRepo.findOne({
          where: { id: dto.idSim },
        });
        if (!sim) {
          throw new BadRequestException('IdSim no existe');
        }
        if (sim.idCliente !== idCliente) {
          throw new BadRequestException(
            'El SIM debe pertenecer al mismo cliente',
          );
        }
      }

      await this.validarFks({
        idModeloDispositivo: dto.idModeloDispositivo,
        idTipoDispositivo: dto.idTipoDispositivo,
        idEstatusDispositivo: dto.idEstatusDispositivo,
      });

      const updateData: Partial<Dispositivos> = {};
      if (dto.numeroSerie !== undefined)
        updateData.numeroSerie = dto.numeroSerie;
      if (dto.idModeloDispositivo !== undefined)
        updateData.idModeloDispositivo = dto.idModeloDispositivo;
      if (dto.idTipoDispositivo !== undefined)
        updateData.idTipoDispositivo = dto.idTipoDispositivo;
      if (dto.idEstatusDispositivo !== undefined)
        updateData.idEstatusDispositivo = dto.idEstatusDispositivo;
      if (dto.idSim !== undefined) updateData.idSim = dto.idSim;
      if (dto.estatus !== undefined) updateData.estatus = dto.estatus;

      await this.repository.update(id, updateData);

      await this.bitacoraLogger.logToBitacora(
        'Dispositivos',
        `Se actualizó el dispositivo ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        ID_MODULO_DISPOSITIVOS,
        EstatusEnumBitcora.SUCCESS,
      );

      const updated = await this.repository.findOne({ where: { id } });
      return {
        status: 'success',
        message: 'Dispositivo actualizado correctamente',
        data: {
          id,
          nombre: updated?.numeroSerie ?? entity.numeroSerie,
        },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Dispositivos',
        `Error al actualizar dispositivo ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
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
    dto: UpdateDispositivosEstatusDto,
    idCliente: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({
        where: { id, idCliente },
      });
      if (!entity) {
        throw new NotFoundException('Dispositivo no encontrado');
      }

      await this.repository.update(id, { estatus: dto.estatus });

      await this.bitacoraLogger.logToBitacora(
        'Dispositivos',
        `Se actualizó estatus de dispositivo ID: ${id} a ${dto.estatus}`,
        'UPDATE',
        { id, estatus: dto.estatus, idCliente },
        idUser,
        ID_MODULO_DISPOSITIVOS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Estatus actualizado correctamente',
        estatus: { estatus: dto.estatus },
        data: { id, nombre: entity.numeroSerie },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Dispositivos',
        `Error al actualizar estatus de dispositivo ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        ID_MODULO_DISPOSITIVOS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Error al cambiar estatus del dispositivo',
      );
    }
  }
}
