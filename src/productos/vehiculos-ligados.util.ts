import { EntityManager } from 'typeorm';
import { EnumTipoDispositivo, EstatusEnum } from 'src/common/estatus.enum';
import { Dispositivos } from 'src/entities/Dispositivos';
import { Instalaciones } from 'src/entities/Instalaciones';

/** Vehículo ligado a una geocerca o a un punto de interés. */
export interface VehiculoLigado {
  idProducto: number;
  idCliente: number | null;
  nombreProducto: string | null;
  placa: string | null;
  numeroEconomico: string | null;
  /** Instalación activa del vehículo (GPS antes que TrackCam o reloj). */
  idInstalacion: number | null;
}

/** Tipos de rastreo que se prefieren como instalación del vehículo (GPS antes que TrackCam o reloj). */
const TIPOS_RASTREO_PREFERIDOS = [
  EnumTipoDispositivo.RASTREADOR,
  EnumTipoDispositivo.AVL,
  EnumTipoDispositivo.TELEFONO,
  EnumTipoDispositivo.TRACKGAS,
];

/** Nombre, placa, económico e instalación activa de cada vehículo. */
export async function vehiculosLigados(m: EntityManager, idsProducto: number[]): Promise<Map<number, VehiculoLigado>> {
  const ids = [...new Set(idsProducto.map(Number).filter((x) => Number.isFinite(x) && x > 0))];
  if (!ids.length) return new Map();
  const [etiquetas, instalaciones] = await Promise.all([
    m.query(
      `SELECT p.Id AS id, p.Nombre AS nombre, p.IdCliente AS idCliente, v.Placa AS placa, v.NumeroEconomico AS economico
         FROM Productos p LEFT JOIN Vehiculos v ON v.IdProducto = p.Id WHERE p.Id IN (?)`,
      [ids],
    ) as Promise<Array<{ id: string; nombre: string | null; idCliente: string; placa: string | null; economico: string | null }>>,
    m
      .createQueryBuilder(Instalaciones, 'i')
      .leftJoin(Dispositivos, 'd', 'd.id = i.idDispositivo')
      .select(['i.idProducto AS idProducto', 'i.id AS id'])
      .where('i.idProducto IN (:...ids) AND i.estatus = :activa', { ids, activa: EstatusEnum.ACTIVO })
      .orderBy(`CASE WHEN d.idTipoDispositivo IN (${TIPOS_RASTREO_PREFERIDOS.join(',')}) THEN 0 ELSE 1 END`, 'ASC')
      .addOrderBy('i.id', 'ASC')
      .getRawMany<{ idProducto: unknown; id: unknown }>(),
  ]);
  const instalacion = new Map<number, number>();
  for (const f of instalaciones) {
    const p = Number(f.idProducto);
    if (!instalacion.has(p)) instalacion.set(p, Number(f.id));
  }
  const etiqueta = new Map(etiquetas.map((e) => [Number(e.id), e]));
  return new Map(
    ids.map((idProducto) => {
      const e = etiqueta.get(idProducto);
      return [
        idProducto,
        {
          idProducto,
          idCliente: e ? Number(e.idCliente) : null,
          nombreProducto: e?.nombre ?? null,
          placa: e?.placa ?? null,
          numeroEconomico: e?.economico ?? null,
          idInstalacion: instalacion.get(idProducto) ?? null,
        },
      ];
    }),
  );
}
