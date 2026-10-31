import {
  agruparPorProveedor,
  dentroDeVentana,
  diaDe,
  horasSinTransmitir,
  HORAS_SIN_TRANSMITIR_DEFECTO,
  umbralHoras,
} from './vigilancia-transmision.reglas';

const pared = (t: string) => new Date(`${t}Z`);

describe('vigilancia de transmisión (reglas)', () => {
  it('umbral: relojes por su fila, los demás 12 h', () => {
    const porTipo = new Map([[7, 24]]);
    expect(umbralHoras(7, porTipo)).toBe(24);
    expect(umbralHoras(1, porTipo)).toBe(HORAS_SIN_TRANSMITIR_DEFECTO);
  });

  it('horas completas sin transmitir, nunca negativas', () => {
    expect(horasSinTransmitir(pared('2026-10-30T20:00:00'), pared('2026-10-31T08:59:59'))).toBe(12);
    expect(horasSinTransmitir(pared('2026-10-31T10:00:00'), pared('2026-10-31T09:00:00'))).toBe(0);
  });

  it('ventana de 9:00 a 11:00 (hora de México)', () => {
    expect(dentroDeVentana(pared('2026-10-31T08:59:59'))).toBe(false);
    expect(dentroDeVentana(pared('2026-10-31T09:00:00'))).toBe(true);
    expect(dentroDeVentana(pared('2026-10-31T10:59:59'))).toBe(true);
    expect(dentroDeVentana(pared('2026-10-31T11:00:00'))).toBe(false);
    expect(diaDe(pared('2026-10-31T10:00:00'))).toBe('2026-10-31');
  });

  it('agrupa por evaluación y compañía; marca posible falla desde el mínimo', () => {
    const a = (fechaEvaluacion: string, idTelefonia: number | null) => ({ fechaEvaluacion, idTelefonia, telefonia: idTelefonia ? `T${idTelefonia}` : null });
    const r = agruparPorProveedor([a('2026-10-31', 1), a('2026-10-31', 1), a('2026-10-31', 1), a('2026-10-31', 2), a('2026-10-30', 1), a('2026-10-31', null), a('2026-10-31', null), a('2026-10-31', null)], 3);
    expect(r.find((g) => g.fechaEvaluacion === '2026-10-31' && g.idTelefonia === 1)).toMatchObject({ avisos: 3, posibleFallaProveedor: true });
    expect(r.find((g) => g.idTelefonia === 2)?.posibleFallaProveedor).toBe(false);
    expect(r.find((g) => g.fechaEvaluacion === '2026-10-30')?.posibleFallaProveedor).toBe(false);
    expect(r.find((g) => g.idTelefonia === null)).toMatchObject({ avisos: 3, posibleFallaProveedor: false });
  });
});
