import {
  BadRequestException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Posiciones } from 'src/entities/Posiciones';
import { nombreCatEvento } from 'src/common/cat-eventos.enum';
import { formatFechaPosicion } from 'src/monitoreo/helpers/monitoreo-historico.helpers';
import {
  ConsolaAlcanceService,
  MSG_IMEI_NO_ENCONTRADO,
  UnidadConsolaPorImei,
} from '../shared/consola-alcance.service';
import { TransmisionesImeiDto } from './dto/transmisiones-imei.dto';
import { condicionTramos } from 'src/motor-activos/tramos-instalacion';

const CANTIDAD_DEFAULT = 50;

/** Sin periodo: las últimas N dentro de toda la vigencia. */
const SIN_LIMITE_INICIO = '1000-01-01 00:00:00';
const SIN_LIMITE_FIN = '9999-12-31 23:59:59';

/** Cabecera de unidad en transmisiones (subset del alcance + cliente). */
export type UnidadTransmisionesImei = {
  idInstalacion: number;
  imei: string;
  idCliente: number;
  nombreCliente: string | null;
  etiqueta: string;
  placas: string | null;
  economico: string | null;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  idTipoDispositivo: number | null;
  nombreTipoDispositivo: string | null;
};

export type TransmisionItem = {
  idPosicion: number;
  fechaHora: string | null;
  lat: number | null;
  lng: number | null;
  velocidad: number | null;
  rumbo: number | null;
  estado: number | null;
  ignicion: number | null;
  idEvento: number | null;
  nombreEvento: string | null;
  bateria: number | null;
  gps: number | null;
  gsm: number | null;
};

export type TransmisionesImeiResult = {
  unidad: UnidadTransmisionesImei;
  cantidadSolicitada: number;
  total: number;
  data: TransmisionItem[];
};

function num(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Transmisiones de Consola: últimas N posiciones de un equipo por IMEI.
 * Solo lectura. Reutiliza el alcance de `ConsolaAlcanceService`.
 */
@Injectable()
export class ConsolaTransmisionesService {
  constructor(
    @InjectRepository(Posiciones)
    private readonly posicionesRepo: Repository<Posiciones>,
    private readonly alcance: ConsolaAlcanceService,
  ) {}

  /**
   * POST /consola/transmisiones — últimas N posiciones del IMEI,
   * de la más reciente a la más antigua. 404 idéntico si no existe o sin acceso.
   */
  async porImei(
    dto: TransmisionesImeiDto,
    idUsuarioToken: number,
    idClienteToken: number,
    rol: number,
  ): Promise<TransmisionesImeiResult> {
    try {
      const imei = String(dto.imei ?? '').trim();
      const cantidad = Math.min(
        500,
        Math.max(1, Math.trunc(Number(dto.cantidad) || CANTIDAD_DEFAULT)),
      );

      const resuelto = await this.alcance.resolverUnidadPorImei(
        imei,
        rol,
        idUsuarioToken,
        idClienteToken,
      );
      if (!resuelto) {
        throw new NotFoundException(MSG_IMEI_NO_ENCONTRADO);
      }

      const unidad = this.mapUnidad(resuelto.unidad);

      // Solo lo que transmitió el equipo instalado en esta unidad: ni de un
      // cliente anterior ni de otra unidad (tramos de vigencia, §6).
      const tramos = await this.alcance.tramosImeiEnInstalacion(
        resuelto.unidad.idInstalacion,
        imei,
        SIN_LIMITE_INICIO,
        SIN_LIMITE_FIN,
      );
      if (!tramos.length) {
        return { unidad, cantidadSolicitada: cantidad, total: 0, data: [] };
      }
      const enTramos = condicionTramos('p', tramos);

      const qb = this.posicionesRepo
        .createQueryBuilder('p')
        .select('p.id', 'idPosicion')
        .addSelect('p.fechaHora', 'fechaHora')
        .addSelect('p.lat', 'lat')
        .addSelect('p.lng', 'lng')
        .addSelect('p.velocidad', 'velocidad')
        .addSelect('p.direccion', 'direccion')
        .addSelect('p.estado', 'estado')
        .addSelect('p.ignicion', 'ignicion')
        .addSelect('p.idEvento', 'idEvento')
        .addSelect('p.bateria', 'bateria')
        .addSelect('p.gps', 'gps')
        .addSelect('p.gsm', 'gsm')
        .where(enTramos.sql, enTramos.params)
        .orderBy('p.fechaHora', 'DESC')
        .addOrderBy('p.id', 'DESC')
        .limit(cantidad);

      const rows = await qb.getRawMany<Record<string, unknown>>();
      const data: TransmisionItem[] = rows.map((row) => {
        const idEvento = num(row.idEvento);
        return {
          idPosicion: Number(row.idPosicion),
          fechaHora: formatFechaPosicion(
            row.fechaHora as string | Date | null,
          ),
          lat: num(row.lat),
          lng: num(row.lng),
          velocidad: num(row.velocidad),
          rumbo: num(row.direccion),
          estado: num(row.estado),
          ignicion: num(row.ignicion),
          idEvento,
          nombreEvento: nombreCatEvento(idEvento),
          bateria: num(row.bateria),
          gps: num(row.gps),
          gsm: num(row.gsm),
        };
      });

      return {
        unidad,
        cantidadSolicitada: cantidad,
        total: data.length,
        data,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  private mapUnidad(u: UnidadConsolaPorImei): UnidadTransmisionesImei {
    return {
      idInstalacion: u.idInstalacion,
      imei: u.imei,
      idCliente: u.idCliente,
      nombreCliente: u.nombreCliente,
      etiqueta: u.etiqueta,
      placas: u.placas,
      economico: u.economico,
      marca: u.marca,
      modelo: u.modelo,
      anio: u.anio,
      idTipoDispositivo: u.idTipoDispositivo,
      nombreTipoDispositivo: u.nombreTipoDispositivo,
    };
  }
}
