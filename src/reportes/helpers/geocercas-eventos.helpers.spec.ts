import { armarVisitas, type EventoGeocerca } from './geocercas-eventos.helpers';

let id = 1;
const e = (
  idGeocerca: number,
  tipo: 'entrada' | 'salida',
  fechaHora: string,
): EventoGeocerca => ({
  idGeocerca,
  nombreGeocerca: `G${idGeocerca}`,
  idPosicion: id++,
  tipo,
  fechaHora,
});

describe('armarVisitas', () => {
  it('empareja entrada y salida con el tiempo dentro y fuera', () => {
    const v = armarVisitas([
      e(1, 'entrada', '2026-11-12T08:00:00'),
      e(1, 'salida', '2026-11-12T08:30:00'),
      e(1, 'entrada', '2026-11-12T09:00:00'),
      e(1, 'salida', '2026-11-12T09:10:00'),
    ]);
    expect(v).toEqual([
      expect.objectContaining({
        entrada: '2026-11-12T08:00:00',
        salida: '2026-11-12T08:30:00',
        minDentro: 30,
        minFueraAntes: null,
      }),
      expect.objectContaining({
        entrada: '2026-11-12T09:00:00',
        salida: '2026-11-12T09:10:00',
        minDentro: 10,
        minFueraAntes: 30,
      }),
    ]);
  });

  it('salida sin entrada: ya estaba dentro al empezar el periodo', () => {
    expect(armarVisitas([e(2, 'salida', '2026-11-12T07:00:00')])).toEqual([
      expect.objectContaining({
        entrada: null,
        salida: '2026-11-12T07:00:00',
        minDentro: null,
      }),
    ]);
  });

  it('entrada sin salida: sigue dentro al terminar el periodo', () => {
    expect(armarVisitas([e(3, 'entrada', '2026-11-12T22:00:00')])).toEqual([
      expect.objectContaining({
        entrada: '2026-11-12T22:00:00',
        salida: null,
        minDentro: null,
      }),
    ]);
  });

  it('separa geocercas que se traslapan', () => {
    const v = armarVisitas([
      e(1, 'entrada', '2026-11-12T08:00:00'),
      e(2, 'entrada', '2026-11-12T08:05:00'),
      e(1, 'salida', '2026-11-12T08:20:00'),
      e(2, 'salida', '2026-11-12T08:25:00'),
    ]);
    expect(v.map((x) => [x.idGeocerca, x.minDentro])).toEqual([
      [1, 20],
      [2, 20],
    ]);
  });
});
