import { Injectable, Logger, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TIPOS_DISPOSITIVO_GEOCERCA } from 'src/common/estatus.enum';
import { extractOuterRing } from './estado-geocerca.util';
import { dentroDeGeocerca } from './geocercas-avisos.util';
import type { PosicionParaPuntos } from './puntos-interes-avisos.service';
import { WebhooksClienteService } from 'src/webhooks-cliente/webhooks-cliente.service';
import { fechaPared } from 'src/utils/datetime-mexico.util';

/**
 * Entrada y salida de las geocercas ligadas al vehículo (`ProductosGeocerca`),
 * para el reporte de entradas y salidas (docs/fis-fiber, ruta del back §3.3).
 * Lo llama el ingest FUERA de su transacción y sin esperar: un error se
 * registra y nunca afecta la llegada de datos. No toca el Estado 8 (eso lo
 * sigue haciendo el ingest) ni abre incidentes.
 *
 * El estado (dentro/fuera) es del vehículo en cada geocerca (`EstadoGeocerca`):
 * sus equipos lo comparten y una posición más vieja que la que fijó el estado
 * no lo cambia. La primera posición solo fija el estado.
 */
@Injectable()
export class GeocercasAvisosService {
  private readonly logger = new Logger(GeocercasAvisosService.name);

  constructor(
    private readonly dataSource: DataSource,
    @Optional() private readonly webhooks?: WebhooksClienteService,
  ) {}

  async evaluar(p: PosicionParaPuntos): Promise<void> {
    try {
      const lat = Number(p.lat);
      const lng = Number(p.lng);
      if (!TIPOS_DISPOSITIVO_GEOCERCA.includes(Number(p.idTipoDispositivo))) return;
      if (p.lat == null || p.lng == null) return;
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0))
        return;
      if (Math.abs(lat) > 90 || Math.abs(lng) > 180 || !(p.fechaHora instanceof Date))
        return;

      const geocercas: Array<{ id: string; geocerca: unknown; idProducto: string }> =
        await this.dataSource.query(
          `SELECT g.Id AS id, g.Geocerca AS geocerca, i.IdProducto AS idProducto
           FROM Instalaciones i
           JOIN ProductosGeocerca pg ON pg.IdProducto = i.IdProducto AND pg.Estatus = 1
           JOIN Geocercas g ON g.Id = pg.IdGeocerca AND g.Estatus = 1
          WHERE i.Id = ?`,
          [p.idInstalacion],
        );
      for (const g of geocercas) {
        const ring = extractOuterRing(
          typeof g.geocerca === 'string' ? JSON.parse(g.geocerca) : g.geocerca,
        );
        if (!ring) continue;
        const dentro = dentroDeGeocerca(lng, lat, ring);
        if (dentro == null) continue;
        await this.aplicar(p, Number(g.idProducto), Number(g.id), dentro, lat, lng);
      }
    } catch (error) {
      this.logger.warn(
        `[Geocercas] no se pudo evaluar instalacion=${p.idInstalacion} posicion=${p.idPosicion}: ${(error as Error)?.message}`,
      );
    }
  }

  private async aplicar(
    p: PosicionParaPuntos,
    idProducto: number,
    idGeocerca: number,
    dentro: boolean,
    lat: number,
    lng: number,
  ): Promise<void> {
    const valor = dentro ? 1 : 0;
    const fecha = p.fechaHora as Date;
    // La primera vez solo fija el estado.
    const nuevo = await this.dataSource.query(
      'INSERT IGNORE INTO EstadoGeocerca (IdProducto, IdGeocerca, Dentro, FechaHora) VALUES (?, ?, ?, ?)',
      [idProducto, idGeocerca, valor, fecha],
    );
    if (Number(nuevo?.affectedRows) === 1) return;
    // Cambió (y la posición es más nueva que la que fijó el estado): una sola
    // fila gana aunque lleguen a la vez posiciones de dos equipos del vehículo.
    const cambio = await this.dataSource.query(
      `UPDATE EstadoGeocerca SET Dentro = ?, FechaHora = ?
        WHERE IdProducto = ? AND IdGeocerca = ? AND Dentro <> ? AND FechaHora < ?`,
      [valor, fecha, idProducto, idGeocerca, valor, fecha],
    );
    if (Number(cambio?.affectedRows) !== 1) {
      await this.dataSource.query(
        'UPDATE EstadoGeocerca SET FechaHora = ? WHERE IdProducto = ? AND IdGeocerca = ? AND Dentro = ? AND FechaHora < ?',
        [fecha, idProducto, idGeocerca, valor, fecha],
      );
      return;
    }
    const tipo = dentro ? 'entrada' : 'salida';
    await this.dataSource.query(
      `INSERT INTO EventosGeocerca (IdGeocerca, IdProducto, IdInstalacion, IdPosicion, Tipo, FechaHora)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [idGeocerca, idProducto, p.idInstalacion, p.idPosicion, tipo, fecha],
    );
    if (this.webhooks) {
      const [inst]: Array<{ idCliente: number; nombre: string }> =
        await this.dataSource.query(
          'SELECT i.IdCliente AS idCliente, g.Nombre AS nombre FROM Instalaciones i, Geocercas g WHERE i.Id = ? AND g.Id = ?',
          [p.idInstalacion, idGeocerca],
        );
      void this.webhooks.encolar(
        dentro ? 'geocerca.entrada' : 'geocerca.salida',
        inst?.idCliente,
        {
          idGeocerca,
          nombreGeocerca: inst?.nombre ?? null,
          idProducto,
          idInstalacion: p.idInstalacion,
          idPosicion: p.idPosicion,
          fechaHora: fechaPared(fecha),
          lat,
          lng,
        },
      );
    }
    this.logger.log(
      `[Geocercas] ${tipo} producto=${idProducto} geocerca=${idGeocerca} instalacion=${p.idInstalacion} posicion=${p.idPosicion}`,
    );
  }
}
