import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreatePermisoDto } from './dto/create-permiso.dto';
import { UpdatePermisoDto } from './dto/update-permiso.dto';
import { Permisos } from 'src/entities/Permisos';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { UpdatePermisoEstatusDto } from './dto/update-permiso-estatus.dto';
import { ApiCrudResponse, ApiResponseCommon, EstatusEnumBitcora } from 'src/common/ApiResponse';
import { UsuariosPermisos } from 'src/entities/UsuariosPermisos';

@Injectable()
export class PermisosService {
  constructor(
    @InjectRepository(Permisos)
    private readonly permisoRepository: Repository<Permisos>,
    @InjectRepository(UsuariosPermisos)
    private readonly usuarioPermiso: Repository<UsuariosPermisos>,
    private readonly bitacoraLogger: BitacoraLoggerService,
  ) {}

  //Obtener todos los permisos con paginado
  async findAll(page: number, limit: number): Promise<ApiResponseCommon> {
    const [data, total] = await this.permisoRepository.findAndCount({
      relations: ['idModulo2'],
      skip: (page - 1) * limit,
      take: limit,
    });

    const result: ApiResponseCommon = {
      data,
      paginated: {
        total: total,
        page,
        lastPage: Math.ceil(total / limit),
      },
    };

    return result;
  }

  //Obtener todos los permisos
  async findAllList(): Promise<ApiResponseCommon> {
    try {
      const permisos = await this.permisoRepository.find({
        relations: ['idModulo2'],
        where: { estatus: 1 },
      });
      const result: ApiResponseCommon = {
        data: permisos,
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al obtener todos los permisos:`,
        error,
      );
    }
  }

  //Obtener permiso by ID
  async findOne(id: number) {
    try {
      const permiso = await this.permisoRepository.findOne({
        where: { id: id },
        relations: ['idModulo2'],
      });
      if (!permiso) throw new NotFoundException('Permiso no encontrado');

      return { data: permiso };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        `Error al obtener el permiso por ID`,
      );
    }
  }

  async createPermiso(
    createPermiso: CreatePermisoDto,
    idUsuario,
  ): Promise<ApiCrudResponse> {
    try {
      const create = this.permisoRepository.create(createPermiso);
      const savedPermiso = await this.permisoRepository.save(create);
      const asignarRoot = {
        idPermiso: savedPermiso.id,
        idUsuario: 1, //Se asigna al usuario supremo
      };
      const permisoRoot = await this.usuarioPermiso.create(asignarRoot);
      this.usuarioPermiso.save(permisoRoot);

      // --- Registro en la bitácora --- SUCCESS
      const querylogger = { createPermiso };
      await this.bitacoraLogger.logToBitacora(
        'Permisos',
        `Se creó el permiso: ${savedPermiso.nombre}`,
        'CREATE',
        querylogger,
        Number(idUsuario),
        4,
        EstatusEnumBitcora.SUCCESS,
      );

      const idPer = savedPermiso.id;
      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Permiso creado correctamente',
        data: {
          id: Number(idPer),
          nombre: `${savedPermiso.nombre} ${savedPermiso.descripcion} ` || '',
        },
      };
      return result;
    } catch (error) {
      // --- Registro en la bitácora --- ERROR
      const querylogger = { createPermiso };
      await this.bitacoraLogger.logToBitacora(
        'Permisos',
        `Se creó el permiso: ${createPermiso.nombre}`,
        'CREATE',
        querylogger,
        Number(idUsuario),
        4,
        EstatusEnumBitcora.ERROR,
        error.message,
      );

      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error al crear permisos`);
    }
  }

  async updateEstatus(
    id: number,
    idUser: number,
    updatePermisoEstatusDto: UpdatePermisoEstatusDto,
  ): Promise<ApiCrudResponse> {
    try {
      const permiso = await this.permisoRepository.findOne({
        where: { id: id },
      });
      if (!permiso) throw new NotFoundException('Permiso no encontrado');
      //Actualiza
      const permisoResult = await this.permisoRepository.update(id, {
        estatus: updatePermisoEstatusDto.estatus,
      });

      // --- Registro en la bitácora --- SUCCESS
      const querylogger = { updatePermisoEstatusDto };
      await this.bitacoraLogger.logToBitacora(
        'Permisos',
        `Se actualizo a estatus ${updatePermisoEstatusDto.estatus} del permiso: ${permiso.nombre}`,
        'UPDATE',
        querylogger,
        idUser,
        4,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Usuario creado correctamente',
        estatus: { estatus: updatePermisoEstatusDto.estatus },
        data: {
          id: id,
          nombre: `${permiso.nombre} ${permiso.descripcion} ` || '',
        },
      };
      return result;
    } catch (error) {
      // --- Registro en la bitácora --- ERROR
      const querylogger = { updatePermisoEstatusDto };
      await this.bitacoraLogger.logToBitacora(
        'Permisos',
        `Se actualizo a estatus ${updatePermisoEstatusDto.estatus} del permiso ID: ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        4,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      return error;
    }
  }

  async update(
    id: number,
    updatePermiso: UpdatePermisoDto,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const permisoActualizar = {
        nombre: updatePermiso.nombre,
        descripcion: updatePermiso.descripcion,
        estatus: updatePermiso.estatus,
        idModulo: updatePermiso.idModulo,
      };
      const permiso = await this.permisoRepository.findOne({
        where: { id: id },
      });
      if (!permiso) throw new NotFoundException('Permiso no encontrado');
      await this.permisoRepository.update(id, permisoActualizar);
      const permisoResult = await this.permisoRepository.findOne({
        where: { id: id },
      });

      // --- Registro en la bitácora --- SUCCESS
      const querylogger = { updatePermiso };
      await this.bitacoraLogger.logToBitacora(
        'Permisos',
        `Se actualizo permiso: ${permisoResult?.nombre}`,
        'UPDATE',
        querylogger,
        idUser,
        4,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Permiso actualizado correctamente',
        data: {
          id: id,
          nombre:
            `${permisoResult?.nombre} ${permisoResult?.descripcion} ` || '',
        },
      };
      return result;
    } catch (error) {
      // --- Registro en la bitácora --- ERROR
      const querylogger = { updatePermiso };
      await this.bitacoraLogger.logToBitacora(
        'Permisos',
        `Se actualizo permiso con ID: ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        4,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      return error;
    }
  }

  async remove(id: number, idUser: number): Promise<ApiCrudResponse> {
    try {
      const permiso = await this.permisoRepository.findOne({
        where: { id: id },
      });
      if (!permiso) throw new NotFoundException('Permiso no encontrado');
      //Desahabilitamos el permiso
      await this.permisoRepository.update(id, { estatus: 0 });

      // --- Registro en la bitácora --- SUCCESS
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'Permisos',
        `Se desactivo el permiso: ${permiso.nombre}`,
        'UPDATE',
        querylogger,
        idUser,
        4,
        EstatusEnumBitcora.SUCCESS,
      );

      //Api response
      const result: ApiCrudResponse = {
        status: 'success',
        message: 'Permiso eliminado correctamente',
        data: {
          id: id,
          nombre: `${permiso.nombre} ${permiso.descripcion} ` || '',
        },
      };
      return result;
    } catch (error) {
      // --- Registro en la bitácora --- ERROR
      const querylogger = { id: id, estatus: 0 };
      await this.bitacoraLogger.logToBitacora(
        'Permisos',
        `Se desactivo el permiso con ID: ${id}`,
        'UPDATE',
        querylogger,
        idUser,
        4,
        EstatusEnumBitcora.ERROR,
        error.message,
      );
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(`Error al eliminar permisos`);
    }
  }
  async obtenerPermisosAgrupados(idUsuario): Promise<any[]> {
    try {
      // Consulta SQL cruda
      const query = `
            SELECT 
            DISTINCT UsuariosPermisos.IdPermiso,
              Modulos.Id AS IdModulo,
              Modulos.Nombre AS NombreModulo,
              Permisos.Id AS PermisoId,
              Permisos.Nombre AS PermisoNombre,
              Permisos.Descripcion AS PermisoDescripcion
            FROM 
			Next.UsuariosPermisos
            INNER JOIN 
              Next.Permisos ON UsuariosPermisos.IdPermiso = Permisos.Id
            INNER JOIN 
             Next.Modulos ON Permisos.IdModulo = Modulos.Id
            WHERE 
              UsuariosPermisos.IdUsuario = '${idUsuario}'`;

      // Ejecutar la consulta
      const results = await this.permisoRepository.query(query);

      if (!Array.isArray(results)) {
        throw new Error('El resultado de la consulta no es un array');
      }

      // Agrupar resultados
      const permisosAgrupados = results.reduce((result, item) => {
        let moduloExistente = result.find(
          (mod) => mod.IdModulo === item.IdModulo,
        );

        if (!moduloExistente) {
          moduloExistente = {
            IdModulo: item.IdModulo,
            NombreModulo: item.NombreModulo,
            Permisos: [],
          };
          result.push(moduloExistente);
        }

        moduloExistente.Permisos.push({
          Id: item.PermisoId,
          Nombre: item.PermisoNombre,
          Descripcion: item.PermisoDescripcion,
        });

        return result;
      }, []);

      return permisosAgrupados;
    } catch (error) {
      console.error('Error al obtener permisos agrupados:', error);
      throw error; // Lanzar el error para manejarlo en la capa superior si es necesario
    }
  }
}
