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
import { PanelAlarma } from 'src/entities/PanelAlarma';
import { Dispositivos } from 'src/entities/Dispositivos';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { CreatePanelAlarmaDto } from './dto/create-panel-alarma.dto';
import { UpdatePanelAlarmaDto } from './dto/update-panel-alarma.dto';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';
import { EnumModulos } from 'src/common/estatus.enum';

@Injectable()
export class PanelAlarmaService {
  constructor(
    @InjectRepository(PanelAlarma)
    private readonly repository: Repository<PanelAlarma>,
    @InjectRepository(Dispositivos)
    private readonly dispositivosRepo: Repository<Dispositivos>,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly tenantFilter: TenantFilterService,
  ) {}

  private async assertDispositivoDelCliente(
    idDispositivo: number,
    idCliente: number,
  ): Promise<Dispositivos> {
    const dispositivo = await this.dispositivosRepo.findOne({
      where: { id: idDispositivo, idCliente },
    });
    if (!dispositivo) {
      throw new BadRequestException(
        'El dispositivo no existe o no pertenece al cliente',
      );
    }
    return dispositivo;
  }

  private validarCifrado(dto: {
    cifradoActivo?: number;
    aesKey?: string | null;
    aesBits?: number;
  }): void {
    if (dto.cifradoActivo === 1 && !dto.aesKey?.trim()) {
      throw new BadRequestException(
        'aesKey es obligatorio cuando cifradoActivo es 1',
      );
    }
  }

  async create(
    dto: CreatePanelAlarmaDto,
    idCliente: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const cifradoActivo = dto.cifradoActivo ?? 0;
      const aesBits = dto.aesBits ?? 128;
      this.validarCifrado({
        cifradoActivo,
        aesKey: dto.aesKey,
        aesBits,
      });

      await this.assertDispositivoDelCliente(dto.idDispositivo, idCliente);

      const panelExistente = await this.repository.findOne({
        where: { idDispositivo: dto.idDispositivo },
      });
      if (panelExistente) {
        throw new BadRequestException(
          'El dispositivo ya está asociado a un panel de alarma',
        );
      }

      const existeCuenta = await this.repository.findOne({
        where: { cuentaSia: dto.cuentaSia },
      });
      if (existeCuenta) {
        throw new BadRequestException('La cuenta SIA ya está registrada');
      }

      const entity = this.repository.create({
        idDispositivo: dto.idDispositivo,
        idCliente,
        cuentaSia: dto.cuentaSia.trim(),
        nombre: dto.nombre.trim(),
        ip: dto.ip ?? null,
        cifradoActivo,
        aesKey: cifradoActivo === 1 ? (dto.aesKey ?? null) : null,
        aesBits,
        estatus: dto.estatus ?? 1,
      });

      const saved = await this.repository.save(entity);

      await this.bitacoraLogger.logToBitacora(
        'PanelAlarma',
        `Se creó el panel SIA: ${saved.cuentaSia}`,
        'CREATE',
        { dto, idCliente },
        idUser,
        EnumModulos.PANELALARMA,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Panel de alarma creado correctamente',
        data: {
          id: Number(saved.idDispositivo),
          nombre: saved.nombre,
        },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'PanelAlarma',
        `Error al crear panel SIA: ${dto.cuentaSia}`,
        'CREATE',
        { dto, idCliente },
        idUser,
        EnumModulos.PANELALARMA,
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
      const where: FindOptionsWhere<PanelAlarma> = {
        estatus: 1,
        ...(tenant.idCliente !== undefined
          ? { idCliente: tenant.idCliente }
          : {}),
      };
      const data = await this.repository.find({
        where,
        order: { idDispositivo: 'DESC' },
      });
      return {
        data: data.map((item) => ({
          ...item,
          idDispositivo: Number(item.idDispositivo),
          idCliente: Number(item.idCliente),
        })),
      };
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
          paginated: { total: 0, page, limit, totalPages: 0 },
        };
      }
      const where: FindOptionsWhere<PanelAlarma> = {
        ...(tenant.idCliente !== undefined
          ? { idCliente: tenant.idCliente }
          : {}),
      };
      const [data, total] = await this.repository.findAndCount({
        where,
        skip: (page - 1) * limit,
        take: limit,
        order: { idDispositivo: 'DESC' },
      });
      return {
        data: data.map((item) => ({
          ...item,
          idDispositivo: Number(item.idDispositivo),
          idCliente: Number(item.idCliente),
        })),
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
  ): Promise<{ data: PanelAlarma }> {
    try {
      const entity = await this.repository.findOne({
        where: { idDispositivo: id, idCliente },
      });
      if (!entity) {
        throw new NotFoundException('Panel de alarma no encontrado');
      }
      return {
        data: {
          ...entity,
          idDispositivo: Number(entity.idDispositivo),
          idCliente: Number(entity.idCliente),
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { message: 'Error al buscar el panel de alarma' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(
    id: number,
    dto: UpdatePanelAlarmaDto,
    idCliente: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({
        where: { idDispositivo: id, idCliente },
      });
      if (!entity) {
        throw new NotFoundException('Panel de alarma no encontrado');
      }

      if (dto.cuentaSia && dto.cuentaSia !== entity.cuentaSia) {
        const existeCuenta = await this.repository.findOne({
          where: { cuentaSia: dto.cuentaSia },
        });
        if (existeCuenta) {
          throw new BadRequestException('La cuenta SIA ya está registrada');
        }
      }

      const cifradoActivo =
        dto.cifradoActivo !== undefined ? dto.cifradoActivo : entity.cifradoActivo;
      const aesKey =
        dto.aesKey !== undefined ? dto.aesKey : entity.aesKey;
      const aesBits =
        dto.aesBits !== undefined ? dto.aesBits : entity.aesBits;

      this.validarCifrado({ cifradoActivo, aesKey, aesBits });

      const updateData: Partial<PanelAlarma> = {};
      if (dto.cuentaSia !== undefined) updateData.cuentaSia = dto.cuentaSia.trim();
      if (dto.nombre !== undefined) updateData.nombre = dto.nombre.trim();
      if (dto.ip !== undefined) updateData.ip = dto.ip;
      if (dto.cifradoActivo !== undefined)
        updateData.cifradoActivo = dto.cifradoActivo;
      if (dto.aesKey !== undefined) updateData.aesKey = dto.aesKey;
      if (dto.aesBits !== undefined) updateData.aesBits = dto.aesBits;
      if (dto.estatus !== undefined) updateData.estatus = dto.estatus;

      if (cifradoActivo === 0) {
        updateData.aesKey = null;
      }

      Object.assign(entity, updateData);
      await this.repository.save(entity);

      await this.bitacoraLogger.logToBitacora(
        'PanelAlarma',
        `Se actualizó el panel ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        EnumModulos.PANELALARMA,
        EstatusEnumBitcora.SUCCESS,
      );

      const updated = await this.repository.findOne({
        where: { idDispositivo: id },
      });
      return {
        status: 'success',
        message: 'Panel de alarma actualizado correctamente',
        data: {
          id,
          nombre: updated?.nombre ?? entity.nombre,
        },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'PanelAlarma',
        `Error al actualizar panel ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        EnumModulos.PANELALARMA,
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
        where: { idDispositivo: id, idCliente },
      });
      if (!entity) {
        throw new NotFoundException('Panel de alarma no encontrado');
      }

      const estatusAnterior = Number(entity.estatus) === 1 ? 1 : 0;
      const estatus = estatusAnterior === 1 ? 0 : 1;
      await this.repository.update(id, { estatus });

      await this.bitacoraLogger.logToBitacora(
        'PanelAlarma',
        `Se actualizó estatus del panel ID: ${id} a ${estatus}`,
        'UPDATE',
        { id, estatusAnterior, estatus, idCliente },
        idUser,
        EnumModulos.PANELALARMA,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Estatus actualizado correctamente',
        estatus: { estatus },
        data: { id, nombre: entity.nombre },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'PanelAlarma',
        `Error al actualizar estatus del panel ID: ${id}`,
        'UPDATE',
        { id, idCliente },
        idUser,
        EnumModulos.PANELALARMA,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Error al cambiar estatus del panel de alarma',
      );
    }
  }
}
