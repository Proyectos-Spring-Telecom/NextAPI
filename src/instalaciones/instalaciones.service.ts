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
import { Instalaciones } from 'src/entities/Instalaciones';
import { Dispositivos } from 'src/entities/Dispositivos';
import { Sims } from 'src/entities/Sims';
import { CatEstatusInstalacion } from 'src/entities/CatEstatusInstalacion';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { CreateInstalacionesDto } from './dto/create-instalaciones.dto';
import { UpdateInstalacionesDto } from './dto/update-instalaciones.dto';
import { UpdateInstalacionesEstatusDto } from './dto/update-instalaciones-estatus.dto';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';

const ID_MODULO_INSTALACIONES = 17;

@Injectable()
export class InstalacionesService {
  constructor(
    @InjectRepository(Instalaciones)
    private readonly repository: Repository<Instalaciones>,
    @InjectRepository(Dispositivos)
    private readonly dispositivosRepo: Repository<Dispositivos>,
    @InjectRepository(Sims)
    private readonly simsRepo: Repository<Sims>,
    @InjectRepository(CatEstatusInstalacion)
    private readonly estatusInstalacionRepo: Repository<CatEstatusInstalacion>,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly tenantFilter: TenantFilterService,
  ) {}

  private async validarDispositivoPerteneceCliente(
    idDispositivo: number,
    idCliente: number,
  ): Promise<Dispositivos> {
    const dispositivo = await this.dispositivosRepo.findOne({
      where: { id: idDispositivo, idCliente },
    });
    if (!dispositivo) {
      throw new BadRequestException(
        'IdDispositivo no existe o no pertenece al cliente',
      );
    }
    return dispositivo;
  }

  private async validarSimPerteneceCliente(
    idSim: number,
    idCliente: number,
  ): Promise<Sims> {
    const sim = await this.simsRepo.findOne({
      where: { id: idSim, idCliente },
    });
    if (!sim) {
      throw new BadRequestException(
        'IdSim no existe o no pertenece al cliente',
      );
    }
    return sim;
  }

  private async validarDispositivoSinInstalacionActiva(
    idDispositivo: number,
    idCliente: number,
    excludeId?: number,
  ): Promise<void> {
    const qb = this.repository
      .createQueryBuilder('i')
      .where('i.idCliente = :idCliente', { idCliente })
      .andWhere('i.idDispositivo = :idDispositivo', { idDispositivo })
      .andWhere('i.estatus = 1');
    if (excludeId !== undefined) {
      qb.andWhere('i.id != :excludeId', { excludeId });
    }
    const existe = await qb.getOne();
    if (existe) {
      throw new BadRequestException(
        'El dispositivo ya tiene una instalación activa',
      );
    }
  }

  private async validarSimSinInstalacionActiva(
    idSim: number,
    idCliente: number,
    excludeId?: number,
  ): Promise<void> {
    const qb = this.repository
      .createQueryBuilder('i')
      .where('i.idCliente = :idCliente', { idCliente })
      .andWhere('i.idSim = :idSim', { idSim })
      .andWhere('i.estatus = 1');
    if (excludeId !== undefined) {
      qb.andWhere('i.id != :excludeId', { excludeId });
    }
    const existe = await qb.getOne();
    if (existe) {
      throw new BadRequestException(
        'El SIM ya tiene una instalación activa',
      );
    }
  }

  private async validarEstatusInstalacion(id: number): Promise<void> {
    const estatus = await this.estatusInstalacionRepo.findOne({
      where: { id },
    });
    if (!estatus) {
      throw new BadRequestException('EstatusInstalacion no existe');
    }
  }

  async create(
    dto: CreateInstalacionesDto,
    idCliente: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      if (dto.idDispositivo != null) {
        await this.validarDispositivoPerteneceCliente(
          dto.idDispositivo,
          idCliente,
        );
        await this.validarDispositivoSinInstalacionActiva(
          dto.idDispositivo,
          idCliente,
        );
      }
      if (dto.idSim != null) {
        await this.validarSimPerteneceCliente(dto.idSim, idCliente);
        await this.validarSimSinInstalacionActiva(dto.idSim, idCliente);
      }
      await this.validarEstatusInstalacion(dto.estatusInstalacion ?? 1);

      const entity = this.repository.create({
        idCliente,
        idProducto: dto.idProducto,
        idDispositivo: dto.idDispositivo ?? null,
        idSim: dto.idSim ?? null,
        estatusInstalacion: dto.estatusInstalacion ?? 1,
        estatus: dto.estatus ?? 1,
      });

      const saved = await this.repository.save(entity);

      const dispositivoLabel =
        dto.idDispositivo != null ? `Dispositivo ${dto.idDispositivo}` : 'sin dispositivo';

      await this.bitacoraLogger.logToBitacora(
        'Instalaciones',
        `Se creó la instalación ID: ${saved.id} (${dispositivoLabel})`,
        'CREATE',
        { dto, idCliente },
        idUser,
        ID_MODULO_INSTALACIONES,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Instalación creada correctamente',
        data: {
          id: Number(saved.id),
          nombre: `Instalación ${saved.id}`,
        },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Instalaciones',
        `Error al crear instalación (Producto ${dto.idProducto})`,
        'CREATE',
        { dto, idCliente },
        idUser,
        ID_MODULO_INSTALACIONES,
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
      const where: FindOptionsWhere<Instalaciones> = {
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
      const where: FindOptionsWhere<Instalaciones> = {
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
  ): Promise<{ data: Instalaciones }> {
    try {
      const entity = await this.repository.findOne({
        where: { id, idCliente },
      });
      if (!entity) {
        throw new NotFoundException('Instalación no encontrada');
      }
      return {
        data: { ...entity, id: Number(entity.id) },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { message: 'Error al buscar la instalación' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(
    id: number,
    dto: UpdateInstalacionesDto,
    idCliente: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({
        where: { id, idCliente },
      });
      if (!entity) {
        throw new NotFoundException('Instalación no encontrada');
      }

      if (
        dto.idDispositivo !== undefined &&
        dto.idDispositivo !== entity.idDispositivo
      ) {
        if (dto.idDispositivo != null) {
          await this.validarDispositivoPerteneceCliente(
            dto.idDispositivo,
            idCliente,
          );
          await this.validarDispositivoSinInstalacionActiva(
            dto.idDispositivo,
            idCliente,
            id,
          );
        }
      }

      if (dto.idSim !== undefined && dto.idSim !== entity.idSim) {
        if (dto.idSim != null) {
          await this.validarSimPerteneceCliente(dto.idSim, idCliente);
          await this.validarSimSinInstalacionActiva(
            dto.idSim,
            idCliente,
            id,
          );
        }
      }

      if (dto.estatusInstalacion !== undefined) {
        await this.validarEstatusInstalacion(dto.estatusInstalacion);
      }

      const updateData: Partial<Instalaciones> = {};
      if (dto.idProducto !== undefined)
        updateData.idProducto = dto.idProducto;
      if (dto.idDispositivo !== undefined)
        updateData.idDispositivo = dto.idDispositivo;
      if (dto.idSim !== undefined) updateData.idSim = dto.idSim;
      if (dto.estatusInstalacion !== undefined)
        updateData.estatusInstalacion = dto.estatusInstalacion;
      if (dto.estatus !== undefined) updateData.estatus = dto.estatus;

      await this.repository.update(id, updateData);

      await this.bitacoraLogger.logToBitacora(
        'Instalaciones',
        `Se actualizó la instalación ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        ID_MODULO_INSTALACIONES,
        EstatusEnumBitcora.SUCCESS,
      );

      const updated = await this.repository.findOne({ where: { id } });
      return {
        status: 'success',
        message: 'Instalación actualizada correctamente',
        data: {
          id,
          nombre: `Instalación ${id}`,
        },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Instalaciones',
        `Error al actualizar instalación ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        ID_MODULO_INSTALACIONES,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async updateEstatus(
    id: number,
    dto: UpdateInstalacionesEstatusDto,
    idCliente: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({
        where: { id, idCliente },
      });
      if (!entity) {
        throw new NotFoundException('Instalación no encontrada');
      }

      await this.repository.update(id, { estatus: dto.estatus });

      await this.bitacoraLogger.logToBitacora(
        'Instalaciones',
        `Se actualizó estatus de instalación ID: ${id} a ${dto.estatus}`,
        'UPDATE',
        { id, estatus: dto.estatus, idCliente },
        idUser,
        ID_MODULO_INSTALACIONES,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Estatus actualizado correctamente',
        estatus: { estatus: dto.estatus },
        data: { id, nombre: `Instalación ${id}` },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Instalaciones',
        `Error al actualizar estatus de instalación ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        ID_MODULO_INSTALACIONES,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Error al cambiar estatus de la instalación',
      );
    }
  }
}
