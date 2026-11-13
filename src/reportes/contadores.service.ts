import {
  BadRequestException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BitacoraLoggerService } from 'src/bitacora/bitacora.service';
import { EstatusEnumBitcora } from 'src/common/ApiResponse';
import { EnumModulos } from 'src/common/estatus.enum';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';
import { nowMexicoCityAsUtcDate } from 'src/utils/datetime-mexico.util';
import { parseFechaHistorico } from 'src/monitoreo/helpers/monitoreo-historico.helpers';
import { MAX_DIAS_ODOMETRO, type AjusteContadoresDto } from './dto/contadores.dto';
import {
  cuentaParaBase,
  historialCompleto,
  redondear,
  serieAlCierre,
  sumarPorDia,
  type BaseContador,
} from './helpers/contadores.helpers';
import { diasDelPeriodo, fechaDeMs } from './helpers/jornada.helpers';
import { JornadaService } from './jornada.service';
import {
  ReportesService,
  type ConsultaUnidades,
  type EtiquetaOperacion,
} from './reportes.service';
import { ResumenDiarioService, type FilaResumenDiario } from './resumen-diario.service';

type Usuario = { idClienteToken: number; rol: number; idUsuario: number };

type Vehiculo = Omit<EtiquetaOperacion, 'idInstalacion' | 'idProducto'> & {
  idProducto: number;
  idsInstalacion: number[];
};

type Bases = { km: BaseContador; horas: BaseContador };

const MS_DIA = 86_400_000;

/**
 * Odómetro y horas de motor acumulados por vehículo (docs/fis-fiber, ruta del
 * back §3.4 y §3.5): base capturada (`ContadoresVehiculo`) o el alta del
 * vehículo (`Vehiculos.KM`), más los días de `ResumenDiarioUnidad` y el día en
 * curso calculado al consultar.
 */
@Injectable()
export class ContadoresService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly reportes: ReportesService,
    private readonly jornadas: JornadaService,
    private readonly resumen: ResumenDiarioService,
    private readonly tenantFilter: TenantFilterService,
    private readonly bitacora: BitacoraLoggerService,
  ) {}

  async contadores(dto: ConsultaUnidades, usuario: Usuario) {
    return envolver(async () => {
      const { idCliente, vehiculos } = await this.vehiculos(dto, usuario);
      const hoy = hoyMexico();
      const ayer = diaAnterior(hoy);
      const bases = await this.bases(vehiculos.map((v) => v.idProducto));
      const desdeMin =
        minimaFecha([...bases.values()].flatMap((b) => [b.km.fecha, b.horas.fecha])) ??
        ayer;
      const guardados = await this.resumen.porProducto(
        vehiculos.map((v) => v.idProducto),
        desdeMin.slice(0, 10),
        ayer,
      );
      const deHoy = await this.deHoy(dto, usuario, vehiculos, hoy);
      const odometrosEquipo = await this.odometrosEquipo(
        vehiculos.flatMap((v) => v.imeis),
      );

      const items = vehiculos.map((v) => {
        const b = bases.get(v.idProducto)!;
        const filas = guardados.filter((f) => f.idProducto === v.idProducto);
        const primerDia = filas[0]?.fecha ?? null;
        const contador = (base: BaseContador, campo: 'km' | 'horasMotor') => {
          const desdeBase =
            filas
              .filter((f) => cuentaParaBase(base, f.fecha))
              .reduce((s, f) => s + f[campo], 0) +
            (cuentaParaBase(base, hoy) ? (deHoy.get(v.idProducto)?.[campo] ?? 0) : 0);
          return {
            valor: redondear(base.valor + desdeBase),
            base,
            desdeBase: redondear(desdeBase),
            historialCompleto: historialCompleto(base, primerDia, hoy),
          };
        };
        return {
          idProducto: v.idProducto,
          placas: v.placas,
          economico: v.economico,
          descripcion: v.descripcion,
          imeis: v.imeis,
          odometro: contador(b.km, 'km'),
          horasMotor: contador(b.horas, 'horasMotor'),
          historialDesde: primerDia,
          odometroEquipo:
            v.imeis.map((i) => odometrosEquipo.get(i)).find((x) => x != null) ?? null,
        };
      });
      return {
        data: {
          idCliente,
          calculadoAl: ahoraMexico(),
          total: items.length,
          vehiculos: items,
        },
      };
    });
  }

  async odometro(
    dto: ConsultaUnidades & { fechaInicio: string; fechaFinal: string },
    usuario: Usuario,
  ) {
    return envolver(async () => {
      const hoy = hoyMexico();
      const dias = diasDelPeriodo(dto.fechaInicio, dto.fechaFinal).filter(
        (d) => d <= hoy,
      );
      if (dto.fechaInicio > dto.fechaFinal) {
        throw new BadRequestException('fechaInicio no puede ser posterior a fechaFinal');
      }
      if (diasDelPeriodo(dto.fechaInicio, dto.fechaFinal).length > MAX_DIAS_ODOMETRO) {
        throw new BadRequestException(
          `El periodo no puede pasar de ${MAX_DIAS_ODOMETRO} días`,
        );
      }
      const { idCliente, vehiculos } = await this.vehiculos(dto, usuario);
      const bases = await this.bases(vehiculos.map((v) => v.idProducto));
      const desdeMin =
        minimaFecha(
          [...bases.values()].flatMap((b) => [b.km.fecha, b.horas.fecha]),
        )?.slice(0, 10) ?? dto.fechaInicio;
      const guardados = await this.resumen.porProducto(
        vehiculos.map((v) => v.idProducto),
        desdeMin < dto.fechaInicio ? desdeMin : dto.fechaInicio,
        dto.fechaFinal < hoy ? dto.fechaFinal : diaAnterior(hoy),
      );
      const deHoy = dias.includes(hoy)
        ? await this.deHoy(dto, usuario, vehiculos, hoy)
        : new Map();

      const items = vehiculos.map((v) => {
        const b = bases.get(v.idProducto)!;
        const filas: FilaResumenDiario[] = guardados.filter(
          (f) => f.idProducto === v.idProducto,
        );
        const hoyV = deHoy.get(v.idProducto);
        const serie = (base: BaseContador, campo: 'km' | 'horasMotor') => {
          const porDia = sumarPorDia(
            filas.map((f) => ({ fecha: f.fecha, valor: f[campo] })),
          );
          if (hoyV) porDia.set(hoy, hoyV[campo]);
          const previos = filas
            .filter((f) => f.fecha < dto.fechaInicio && cuentaParaBase(base, f.fecha))
            .reduce((s, f) => s + f[campo], 0);
          return serieAlCierre(base, previos, dias, porDia);
        };
        const km = serie(b.km, 'km');
        const horas = serie(b.horas, 'horasMotor');
        return {
          idProducto: v.idProducto,
          placas: v.placas,
          economico: v.economico,
          descripcion: v.descripcion,
          imeis: v.imeis,
          baseOdometro: b.km,
          baseHorasMotor: b.horas,
          km: redondear(km.reduce((s, d) => s + d.valor, 0)),
          horasMotor: redondear(horas.reduce((s, d) => s + d.valor, 0)),
          porDia: dias.map((fecha, i) => ({
            fecha,
            km: km[i].valor,
            odometroAlCierre: km[i].alCierre,
            horasMotor: horas[i].valor,
            horasMotorAlCierre: horas[i].alCierre,
          })),
        };
      });
      return {
        data: {
          idCliente,
          fechaInicio: dto.fechaInicio,
          fechaFinal: dto.fechaFinal,
          total: items.length,
          vehiculos: items,
        },
      };
    });
  }

  /** Lectura del tablero: nueva base del odómetro y/o de las horas de motor. */
  async ajustar(idProducto: number, dto: AjusteContadoresDto, usuario: Usuario) {
    return envolver(async () => {
      if (dto.km == null && dto.horasMotor == null) {
        throw new BadRequestException('Manda km, horasMotor o ambos');
      }
      const [producto]: Array<{ idCliente: number }> = await this.dataSource.query(
        'SELECT p.IdCliente AS idCliente FROM Productos p JOIN Vehiculos v ON v.IdProducto = p.Id WHERE p.Id = ?',
        [idProducto],
      );
      if (!producto) throw new NotFoundException('Vehículo no encontrado');
      const scope = await this.tenantFilter.idsClientePermitidos(
        usuario.rol,
        usuario.idClienteToken,
      );
      if (!this.tenantFilter.clienteVisibleEnScope(scope, Number(producto.idCliente))) {
        throw new ForbiddenException('El vehículo no es de tu alcance');
      }
      let fecha: string;
      try {
        fecha = dto.fecha ? parseFechaHistorico(dto.fecha) : ahoraMexico();
      } catch {
        throw new BadRequestException('fecha inválida');
      }
      const ahora = ahoraMexico();
      if (fecha > ahora)
        throw new BadRequestException('La fecha de la lectura no puede ser futura');

      await this.dataSource.query(
        `INSERT INTO ContadoresVehiculo
           (IdProducto, KmBase, FechaKmBase, HorasMotorBase, FechaHorasMotorBase, IdUsuario, FechaActualizacion)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           KmBase = IF(VALUES(KmBase) IS NULL, KmBase, VALUES(KmBase)),
           FechaKmBase = IF(VALUES(KmBase) IS NULL, FechaKmBase, VALUES(FechaKmBase)),
           HorasMotorBase = IF(VALUES(HorasMotorBase) IS NULL, HorasMotorBase, VALUES(HorasMotorBase)),
           FechaHorasMotorBase = IF(VALUES(HorasMotorBase) IS NULL, FechaHorasMotorBase, VALUES(FechaHorasMotorBase)),
           IdUsuario = VALUES(IdUsuario),
           FechaActualizacion = VALUES(FechaActualizacion)`,
        [
          idProducto,
          dto.km ?? null,
          dto.km != null ? fecha : null,
          dto.horasMotor ?? null,
          dto.horasMotor != null ? fecha : null,
          usuario.idUsuario,
          ahora,
        ],
      );
      await this.bitacora.logToBitacora(
        'Reportes',
        `Contadores del vehículo ${idProducto} ajustados con la lectura del tablero.`,
        'UPDATE',
        { idProducto, km: dto.km ?? null, horasMotor: dto.horasMotor ?? null, fecha },
        usuario.idUsuario,
        EnumModulos.VEHICULOS,
        EstatusEnumBitcora.SUCCESS,
      );
      const bases = await this.bases([idProducto]);
      return { data: { idProducto, ...bases.get(idProducto)! } };
    });
  }

  /** Vehículos del alcance (una entrada por producto, aunque haya tenido varias instalaciones). */
  private async vehiculos(dto: ConsultaUnidades, usuario: Usuario) {
    const { idCliente, unidades } = await this.reportes.unidadesDelAlcance(
      dto,
      usuario.idClienteToken,
      usuario.rol,
      usuario.idUsuario,
    );
    const porProducto = new Map<number, Vehiculo>();
    // La instalación más reciente (id mayor) pone la etiqueta y el IMEI actual.
    for (const u of [...unidades].sort((a, b) => b.idInstalacion - a.idInstalacion)) {
      if (u.idProducto == null) continue;
      const v = porProducto.get(u.idProducto);
      if (v) {
        v.idsInstalacion.push(u.idInstalacion);
        u.imeis.forEach((i) => !v.imeis.includes(i) && v.imeis.push(i));
      } else {
        const { idInstalacion, idProducto, ...etiqueta } = u;
        porProducto.set(idProducto, {
          ...etiqueta,
          imeis: [...u.imeis],
          idProducto,
          idsInstalacion: [idInstalacion],
        });
      }
    }
    return {
      idCliente,
      vehiculos: [...porProducto.values()].sort((a, b) => a.idProducto - b.idProducto),
    };
  }

  /** Base de cada contador: la lectura capturada o, sin ella, el alta del vehículo. */
  private async bases(idsProducto: number[]): Promise<Map<number, Bases>> {
    const bases = new Map<number, Bases>();
    if (!idsProducto.length) return bases;
    const filas: Array<Record<string, unknown>> = await this.dataSource.query(
      `SELECT p.Id AS idProducto, v.KM AS kmAlta, DATE_FORMAT(p.FechaCreacion, '%Y-%m-%d %H:%i:%s') AS alta,
              c.KmBase AS kmBase, DATE_FORMAT(c.FechaKmBase, '%Y-%m-%d %H:%i:%s') AS fechaKm,
              c.HorasMotorBase AS horasBase, DATE_FORMAT(c.FechaHorasMotorBase, '%Y-%m-%d %H:%i:%s') AS fechaHoras
         FROM Productos p
         LEFT JOIN Vehiculos v ON v.IdProducto = p.Id
         LEFT JOIN ContadoresVehiculo c ON c.IdProducto = p.Id
        WHERE p.Id IN (?)`,
      [idsProducto],
    );
    for (const f of filas) {
      const alta = f.alta == null ? null : String(f.alta);
      const desdeAlta = (valor: unknown): BaseContador => ({
        valor: Number(valor) || 0,
        fecha: alta,
        fuente: alta ? 'alta_vehiculo' : 'sin_base',
      });
      bases.set(Number(f.idProducto), {
        km:
          f.kmBase != null
            ? { valor: Number(f.kmBase), fecha: String(f.fechaKm), fuente: 'captura' }
            : desdeAlta(f.kmAlta),
        horas:
          f.horasBase != null
            ? {
                valor: Number(f.horasBase),
                fecha: String(f.fechaHoras),
                fuente: 'captura',
              }
            : desdeAlta(0),
      });
    }
    for (const id of idsProducto) {
      if (!bases.has(id)) {
        const sin: BaseContador = { valor: 0, fecha: null, fuente: 'sin_base' };
        bases.set(id, { km: sin, horas: sin });
      }
    }
    return bases;
  }

  /** Km y horas de motor del día en curso, calculados al consultar, por producto. */
  private async deHoy(
    dto: ConsultaUnidades,
    usuario: Usuario,
    vehiculos: Vehiculo[],
    hoy: string,
  ): Promise<Map<number, { km: number; horasMotor: number }>> {
    const productoDe = new Map<number, number>();
    vehiculos.forEach((v) =>
      v.idsInstalacion.forEach((i) => productoDe.set(i, v.idProducto)),
    );
    const porInstalacion = await this.jornadas.resumenPorInstalacion(
      {
        idCliente: dto.idCliente,
        filtro: dto.filtro,
        valores: dto.valores,
        fechaInicio: hoy,
        fechaFinal: hoy,
      },
      usuario,
    );
    const deHoy = new Map<number, { km: number; horasMotor: number }>();
    for (const [idInstalacion, [j]] of porInstalacion) {
      const idProducto = productoDe.get(idInstalacion);
      if (idProducto == null || !j) continue;
      const v = deHoy.get(idProducto) ?? { km: 0, horasMotor: 0 };
      deHoy.set(idProducto, { km: v.km + j.km, horasMotor: v.horasMotor + j.horasMotor });
    }
    return deHoy;
  }

  /** Lo que reporta el equipo en `UltimaPosicion.Odometro` (sin ajustar). */
  private async odometrosEquipo(imeis: string[]): Promise<Map<string, number>> {
    const unicos = [...new Set(imeis)];
    if (!unicos.length) return new Map();
    const filas: Array<{ imei: string; odometro: unknown }> = await this.dataSource.query(
      'SELECT CAST(Imei AS CHAR) AS imei, Odometro AS odometro FROM UltimaPosicion WHERE Imei IN (?) AND Odometro IS NOT NULL',
      [unicos],
    );
    return new Map(filas.map((f) => [String(f.imei), Number(f.odometro)]));
  }
}

function ahoraMexico(): string {
  return fechaDeMs(nowMexicoCityAsUtcDate().getTime()).replace('T', ' ');
}

function hoyMexico(): string {
  return ahoraMexico().slice(0, 10);
}

function diaAnterior(dia: string): string {
  return fechaDeMs(Date.parse(`${dia}T00:00:00Z`) - MS_DIA).slice(0, 10);
}

function minimaFecha(fechas: Array<string | null>): string | null {
  const validas = fechas.filter((f): f is string => f != null).sort();
  return validas[0] ?? null;
}

async function envolver<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof HttpException) throw error;
    throw new BadRequestException((error as Error)?.message);
  }
}
