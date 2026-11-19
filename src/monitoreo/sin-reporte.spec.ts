import { decidir, encendida, UMBRALES_DEFECTO, umbralMinutos } from './sin-reporte.reglas';
import { motivoCierre, SinReporteScheduler } from './sin-reporte.scheduler';

const vehiculo = { idTipoProducto: 1, idTipoDispositivo: 5, ignicion: 1, estado: 1, velocidad: 40, intervaloRelojSeg: null };

describe('sin reporte: umbral por unidad', () => {
  it('vehículo encendido, en movimiento o en alerta: 11 min', () => {
    expect(umbralMinutos(vehiculo)).toBe(11);
    expect(umbralMinutos({ ...vehiculo, ignicion: null, estado: 2, velocidad: 0 })).toBe(11);
    expect(umbralMinutos({ ...vehiculo, ignicion: 0, estado: 0, velocidad: 12 })).toBe(11);
  });

  it('vehículo apagado y detenido: no aplica por omisión (reporta cada 2 h)', () => {
    const apagado = { ...vehiculo, ignicion: 0, estado: 4, velocidad: 0 };
    expect(encendida(apagado)).toBe(false);
    expect(umbralMinutos(apagado)).toBe(0);
    expect(umbralMinutos(apagado, { ...UMBRALES_DEFECTO, apagadoMin: 150 })).toBe(150);
  });

  it('reloj: el doble de su intervalo, mínimo 11; teléfono 30; panel e inmueble no', () => {
    const reloj = { idTipoProducto: 4, idTipoDispositivo: 7, ignicion: null, estado: 0, velocidad: 0, intervaloRelojSeg: 600 };
    expect(umbralMinutos(reloj)).toBe(20);
    expect(umbralMinutos({ ...reloj, intervaloRelojSeg: 60 })).toBe(11);
    expect(umbralMinutos({ ...reloj, intervaloRelojSeg: null })).toBe(11);
    expect(umbralMinutos({ ...reloj, idTipoDispositivo: 4 })).toBe(30);
    expect(umbralMinutos({ ...reloj, idTipoProducto: 3, idTipoDispositivo: 2 })).toBe(0);
  });

  it('el que acaba de cruzar se avisa; el que ya llevaba mucho solo se registra', () => {
    expect(decidir(11, 11, 30)).toBe('avisar');
    expect(decidir(41, 11, 30)).toBe('avisar');
    expect(decidir(42, 11, 30)).toBe('registrar');
  });
});

describe('sin reporte: cierre del episodio', () => {
  const base = { imei: '861', ultimoRegistro: '2026-11-18 12:01:00', estatusInst: 1, imeiActual: '861', registro: '2026-11-18 12:01:00' };
  it('sigue en falta mientras no llegue nada nuevo', () => expect(motivoCierre(base)).toBeNull());
  it('reportó, baja o cambio de equipo', () => {
    expect(motivoCierre({ ...base, registro: '2026-11-18 12:19:40' })).toBe('reporto');
    expect(motivoCierre({ ...base, estatusInst: 0 })).toBe('baja');
    expect(motivoCierre({ ...base, estatusInst: null })).toBe('baja');
    expect(motivoCierre({ ...base, imeiActual: '999' })).toBe('cambio');
  });
});

describe('SinReporteScheduler.abrirNuevos', () => {
  const fila = (id: number, minutos: number) => ({
    idInstalacion: id, idCliente: 13, idTipoProducto: 1, idTipoDispositivo: 5, imei: String(800 + id),
    fechaHora: '2026-11-18 12:01:09', registro: '2026-11-18 12:01:10', ignicion: 1, estado: 1, velocidad: 30,
    intervalo: null, minutos,
  });
  const armar = (filas: unknown[], segFrescura = 10, env: Record<string, string> = {}) => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('MAX(FHRegistro)')) return [{ seg: segFrescura }];
      if (sql.includes('FROM Instalaciones i')) return filas;
      if (sql.startsWith('INSERT IGNORE')) return { affectedRows: 1 };
      return [];
    });
    const gateway = { emitSinReporte: jest.fn(), emitSinReporteMasivo: jest.fn(), emitReporteRecuperado: jest.fn() };
    const monitoreo = { obtenerPorInstalacion: jest.fn(async () => ({ placa: 'RY73340', economico: 'NISSA HUAT', lat: 20.5, lng: -100.8, cliente: 'X' })) };
    const config = { get: (k: string) => env[k] };
    const s = new SinReporteScheduler({ query } as any, gateway as any, monitoreo as any, config as any);
    return { s, query, gateway };
  };

  it('avisa una vez con placa, económico y la última ubicación conocida', async () => {
    const { s, gateway, query } = armar([fila(1234, 11)]);
    expect(await s.abrirNuevos()).toEqual([1234]);
    expect(gateway.emitSinReporte).toHaveBeenCalledWith(1234, expect.objectContaining({
      idInstalacion: 1234, placa: 'RY73340', economico: 'NISSA HUAT', minutosSinReporte: 11, umbralMin: 11, lat: 20.5, lng: -100.8,
    }));
    const insert = query.mock.calls.find(([sql]) => String(sql).startsWith('INSERT IGNORE'));
    expect(insert?.[1]?.at(-1)).toBe(1);
  });

  it('sin posiciones en toda la flota (ingesta caída) no abre nada', async () => {
    const { s, gateway, query } = armar([fila(1, 15)], 900);
    expect(await s.abrirNuevos()).toEqual([]);
    expect(gateway.emitSinReporte).not.toHaveBeenCalled();
    expect(query.mock.calls.some(([sql]) => String(sql).includes('FROM Instalaciones i'))).toBe(false);
  });

  it('muchas a la vez: se registran sin alerta y va un solo aviso masivo', async () => {
    const filas = Array.from({ length: 4 }, (_, i) => fila(i + 1, 12));
    const { s, gateway } = armar(filas, 10, { SIN_REPORTE_MASIVO_MAX: '3' });
    expect(await s.abrirNuevos()).toEqual([]);
    expect(gateway.emitSinReporte).not.toHaveBeenCalled();
    expect(gateway.emitSinReporteMasivo).toHaveBeenCalledWith({ total: 4, porTipoDispositivo: [{ idTipoDispositivo: 5, total: 4 }] });
  });

  it('la que ya llevaba horas se registra sin alerta; la apagada no entra', async () => {
    const apagada = { ...fila(3, 60), ignicion: 0, estado: 4, velocidad: 0 };
    const { s, gateway, query } = armar([fila(2, 300), apagada]);
    expect(await s.abrirNuevos()).toEqual([]);
    expect(gateway.emitSinReporte).not.toHaveBeenCalled();
    const inserts = query.mock.calls.filter(([sql]) => String(sql).startsWith('INSERT IGNORE'));
    expect(inserts).toHaveLength(1);
    expect(inserts[0][1][0]).toBe(2);
    expect(inserts[0][1].at(-1)).toBe(0);
  });
});
