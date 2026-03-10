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
import { Vehiculos } from 'src/entities/Vehiculos';
import { CatModeloVehiculo } from 'src/entities/CatModeloVehiculo';
import { CatTipoVehiculo } from 'src/entities/CatTipoVehiculo';
import { CatEstatusVehiculo } from 'src/entities/CatEstatusVehiculo';
import { CatTipoCombustible } from 'src/entities/CatTipoCombustible';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { CreateVehiculosDto } from './dto/create-vehiculos.dto';
import { UpdateVehiculosDto } from './dto/update-vehiculos.dto';
import { UpdateVehiculosEstatusDto } from './dto/update-vehiculos-estatus.dto';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';

const ID_MODULO_VEHICULOS = 16;

@Injectable()
export class VehiculosService {
  constructor(
    @InjectRepository(Vehiculos)
    private readonly repository: Repository<Vehiculos>,
    @InjectRepository(CatModeloVehiculo)
    private readonly catModeloVehiculoRepo: Repository<CatModeloVehiculo>,
    @InjectRepository(CatTipoVehiculo)
    private readonly catTipoVehiculoRepo: Repository<CatTipoVehiculo>,
    @InjectRepository(CatEstatusVehiculo)
    private readonly catEstatusVehiculoRepo: Repository<CatEstatusVehiculo>,
    @InjectRepository(CatTipoCombustible)
    private readonly catTipoCombustibleRepo: Repository<CatTipoCombustible>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  private async validarFks(dto: {
    idModeloVehiculo?: number;
    idTipoVehiculo?: number;
    idEstatusVehiculo?: number;
    idCombustible?: number;
  }): Promise<void> {
    if (dto.idModeloVehiculo !== undefined) {
      const model = await this.catModeloVehiculoRepo.findOne({
        where: { id: dto.idModeloVehiculo },
      });
      if (!model) {
        throw new BadRequestException('IdModeloVehiculo no existe');
      }
    }
    if (dto.idTipoVehiculo !== undefined) {
      const tipo = await this.catTipoVehiculoRepo.findOne({
        where: { id: dto.idTipoVehiculo },
      });
      if (!tipo) {
        throw new BadRequestException('IdTipoVehiculo no existe');
      }
    }
    if (dto.idEstatusVehiculo !== undefined) {
      const est = await this.catEstatusVehiculoRepo.findOne({
        where: { id: dto.idEstatusVehiculo },
      });
      if (!est) {
        throw new BadRequestException('IdEstatusVehiculo no existe');
      }
    }
    if (dto.idCombustible !== undefined) {
      const comb = await this.catTipoCombustibleRepo.findOne({
        where: { id: dto.idCombustible },
      });
      if (!comb) {
        throw new BadRequestException('IdCombustible no existe');
      }
    }
  }

  async create(
    dto: CreateVehiculosDto,
    idCliente: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const existePlaca = await this.repository.findOne({
        where: { placa: dto.placa, idCliente },
      });
      if (existePlaca) {
        throw new BadRequestException(
          'La placa ya existe para este cliente',
        );
      }

      await this.validarFks({
        idModeloVehiculo: dto.idModeloVehiculo,
        idTipoVehiculo: dto.idTipoVehiculo,
        idEstatusVehiculo: dto.idEstatusVehiculo ?? 1,
        idCombustible: dto.idCombustible,
      });

      const entity = this.repository.create({
        placa: dto.placa,
        numeroEconomico: dto.numeroEconomico,
        idModeloVehiculo: dto.idModeloVehiculo,
        idTipoVehiculo: dto.idTipoVehiculo,
        anio: dto.anio,
        color: dto.color ?? null,
        numeroSerie: dto.numeroSerie ?? null,
        foto: dto.foto ?? null,
        fotoFrente: dto.fotoFrente ?? null,
        fotoTrasera: dto.fotoTrasera ?? null,
        fotoDerecha: dto.fotoDerecha ?? null,
        fotoIzquierda: dto.fotoIzquierda ?? null,
        fotoExtra: dto.fotoExtra ?? null,
        tarjetaCirculacion: dto.tarjetaCirculacion ?? null,
        polizaSeguro: dto.polizaSeguro ?? null,
        permisoConcesion: dto.permisoConcesion ?? null,
        inspeccionMecanica: dto.inspeccionMecanica ?? null,
        pasajerosSentados: dto.pasajerosSentados ?? null,
        pasajerosParados: dto.pasajerosParados ?? null,
        idCombustible: dto.idCombustible ?? null,
        km: dto.km ?? null,
        capacidadLitros: dto.capacidadLitros ?? null,
        idEstatusVehiculo: dto.idEstatusVehiculo ?? 1,
        idCliente,
        estatus: dto.estatus ?? 1,
      });

      const saved = await this.repository.save(entity);

      await this.bitacoraLogger.logToBitacora(
        'Vehiculos',
        `Se creó el vehículo placa: ${dto.placa}`,
        'CREATE',
        { dto, idCliente },
        idUser,
        ID_MODULO_VEHICULOS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Vehículo creado correctamente',
        data: { id: Number(saved.id), nombre: saved.placa },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Vehiculos',
        `Error al crear vehículo placa: ${dto.placa}`,
        'CREATE',
        { dto, idCliente },
        idUser,
        ID_MODULO_VEHICULOS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async findAllList(
    idCliente: number,
    soloActivos = true,
  ): Promise<ApiResponseCommon> {
    try {
      const where: Record<string, unknown> = { idCliente };
      if (soloActivos) {
        where.estatus = 1;
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
    idCliente: number,
    page: number,
    limit: number,
    soloActivos = false,
  ): Promise<ApiResponseCommon> {
    try {
      const where: Record<string, unknown> = { idCliente };
      if (soloActivos) {
        where.estatus = 1;
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

  async findOne(
    id: number,
    idCliente: number,
  ): Promise<{ data: Vehiculos }> {
    try {
      const entity = await this.repository.findOne({
        where: { id, idCliente },
      });
      if (!entity) {
        throw new NotFoundException('Vehículo no encontrado');
      }
      return {
        data: { ...entity, id: Number(entity.id) },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { message: 'Error al buscar el vehículo' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(
    id: number,
    dto: UpdateVehiculosDto,
    idCliente: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({
        where: { id, idCliente },
      });
      if (!entity) {
        throw new NotFoundException('Vehículo no encontrado');
      }

      if (dto.placa && dto.placa !== entity.placa) {
        const existePlaca = await this.repository.findOne({
          where: { placa: dto.placa, idCliente },
        });
        if (existePlaca) {
          throw new BadRequestException(
            'La placa ya existe para este cliente',
          );
        }
      }

      await this.validarFks({
        idModeloVehiculo: dto.idModeloVehiculo,
        idTipoVehiculo: dto.idTipoVehiculo,
        idEstatusVehiculo: dto.idEstatusVehiculo,
        idCombustible: dto.idCombustible,
      });

      const updateData: Partial<Vehiculos> = {};
      if (dto.placa !== undefined) updateData.placa = dto.placa;
      if (dto.numeroEconomico !== undefined)
        updateData.numeroEconomico = dto.numeroEconomico;
      if (dto.idModeloVehiculo !== undefined)
        updateData.idModeloVehiculo = dto.idModeloVehiculo;
      if (dto.idTipoVehiculo !== undefined)
        updateData.idTipoVehiculo = dto.idTipoVehiculo;
      if (dto.anio !== undefined) updateData.anio = dto.anio;
      if (dto.color !== undefined) updateData.color = dto.color;
      if (dto.numeroSerie !== undefined)
        updateData.numeroSerie = dto.numeroSerie;
      if (dto.foto !== undefined) updateData.foto = dto.foto;
      if (dto.fotoFrente !== undefined) updateData.fotoFrente = dto.fotoFrente;
      if (dto.fotoTrasera !== undefined)
        updateData.fotoTrasera = dto.fotoTrasera;
      if (dto.fotoDerecha !== undefined)
        updateData.fotoDerecha = dto.fotoDerecha;
      if (dto.fotoIzquierda !== undefined)
        updateData.fotoIzquierda = dto.fotoIzquierda;
      if (dto.fotoExtra !== undefined) updateData.fotoExtra = dto.fotoExtra;
      if (dto.tarjetaCirculacion !== undefined)
        updateData.tarjetaCirculacion = dto.tarjetaCirculacion;
      if (dto.polizaSeguro !== undefined)
        updateData.polizaSeguro = dto.polizaSeguro;
      if (dto.permisoConcesion !== undefined)
        updateData.permisoConcesion = dto.permisoConcesion;
      if (dto.inspeccionMecanica !== undefined)
        updateData.inspeccionMecanica = dto.inspeccionMecanica;
      if (dto.pasajerosSentados !== undefined)
        updateData.pasajerosSentados = dto.pasajerosSentados;
      if (dto.pasajerosParados !== undefined)
        updateData.pasajerosParados = dto.pasajerosParados;
      if (dto.idCombustible !== undefined)
        updateData.idCombustible = dto.idCombustible;
      if (dto.km !== undefined) updateData.km = dto.km;
      if (dto.capacidadLitros !== undefined)
        updateData.capacidadLitros = dto.capacidadLitros;
      if (dto.idEstatusVehiculo !== undefined)
        updateData.idEstatusVehiculo = dto.idEstatusVehiculo;
      if (dto.estatus !== undefined) updateData.estatus = dto.estatus;

      await this.repository.update(id, updateData);

      await this.bitacoraLogger.logToBitacora(
        'Vehiculos',
        `Se actualizó el vehículo ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        ID_MODULO_VEHICULOS,
        EstatusEnumBitcora.SUCCESS,
      );

      const updated = await this.repository.findOne({ where: { id } });
      return {
        status: 'success',
        message: 'Vehículo actualizado correctamente',
        data: {
          id,
          nombre: updated?.placa ?? entity.placa,
        },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Vehiculos',
        `Error al actualizar vehículo ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        ID_MODULO_VEHICULOS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async updateEstatus(
    id: number,
    dto: UpdateVehiculosEstatusDto,
    idCliente: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({
        where: { id, idCliente },
      });
      if (!entity) {
        throw new NotFoundException('Vehículo no encontrado');
      }

      await this.repository.update(id, { estatus: dto.estatus });

      await this.bitacoraLogger.logToBitacora(
        'Vehiculos',
        `Se actualizó estatus de vehículo ID: ${id} a ${dto.estatus}`,
        'UPDATE',
        { id, estatus: dto.estatus, idCliente },
        idUser,
        ID_MODULO_VEHICULOS,
        EstatusEnumBitcora.SUCCESS,
      );

      return {
        status: 'success',
        message: 'Estatus actualizado correctamente',
        estatus: { estatus: dto.estatus },
        data: { id, nombre: entity.placa },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Vehiculos',
        `Error al actualizar estatus de vehículo ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        ID_MODULO_VEHICULOS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(
        'Error al cambiar estatus del vehículo',
      );
    }
  }
}
