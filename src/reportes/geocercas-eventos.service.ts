import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { formatFechaPosicion } from 'src/monitoreo/helpers/monitoreo-historico.helpers';
import { MAX_DIAS_JORNADA } from './dto/jornada.dto';
import {
  armarVisitas,
  type EventoGeocerca,
  type VisitaGeocerca,
} from './helpers/geocercas-eventos.helpers';
import { diasDelPeriodo } from './helpers/jornada.helpers';
import {
  ReportesService,
  type ConsultaUnidades,
  type EtiquetaOperacion,
} from './reportes.service';

type Usuario = { idClienteToken: number; rol: number; idUsuario: number };

export type GeocercasUnidad = Omit<EtiquetaOperacion, 'imeis'> & {
  entradas: number;
  salidas: number;
  visitas: VisitaGeocerca[];
};

/**
 * Entradas y salidas de geocerca registradas en vivo (`EventosGeocerca`,
 * docs/fis-fiber, ruta del back §3.3). Empieza a contar desde el despliegue:
 * las salidas anteriores siguen en `POST /reportes/salidas-geocerca`.
 */
@Injectable()
export class GeocercasEventosService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly reportes: ReportesService,
  ) {}

  async eventos(
    dto: ConsultaUnidades & {
      fechaInicio: string;
      fechaFinal?: string;
      idsGeocerca?: number[];
    },
    usuario: Usuario,
  ) {
    try {
      const fechaFinal = dto.fechaFinal ?? dto.fechaInicio;
      const dias = diasDelPeriodo(dto.fechaInicio, fechaFinal);
      if (!dias.length)
        throw new BadRequestException('fechaInicio no puede ser posterior a fechaFinal');
      if (dias.length > MAX_DIAS_JORNADA) {
        throw new BadRequestException(
          `El periodo no puede pasar de ${MAX_DIAS_JORNADA} días`,
        );
      }
      const { idCliente, unidades } = await this.reportes.unidadesDelAlcance(
        dto,
        usuario.idClienteToken,
        usuario.rol,
        usuario.idUsuario,
      );
      const ids = unidades.map((u) => u.idInstalacion);
      const geocercas = dto.idsGeocerca?.length ? dto.idsGeocerca : null;
      const filas: Array<Record<string, unknown>> = ids.length
        ? await this.dataSource.query(
            `SELECT e.IdInstalacion AS idInstalacion, e.IdGeocerca AS idGeocerca, g.Nombre AS nombre,
                    e.IdPosicion AS idPosicion, e.Tipo AS tipo, e.FechaHora AS fechaHora
               FROM EventosGeocerca e
               JOIN Geocercas g ON g.Id = e.IdGeocerca
              WHERE e.IdInstalacion IN (?)
                AND e.FechaHora BETWEEN ? AND ?
                ${geocercas ? 'AND e.IdGeocerca IN (?)' : ''}
              ORDER BY e.FechaHora, e.Id`,
            [
              ids,
              `${dto.fechaInicio} 00:00:00`,
              `${fechaFinal} 23:59:59`,
              ...(geocercas ? [geocercas] : []),
            ],
          )
        : [];

      const porInstalacion = new Map<number, EventoGeocerca[]>();
      for (const f of filas) {
        const lista = porInstalacion.get(Number(f.idInstalacion)) ?? [];
        lista.push({
          idGeocerca: Number(f.idGeocerca),
          nombreGeocerca: String(f.nombre ?? ''),
          idPosicion: Number(f.idPosicion),
          tipo: f.tipo === 'entrada' ? 'entrada' : 'salida',
          fechaHora: formatFechaPosicion(f.fechaHora as string | Date) ?? '',
        });
        porInstalacion.set(Number(f.idInstalacion), lista);
      }

      // Solo las unidades con eventos: la lista completa de la flota no aporta aquí.
      const items: GeocercasUnidad[] = unidades
        .filter((u) => porInstalacion.has(u.idInstalacion))
        .map(({ imeis: _imeis, ...u }) => {
          const eventos = porInstalacion.get(u.idInstalacion)!;
          return {
            ...u,
            entradas: eventos.filter((e) => e.tipo === 'entrada').length,
            salidas: eventos.filter((e) => e.tipo === 'salida').length,
            visitas: armarVisitas(eventos),
          };
        });
      return {
        data: {
          idCliente,
          fechaInicio: dto.fechaInicio,
          fechaFinal,
          total: items.length,
          unidades: items,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException((error as Error)?.message);
    }
  }
}
