import { DataSource } from 'typeorm';
import { Dispositivos } from 'src/entities/Dispositivos';
import { HistoricoInstalaciones } from 'src/entities/HistoricoInstalaciones';
import { Instalaciones } from 'src/entities/Instalaciones';
import { OrdenesServicio } from 'src/entities/OrdenesServicio';
import { Sims } from 'src/entities/Sims';
import { Vehiculos } from 'src/entities/Vehiculos';

/**
 * Equipo, SIM, fotos y documentos de la orden en texto para personas: lo
 * comparten el detalle (`GET /ordenes-servicio/:id`) y el PDF.
 */

export interface InstalacionDescrita {
  idInstalacion: number;
  tipoEquipo: string | null;
  /** "Suntech ST210 - IMEI 3333 - Serie: 0000009" */
  dispositivo: string | null;
  /** "Telcel - ICCID 000002 - Tel: 7775642667" */
  sim: string | null;
}

export interface ArchivoVehiculo {
  clave: string;
  nombre: string;
  ruta: string;
}

type Version = { idProducto: number; idDispositivo: number | null; idSim: number | null };

export const FOTOS_VEHICULO = [
  ['foto', 'Principal'],
  ['fotoFrente', 'Frontal'],
  ['fotoTrasera', 'Trasera'],
  ['fotoDerecha', 'Lateral derecha'],
  ['fotoIzquierda', 'Lateral izquierda'],
  ['fotoExtra', 'Extra'],
] as const;
export const DOCUMENTOS_VEHICULO = [
  ['tarjetaCirculacion', 'Tarjeta de circulación'],
  ['polizaSeguro', 'Póliza de seguro'],
  ['permisoCarga', 'Permiso de carga'],
] as const;

export function textoDispositivo(x: Dispositivos | null | undefined, conTipo = false): string | null {
  if (!x) return null;
  return [
    conTipo ? x.idTipoDispositivo2?.nombre : null,
    [x.idMarca2?.nombre, x.idModelo2?.nombre].filter(Boolean).join(' ') || null,
    x.imei ? `IMEI ${x.imei}` : null,
    x.numeroSerie ? `Serie: ${x.numeroSerie}` : null,
  ]
    .filter(Boolean)
    .join(' - ');
}

export function textoSim(x: Sims | null | undefined): string | null {
  if (!x) return null;
  return [x.idTelefonia2?.nombreTelefonia, x.imei ? `ICCID ${x.imei}` : null, x.numeroTelefono ? `Tel: ${x.numeroTelefono}` : null]
    .filter(Boolean)
    .join(' - ');
}

/** Los archivos del vehículo que sí están registrados, en el orden de la ficha. */
export function archivosVehiculo(v: Vehiculos | null, lista: typeof FOTOS_VEHICULO | typeof DOCUMENTOS_VEHICULO): ArchivoVehiculo[] {
  if (!v) return [];
  return lista.filter(([clave]) => v[clave]).map(([clave, nombre]) => ({ clave, nombre, ruta: v[clave] as string }));
}

export class EquiposDeOrden {
  constructor(private readonly ds: DataSource) {}

  /** La instalación tal como quedó: viva o, si un cambio posterior la archivó, su versión en el histórico. */
  async version(id: number | null | undefined): Promise<Version | null> {
    if (!id) return null;
    const viva = await this.ds.getRepository(Instalaciones).findOne({ where: { id } });
    if (viva) return { idProducto: Number(viva.idProducto), idDispositivo: viva.idDispositivo, idSim: viva.idSim };
    const archivada = await this.ds
      .getRepository(HistoricoInstalaciones)
      .findOne({ where: { idInstalacionOriginal: id }, order: { id: 'DESC' } });
    return archivada ? { idProducto: Number(archivada.idProducto), idDispositivo: archivada.idDispositivo, idSim: archivada.idSim } : null;
  }

  dispositivo(id: number | null | undefined): Promise<Dispositivos | null> {
    return id
      ? this.ds.getRepository(Dispositivos).findOne({ where: { id }, relations: { idMarca2: true, idModelo2: true, idTipoDispositivo2: true } })
      : Promise.resolve(null);
  }

  sim(id: number | null | undefined): Promise<Sims | null> {
    return id ? this.ds.getRepository(Sims).findOne({ where: { id }, relations: { idTelefonia2: true } }) : Promise.resolve(null);
  }

  vehiculo(idProducto: number | null | undefined): Promise<Vehiculos | null> {
    return idProducto ? this.ds.getRepository(Vehiculos).findOne({ where: { idProducto } }) : Promise.resolve(null);
  }

  /** Lo que el detalle de la orden manda en vez de los ids. */
  async describir(orden: OrdenesServicio) {
    const idAtendida = Number(orden.idInstalacion ?? orden.idInstalacionProgramada) || null;
    const [atendida, resultado] = await Promise.all([this.version(idAtendida), this.version(orden.idInstalacionResultado)]);
    const describe = async (id: number | null, v: Version | null): Promise<InstalacionDescrita | null> => {
      if (!id || !v) return null;
      const [d, s] = await Promise.all([this.dispositivo(v.idDispositivo), this.sim(v.idSim)]);
      return { idInstalacion: id, tipoEquipo: d?.idTipoDispositivo2?.nombre ?? null, dispositivo: textoDispositivo(d), sim: textoSim(s) };
    };
    const idProducto = orden.idProducto ?? resultado?.idProducto ?? atendida?.idProducto ?? null;
    const [instalacion, instalacionResultado, dispositivoNuevo, simNuevo, vehiculo] = await Promise.all([
      describe(idAtendida, atendida),
      describe(Number(orden.idInstalacionResultado) || null, resultado),
      this.dispositivo(orden.idDispositivoNuevo),
      this.sim(orden.idSimNuevo),
      this.vehiculo(idProducto),
    ]);
    return {
      instalacion,
      instalacionResultado,
      dispositivoNuevo: textoDispositivo(dispositivoNuevo, true),
      simNuevo: textoSim(simNuevo),
      fotosVehiculo: archivosVehiculo(vehiculo, FOTOS_VEHICULO),
      documentosVehiculo: archivosVehiculo(vehiculo, DOCUMENTOS_VEHICULO),
    };
  }
}
