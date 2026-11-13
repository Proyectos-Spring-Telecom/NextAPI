import { TipoOrigenIncidente } from 'src/common/estatus.enum';
import { Incidentes } from 'src/entities/Incidentes';
import { idPanelIncidente, imeiIncidente, mapIncidentePlano } from './map-incidentes.util';

const incidente = (tipoOrigen: number, datosOrigen: Record<string, unknown>) =>
  ({ id: 62, idCliente: 13, tipoOrigen, datosOrigen, estatus: 1 }) as unknown as Incidentes;

describe('map-incidentes: unidad e inmueble', () => {
  it('panel: idPanel del snapshot, sin IMEI; posición: IMEI, sin panel', () => {
    const panel = incidente(TipoOrigenIncidente.EVENTO_ALARMA, { idPanel: 1000002, zona: 1 });
    expect(idPanelIncidente(panel)).toBe(1000002);
    expect(imeiIncidente(panel)).toBeNull();
    const pos = incidente(TipoOrigenIncidente.POSICION, { imei: '861', idPanel: 5 });
    expect(idPanelIncidente(pos)).toBeNull();
    expect(imeiIncidente(pos)).toBe('861');
  });

  it('panel: inmueble, instalación y coordenadas del inmueble', () => {
    const plano = mapIncidentePlano(incidente(TipoOrigenIncidente.EVENTO_ALARMA, { idPanel: 1000002 }), false, {
      idInstalacion: 900,
      economico: null,
      placas: null,
      marca: null,
      modelo: null,
      nombreProducto: 'Casa Pedregal',
      inmueble: 'Casa Pedregal',
      lat: 19.3,
      lng: -99.2,
    });
    expect(plano).toMatchObject({ idInstalacion: 900, nombreProducto: 'Casa Pedregal', inmueble: 'Casa Pedregal', lat: 19.3, lng: -99.2 });
  });

  it('panel sin instalación activa: todo en null', () => {
    const plano = mapIncidentePlano(incidente(TipoOrigenIncidente.EVENTO_ALARMA, { idPanel: 1000002 }));
    expect(plano).toMatchObject({ idInstalacion: null, nombreProducto: null, inmueble: null, lat: null, lng: null });
  });

  it('posición: lat/lng de la posición; sin ubicación medida quedan en null (no 0)', () => {
    expect(mapIncidentePlano(incidente(TipoOrigenIncidente.POSICION, { imei: '1', lat: 19.4, lng: -99.1 }))).toMatchObject({
      lat: 19.4,
      lng: -99.1,
    });
    expect(mapIncidentePlano(incidente(TipoOrigenIncidente.POSICION, { imei: '1', lat: null, lng: null }))).toMatchObject({
      lat: null,
      lng: null,
    });
  });
});
