import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UltimaPosicion } from 'src/entities/UltimaPosicion';
import { Dispositivos } from 'src/entities/Dispositivos';
import { Instalaciones } from 'src/entities/Instalaciones';
import { EstatusEnum } from 'src/common/estatus.enum';
import { formatFechaPosicion } from 'src/monitoreo/helpers/monitoreo-historico.helpers';
import {
  ConsolaAlcanceService,
  UnidadConsolaPorImei,
} from '../shared/consola-alcance.service';
import { SinTransmisionDto } from './dto/sin-transmision.dto';
import {
  evaluarSinTransmision,
  fechaParedDesdeDate,
  restarDiasPared,
} from './sin-transmision.helpers';

/** Unidad que no ha transmitido en el periodo pedido. */
export type UnidadSinTransmisionItem = Omit<UnidadConsolaPorImei, 'canalesActivos'> & {
  /** `YYYY-MM-DDTHH:mm:ss` de la última transmisión; null si nunca transmitió. */
  ultimaTransmision: string | null;
  nuncaTransmitio: boolean;
  minutosSinTransmitir: number | null;
  diasSinTransmitir: number | null;
  lat: number | null;
  lng: number | null;
  estado: number | null;
  ignicion: number | null;
};

export type SinTransmisionResult = {
  dias: number;
  /** Hora de pared de la consulta y del corte (ahora − días). */
  fechaConsulta: string;
  fechaCorte: string;
  /** Unidades evaluadas (todas las del alcance / cliente). */
  totalUnidades: number;
  total: number;
  data: UnidadSinTransmisionItem[];
};

/** IMEI por consulta a `UltimaPosicion` (lista IN acotada). */
const LOTE_IMEIS = 500;

/**
 * Consola → Sin Transmisión: unidades activas del alcance cuya última
 * transmisión (`UltimaPosicion`, una fila por IMEI) es anterior a
 * (ahora − días), o que nunca han transmitido. Solo lectura.
 */
@Injectable()
export class ConsolaSinTransmisionService {
  constructor(
    private readonly alcance: ConsolaAlcanceService,
    @InjectRepository(UltimaPosicion)
    private readonly ultimaPosicionRepo: Repository<UltimaPosicion>,
  ) {}

  async consultar(
    dto: SinTransmisionDto,
    idUsuarioToken: number,
    idClienteToken: number,
    rol: number,
  ): Promise<SinTransmisionResult> {
    try {
      const dias = Math.trunc(Number(dto.dias));
      const unidades = await this.alcance.unidadesEnAlcance(
        rol,
        idUsuarioToken,
        idClienteToken,
        dto.idCliente ?? null,
      );
      if (unidades === null) {
        throw new ForbiddenException('Cliente fuera de alcance');
      }

      const fechaConsulta = fechaParedDesdeDate(new Date());
      const fechaCorte = restarDiasPared(fechaConsulta, dias);
      const ultimas = await this.cargarUltimasPosiciones(unidades.map((u) => u.imei));

      const data: UnidadSinTransmisionItem[] = [];
      for (const { canalesActivos: _c, ...unidad } of unidades) {
        const up = ultimas.get(unidad.imei) ?? null;
        const ultimaTransmision = up?.fechaHora ?? null;
        const { incluir, minutosSinTransmitir } = evaluarSinTransmision(
          ultimaTransmision,
          fechaConsulta,
          dias,
        );
        if (!incluir) continue;
        data.push({
          ...unidad,
          ultimaTransmision,
          nuncaTransmitio: ultimaTransmision == null,
          minutosSinTransmitir,
          diasSinTransmitir:
            minutosSinTransmitir != null ? Math.floor(minutosSinTransmitir / 1440) : null,
          lat: up?.lat ?? null,
          lng: up?.lng ?? null,
          estado: up?.estado ?? null,
          ignicion: up?.ignicion ?? null,
        });
      }

      // Más tiempo sin transmitir primero; las que nunca transmitieron al final.
      data.sort((a, b) => {
        if (a.nuncaTransmitio !== b.nuncaTransmitio) return a.nuncaTransmitio ? 1 : -1;
        return (b.minutosSinTransmitir ?? 0) - (a.minutosSinTransmitir ?? 0);
      });

      return {
        dias,
        fechaConsulta,
        fechaCorte,
        totalUnidades: unidades.length,
        total: data.length,
        data,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }

  /**
   * Última posición por IMEI (índice único `UQ_UltimaPosicion_Imei`), solo si
   * es de la instalación vigente del equipo.
   */
  private async cargarUltimasPosiciones(imeis: string[]): Promise<
    Map<
      string,
      {
        fechaHora: string | null;
        lat: number | null;
        lng: number | null;
        estado: number | null;
        ignicion: number | null;
      }
    >
  > {
    const mapa = new Map<
      string,
      {
        fechaHora: string | null;
        lat: number | null;
        lng: number | null;
        estado: number | null;
        ignicion: number | null;
      }
    >();
    const unicos = [...new Set(imeis.filter(Boolean))];
    const num = (v: unknown) => {
      const n = Number(v);
      return v != null && v !== '' && Number.isFinite(n) ? n : null;
    };

    for (let i = 0; i < unicos.length; i += LOTE_IMEIS) {
      const lote = unicos.slice(i, i + LOTE_IMEIS);
      const rows = await this.ultimaPosicionRepo
        .createQueryBuilder('up')
        .select('CAST(up.imei AS CHAR)', 'imei')
        .addSelect('up.fechaHora', 'fechaHora')
        .addSelect('up.lat', 'lat')
        .addSelect('up.lng', 'lng')
        .addSelect('up.estado', 'estado')
        .addSelect('up.ignicion', 'ignicion')
        // Una última posición anterior a la instalación vigente es de otra
        // vigencia (§6): para esta unidad cuenta como "nunca transmitió".
        .innerJoin(Dispositivos, 'd', 'd.imei = up.imei')
        .innerJoin(
          Instalaciones,
          'i',
          'i.idDispositivo = d.id AND i.estatus = :activa AND up.fechaHora >= i.vigenteDesde',
          { activa: EstatusEnum.ACTIVO },
        )
        .where('up.imei IN (:...lote)', { lote })
        .getRawMany<Record<string, unknown>>();

      for (const row of rows) {
        const imei = String(row.imei ?? '').trim();
        if (!imei) continue;
        mapa.set(imei, {
          fechaHora: formatFechaPosicion(row.fechaHora as string | Date | null),
          lat: num(row.lat),
          lng: num(row.lng),
          estado: num(row.estado),
          ignicion: num(row.ignicion),
        });
      }
    }
    return mapa;
  }
}
