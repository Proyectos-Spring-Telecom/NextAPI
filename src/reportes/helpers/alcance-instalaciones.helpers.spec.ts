import { limitarIdsInstalacionPorAsignacion } from './alcance-instalaciones.helpers';

describe('limitarIdsInstalacionPorAsignacion', () => {
  it('roles sin asignación (all) dejan el filtro igual', () => {
    expect(limitarIdsInstalacionPorAsignacion('all', null)).toBeNull();
    expect(limitarIdsInstalacionPorAsignacion('all', [])).toEqual([]);
    expect(limitarIdsInstalacionPorAsignacion('all', [1, 2])).toEqual([1, 2]);
  });

  it('sin filtro, un rol 7/9 queda limitado a sus asignadas', () => {
    expect(limitarIdsInstalacionPorAsignacion([5, 7, 5], null)).toEqual([5, 7]);
  });

  it('sin asignadas no ve nada (lista vacía, nunca null)', () => {
    expect(limitarIdsInstalacionPorAsignacion([], null)).toEqual([]);
    expect(limitarIdsInstalacionPorAsignacion([], [1, 2])).toEqual([]);
  });

  it('con filtro, excluye las instalaciones no asignadas', () => {
    expect(limitarIdsInstalacionPorAsignacion([5, 7], [5, 6, 7, 8])).toEqual([
      5, 7,
    ]);
    expect(limitarIdsInstalacionPorAsignacion([5, 7], [6])).toEqual([]);
  });

  it('un filtro sin coincidencias sigue vacío', () => {
    expect(limitarIdsInstalacionPorAsignacion([5], [])).toEqual([]);
  });
});
