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
import { Vehiculos } from 'src/entities/Vehiculos';
import { CatModelos } from 'src/entities/CatModelos';
import { CatMarcas } from 'src/entities/CatMarcas';
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
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';
import { WebhookEmitterService } from 'src/webhook-emitter/webhook-emitter.service';
import { WebhookEvent } from 'src/webhook-emitter/interfaces/webhook-event.interface';

const ID_MODULO_VEHICULOS = 16;

/** Fila devuelta por la query base de vehículo por placa (activos). */
export interface VehiculoPorPlacaData {
  id: number;
  placa: string;
  numeroEconomico: string;
  anio: number;
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
    private readonly bitacoraLogger: BitacoraLoggerService,
    private readonly tenantFilter: TenantFilterService,
    private readonly webhookEmitter: WebhookEmitterService,
  ) { }

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

  private buildVehiculoWebhookData(
    placa: string,
    marcaNombre?: string | null,
  ): Record<string, unknown> {
    return {
      placa,
      marcaNombre: marcaNombre ?? '',
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
        throw new BadRequestException('La placa ya existe para este cliente');
      }

      await this.validarFks({
        idMarcaVehiculo: dto.idMarcaVehiculo,
        idModeloVehiculo: dto.idModeloVehiculo,
        idCombustible: dto.idCombustible,
      });

      const entity = this.repository.create({
        placa: dto.placa,
        numeroEconomico: dto.numeroEconomico,
        idMarcaVehiculo: dto.idMarcaVehiculo ?? null,
        idModeloVehiculo: dto.idModeloVehiculo ?? null,
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
        idCombustible: dto.idCombustible ?? null,
        km: dto.km ?? null,
        capacidadLitros: dto.capacidadLitros ?? null,
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

      this.webhookEmitter.emit(
        WebhookEvent.VEHICULO_CREATED,
        idCliente,
        Number(saved.id),
        this.buildVehiculoWebhookData(
          saved.placa,
          await this.resolveMarcaNombre(saved.idMarcaVehiculo),
        ),
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

  async findAllList(idCliente: number, rol: number): Promise<ApiResponseCommon> {
    try {
      const tenant = await this.tenantFilter.forTypeOrmIdCliente(rol, idCliente);
      if (tenant.sinAcceso) {
        return { data: [] };
      }
      const where: FindOptionsWhere<Vehiculos> = {
        estatus: 1,
        ...(tenant.idCliente !== undefined ? { idCliente: tenant.idCliente } : {}),
      };
      const data = await this.repository.find({
        where,
        relations: {
          idMarcaVehiculo2: true,
          idModeloVehiculo2: true,
        },
        order: { id: 'ASC' },
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

  async findOne(id: number, idCliente: number): Promise<{ data: Vehiculos }> {
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

  /** SELECT + JOINs comunes; el WHERE y LIMIT se arman en `findOneByPlaca`. */
  private static readonly SQL_VEHICULO_POR_PLACA_BASE = `
SELECT
    v.Id AS id,
    v.Placa AS placa,
    v.NumeroEconomico AS numeroEconomico,
    v.Anio AS anio,
    v.Color AS color,
    v.FotoFrente AS fotoFrente,
    v.KM AS km,
    v.CapacidadLitros AS capacidadLitros,
    v.Estatus AS estatus,
    v.FechaCreacion AS fechaCreacion,
    c.Id AS idCliente,
    CONCAT_WS(' ', c.Nombre, c.ApellidoPaterno, c.ApellidoMaterno) AS nombreCompleto,
    mv.Id AS modeloId,
    mv.Nombre AS modeloNombre,
    mar.Id AS marcaId,
    mar.Nombre AS marcaNombre,
    tc.Id AS combustibleId,
    tc.Nombre AS combustibleNombre
FROM Vehiculos v
INNER JOIN Clientes c ON v.IdCliente = c.Id
LEFT JOIN CatModelos mv ON v.IdModeloVehiculo = mv.Id
LEFT JOIN CatMarcas mar ON v.IdMarcaVehiculo = mar.Id
LEFT JOIN CatTipoCombustible tc ON v.IdCombustible = tc.Id
`;

  private mapVehiculoConRelaciones(item: Vehiculos) {
    const marca = item.idMarcaVehiculo2;
    const modelo = item.idModeloVehiculo2;
    const { idMarcaVehiculo2, idModeloVehiculo2, ...vehiculo } = item;

    return {
      ...vehiculo,
      id: Number(item.id),
      idMarcaVehiculo:
        item.idMarcaVehiculo != null ? Number(item.idMarcaVehiculo) : null,
      idModeloVehiculo:
        item.idModeloVehiculo != null ? Number(item.idModeloVehiculo) : null,
      marca: marca
        ? {
          id: Number(marca.id),
          nombre: marca.nombre,
        }
        : null,
      modelo: modelo
        ? {
          id: Number(modelo.id),
          nombre: modelo.nombre,
          idMarcaVehiculo: Number(modelo.idCatMarcas),
        }
        : null,
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
      numeroEconomico: String(g('numeroEconomico')),
      anio: num('anio'),
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

      const whereClause = `WHERE v.Estatus = 1 AND v.Placa = ?${tenant.sql}`;
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
  ): Promise<ApiCrudResponse> {
    try {
      const entity = await this.repository.findOne({
        where: { id },
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
      if (dto.foto !== undefined) updateData.foto = dto.foto;
      if (dto.fotoFrente !== undefined) updateData.fotoFrente = dto.fotoFrente;
      if (dto.fotoTrasera !== undefined) updateData.fotoTrasera = dto.fotoTrasera;
      if (dto.fotoDerecha !== undefined) updateData.fotoDerecha = dto.fotoDerecha;
      if (dto.fotoIzquierda !== undefined) updateData.fotoIzquierda = dto.fotoIzquierda;
      if (dto.fotoExtra !== undefined) updateData.fotoExtra = dto.fotoExtra;
      if (dto.tarjetaCirculacion !== undefined)
        updateData.tarjetaCirculacion = dto.tarjetaCirculacion;
      if (dto.polizaSeguro !== undefined) updateData.polizaSeguro = dto.polizaSeguro;
      if (dto.permisoConcesion !== undefined)
        updateData.permisoConcesion = dto.permisoConcesion;
      if (dto.inspeccionMecanica !== undefined)
        updateData.inspeccionMecanica = dto.inspeccionMecanica;
      if (dto.idCombustible !== undefined) updateData.idCombustible = dto.idCombustible;
      if (dto.km !== undefined) updateData.km = dto.km;
      if (dto.capacidadLitros !== undefined)
        updateData.capacidadLitros = dto.capacidadLitros;
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

      const updated = await this.repository.findOne({
        where: { id },
        relations: { idMarcaVehiculo2: true },
      });

      this.webhookEmitter.emit(
        WebhookEvent.VEHICULO_UPDATED,
        idCliente,
        id,
        this.buildVehiculoWebhookData(
          updated?.placa ?? entity.placa,
          updated?.idMarcaVehiculo2?.nombre ??
            (await this.resolveMarcaNombre(
              updated?.idMarcaVehiculo ?? entity.idMarcaVehiculo,
            )),
        ),
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

      if (dto.estatus === 0) {
        this.webhookEmitter.emit(
          WebhookEvent.VEHICULO_DELETED,
          idCliente,
          id,
          this.buildVehiculoWebhookData(
            entity.placa,
            await this.resolveMarcaNombre(entity.idMarcaVehiculo),
          ),
        );
      }

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
      throw new InternalServerErrorException('Error al cambiar estatus del vehículo');
    }
  }
}
