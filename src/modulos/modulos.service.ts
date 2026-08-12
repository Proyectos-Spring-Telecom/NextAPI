import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateModuloDto } from './dto/create-modulo.dto';
import { UpdateModuloDto } from './dto/update-modulo.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Modulos } from 'src/entities/Modulos';
import { Repository } from 'typeorm';
import { Permisos } from 'src/entities/Permisos';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';

@Injectable()
export class ModulosService {
  constructor(
    @InjectRepository(Permisos)
    private readonly permisosRepository: Repository<Permisos>,
    @InjectRepository(Modulos)
    private readonly moduloRepository: Repository<Modulos>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  async create(
    createModuloDto: CreateModuloDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const modulos = await this.moduloRepository.findOne({
        where: { nombre: createModuloDto.nombre },
      });
      if (modulos) {
        throw new BadRequestException('El modulo ya existe');
      }
      const create = await this.moduloRepository.create(createModuloDto);
      const saved = await this.moduloRepository.save(create);

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { createModuloDto };
      await this.bitacoraLogger.logToBitacora(
        'Modulos',
        `Se creó un modulos con nombre: ${createModuloDto.nombre}`,
        'CREATE',
        querylogger,
        idUser,
        5,
        EstatusEnumBitcora.SUCCESS,
      );

      const idMod = saved.id;
      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Modulo creado correctamente',
        data: {
          id: Number(idMod),
          nombre: `${saved.nombre} ${saved.descripcion} ` || '',
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { createModuloDto };
      await this.bitacoraLogger.logToBitacora(
        'Modulos',
        `Se creó un modulos con nombre: ${createModuloDto.nombre}`,
        'CREATE',
        querylogger,
        idUser,
        5,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      throw new BadRequestException(error);
    }
  }

  async findAllList(): Promise<ApiResponseCommon> {
    try {
      const modulos = await this.moduloRepository.find({
        relations: ['permisos'],
        where: { estatus: 1 },
      });
      // 🔥 Forzamos ids a number y agregamos nombreCompleto
      const data = modulos.map((item) => ({
        ...item,
        id: Number(item.id),
        permisos: item.permisos.map((permiso) => ({
          ...permiso,
          id: Number(permiso.id),
          idModulo: Number(permiso.idModulo),
        })),
      }));
      const result: ApiResponseCommon = {
        data,
      };
      return result;
    } catch (error) {
      throw new BadRequestException(error);
    }
  }

  async findAll(page: number, limit: number): Promise<ApiResponseCommon> {
    try {
      const [data, total] = await this.moduloRepository.findAndCount({
        relations: ['permisos'],
        skip: (page - 1) * limit,
        take: limit,
      });
      // 🔥 Forzamos ids a number y agregamos nombreCompleto
      const modulos = data.map((item) => ({
        ...item,
        id: Number(item.id),
        permisos: item.permisos.map((permiso) => ({
          ...permiso,
          id: Number(permiso.id),
          idModulo: Number(permiso.idModulo),
        })),
      }));

      const result: ApiResponseCommon = {
        data: modulos,
        paginated: {
          total: total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
      return result;
    } catch (error) {
      throw new BadRequestException(error.message || 'Error fetching data');
    }
  }

  async findOne(id: number) {
    try {
      const modulo = await this.moduloRepository.findOne({
        where: { id: id },
        relations: ['permisos'],
      });
      if (!modulo) throw new NotFoundException({ message: 'Módulo no encontrado' });

      return { data: modulo };
    } catch (error) {
      if (error instanceof HttpException) throw error;

      console.error('Error interno:', error);

      throw new HttpException(
        {
          message: 'Error interno al buscar el módulo',
          details: error.message,
        },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(
    id: number,
    updateModuloDto: UpdateModuloDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const modulo = await this.moduloRepository.findOne({
        where: { id: id },
      });
      if (!modulo) throw new NotFoundException('Módulo no encontrado');
      await this.moduloRepository.update(id, updateModuloDto);
      const moduloResult = await this.moduloRepository.findOne({
        where: { id: id },
      });

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { updateModuloDto };
      await this.bitacoraLogger.logToBitacora(
        'Modulos',
        `Se creó un modulos con modulo: ${updateModuloDto.nombre}`,
        'UPDATE',
        querylogger,
        idUser,
        5,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Modulo actualizado correctamente',
        data: {
          id: id,
          nombre: `${moduloResult?.nombre} ${moduloResult?.descripcion} ` || '',
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { updateModuloDto };
      await this.bitacoraLogger.logToBitacora(
        'Modulos',
        `Se creó un modulos con modulo: ${updateModuloDto.nombre}`,
        'UPDATE',
        querylogger,
        idUser,
        5,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      throw new BadRequestException(error);
    }
  }

  async updateModulosStatus(id: number, idUser: number): Promise<ApiCrudResponse> {
    try {
      const modulo = await this.moduloRepository.findOne({ where: { id: id } });
      if (!modulo) {
        throw new NotFoundException('Modulo no encontrado');
      }
      const estatusAnterior = Number(modulo.estatus) === 1 ? 1 : 0;
      const estatus = estatusAnterior === 1 ? 0 : 1;
      await this.moduloRepository.update(id, { estatus });
      await this.permisosRepository.update({ idModulo: id }, { estatus });

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { id, estatusAnterior, estatus };
      await this.bitacoraLogger.logToBitacora(
        'Modulos',
        `Se actualizo el modulo con ID: ${id} a estatus: ${estatus}`,
        'UPDATE',
        querylogger,
        idUser,
        5,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Estatus modulo actualizado correctamente',
        estatus: { estatus: estatus },
        data: {
          id: id,
          nombre: `${modulo.nombre} ${modulo.descripcion} ` || '',
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { id };
      await this.bitacoraLogger.logToBitacora(
        'Modulos',
        `No se pudo cambiar el estatus del módulo con ID: ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        5,
        EstatusEnumBitcora.ERROR,
        error.message,
      );

      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al cambiar estatus del modulos con id: ${id}`,
      );
    }
  }

}
