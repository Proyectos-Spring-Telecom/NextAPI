import { BadRequestException } from '@nestjs/common';
import {
  assertEstatusSalida,
  assertTransicionManual,
  estatusSalidaPorBaja,
} from './estatus-recurso';

const admin = { rol: 3 };
const sa = { rol: 1 };

describe('Estatus de recursos (motor-activos §1)', () => {
  it.each([
    [0, 1],
    [1, 0],
    [1, 3],
    [3, 1],
    [3, 4],
    [3, 5],
    [3, 0],
    [4, 1],
    [4, 5],
  ])('dispositivo %i → %i se permite a mano', (de, a) => {
    expect(() => assertTransicionManual('dispositivo', de, a, admin)).not.toThrow();
    expect(() => assertTransicionManual('sim', de, a, admin)).not.toThrow();
  });

  it.each([
    [1, 4],
    [1, 5],
    [0, 3],
    [4, 3],
    [4, 0],
  ])('dispositivo %i → %i no está en la tabla → 400 con los permitidos', (de, a) => {
    expect(() => assertTransicionManual('dispositivo', de, a, admin)).toThrow(/Permitidos/);
  });

  it('el 2 solo lo pone o lo quita una instalación', () => {
    expect(() => assertTransicionManual('dispositivo', 1, 2, admin)).toThrow(/solo lo pone una instalación/);
    expect(() => assertTransicionManual('sim', 2, 3, admin)).toThrow(/instalación activa/);
    expect(() => assertTransicionManual('producto', 2, 1, admin)).toThrow(/instalación activa/);
  });

  it('mismo estatus → 400', () => {
    expect(() => assertTransicionManual('sim', 1, 1, admin)).toThrow(/ya está/);
  });

  it('inservible es terminal: solo SA/Dev con motivo', () => {
    expect(() => assertTransicionManual('dispositivo', 5, 1, admin)).toThrow(/solo administración del sistema/);
    expect(() => assertTransicionManual('dispositivo', 5, 1, sa)).toThrow(/motivo/);
    expect(() => assertTransicionManual('dispositivo', 5, 1, { rol: 1, motivo: 'Capturado por error' })).not.toThrow();
  });

  it('producto conserva su escala hasta la fase C (todo menos el 2)', () => {
    expect(() => assertTransicionManual('producto', 1, 4, admin)).not.toThrow();
    expect(() => assertTransicionManual('producto', 5, 1, admin)).not.toThrow();
  });

  it('lo que sale de una instalación: dispositivo y SIM a 3/4/5; producto cualquiera menos 2', () => {
    expect(assertEstatusSalida('dispositivo', 4, 'x')).toBe(4);
    expect(() => assertEstatusSalida('dispositivo', 1, 'estatusDispositivoAnterior')).toThrow(BadRequestException);
    expect(() => assertEstatusSalida('sim', 0, 'x')).toThrow(/3 \(por revisar\)/);
    expect(() => assertEstatusSalida('sim', undefined, 'x')).toThrow(/obligatorio/);
    expect(assertEstatusSalida('producto', 1, 'x')).toBe(1);
    expect(() => assertEstatusSalida('producto', 2, 'x')).toThrow(BadRequestException);
  });

  it('baja: inservible (5) manda el dispositivo a 5; si no, a revisión; SIM a revisión; producto a 1', () => {
    expect(estatusSalidaPorBaja('dispositivo', 5)).toBe(5);
    expect(estatusSalidaPorBaja('dispositivo', 0)).toBe(3);
    expect(estatusSalidaPorBaja('sim', 5)).toBe(3);
    expect(estatusSalidaPorBaja('producto', 5)).toBe(1);
  });
});
