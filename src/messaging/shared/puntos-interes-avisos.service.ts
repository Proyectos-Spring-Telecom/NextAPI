import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TIPOS_DISPOSITIVO_GEOCERCA } from 'src/common/estatus.enum';
import { EventosPuntoInteres } from 'src/entities/EventosPuntoInteres';
import { MonitoreoGateway } from 'src/monitoreo/monitoreo.gateway';
import { fechaPared } from 'src/utils/datetime-mexico.util';
import { distanciaMetros } from 'src/utils/recorrido.utils';

/** Margen para dar por salido (evita llegadas y salidas repetidas por el ruido del GPS en la orilla). */
export function margenSalidaMetros(radio: number): number {
  return Math.max(15, radio * 0.2);
}

/**
 * Dentro (llegó), fuera (salió) o `null` si está en la franja de la orilla y se
 * queda como estaba: entra al pasar el radio y sale al pasar radio + margen.
 */
export function dentroDelPunto(distancia: number, radio: number): boolean | null {
  if (distancia <= radio) return true;
  if (distancia > radio + margenSalidaMetros(radio)) return false;
  return null;
}

export interface PosicionParaPuntos {
  idInstalacion: number;
  idPosicion: number;
  idTipoDispositivo?: number | null;
  lat?: number | null;
  lng?: number | null;
  /** Hora de México (misma convención que `Posiciones.FechaHora`). */
  fechaHora?: Date | null;
}

/**
 * Llegada y salida de los puntos de interés ligados al vehículo
 * (`ProductosPuntoInteres`). Lo llama el ingest FUERA de su transacción y sin
 * esperar: un error se registra y nunca afecta la llegada de datos. No toca el
 * Estado ni el IdEvento de la posición ni abre incidentes.
 *
 * El estado (dentro/fuera) es del vehículo en cada punto (`EstadoPuntoInteres`):
 * sus equipos lo comparten y una posición más vieja que la que fijó el estado
 * no lo cambia. La primera posición solo fija el estado.
 */
@Injectable()
export class PuntosInteresAvisosService {
  private readonly logger = new Logger(PuntosInteresAvisosService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly monitoreoGateway: MonitoreoGateway,
  ) {}

  async evaluar(p: PosicionParaPuntos): Promise<void> {
    try {
      const lat = Number(p.lat);
      const lng = Number(p.lng);
      if (!TIPOS_DISPOSITIVO_GEOCERCA.includes(Number(p.idTipoDispositivo))) return;
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return;
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || !(p.fechaHora instanceof Date)) return;

      const puntos: Array<{ id: string; nombre: string; lat: number; lng: number; radio: number | null; idProducto: string }> =
        await this.dataSource.query(
          `SELECT p.Id AS id, p.Nombre AS nombre, p.Lat AS lat, p.Lng AS lng, p.RadioMetros AS radio, i.IdProducto AS idProducto
             FROM Instalaciones i
             JOIN ProductosPuntoInteres pp ON pp.IdProducto = i.IdProducto AND pp.Estatus = 1
             JOIN PuntosInteres p ON p.Id = pp.IdPuntoInteres AND p.Estatus = 1
            WHERE i.Id = ?`,
          [p.idInstalacion],
        );
      for (const punto of puntos) {
        const radio = Number(punto.radio) > 0 ? Number(punto.radio) : 25;
        const distancia = distanciaMetros({ lat, lng }, { lat: Number(punto.lat), lng: Number(punto.lng) });
        const dentro = dentroDelPunto(distancia, radio);
        if (dentro == null) continue;
        await this.aplicar(p, Number(punto.idProducto), Number(punto.id), punto.nombre, dentro, distancia, lat, lng);
      }
    } catch (error) {
      this.logger.warn(
        `[PuntosInteres] no se pudo evaluar instalacion=${p.idInstalacion} posicion=${p.idPosicion}: ${(error as Error)?.message}`,
      );
    }
  }

  private async aplicar(
    p: PosicionParaPuntos,
    idProducto: number,
    idPuntoInteres: number,
    nombre: string,
    dentro: boolean,
    distancia: number,
    lat: number,
    lng: number,
  ): Promise<void> {
    const valor = dentro ? 1 : 0;
    const fecha = p.fechaHora as Date;
    // La primera vez solo fija el estado.
    const nuevo = await this.dataSource.query(
      'INSERT IGNORE INTO EstadoPuntoInteres (IdProducto, IdPuntoInteres, Dentro, FechaHora) VALUES (?, ?, ?, ?)',
      [idProducto, idPuntoInteres, valor, fecha],
    );
    if (Number(nuevo?.affectedRows) === 1) return;
    // Cambió (y la posición es más nueva que la que fijó el estado): una sola
    // fila gana aunque lleguen a la vez posiciones de dos equipos del vehículo.
    const cambio = await this.dataSource.query(
      `UPDATE EstadoPuntoInteres SET Dentro = ?, FechaHora = ?
        WHERE IdProducto = ? AND IdPuntoInteres = ? AND Dentro <> ? AND FechaHora < ?`,
      [valor, fecha, idProducto, idPuntoInteres, valor, fecha],
    );
    if (Number(cambio?.affectedRows) !== 1) {
      await this.dataSource.query(
        'UPDATE EstadoPuntoInteres SET FechaHora = ? WHERE IdProducto = ? AND IdPuntoInteres = ? AND Dentro = ? AND FechaHora < ?',
        [fecha, idProducto, idPuntoInteres, valor, fecha],
      );
      return;
    }
    const tipo = dentro ? 'llegada' : 'salida';
    const evento = await this.dataSource.getRepository(EventosPuntoInteres).save({
      idPuntoInteres,
      idProducto,
      idInstalacion: p.idInstalacion,
      idPosicion: p.idPosicion,
      tipo,
      fechaHora: fecha,
    });
    this.logger.log(
      `[PuntosInteres] ${tipo} producto=${idProducto} punto=${idPuntoInteres} instalacion=${p.idInstalacion} posicion=${p.idPosicion}`,
    );
    this.monitoreoGateway.emitPuntoInteres({
      id: Number(evento.id),
      tipo,
      idPuntoInteres,
      nombrePuntoInteres: nombre,
      idProducto,
      idInstalacion: p.idInstalacion,
      idPosicion: p.idPosicion,
      fechaHora: fechaPared(fecha),
      lat,
      lng,
      distanciaMetros: Math.round(distancia),
    });
  }
}
