import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Res,
} from '@nestjs/common';
import { CreateRolDto } from './dto/create-rol.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { Roles } from 'src/entities/Roles';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import { Response } from 'express';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Roles)
    private readonly rolesRepository: Repository<Roles>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  async create(idUser: number, createRoleDto: CreateRolDto): Promise<ApiCrudResponse> {
    try {
      const rol = await this.rolesRepository.find({
        where: { nombre: createRoleDto.nombre },
      });
      if (rol.length !== 0) {
        throw new BadRequestException('El rol ya existe');
      }
      const newRol = await this.rolesRepository.create(createRoleDto);
      const rolSave = await this.rolesRepository.save(newRol);

      //-----Registro en la bitacora----- SUCCESS
      const querylogger = { createRoleDto };
      await this.bitacoraLogger.logToBitacora(
        'Roles',
        `Se creó un rol con nombre: ${rolSave.nombre}`,
        'CREATE',
        querylogger,
        idUser,
        3,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Rol creado correctamente',
        data: {
          id: rolSave.id,
          nombre: `${rolSave.nombre} ${rolSave.descripcion} ` || '',
        },
      };
      return result;
    } catch (error) {
      //-----Registro en la bitacora----- ERROR
      const querylogger = { createRoleDto };
      await this.bitacoraLogger.logToBitacora(
        'Roles',
        `Se creó un rol con nombre: ${createRoleDto.nombre}`,
        'CREATE',
        querylogger,
        idUser,
        3,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al crear rol',
        error,
      });
    }
  }

  async findAll(rol: number, page: number, limit: number): Promise<ApiResponseCommon> {
    let data;
    let total;
    switch (rol) {
      case 1:
        [data, total] = await this.rolesRepository.findAndCount({
          skip: (page - 1) * limit,
          take: limit,
        });
        break;

      default:
        [data, total] = await this.rolesRepository.findAndCount({
          skip: (page - 1) * limit,
          take: limit,
          where: {
            id: Not(1),
          },
        });
        break;
    }

    const result: ApiResponseCommon = {
      data: data,
      paginated: {
        total: total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };

    return result;
  }

  async findAllList(rol: number): Promise<ApiResponseCommon> {
    let permisos;
    switch (rol) {
      case 1:
        permisos = await this.rolesRepository.find({ where: { estatus: 1 } });
        break;

      default:
        permisos = await this.rolesRepository.find({
          where: {
            estatus: 1,
            id: Not(1),
          },
        });
        break;
    }

    const result: ApiResponseCommon = {
      data: permisos,
    };
    return result;
  }

  async findOne(id: number) {
    try {
      const permiso = await this.rolesRepository.findOne({
        where: { id: id },
      });
      if (!permiso) throw new NotFoundException('Rol no encontrado');

      return { data: permiso };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error al obtener el rol`);
    }
  }

  async update(
    id: number,
    idUser: number,
    updateRoleDto: UpdateRoleDto,
  ): Promise<ApiCrudResponse> {
    try {
      const rol = await this.rolesRepository.findOne({ where: { id: id } });
      if (!rol) throw new NotFoundException('Rol no encontrado');

      //actualizamos el rol
      await this.rolesRepository.update(id, updateRoleDto);

      // --- Registro en la bitácora --- SUCCESS
      const querylogger = { updateRoleDto };
      await this.bitacoraLogger.logToBitacora(
        'Roles',
        `Se actualizo el rol: ${updateRoleDto?.nombre}`,
        'UPDATE',
        querylogger,
        idUser,
        3,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Rol actualizado correctamente',
        data: {
          id: id,
          nombre: `${updateRoleDto?.nombre} ${updateRoleDto?.descripcion} ` || '',
        },
      };
      return result;
    } catch (error) {
      // --- Registro en la bitácora --- ERROR
      const querylogger = { updateRoleDto };
      await this.bitacoraLogger.logToBitacora(
        'Roles',
        `Se actualizo el rol: ${updateRoleDto?.nombre}`,
        'UPDATE',
        querylogger,
        idUser,
        3,
        EstatusEnumBitcora.ERROR,
        error.message,
      );

      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al actualizar rol',
        error,
      });
    }
  }

  async updateEstatus(id: number, idUser: number): Promise<ApiCrudResponse> {
    try {
      const rol = await this.rolesRepository.findOne({
        where: { id: id },
      });
      if (!rol) throw new NotFoundException('Rol no encontrado');
      const estatusAnterior = Number(rol.estatus) === 1 ? 1 : 0;
      const estatus = estatusAnterior === 1 ? 0 : 1;
      await this.rolesRepository.update(id, { estatus });

      // --- Registro en la bitácora --- SUCCESS
      const querylogger = { id, estatusAnterior, estatus };
      await this.bitacoraLogger.logToBitacora(
        'Roles',
        `Se actualizó a estatus ${estatus} el rol: ${rol.nombre}`,
        'UPDATE',
        querylogger,
        idUser,
        3,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Estatus rol actualizado correctamente',
        estatus: { estatus },
        data: {
          id: id,
          nombre: `${rol.nombre} ${rol.descripcion} ` || '',
        },
      };
      return result;
    } catch (error) {
      // --- Registro en la bitácora --- ERROR
      const querylogger = { id };
      await this.bitacoraLogger.logToBitacora(
        'Roles',
        `No se pudo cambiar el estatus del rol con ID: ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        3,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Error al cambiar estatus rol',
        error,
      });
    }
  }

}
