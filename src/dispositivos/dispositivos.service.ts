import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Not, Repository } from 'typeorm';
import { Dispositivos } from 'src/entities/Dispositivos';
import { PanelAlarma } from 'src/entities/PanelAlarma';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { CreateDispositivosDto } from './dto/create-dispositivos.dto';
import { UpdateDispositivosDto } from './dto/update-dispositivos.dto';
import { UpdateDispositivoEstatusDto } from './dto/update-dispositivo-estatus.dto';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';
import {
  EnumModulos,
  EnumEstatusProductoDispositivo,
  EstatusEnum,
} from 'src/common/estatus.enum';
import { assertEstatusNoAsignado } from 'src/common/assert-estatus-no-asignado.util';
import {
  crearDispositivoBase,
  obtenerTipoPanelAlarma,
  validarFksDispositivo,
} from './crear-dispositivo.util';
import {
  mapDispositivoPlano,
  RELACIONES_DISPOSITIVO_BASE,
} from './map-relaciones.util';

@Injectable()
export class DispositivosService {
  constructor(
    @InjectRepository(Dispositivos)
    private readonly repository: Repository<Dispositivos>,
    @InjectRepository(PanelAlarma)
    private readonly panelRepo: Repository<PanelAlarma>,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly tenantFilter: TenantFilterService,
  ) {}

  private async whereTenant(
    rol: number,
    idClienteToken: number,
    idTipoDispositivo?: number,
    idClienteFiltro?: number,
  ): Promise<{ sinAcceso: boolean; where: FindOptionsWhere<Dispositivos> }> {
    const tenant = await this.tenantFilter.forTypeOrmIdCliente(
      rol,
      idClienteToken,
    );
    if (tenant.sinAcceso) {
      return { sinAcceso: true, where: {} };
    }

    let idClienteWhere = tenant.idCliente;
    if (idClienteFiltro != null) {
      if (tenant.idCliente === undefined) {
        idClienteWhere = idClienteFiltro;
      } else if (typeof tenant.idCliente === 'number') {
        if (Number(tenant.idCliente) !== idClienteFiltro) {
          return { sinAcceso: true, where: {} };
        }
        idClienteWhere = idClienteFiltro;
      } else {
        const ids = await this.tenantFilter.getClienteHijosIds(idClienteToken);
        if (!ids.includes(idClienteFiltro)) {
          return { sinAcceso: true, where: {} };
        }
        idClienteWhere = idClienteFiltro;
      }
    }

    return {
      sinAcceso: false,
      where: {
        ...(idClienteWhere !== undefined ? { idCliente: idClienteWhere } : {}),
        ...(idTipoDispositivo != null ? { idTipoDispositivo } : {}),
      },
    };
  }

  async create(
    dto: CreateDispositivosDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    const idCliente = dto.idCliente;
    try {
      const tipoPanel = await obtenerTipoPanelAlarma(
        this.repository.manager,
      ).catch(() => null);
      if (
        tipoPanel &&
        Number(dto.idTipoDispositivo) === Number(tipoPanel.id)
      ) {
        throw new BadRequestException(
          'El tipo panel requiere datos extra. Use POST /dispositivos/paneles',
        );
      }

      const saved = await crearDispositivoBase(this.repository.manager, {
        idCliente,
        idTipoDispositivo: dto.idTipoDispositivo,
        numeroSerie: dto.numeroSerie,
        imei: dto.imei ?? null,
        eco: dto.eco ?? null,
        idMarca: dto.idMarca ?? null,
        idModelo: dto.idModelo ?? null,
      });

      await this.bitacoraLogger.logToBitacora(
        'Dispositivos',
        `Se creó el dispositivo Nº serie: ${dto.numeroSerie}`,
        'CREATE',
        { dto, idCliente },
        idUser,
        EnumModulos.DISPOSITIVOS,
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
        EnumModulos.DISPOSITIVOS,
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
    idTipoDispositivo?: number,
    idClienteFiltro?: number,
  ): Promise<ApiResponseCommon> {
    try {
      const { sinAcceso, where } = await this.whereTenant(
        rol,
        idCliente,
        idTipoDispositivo,
        idClienteFiltro,
      );
      if (sinAcceso) {
        return { data: [] };
      }
      const data = await this.repository.find({
        where: {
          ...where,
          estatus: EnumEstatusProductoDispositivo.ACTIVO,
        },
        relations: [...RELACIONES_DISPOSITIVO_BASE],
        order: { id: 'DESC' },
      });
      return { data: data.map((item) => mapDispositivoPlano(item)) };
    } catch (error) {
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findAll(
    idCliente: number,
    rol: number,
    page: number,
    limit: number,
    idTipoDispositivo?: number,
    obtenerTodos?: EstatusEnum,
  ): Promise<ApiResponseCommon> {
    try {
      const { sinAcceso, where } = await this.whereTenant(
        rol,
        idCliente,
        idTipoDispositivo,
      );
      if (sinAcceso) {
        return {
          data: [],
          paginated: { total: 0, page, limit, totalPages: 0 },
        };
      }
      const incluirInservibles = obtenerTodos === EstatusEnum.ACTIVO;
      const [data, total] = await this.repository.findAndCount({
        where: {
          ...where,
          ...(incluirInservibles
            ? {}
            : { estatus: Not(EnumEstatusProductoDispositivo.INSERVIBLE) }),
        },
        relations: [...RELACIONES_DISPOSITIVO_BASE],
        skip: (page - 1) * limit,
        take: limit,
        order: { id: 'DESC' },
      });
      return {
        data: data.map((item) => mapDispositivoPlano(item)),
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

  async findOne(id: number, idCliente: number) {
    try {
      const entity = await this.repository.findOne({
        where: { id, idCliente },
        relations: [...RELACIONES_DISPOSITIVO_BASE],
      });
      if (!entity) {
        throw new NotFoundException('Dispositivo no encontrado');
      }
      return { data: mapDispositivoPlano(entity) };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
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

      if (
        dto.imei != null &&
        Number(dto.imei) !== Number(entity.imei ?? NaN)
      ) {
        const existeImei = await this.repository.findOne({
          where: { imei: dto.imei },
        });
        if (existeImei) {
          throw new BadRequestException('El IMEI ya está registrado');
        }
      }

      await validarFksDispositivo(this.repository.manager, {
        idTipoDispositivo: dto.idTipoDispositivo,
        idMarca:
          dto.idMarca !== undefined || dto.idModelo !== undefined
            ? dto.idMarca !== undefined
              ? dto.idMarca
              : entity.idMarca
            : undefined,
        idModelo:
          dto.idMarca !== undefined || dto.idModelo !== undefined
            ? dto.idModelo !== undefined
              ? dto.idModelo
              : entity.idModelo
            : dto.idModelo,
      });

      if (dto.idTipoDispositivo !== undefined)
        entity.idTipoDispositivo = dto.idTipoDispositivo;
      if (dto.numeroSerie !== undefined) entity.numeroSerie = dto.numeroSerie;
      if (dto.imei !== undefined) entity.imei = dto.imei;
      if (dto.eco !== undefined) entity.eco = dto.eco;
      if (dto.idMarca !== undefined) entity.idMarca = dto.idMarca;
      if (dto.idModelo !== undefined) entity.idModelo = dto.idModelo;
      await this.repository.save(entity);

      await this.bitacoraLogger.logToBitacora(
        'Dispositivos',
        `Se actualizó el dispositivo ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        EnumModulos.DISPOSITIVOS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Dispositivo actualizado correctamente',
        data: { id, nombre: entity.numeroSerie },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Dispositivos',
        `Error al actualizar dispositivo ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        EnumModulos.DISPOSITIVOS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async updateEstatus(
    id: number,
    dto: UpdateDispositivoEstatusDto,
    idCliente: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({
        where: { id },
      });
      if (!entity) {
        throw new NotFoundException('Dispositivo no encontrado');
      }

      assertEstatusNoAsignado(Number(entity.estatus), 'dispositivo');

      const estatusAnterior = Number(entity.estatus);
      const estatus = dto.estatus;
      await this.repository.update({ id }, { estatus });
      await this.panelRepo.update({ idDispositivo: id }, { estatus });

      await this.bitacoraLogger.logToBitacora(
        'Dispositivos',
        `Se actualizó estatus de dispositivo ID: ${id} a ${estatus}`,
        'UPDATE',
        {
          id,
          estatusAnterior,
          estatus,
          idCliente,
          idClienteRecurso: entity.idCliente,
        },
        idUser,
        EnumModulos.DISPOSITIVOS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Estatus actualizado correctamente',
        estatus: { estatus },
        data: { id, nombre: entity.numeroSerie },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Dispositivos',
        `Error al actualizar estatus de dispositivo ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        EnumModulos.DISPOSITIVOS,
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
