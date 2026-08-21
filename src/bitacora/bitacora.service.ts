import {
  HttpException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { CreateBitacoraDto } from './dto/create-bitacora.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Bitacora } from 'src/entities/Bitacora';
import { Repository } from 'typeorm';
import { ApiResponseCommon } from 'src/common/ApiResponse';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';
import { nowMexicoCityMysql } from 'src/utils/datetime-mexico.util';

@Injectable()
export class BitacoraLoggerService {
  constructor(
    @InjectRepository(Bitacora)
    private readonly bitacoraRepository: Repository<Bitacora>,
    private readonly tenantFilter: TenantFilterService,
  ) {}
  createBitacora(createBitacoraDto: CreateBitacoraDto) {
    return 'This action adds a new bitacora';
  }

  async findAllListBitacora(cliente: number, rol: number) {
    try {
      const tenant = await this.tenantFilter.build(rol, cliente, 'u', 'IdCliente');
      if (tenant.sinAcceso) {
        return { data: [] };
      }

      const bitacora = await this.bitacoraRepository.query(
        `
SELECT
  b.Id AS id,
  b.Modulo AS modulo,
  b.Descripcion AS descripcion,
  b.Accion AS accion,
  b.Query AS query,
  b.FechaCreacion AS fechaCreacion,
  b.Estatus AS estatus,
  b.Error AS error,
  u.Id AS idUsuario,
  u.Nombre AS nombreUsuario,
  u.ApellidoPaterno AS apellidoPaternoUsuario,
  u.ApellidoMaterno AS apellidoMaternoUsuario,
  u.UserName AS UserNameUsuario,
  u.Estatus AS estatusUsuario,
  m.Id AS idModulo,
  m.Nombre AS nombreModulo,
  m.Descripcion AS descripcionModulo
FROM Bitacora b
INNER JOIN Usuarios u ON b.IdUsuario = u.Id
INNER JOIN Modulos m ON b.IdModulo = m.Id
WHERE b.Estatus = 1
${tenant.sql}
ORDER BY b.FechaCreacion DESC
`,
        [...tenant.params],
      );

      const data = bitacora.map((item) => ({
        ...item,
        id: Number(item.id),
        idUsuario: Number(item.idUsuario),
        idModulo: Number(item.idModulo),
      }));

      const result: ApiResponseCommon = {
        data: data,
      };
      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Ocurrió un error al obtener las bitácoras listado.',
      );
    }
  }

  async findAll(cliente: number, rol: number, page: number, limit: number) {
    try {
      const offset = (page - 1) * limit;
      const tenant = await this.tenantFilter.build(rol, cliente, 'u', 'IdCliente');
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

      const selectFrom = `
SELECT
  b.Id AS id,
  b.Modulo AS modulo,
  b.Descripcion AS descripcion,
  b.Accion AS accion,
  b.Query AS query,
  b.FechaCreacion AS fechaCreacion,
  b.Estatus AS estatus,
  b.Error AS error,
  u.Id AS idUsuario,
  u.Nombre AS nombreUsuario,
  u.ApellidoPaterno AS apellidoPaternoUsuario,
  u.ApellidoMaterno AS apellidoMaternoUsuario,
  u.UserName AS UserNameUsuario,
  u.Estatus AS estatusUsuario,
  m.Id AS idModulo,
  m.Nombre AS nombreModulo,
  m.Descripcion AS descripcionModulo
FROM Bitacora b
INNER JOIN Usuarios u ON b.IdUsuario = u.Id
INNER JOIN Modulos m ON b.IdModulo = m.Id
WHERE 1 = 1
${tenant.sql}`;

      const bitacora = await this.bitacoraRepository.query(
        `${selectFrom}
ORDER BY b.FechaCreacion DESC
LIMIT ? OFFSET ?`,
        [...tenant.params, limit, offset],
      );

      const totalResult = await this.bitacoraRepository.query(
        `SELECT COUNT(*) AS total FROM Bitacora b
INNER JOIN Usuarios u ON b.IdUsuario = u.Id
INNER JOIN Modulos m ON b.IdModulo = m.Id
WHERE 1 = 1
${tenant.sql}`,
        [...tenant.params],
      );

      const total = Number(totalResult[0]?.total ?? 0);

      const data = bitacora.map((item) => ({
        ...item,
        id: Number(item.id),
        idUsuario: Number(item.idUsuario),
        idModulo: Number(item.idModulo),
      }));
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
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException(
        'Ocurrió un error al obtener las bitácoras paginada.',
      );
    }
  }

  async findOne(id: number) {
    try {
      const bitacora = await this.bitacoraRepository.query(
        `
SELECT
  -- Bitácora
  b.Id AS id,
  b.Modulo AS modulo,
  b.Descripcion AS descripcion,
  b.Accion AS accion,
  b.Query AS query,
  b.FechaCreacion AS fechaCreacion,
  b.Estatus AS estatus,
  b.Error AS error,

  -- Usuario
  u.Id AS idUsuario,
  u.Nombre AS nombreUsuario,
  u.ApellidoPaterno AS apellidoPaternoUsuario,
  u.ApellidoMaterno AS apellidoMaternoUsuario,
  u.UserName AS UserNameUsuario,
  u.Estatus AS estatusUsuario,

  -- Módulo
  m.Id AS idModulo,
  m.Nombre AS nombreModulo,
  m.Descripcion AS descripcionModulo

FROM Bitacora b
INNER JOIN Usuarios u ON b.IdUsuario = u.Id
INNER JOIN Modulos m ON b.IdModulo = m.Id

WHERE b.Id = ?

ORDER BY b.FechaCreacion DESC;
            `,
        [id],
      );

      if (bitacora.length === 0) {
        throw new NotFoundException(`Bitácora con ID: ${id} no encontrada.`);
      }

      const data = bitacora.map((item) => ({
        ...item,
        id: Number(item.id),
        idUsuario: Number(item.idUsuario),
        idModulo: Number(item.idModulo),
      }));

      return { data: data };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new InternalServerErrorException({
        message: 'Ocurrió un error al obtener las bitácoras paginada.',
      });
    }
  }

  async logToBitacora(
    modulo: string,
    descripcion: string,
    accion: string,
    query: object,
    idUsuario: number,
    idModulo: number,
    estatus?: string,
    error?: string,
  ) {
    const FechaActual = nowMexicoCityMysql();

    const registro = this.bitacoraRepository.create({
      modulo: modulo,
      descripcion: descripcion,
      accion: accion,
      query: query,
      estatus: estatus ?? null,
      error: error ?? null,
      idUsuario: idUsuario,
      idModulo: idModulo,
    });
    console.log(FechaActual);
    await this.bitacoraRepository.save(registro);
    console.log('Registro guardado correctamente en la bitácora: ', registro);
  }
}
