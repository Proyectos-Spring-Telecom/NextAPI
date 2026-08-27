import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, FindOptionsWhere, Repository } from 'typeorm';
import { Vehiculos } from 'src/entities/Vehiculos';
import { CatModelos } from 'src/entities/CatModelos';
import { CatMarcas } from 'src/entities/CatMarcas';
import { CatTipoCombustible } from 'src/entities/CatTipoCombustible';
import { Productos } from 'src/entities/Productos';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { CreateVehiculosDto } from './dto/create-vehiculos.dto';
import { UpdateVehiculosDto } from './dto/update-vehiculos.dto';
import { UpdateProductoEstatusDto } from '../dto/update-producto-estatus.dto';
import {
  ApiCrudResponse,
  ApiResponseCommon,
  EstatusEnumBitcora,
} from 'src/common/ApiResponse';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';
import { WebhookEmitterService } from 'src/webhook-emitter/webhook-emitter.service';
import { WebhookEvent } from 'src/webhook-emitter/interfaces/webhook-event.interface';
import { S3Service } from 'src/s3/s3.service';
import {
  EnumModulos,
  EnumEstatusProductoDispositivo,
  EnumTipoProducto,
  EstatusEnum,
} from 'src/common/estatus.enum';
import { assertEstatusNoAsignado } from 'src/common/assert-estatus-no-asignado.util';
import { crearProductoBase } from '../crear-producto.util';
import {
  nombreCliente,
} from '../map-relaciones.util';
import type {
  VehiculoFileField,
  VehiculosUploadFiles,
} from './vehiculos-upload.interceptor';

const RELACIONES_VEHICULO = {
  idMarcaVehiculo2: true,
  idModeloVehiculo2: true,
  idCombustible2: true,
  idProducto2: {
    idCliente2: true,
    idTipoProducto2: true,
  },
} as const;

const VEHICULO_FILE_FIELDS: VehiculoFileField[] = [
  'foto',
  'fotoFrente',
  'fotoTrasera',
  'fotoDerecha',
  'fotoIzquierda',
  'fotoExtra',
  'tarjetaCirculacion',
  'polizaSeguro',
  'permisoCarga',
];

/** Fila devuelta por la query base de vehículo por placa (activos). */
export interface VehiculoPorPlacaData {
  id: number;
  placa: string;
  numeroEconomico: string | null;
  anio: number | null;
  color: string | null;
  fotoFrente: string | null;
  km: number | null;
  capacidadLitros: number | null;
  estatus: number;
  fechaCreacion: Date;
  idCliente: number;
  nombreCompleto: string | null;
  modeloId: number | null;
  modeloNombre: string | null;
  marcaId: number | null;
  marcaNombre: string | null;
  combustibleId: number | null;
  combustibleNombre: string | null;
}

@Injectable()
export class VehiculosService {
  constructor(
    @InjectRepository(Vehiculos)
    private readonly repository: Repository<Vehiculos>,
    @InjectRepository(CatModelos)
    private readonly catModelosRepo: Repository<CatModelos>,
    @InjectRepository(CatMarcas)
    private readonly catMarcasRepo: Repository<CatMarcas>,
    @InjectRepository(CatTipoCombustible)
    private readonly catTipoCombustibleRepo: Repository<CatTipoCombustible>,
    @InjectRepository(Productos)
    private readonly productosRepo: Repository<Productos>,
    private readonly dataSource: DataSource,
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly tenantFilter: TenantFilterService,
    private readonly webhookEmitter: WebhookEmitterService,
    private readonly s3Service: S3Service,
  ) { }

  private async uploadFiles(
    files: VehiculosUploadFiles,
    idUser: number,
  ): Promise<Partial<Record<VehiculoFileField, string>>> {
    const urls: Partial<Record<VehiculoFileField, string>> = {};

    for (const field of VEHICULO_FILE_FIELDS) {
      const file = files[field]?.[0];
      if (!file) continue;

      const { url } = await this.s3Service.uploadFile(
        file,
        'vehiculos',
        idUser,
        EnumModulos.VEHICULOS,
      );
      urls[field] = url;
    }

    return urls;
  }

  private async replaceFiles(
    entity: Vehiculos,
    files: VehiculosUploadFiles,
    idUser: number,
  ): Promise<Partial<Record<VehiculoFileField, string>>> {
    const urls: Partial<Record<VehiculoFileField, string>> = {};

    for (const field of VEHICULO_FILE_FIELDS) {
      const file = files[field]?.[0];
      if (!file) continue;

      const { url } = await this.s3Service.updateFile(
        entity[field],
        file,
        'vehiculos',
        idUser,
        EnumModulos.VEHICULOS,
      );
      urls[field] = url;
    }

    return urls;
  }

  private async validarFks(dto: {
    idMarcaVehiculo?: number | null;
    idModeloVehiculo?: number | null;
    idCombustible?: number;
  }): Promise<void> {
    if (dto.idMarcaVehiculo != null) {
      const marca = await this.catMarcasRepo.findOne({
        where: { id: dto.idMarcaVehiculo },
      });
      if (!marca) {
        throw new BadRequestException('IdMarcaVehiculo no existe en CatMarcas');
      }
    }
    if (dto.idModeloVehiculo != null) {
      const model = await this.catModelosRepo.findOne({
        where: { id: dto.idModeloVehiculo },
      });
      if (!model) {
        throw new BadRequestException('IdModeloVehiculo no existe en CatModelos');
      }
      if (
        dto.idMarcaVehiculo != null &&
        Number(model.idCatMarcas) !== Number(dto.idMarcaVehiculo)
      ) {
        throw new BadRequestException(
          'El modelo no pertenece a la marca indicada',
        );
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

  private buildVehiculoWebhookData(input: {
    placa: string;
    marcaNombre?: string | null;
    modeloNombre?: string | null;
    fotoFrente?: string | null;
  }): Record<string, unknown> {
    return {
      placa: input.placa,
      marcaNombre: input.marcaNombre ?? '',
      modeloNombre: input.modeloNombre ?? '',
      fotoFrente: input.fotoFrente ?? null,
    };
  }

  private async resolveMarcaNombre(
    idMarcaVehiculo: number | null,
  ): Promise<string> {
    if (idMarcaVehiculo == null) {
      return '';
    }
    const marca = await this.catMarcasRepo.findOne({
      where: { id: idMarcaVehiculo },
    });
    return marca?.nombre ?? '';
  }

  private async resolveModeloNombre(
    idModeloVehiculo: number | null,
  ): Promise<string> {
    if (idModeloVehiculo == null) {
      return '';
    }
    const modelo = await this.catModelosRepo.findOne({
      where: { id: idModeloVehiculo },
    });
    return modelo?.nombre ?? '';
  }

  async create(
    dto: CreateVehiculosDto,
    idUser: number,
    files: VehiculosUploadFiles = {},
  ): Promise<ApiCrudResponse> {
    const idCliente = dto.idCliente;
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const existePlaca = await this.repository.findOne({
        where: { placa: dto.placa, idCliente },
      });
      if (existePlaca) {
        throw new BadRequestException('La placa ya existe para este cliente');
      }

      await this.validarFks({
        idMarcaVehiculo: dto.idMarcaVehiculo,
        idModeloVehiculo: dto.idModeloVehiculo,
        idCombustible: dto.idCombustible,
      });
      const fileUrls = await this.uploadFiles(files, idUser);

      const producto = await crearProductoBase(queryRunner.manager, {
        idCliente,
        idTipoProducto: EnumTipoProducto.VEHICULO,
        nombre: dto.placa,
      });

      const entity = queryRunner.manager.create(Vehiculos, {
        idProducto: producto.id,
        idCliente,
        placa: dto.placa,
        numeroEconomico: dto.numeroEconomico ?? null,
        idMarcaVehiculo: dto.idMarcaVehiculo ?? null,
        idModeloVehiculo: dto.idModeloVehiculo ?? null,
        anio: dto.anio ?? null,
        color: dto.color ?? null,
        numeroSerie: dto.numeroSerie ?? null,
        foto: fileUrls.foto ?? null,
        fotoFrente: fileUrls.fotoFrente ?? null,
        fotoTrasera: fileUrls.fotoTrasera ?? null,
        fotoDerecha: fileUrls.fotoDerecha ?? null,
        fotoIzquierda: fileUrls.fotoIzquierda ?? null,
        fotoExtra: fileUrls.fotoExtra ?? null,
        tarjetaCirculacion: fileUrls.tarjetaCirculacion ?? null,
        polizaSeguro: fileUrls.polizaSeguro ?? null,
        permisoCarga: fileUrls.permisoCarga ?? null,
        idCombustible: dto.idCombustible ?? null,
        km: dto.km ?? null,
        capacidadLitros: dto.capacidadLitros ?? null,
      });

      const saved = await queryRunner.manager.save(entity);
      await queryRunner.commitTransaction();

      await this.bitacoraLogger.logToBitacora(
        'Vehiculos',
        `Se creó el vehículo placa: ${dto.placa}`,
        'CREATE',
        { dto, idCliente },
        idUser,
        EnumModulos.VEHICULOS,
        EstatusEnumBitcora.SUCCESS,
      );

      this.webhookEmitter.emit(
        WebhookEvent.VEHICULO_CREATED,
        idCliente,
        Number(saved.idProducto),
        this.buildVehiculoWebhookData({
          placa: saved.placa,
          marcaNombre: await this.resolveMarcaNombre(saved.idMarcaVehiculo),
          modeloNombre: await this.resolveModeloNombre(saved.idModeloVehiculo),
          fotoFrente: saved.fotoFrente,
        }),
      );

      return {
        status: 'success',
        message: 'Vehículo creado correctamente',
        data: {
          id: Number(saved.idProducto),
          nombre: saved.placa,
        },
      };
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      await this.bitacoraLogger.logToBitacora(
        'Vehiculos',
        `Error al crear vehículo placa: ${dto.placa}`,
        'CREATE',
        { dto, idCliente },
        idUser,
        EnumModulos.VEHICULOS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    } finally {
      await queryRunner.release();
    }
  }

  async findAllList(idCliente: number, rol: number): Promise<ApiResponseCommon> {
    try {
      const tenant = await this.tenantFilter.forTypeOrmIdCliente(rol, idCliente);
      if (tenant.sinAcceso) {
        return { data: [] };
      }
      const where: FindOptionsWhere<Vehiculos> = {
        idProducto2: { estatus: EstatusEnum.ACTIVO },
        ...(tenant.idCliente !== undefined ? { idCliente: tenant.idCliente } : {}),
      };
      const data = await this.repository.find({
        where,
        relations: RELACIONES_VEHICULO,
        order: { idProducto: 'ASC' },
      });
      const dataNormalizada = data.map((item) =>
        this.mapVehiculoConRelaciones(item),
      );
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
      const tenant = await this.tenantFilter.forTypeOrmIdCliente(rol, idCliente);
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

      const where: FindOptionsWhere<Vehiculos> = {
        ...(tenant.idCliente !== undefined ? { idCliente: tenant.idCliente } : {}),
      };
      const [data, total] = await this.repository.findAndCount({
        where,
        relations: RELACIONES_VEHICULO,
        skip: (page - 1) * limit,
        take: limit,
        order: { idProducto: 'ASC' },
      });
      const dataNormalizada = data.map((item) =>
        this.mapVehiculoConRelaciones(item),
      );
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

  async findOne(id: number, idCliente: number) {
    try {
      const entity = await this.repository.findOne({
        where: { idProducto: id },
        relations: RELACIONES_VEHICULO,
      });
      if (!entity) {
        throw new NotFoundException('Vehículo no encontrado');
      }
      return {
        data: this.mapVehiculoConRelaciones(entity),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { message: 'Error al buscar el vehículo' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /** SELECT + JOINs comunes; el WHERE y LIMIT se arman en `findOneByPlaca`. */
  private static readonly SQL_VEHICULO_POR_PLACA_BASE = `
SELECT
    v.IdProducto AS id,
    v.Placa AS placa,
    v.NumeroEconomico AS numeroEconomico,
    v.Anio AS anio,
    v.Color AS color,
    v.FotoFrente AS fotoFrente,
    v.KM AS km,
    v.CapacidadLitros AS capacidadLitros,
    p.Estatus AS estatus,
    p.FechaCreacion AS fechaCreacion,
    c.Id AS idCliente,
    CONCAT_WS(' ', c.Nombre, c.ApellidoPaterno, c.ApellidoMaterno) AS nombreCompleto,
    mv.Id AS modeloId,
    mv.Nombre AS modeloNombre,
    mar.Id AS marcaId,
    mar.Nombre AS marcaNombre,
    tc.Id AS combustibleId,
    tc.Nombre AS combustibleNombre
FROM Vehiculos v
INNER JOIN Productos p ON v.IdCliente = p.IdCliente AND v.IdProducto = p.Id
INNER JOIN Clientes c ON p.IdCliente = c.Id
LEFT JOIN CatModelos mv ON v.IdModeloVehiculo = mv.Id
LEFT JOIN CatMarcas mar ON v.IdMarcaVehiculo = mar.Id
LEFT JOIN CatTipoCombustible tc ON v.IdCombustible = tc.Id
`;

  private mapVehiculoConRelaciones(item: Vehiculos) {
    const producto = item.idProducto2;
    const cliente = producto?.idCliente2;
    const tipoProducto = producto?.idTipoProducto2;
    const marca = item.idMarcaVehiculo2;
    const modelo = item.idModeloVehiculo2;
    const combustible = item.idCombustible2;

    return {
      id: Number(item.idProducto),
      placa: item.placa,
      numeroEconomico: item.numeroEconomico,
      anio: item.anio != null ? Number(item.anio) : null,
      color: item.color,
      numeroSerie: item.numeroSerie,
      foto: item.foto,
      fotoFrente: item.fotoFrente,
      fotoTrasera: item.fotoTrasera,
      fotoDerecha: item.fotoDerecha,
      fotoIzquierda: item.fotoIzquierda,
      fotoExtra: item.fotoExtra,
      tarjetaCirculacion: item.tarjetaCirculacion,
      polizaSeguro: item.polizaSeguro,
      permisoCarga: item.permisoCarga,
      km: item.km != null ? Number(item.km) : null,
      capacidadLitros:
        item.capacidadLitros != null ? Number(item.capacidadLitros) : null,
      idMarcaVehiculo:
        item.idMarcaVehiculo != null ? Number(item.idMarcaVehiculo) : null,
      nombreMarca: marca?.nombre ?? null,
      idModeloVehiculo:
        item.idModeloVehiculo != null ? Number(item.idModeloVehiculo) : null,
      nombreModelo: modelo?.nombre ?? null,
      idCombustible:
        item.idCombustible != null ? Number(item.idCombustible) : null,
      nombreCombustible: combustible?.nombre ?? null,
      nombreProducto: producto?.nombre ?? item.placa,
      estatus: producto?.estatus != null ? Number(producto.estatus) : null,
      idCliente: Number(item.idCliente),
      nombreCliente: nombreCliente(cliente),
      idTipoProducto:
        tipoProducto?.id != null ? Number(tipoProducto.id) : null,
      nombreTipoProducto: tipoProducto?.nombre ?? null,
      codigoTipoProducto: tipoProducto?.codigo ?? null,
      fechaCreacion: producto?.fechaCreacion ?? null,
      fechaActualizacion: producto?.fechaActualizacion ?? null,
    };
  }

  private mapRowAVehiculoPorPlaca(row: Record<string, unknown>): VehiculoPorPlacaData {
    const g = (k: string) => row[k];
    const num = (k: string): number => Number(g(k));
    const numOrNull = (k: string): number | null =>
      g(k) == null || g(k) === '' ? null : Number(g(k));
    const strOrNull = (k: string): string | null => (g(k) == null ? null : String(g(k)));
    const nombreCompletoRaw = g('nombreCompleto');
    const nombreCompleto =
      nombreCompletoRaw == null || String(nombreCompletoRaw).trim() === ''
        ? null
        : String(nombreCompletoRaw).trim();

    return {
      id: num('id'),
      placa: String(g('placa')),
      numeroEconomico: strOrNull('numeroEconomico'),
      anio: numOrNull('anio'),
      color: strOrNull('color'),
      fotoFrente: strOrNull('fotoFrente'),
      km: numOrNull('km'),
      capacidadLitros: numOrNull('capacidadLitros'),
      estatus: num('estatus'),
      fechaCreacion: g('fechaCreacion') as Date,
      idCliente: num('idCliente'),
      nombreCompleto,
      modeloId: numOrNull('modeloId'),
      modeloNombre: strOrNull('modeloNombre'),
      marcaId: numOrNull('marcaId'),
      marcaNombre: strOrNull('marcaNombre'),
      combustibleId: numOrNull('combustibleId'),
      combustibleNombre: strOrNull('combustibleNombre'),
    };
  }

  async findOneByPlaca(
    placa: string,
    idCliente: number,
    rol: number,
  ): Promise<{ data: VehiculoPorPlacaData }> {
    try {
      const placaNorm = placa.trim();
      if (!placaNorm) {
        throw new BadRequestException('La placa es requerida');
      }
      const tenant = await this.tenantFilter.build(rol, idCliente, 'v', 'IdCliente');
      if (tenant.sinAcceso) {
        throw new NotFoundException('Vehículo no encontrado');
      }

      const sinAcotarCliente = tenant.sql === '' && tenant.params.length === 0;
      const filtroPorVariosClientes = tenant.sql.includes('IN');
      const limit = sinAcotarCliente || filtroPorVariosClientes ? 2 : 1;

      const whereClause = `WHERE p.Estatus = ${EstatusEnum.ACTIVO} AND v.Placa = ?${tenant.sql}`;
      const parametros: unknown[] = [placaNorm, ...tenant.params];

      const query = `${VehiculosService.SQL_VEHICULO_POR_PLACA_BASE}
${whereClause}
LIMIT ${limit}
`;

      const filas = await this.repository.query(query, parametros);

      if (!filas?.length) {
        throw new NotFoundException('Vehículo no encontrado');
      }
      if (filas.length > 1) {
        throw new BadRequestException(
          'Hay más de un vehículo con esta placa en el ámbito permitido para su rol; acote la búsqueda.',
        );
      }

      return {
        data: this.mapRowAVehiculoPorPlaca(filas[0] as Record<string, unknown>),
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new HttpException(
        { message: 'Error al buscar el vehículo por placa' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async update(
    id: number,
    dto: UpdateVehiculosDto,
    idCliente: number,
    idUser: number,
    files: VehiculosUploadFiles = {},
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({
        where: { idProducto: id, idCliente },
      });
      if (!entity) {
        throw new NotFoundException('Vehículo no encontrado');
      }

      if (dto.placa && dto.placa !== entity.placa) {
        const existePlaca = await this.repository.findOne({
          where: { placa: dto.placa, idCliente },
        });
        if (existePlaca) {
          throw new BadRequestException('La placa ya existe para este cliente');
        }
      }

      await this.validarFks({
        idMarcaVehiculo:
          dto.idMarcaVehiculo !== undefined || dto.idModeloVehiculo !== undefined
            ? (dto.idMarcaVehiculo !== undefined
              ? dto.idMarcaVehiculo
              : entity.idMarcaVehiculo)
            : undefined,
        idModeloVehiculo:
          dto.idMarcaVehiculo !== undefined || dto.idModeloVehiculo !== undefined
            ? (dto.idModeloVehiculo !== undefined
              ? dto.idModeloVehiculo
              : entity.idModeloVehiculo)
            : dto.idModeloVehiculo,
        idCombustible: dto.idCombustible,
      });

      const updateData: Partial<Vehiculos> = {};
      if (dto.placa !== undefined) updateData.placa = dto.placa;
      if (dto.numeroEconomico !== undefined)
        updateData.numeroEconomico = dto.numeroEconomico;
      if (dto.idMarcaVehiculo !== undefined)
        updateData.idMarcaVehiculo = dto.idMarcaVehiculo;
      if (dto.idModeloVehiculo !== undefined)
        updateData.idModeloVehiculo = dto.idModeloVehiculo;
      if (dto.anio !== undefined) updateData.anio = dto.anio;
      if (dto.color !== undefined) updateData.color = dto.color;
      if (dto.numeroSerie !== undefined) updateData.numeroSerie = dto.numeroSerie;
      if (dto.idCombustible !== undefined) updateData.idCombustible = dto.idCombustible;
      if (dto.km !== undefined) updateData.km = dto.km;
      if (dto.capacidadLitros !== undefined)
        updateData.capacidadLitros = dto.capacidadLitros;
      Object.assign(
        updateData,
        await this.replaceFiles(entity, files, idUser),
      );
      await this.repository.update(id, updateData);

      if (dto.placa !== undefined) {
        await this.productosRepo.update(
          { id, idCliente },
          { nombre: dto.placa },
        );
      }

      await this.bitacoraLogger.logToBitacora(
        'Vehiculos',
        `Se actualizó el vehículo ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        EnumModulos.VEHICULOS,
        EstatusEnumBitcora.SUCCESS,
      );

      const updated = await this.repository.findOne({
        where: { idProducto: id },
        relations: { idMarcaVehiculo2: true, idModeloVehiculo2: true },
      });

      this.webhookEmitter.emit(
        WebhookEvent.VEHICULO_UPDATED,
        idCliente,
        id,
        this.buildVehiculoWebhookData({
          placa: updated?.placa ?? entity.placa,
          marcaNombre:
            updated?.idMarcaVehiculo2?.nombre ??
            (await this.resolveMarcaNombre(
              updated?.idMarcaVehiculo ?? entity.idMarcaVehiculo,
            )),
          modeloNombre:
            updated?.idModeloVehiculo2?.nombre ??
            (await this.resolveModeloNombre(
              updated?.idModeloVehiculo ?? entity.idModeloVehiculo,
            )),
          fotoFrente: updated?.fotoFrente ?? entity.fotoFrente,
        }),
      );

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
        EnumModulos.VEHICULOS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  async updateEstatus(
    id: number,
    dto: UpdateProductoEstatusDto,
    idCliente: number,
    idUser: number,
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({
        where: { idProducto: id },
      });
      if (!entity) {
        throw new NotFoundException('Vehículo no encontrado');
      }
      const producto = await this.productosRepo.findOne({
        where: { id },
      });
      if (!producto) {
        throw new NotFoundException('Producto del vehículo no encontrado');
      }

      assertEstatusNoAsignado(Number(producto.estatus), 'producto');

      const estatusAnterior = Number(producto.estatus);
      const estatus = dto.estatus;
      await this.productosRepo.update({ id }, { estatus });

      await this.bitacoraLogger.logToBitacora(
        'Vehiculos',
        `Se actualizó estatus de vehículo ID: ${id} a ${estatus}`,
        'UPDATE',
        {
          id,
          estatusAnterior,
          estatus,
          idCliente,
          idClienteRecurso: entity.idCliente,
        },
        idUser,
        EnumModulos.VEHICULOS,
        EstatusEnumBitcora.SUCCESS,
      );

      if (
        estatus === EnumEstatusProductoDispositivo.INACTIVO ||
        estatus === EnumEstatusProductoDispositivo.BAJA_REMPLAZO ||
        estatus === EnumEstatusProductoDispositivo.BAJA_MANTENIMIENTO ||
        estatus === EnumEstatusProductoDispositivo.INSERVIBLE
      ) {
        this.webhookEmitter.emit(
          WebhookEvent.VEHICULO_DELETED,
          entity.idCliente,
          id,
          this.buildVehiculoWebhookData({
            placa: entity.placa,
            marcaNombre: await this.resolveMarcaNombre(entity.idMarcaVehiculo),
            modeloNombre: await this.resolveModeloNombre(
              entity.idModeloVehiculo,
            ),
            fotoFrente: entity.fotoFrente,
          }),
        );
      }

      return {
        status: 'success',
        message: 'Estatus actualizado correctamente',
        estatus: { estatus },
        data: { id, nombre: entity.placa },
      };
    } catch (error) {
      await this.bitacoraLogger.logToBitacora(
        'Vehiculos',
        `Error al actualizar estatus de vehículo ID: ${id}`,
        'UPDATE',
        { id, dto, idCliente },
        idUser,
        EnumModulos.VEHICULOS,
        EstatusEnumBitcora.ERROR,
        (error as Error)?.message,
      );
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException('Error al cambiar estatus del vehículo');
    }
  }
}
