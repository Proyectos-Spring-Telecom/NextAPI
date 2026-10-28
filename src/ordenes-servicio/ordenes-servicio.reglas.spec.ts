import { faltantesParaCerrar, folioDe, OrdenParaCierre } from './ordenes-servicio.reglas';

const catalogo = [
  { seccion: 'vehiculo_cuenta_con', clave: 'alarma', obligatorio: 0 },
  { seccion: 'funcionamiento_vehiculo', clave: 'tablero_iniciar', obligatorio: 0 },
  { seccion: 'fallas_equipo', clave: 'otro', obligatorio: 0 },
  { seccion: 'pruebas', clave: 'transmision', obligatorio: 0 },
  { seccion: 'fotos', clave: 'tablero_inicio', obligatorio: 1 },
  { seccion: 'fotos', clave: 'falla_extra_1', obligatorio: 0 },
  { seccion: 'firmas', clave: 'firma_cliente', obligatorio: 1 },
];

const completas = [
  { seccion: 'vehiculo_cuenta_con', clave: 'alarma', valor: 0 },
  { seccion: 'funcionamiento_vehiculo', clave: 'tablero_iniciar', valor: 1 },
  { seccion: 'fallas_equipo', clave: 'otro', valor: 0 },
  { seccion: 'pruebas', clave: 'transmision', valor: 1 },
];
const archivos = [{ clave: 'tablero_inicio' }, { clave: 'firma_cliente' }];

const orden = (o: Partial<OrdenParaCierre>): OrdenParaCierre => ({
  tipoServicio: 'revision',
  idInstalacion: 10,
  idProducto: 5,
  idDispositivoNuevo: null,
  idSimNuevo: null,
  estatusSalienteAnterior: null,
  estatusInstalacionBaja: null,
  idMonitorista: 7,
  observaciones: null,
  ...o,
});

describe('faltantesParaCerrar', () => {
  it('revisión completa se puede cerrar (casillas en "no" cuentan como respondidas)', () => {
    expect(faltantesParaCerrar(orden({}), completas, archivos, catalogo)).toEqual([]);
  });

  it('casilla sin responder, archivo obligatorio y monitorista faltantes', () => {
    const f = faltantesParaCerrar(
      orden({ idMonitorista: null }),
      completas.filter((r) => r.seccion !== 'vehiculo_cuenta_con'),
      [{ clave: 'firma_cliente' }],
      catalogo,
    );
    expect(f).toEqual([
      'Sin respuesta en vehiculo_cuenta_con: alarma',
      'Faltan archivos: tablero_inicio',
      'Falta el monitorista',
    ]);
  });

  it('falla "otro" exige observaciones', () => {
    const r = completas.map((x) => (x.clave === 'otro' ? { ...x, valor: 1 } : x));
    expect(faltantesParaCerrar(orden({}), r, archivos, catalogo)).toContain(
      'La falla "Otro" requiere describirla en observaciones',
    );
    expect(faltantesParaCerrar(orden({ observaciones: 'tapa rota' }), r, archivos, catalogo)).toEqual([]);
  });

  it('al menos una prueba correcta, salvo en desinstalación', () => {
    const r = completas.map((x) => (x.seccion === 'pruebas' ? { ...x, valor: 0 } : x));
    expect(faltantesParaCerrar(orden({}), r, archivos, catalogo)).toContain(
      'Al menos una prueba debe resultar correcta',
    );
    expect(
      faltantesParaCerrar(orden({ tipoServicio: 'desinstalacion', estatusInstalacionBaja: 0 }), r, archivos, catalogo),
    ).toEqual([]);
  });

  it('datos del movimiento según el tipo', () => {
    expect(
      faltantesParaCerrar(orden({ tipoServicio: 'instalacion', idInstalacion: null, idProducto: null }), completas, archivos, catalogo),
    ).toEqual(['Falta el vehículo (idProducto)', 'Falta el equipo a instalar (idDispositivoNuevo)']);
    expect(faltantesParaCerrar(orden({ tipoServicio: 'c_sim', idSimNuevo: 3 }), completas, archivos, catalogo)).toEqual([
      'Falta el estatus de la SIM que sale (estatusSalienteAnterior)',
    ]);
    expect(
      faltantesParaCerrar(orden({ tipoServicio: 'desinstalacion', estatusInstalacionBaja: 3 }), completas, archivos, catalogo),
    ).toEqual(['Falta el estatus de la baja (estatusInstalacionBaja: 0 o 5)']);
    expect(faltantesParaCerrar(orden({ idInstalacion: null }), completas, archivos, catalogo)).toEqual([
      'Falta la instalación atendida (idInstalacion)',
    ]);
  });

  it('folio', () => {
    expect(folioDe(42)).toBe('OS-000042');
  });
});
