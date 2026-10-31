import { Injectable } from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { Instalaciones } from 'src/entities/Instalaciones';
import { HistoricoInstalaciones } from 'src/entities/HistoricoInstalaciones';
import { Dispositivos } from 'src/entities/Dispositivos';
import { EstatusEnum, EnumAccionHistoricoInstalacion } from 'src/common/estatus.enum';
import { fechaPared } from 'src/utils/datetime-mexico.util';
import { fusionarTramos, type TramoInstalacion } from './tramos-instalacion';

interface Version {
  idCliente: number;
  idProducto: number | null;
  idDispositivo: number | null;
  desde: Date | null;
  hasta: Date | null;
}

/**
 * Carga los tramos de vigencia de instalaciones (docs/motor-activos.md §6):
 * la versión vigente (desde `VigenteDesde`, abierta) y la cadena archivada en
 * `HistoricoInstalaciones` por `IdHistoricoInstalacion`.
 *
 * - Dada de baja con el motor: su último periodo es la baja archivada; la fila
 *   ya no aporta un tramo abierto.
 * - Baja anterior al motor (sin archivo): el periodo termina en
 *   `FechaActualizacion`, la última escritura de la fila.
 * - Solo versiones del mismo cliente que la instalación: lo transmitido se
 *   queda con el cliente donde se generó.
 */
@Injectable()
export class TramosInstalacionService {
  constructor(private readonly dataSource: DataSource) {}

  async tramosDe(idsInstalacion: readonly number[]): Promise<Map<number, TramoInstalacion[]>> {
    const ids = [...new Set(idsInstalacion.map(Number))];
    const resultado = new Map<number, TramoInstalacion[]>(ids.map((id) => [id, []]));
    if (!ids.length) return resultado;
    const manager = this.dataSource.manager;

    const filas = await manager.find(Instalaciones, {
      where: { id: In(ids) },
      select: {
        id: true,
        idCliente: true,
        idProducto: true,
        idDispositivo: true,
        estatus: true,
        vigenteDesde: true,
        fechaActualizacion: true,
        idHistoricoInstalacion: true,
      },
    });

    const inactivas = filas.filter((f) => Number(f.estatus) !== EstatusEnum.ACTIVO).map((f) => Number(f.id));
    const bajas = inactivas.length
      ? await manager.find(HistoricoInstalaciones, {
          where: { idInstalacionOriginal: In(inactivas), accion: EnumAccionHistoricoInstalacion.BAJA },
          select: { id: true, idInstalacionOriginal: true },
          order: { id: 'DESC' },
        })
      : [];
    const ultimaBaja = new Map<number, number>();
    for (const b of bajas) {
      const orig = Number(b.idInstalacionOriginal);
      if (!ultimaBaja.has(orig)) ultimaBaja.set(orig, Number(b.id));
    }

    const versiones = new Map<number, Version[]>();
    const cursor = new Map<number, number>(); // id de histórico → instalación que lo pide
    for (const f of filas) {
      const id = Number(f.id);
      const idCliente = Number(f.idCliente);
      const eslabon = f.idHistoricoInstalacion != null ? Number(f.idHistoricoInstalacion) : null;
      const lista: Version[] = [];
      versiones.set(id, lista);
      const activa = Number(f.estatus) === EstatusEnum.ACTIVO;
      const baja = ultimaBaja.get(id);
      if (!activa && baja != null && baja > (eslabon ?? 0)) {
        cursor.set(baja, id);
        continue;
      }
      lista.push({
        idCliente,
        idProducto: f.idProducto != null ? Number(f.idProducto) : null,
        idDispositivo: f.idDispositivo != null ? Number(f.idDispositivo) : null,
        desde: f.vigenteDesde,
        hasta: activa ? null : (f.fechaActualizacion ?? f.vigenteDesde),
      });
      if (eslabon != null) cursor.set(eslabon, id);
    }

    // La cadena, un nivel por consulta.
    const visitados = new Set<number>();
    while (cursor.size) {
      const pendientes = [...cursor.entries()].filter(([h]) => !visitados.has(h));
      cursor.clear();
      if (!pendientes.length) break;
      pendientes.forEach(([h]) => visitados.add(h));
      const hist = await manager.find(HistoricoInstalaciones, {
        where: { id: In(pendientes.map(([h]) => h)) },
      });
      const porId = new Map(hist.map((h) => [Number(h.id), h]));
      for (const [idHist, idInst] of pendientes) {
        const h = porId.get(idHist);
        if (!h) continue;
        versiones.get(idInst)!.push({
          idCliente: Number(h.idCliente),
          idProducto: h.idProducto != null ? Number(h.idProducto) : null,
          idDispositivo: h.idDispositivo != null ? Number(h.idDispositivo) : null,
          desde: h.vigenteDesde,
          hasta: h.vigenteHasta ?? h.fhArchivado ?? h.vigenteDesde,
        });
        if (h.idHistoricoInstalacion != null) cursor.set(Number(h.idHistoricoInstalacion), idInst);
      }
    }

    const idsDispositivo = [
      ...new Set([...versiones.values()].flat().map((v) => v.idDispositivo).filter((d): d is number => d != null)),
    ];
    const dispositivos = idsDispositivo.length
      ? await manager.find(Dispositivos, { where: { id: In(idsDispositivo) }, select: { id: true, imei: true } })
      : [];
    const imeiDe = new Map(dispositivos.map((d) => [Number(d.id), d.imei ? String(d.imei) : null]));

    for (const f of filas) {
      const id = Number(f.id);
      const idCliente = Number(f.idCliente);
      const tramos: TramoInstalacion[] = [];
      for (const v of versiones.get(id) ?? []) {
        if (v.idCliente !== idCliente || v.idDispositivo == null || !v.desde) continue;
        const imei = imeiDe.get(v.idDispositivo);
        if (!imei) continue;
        tramos.push({
          idInstalacion: id,
          idDispositivo: v.idDispositivo,
          idProducto: v.idProducto,
          imei,
          desde: fechaPared(new Date(v.desde)),
          hasta: v.hasta ? fechaPared(new Date(v.hasta)) : null,
        });
      }
      resultado.set(id, fusionarTramos(tramos));
    }
    return resultado;
  }

  /** Tramos de una instalación. */
  async tramosDeInstalacion(idInstalacion: number): Promise<TramoInstalacion[]> {
    return (await this.tramosDe([idInstalacion])).get(Number(idInstalacion)) ?? [];
  }
}
