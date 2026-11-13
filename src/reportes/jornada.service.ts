import { BadRequestException, HttpException, Injectable } from '@nestjs/common';
import { nowMexicoCityAsUtcDate } from 'src/utils/datetime-mexico.util';
import { redondearKm } from 'src/utils/recorrido.utils';
import { MAX_DIAS_JORNADA } from './dto/jornada.dto';
import type { FiltroPasoPorPoi } from './dto/paso-por-poi.dto';
import {
  armarJornada,
  diasDelPeriodo,
  estimarUmbralSinDatos,
  msDeFecha,
  resumenDeJornada,
  type CicloMotor,
  type JornadaDia,
  type PuntoOperacion,
  type ResumenJornada,
} from './helpers/jornada.helpers';
import { paradasDeJornada, ubicarParada, type Parada } from './helpers/paradas.helpers';
import { ReportesService, type UnidadOperacion } from './reportes.service';

type ConsultaJornada = {
  idCliente?: number;
  filtro?: FiltroPasoPorPoi;
  valores?: string[];
  fechaInicio: string;
  fechaFinal?: string;
};

type Usuario = { idClienteToken: number; rol: number; idUsuario: number };

/** Usuario del token (`req.user`) para los reportes de jornada. */
export function usuarioDe(req: {
  user: { idCliente: unknown; rol: unknown; userId: unknown };
}): Usuario {
  return {
    idClienteToken: Number(req.user.idCliente),
    rol: Number(req.user.rol),
    idUsuario: Number(req.user.userId),
  };
}

type EtiquetaUnidad = Omit<UnidadOperacion, 'puntos'>;

export type JornadaUnidad = EtiquetaUnidad & { jornadas: JornadaDia[] };

export type MotorUnidad = EtiquetaUnidad & {
  horasMotor: number;
  km: number;
  ciclosMotor: number;
  reportaIgnicion: boolean;
  porDia: Array<
    Pick<
      ResumenJornada,
      'fecha' | 'primerEncendido' | 'ultimoApagado' | 'horasMotor' | 'ciclosMotor' | 'km'
    >
  >;
  ciclos: Array<CicloMotor & { fecha: string }>;
};

export type FilaFlotaDia = EtiquetaUnidad & ResumenJornada;

export type ParadasUnidad = EtiquetaUnidad & {
  total: number;
  minutos: number;
  paradas: Parada[];
};

const MS_DIA = 86_400_000;
const MS_PREVIAS = 6 * 3_600_000;

/**
 * Jornada, motor on/off y flota del día (docs/fis-fiber, ruta del back §3.1).
 * Solo lectura: se calcula al consultar con las posiciones del periodo.
 */
@Injectable()
export class JornadaService {
  constructor(private readonly reportes: ReportesService) {}

  async jornada(dto: ConsultaJornada, usuario: Usuario) {
    return envolver(async () => {
      const { unidades, ...periodo } = await this.calcular(dto, usuario);
      const items: JornadaUnidad[] = unidades.map(({ unidad, jornadas }) => ({
        ...unidad,
        jornadas,
      }));
      return { data: { ...periodo, total: items.length, unidades: items } };
    });
  }

  async motor(dto: ConsultaJornada, usuario: Usuario) {
    return envolver(async () => {
      const { unidades, ...periodo } = await this.calcular(dto, usuario);
      const items: MotorUnidad[] = unidades.map(({ unidad, jornadas }) => ({
        ...unidad,
        horasMotor:
          Math.round(jornadas.reduce((s, j) => s + j.horasMotor, 0) * 100) / 100,
        km: redondearKm(jornadas.reduce((s, j) => s + j.km, 0)),
        ciclosMotor: jornadas.reduce((s, j) => s + j.ciclosMotor, 0),
        reportaIgnicion: jornadas.some((j) => j.reportaIgnicion),
        porDia: jornadas.map(
          ({ fecha, primerEncendido, ultimoApagado, horasMotor, ciclosMotor, km }) => ({
            fecha,
            primerEncendido,
            ultimoApagado,
            horasMotor,
            ciclosMotor,
            km,
          }),
        ),
        ciclos: jornadas.flatMap((j) => j.ciclos.map((c) => ({ ...c, fecha: j.fecha }))),
      }));
      return { data: { ...periodo, total: items.length, unidades: items } };
    });
  }

  async flotaDia(dto: ConsultaJornada, usuario: Usuario) {
    return envolver(async () => {
      const { unidades, ...periodo } = await this.calcular(dto, usuario);
      const filas: FilaFlotaDia[] = unidades.flatMap(({ unidad, jornadas }) =>
        jornadas.map((j) => ({ ...unidad, ...resumenDeJornada(j) })),
      );
      return { data: { ...periodo, total: filas.length, filas } };
    });
  }

  async paradas(dto: ConsultaJornada & { minutosMinimos?: number }, usuario: Usuario) {
    return envolver(async () => {
      const { unidades, ...periodo } = await this.calcular(dto, usuario);
      const lugares = await this.reportes.lugaresDeVehiculos(
        unidades.map(({ unidad }) => unidad.idProducto ?? 0),
      );
      const minimo = dto.minutosMinimos ?? 0;
      const items: ParadasUnidad[] = unidades.map(({ unidad, jornadas }) => {
        const paradas = jornadas
          .flatMap(paradasDeJornada)
          .filter((p) => p.min >= minimo)
          .map((p) => ubicarParada(p, lugares.get(unidad.idProducto ?? 0)));
        return {
          ...unidad,
          total: paradas.length,
          minutos: Math.round(paradas.reduce((s, p) => s + p.min, 0) * 10) / 10,
          paradas,
        };
      });
      return { data: { ...periodo, total: items.length, unidades: items } };
    });
  }

  /** Resumen por día de cada instalación (`incluirJornada` en velocidad y distancia). */
  async resumenPorInstalacion(
    dto: ConsultaJornada & { fechaFinal: string },
    usuario: Usuario,
  ): Promise<Map<number, ResumenJornada[]>> {
    return envolver(async () => {
      const consulta = {
        ...dto,
        fechaInicio: dto.fechaInicio.slice(0, 10),
        fechaFinal: dto.fechaFinal.slice(0, 10),
      };
      const { unidades } = await this.calcular(consulta, usuario);
      return new Map(
        unidades.map(({ unidad, jornadas }) => [
          unidad.idInstalacion,
          jornadas.map(resumenDeJornada),
        ]),
      );
    });
  }

  private async calcular(dto: ConsultaJornada, usuario: Usuario) {
    const fechaInicio = dto.fechaInicio;
    const fechaFinal = dto.fechaFinal ?? dto.fechaInicio;
    const dias = diasDelPeriodo(fechaInicio, fechaFinal);
    if (!dias.length) {
      throw new BadRequestException('fechaInicio no puede ser posterior a fechaFinal');
    }
    if (dias.length > MAX_DIAS_JORNADA) {
      throw new BadRequestException(
        `El periodo no puede pasar de ${MAX_DIAS_JORNADA} días`,
      );
    }

    const ahoraMs = nowMexicoCityAsUtcDate().getTime();
    // Los días que no han empezado no tienen jornada.
    const diasValidos = dias.filter((d) => msDeFecha(`${d}T00:00:00`) <= ahoraMs);

    const { idCliente, unidades } = await this.reportes.posicionesOperacion(
      dto,
      `${fechaInicio} 00:00:00`,
      `${fechaFinal} 23:59:59`,
      usuario.idClienteToken,
      usuario.rol,
      usuario.idUsuario,
    );

    return {
      idCliente,
      fechaInicio,
      fechaFinal,
      unidades: unidades.map(({ puntos, ...unidad }) => {
        const umbralSinDatosMin = estimarUmbralSinDatos(puntos);
        return {
          unidad,
          jornadas: diasValidos.map((dia) =>
            armarJornada(dia, puntosDelDia(puntos, dia), { ahoraMs, umbralSinDatosMin }),
          ),
        };
      }),
    };
  }
}

/**
 * Las posiciones que necesita un día: las 6 h previas (cómo amaneció), las
 * del día y la primera del día siguiente (cierra el último tramo).
 */
function puntosDelDia(puntos: readonly PuntoOperacion[], dia: string): PuntoOperacion[] {
  const inicio = msDeFecha(`${dia}T00:00:00`);
  const fin = inicio + MS_DIA;
  const salida: PuntoOperacion[] = [];
  for (const p of puntos) {
    const ms = msDeFecha(p.fechaHora);
    if (ms < inicio - MS_PREVIAS) continue;
    salida.push(p);
    if (ms >= fin) break;
  }
  return salida;
}

/** Errores no HTTP → 400, como los demás reportes. */
async function envolver<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof HttpException) throw error;
    throw new BadRequestException((error as Error)?.message);
  }
}
