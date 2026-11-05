import { Dispositivos } from 'src/entities/Dispositivos';
import { Sims } from 'src/entities/Sims';
import { Vehiculos } from 'src/entities/Vehiculos';
import { archivosVehiculo, DOCUMENTOS_VEHICULO, FOTOS_VEHICULO, textoDispositivo, textoSim } from './ordenes-servicio.equipos';

describe('equipos de la orden en texto', () => {
  const equipo = {
    imei: '3333',
    numeroSerie: '0000009',
    idMarca2: { nombre: 'Suntech' },
    idModelo2: { nombre: 'ST210' },
    idTipoDispositivo2: { nombre: 'AVL' },
  } as unknown as Dispositivos;

  it('dispositivo como en el PDF, con el tipo solo para el equipo nuevo', () => {
    expect(textoDispositivo(equipo)).toBe('Suntech ST210 - IMEI 3333 - Serie: 0000009');
    expect(textoDispositivo(equipo, true)).toBe('AVL - Suntech ST210 - IMEI 3333 - Serie: 0000009');
    expect(textoDispositivo({ numeroSerie: '7' } as Dispositivos)).toBe('Serie: 7');
    expect(textoDispositivo(null)).toBeNull();
  });

  it('SIM con compañía, ICCID y teléfono', () => {
    const sim = { imei: '000002', numeroTelefono: '7775642667', idTelefonia2: { nombreTelefonia: 'Telcel' } } as unknown as Sims;
    expect(textoSim(sim)).toBe('Telcel - ICCID 000002 - Tel: 7775642667');
    expect(textoSim(null)).toBeNull();
  });

  it('solo las fotos y documentos registrados, en el orden de la ficha', () => {
    const v = { foto: 's3://a', fotoTrasera: 's3://b', fotoFrente: null, polizaSeguro: 's3://c' } as unknown as Vehiculos;
    expect(archivosVehiculo(v, FOTOS_VEHICULO)).toEqual([
      { clave: 'foto', nombre: 'Principal', ruta: 's3://a' },
      { clave: 'fotoTrasera', nombre: 'Trasera', ruta: 's3://b' },
    ]);
    expect(archivosVehiculo(v, DOCUMENTOS_VEHICULO)).toEqual([{ clave: 'polizaSeguro', nombre: 'Póliza de seguro', ruta: 's3://c' }]);
    expect(archivosVehiculo(null, FOTOS_VEHICULO)).toEqual([]);
  });
});
