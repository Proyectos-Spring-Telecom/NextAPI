import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Instalaciones } from 'src/entities/Instalaciones';
import { Dispositivos } from 'src/entities/Dispositivos';
import { Posiciones } from 'src/entities/Posiciones';
import { PuntosInteres } from 'src/entities/PuntosInteres';
import { Productos } from 'src/entities/Productos';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';
import {
  EnumTipoDispositivo,
  EstatusEnum,
} from 'src/common/estatus.enum';
import { parseFechaHistorico } from 'src/monitoreo/helpers/monitoreo-historico.helpers';
import { PasoPorPoiDto } from './dto/paso-por-poi.dto';

export type DispositivoPasoPoiItem = {
  idInstalacion: number;
  idDispositivo: number;
  imei: string;
  numeroSerie: string | null;
  nombreProducto: string | null;
  cantidadPosiciones: number;
  primeraDeteccion: Date | string;
  ultimaDeteccion: Date | string;
};

export type PasoPorPoiResult = {
  idPuntoInteres: number;
  nombrePuntoInteres: string;
  idCliente: number;
  lat: number;
  lng: number;
  radioMetros: number;
  fechaInicio: string;
  fechaFinal: string;
  instalacionesEvaluadas: number;
  totalDispositivos: number;
  dispositivos: DispositivoPasoPoiItem[];
};

@Injectable()
export class ReportesService {
  constructor(
    @InjectRepository(PuntosInteres)
    private readonly puntosRepo: Repository<PuntosInteres>,
    @InjectRepository(Instalaciones)
    private readonly instalacionesRepo: Repository<Instalaciones>,
    private readonly tenantFilter: TenantFilterService,
  ) {}

  async pasoPorPuntoInteres(
    dto: PasoPorPoiDto,
    idClienteToken: number,
    rol: number,
  ): Promise<{ data: PasoPorPoiResult }> {
    try {
      const idCliente = Number(dto.idCliente);
      await this.assertClienteEnAlcance(rol, idClienteToken, idCliente);

      let fechaInicio: string;
      let fechaFinal: string;
      try {
        fechaInicio = parseFechaHistorico(dto.fechaInicio);
        fechaFinal = parseFechaHistorico(dto.fechaFinal);
      } catch {
        throw new BadRequestException(
          'fechaInicio / fechaFinal tienen un formato inválido',
        );
      }
      if (fechaInicio > fechaFinal) {
        throw new BadRequestException(
          'fechaInicio no puede ser posterior a fechaFinal',
        );
      }

      const poi = await this.puntosRepo.findOne({
        where: { id: dto.idPuntoInteres },
      });
      if (!poi) {
        throw new NotFoundException('Punto de interés no encontrado');
      }
      if (Number(poi.idCliente) !== idCliente) {
        throw new BadRequestException(
          'El punto de interés no pertenece al cliente indicado',
        );
      }

      const lat = Number(poi.lat);
      const lng = Number(poi.lng);
      const radioMetros =
        poi.radioMetros != null && Number(poi.radioMetros) > 0
          ? Number(poi.radioMetros)
          : 25;

      const idsFiltro = this.normalizeIds(dto.idsInstalacion);
      if (idsFiltro?.length) {
        await this.assertInstalacionesDelCliente(idCliente, idsFiltro);
      }

      const candidatos = await this.cargarInstalacionesCandidatas(
        idCliente,
        idsFiltro,
      );

      if (!candidatos.length) {
        return {
          data: {
            idPuntoInteres: Number(poi.id),
            nombrePuntoInteres: poi.nombre,
            idCliente,
            lat,
            lng,
            radioMetros,
            fechaInicio,
            fechaFinal,
            instalacionesEvaluadas: 0,
            totalDispositivos: 0,
            dispositivos: [],
          },
        };
      }

      const dispositivos = await this.consultarPasosPorRadio({
        candidatos,
        lat,
        lng,
        radioMetros,
        fechaInicio,
        fechaFinal,
      });

      return {
        data: {
          idPuntoInteres: Number(poi.id),
          nombrePuntoInteres: poi.nombre,
          idCliente,
          lat,
          lng,
          radioMetros,
          fechaInicio,
          fechaFinal,
          instalacionesEvaluadas: candidatos.length,
          totalDispositivos: dispositivos.length,
          dispositivos,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  private async assertClienteEnAlcance(
    rol: number,
    idClienteToken: number,
    idCliente: number,
  ): Promise<void> {
    const scope = await this.tenantFilter.idsClientePermitidos(
      rol,
      idClienteToken,
    );
    if (!this.tenantFilter.clienteVisibleEnScope(scope, idCliente)) {
      throw new ForbiddenException(
        'No puedes generar reportes para ese cliente',
      );
    }
  }

  private normalizeIds(ids?: number[]): number[] | null {
    if (!ids?.length) return null;
    const unique = [
      ...new Set(
        ids.map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0),
      ),
    ];
    return unique.length ? unique : null;
  }

  private async assertInstalacionesDelCliente(
    idCliente: number,
    ids: number[],
  ): Promise<void> {
    const rows = await this.instalacionesRepo.find({
      where: { idCliente, id: In(ids) },
      select: ['id'],
    });
    const found = new Set(rows.map((r) => Number(r.id)));
    const missing = ids.filter((id) => !found.has(id));
    if (missing.length) {
      throw new BadRequestException(
        `Instalaciones no pertenecen al cliente o no existen: ${missing.join(', ')}`,
      );
    }
  }

  private async cargarInstalacionesCandidatas(
    idCliente: number,
    idsFiltro: number[] | null,
  ): Promise<
    Array<{
      idInstalacion: number;
      idDispositivo: number;
      imei: string;
      numeroSerie: string | null;
      nombreProducto: string | null;
    }>
  > {
    const qb = this.instalacionesRepo
      .createQueryBuilder('i')
      .innerJoin(
        Dispositivos,
        'd',
        'd.id = i.idDispositivo AND d.idCliente = i.idCliente',
      )
      .leftJoin(
        Productos,
        'p',
        'p.id = i.idProducto AND p.idCliente = i.idCliente',
      )
      .select([
        'i.id AS idInstalacion',
        'd.id AS idDispositivo',
        'CAST(d.imei AS CHAR) AS imei',
        'd.numeroSerie AS numeroSerie',
        'p.nombre AS nombreProducto',
      ])
      .where('i.idCliente = :idCliente', { idCliente })
      .andWhere('i.estatus = :activo', { activo: EstatusEnum.ACTIVO })
      .andWhere('i.idDispositivo IS NOT NULL')
      .andWhere('d.imei IS NOT NULL')
      .andWhere('d.idTipoDispositivo <> :panel', {
        panel: EnumTipoDispositivo.PANEL_ALARMA,
      });

    if (idsFiltro?.length) {
      qb.andWhere('i.id IN (:...ids)', { ids: idsFiltro });
    }

    const rows = await qb.getRawMany<Record<string, unknown>>();
    return rows
      .map((row) => ({
        idInstalacion: Number(row.idInstalacion),
        idDispositivo: Number(row.idDispositivo),
        imei: String(row.imei ?? '').trim(),
        numeroSerie:
          row.numeroSerie != null && String(row.numeroSerie).trim() !== ''
            ? String(row.numeroSerie)
            : null,
        nombreProducto:
          row.nombreProducto != null && String(row.nombreProducto).trim() !== ''
            ? String(row.nombreProducto)
            : null,
      }))
      .filter((r) => r.imei !== '' && Number.isFinite(r.idInstalacion));
  }

  private async consultarPasosPorRadio(args: {
    candidatos: Array<{
      idInstalacion: number;
      idDispositivo: number;
      imei: string;
      numeroSerie: string | null;
      nombreProducto: string | null;
    }>;
    lat: number;
    lng: number;
    radioMetros: number;
    fechaInicio: string;
    fechaFinal: string;
  }): Promise<DispositivoPasoPoiItem[]> {
    const { candidatos, lat, lng, radioMetros, fechaInicio, fechaFinal } =
      args;

    const byImei = new Map(candidatos.map((c) => [c.imei, c]));
    const imeis = [...byImei.keys()];

    // Bbox aproximado para reducir filas antes del Haversine exacto.
    const metrosPorGradoLat = 111_320;
    const cosLat = Math.cos((lat * Math.PI) / 180);
    const metrosPorGradoLng = Math.max(metrosPorGradoLat * Math.abs(cosLat), 1);
    const deltaLat = radioMetros / metrosPorGradoLat;
    const deltaLng = radioMetros / metrosPorGradoLng;

    const rows = await this.instalacionesRepo.manager
      .getRepository(Posiciones)
      .createQueryBuilder('p')
      .select([
        'CAST(p.imei AS CHAR) AS imei',
        'COUNT(p.id) AS cantidadPosiciones',
        'MIN(p.fechaHora) AS primeraDeteccion',
        'MAX(p.fechaHora) AS ultimaDeteccion',
      ])
      .where('p.imei IN (:...imeis)', { imeis })
      .andWhere('p.fechaHora >= :fechaInicio', { fechaInicio })
      .andWhere('p.fechaHora <= :fechaFinal', { fechaFinal })
      .andWhere('p.lat BETWEEN :latMin AND :latMax', {
        latMin: lat - deltaLat,
        latMax: lat + deltaLat,
      })
      .andWhere('p.lng BETWEEN :lngMin AND :lngMax', {
        lngMin: lng - deltaLng,
        lngMax: lng + deltaLng,
      })
      .andWhere(
        `(6371000 * ACOS(LEAST(1, GREATEST(-1,
          COS(RADIANS(:poiLat)) * COS(RADIANS(p.lat))
          * COS(RADIANS(p.lng) - RADIANS(:poiLng))
          + SIN(RADIANS(:poiLat)) * SIN(RADIANS(p.lat))
        )))) <= :radioMetros`,
        { poiLat: lat, poiLng: lng, radioMetros },
      )
      .groupBy('p.imei')
      .getRawMany<Record<string, unknown>>();

    const result: DispositivoPasoPoiItem[] = [];
    for (const row of rows) {
      const imei = String(row.imei ?? '').trim();
      const cand = byImei.get(imei);
      if (!cand) continue;
      result.push({
        idInstalacion: cand.idInstalacion,
        idDispositivo: cand.idDispositivo,
        imei: cand.imei,
        numeroSerie: cand.numeroSerie,
        nombreProducto: cand.nombreProducto,
        cantidadPosiciones: Number(row.cantidadPosiciones) || 0,
        primeraDeteccion: row.primeraDeteccion as Date | string,
        ultimaDeteccion: row.ultimaDeteccion as Date | string,
      });
    }

    result.sort((a, b) => a.idInstalacion - b.idInstalacion);
    return result;
  }
}
