import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';
import {
  fragmentoPanelesAsignados,
  idsPanelesAsignados,
  panelVisiblePorAsignacion,
} from './alarmas-alcance.util';

function tenant(asignadas: 'all' | number[]): TenantFilterService {
  return {
    idsInstalacionAsignadas: jest.fn().mockResolvedValue(asignadas),
  } as unknown as TenantFilterService;
}

const USER = { userId: 4, idCliente: 2, rol: 7 };

describe('alarmas-alcance.util', () => {
  it('roles sin asignación no consultan ni filtran', async () => {
    const query = jest.fn();
    await expect(idsPanelesAsignados(tenant('all'), query, USER)).resolves.toBe('all');
    expect(query).not.toHaveBeenCalled();
    expect(fragmentoPanelesAsignados('all', 'p.IdDispositivo')).toEqual({ sql: '', params: [] });
    expect(panelVisiblePorAsignacion('all', 99)).toBe(true);
  });

  it('rol 7/9 sin instalaciones asignadas no ve paneles', async () => {
    const query = jest.fn();
    await expect(idsPanelesAsignados(tenant([]), query, USER)).resolves.toEqual([]);
    expect(query).not.toHaveBeenCalled();
    expect(fragmentoPanelesAsignados([], 'e.IdPanel').sql).toContain('1 = 0');
    expect(panelVisiblePorAsignacion([], 1)).toBe(false);
  });

  it('rol 7/9 resuelve los equipos de sus instalaciones vigentes', async () => {
    const query = jest.fn().mockResolvedValue([{ id: '10' }, { id: 20 }, { id: null }]);
    await expect(idsPanelesAsignados(tenant([1, 2]), query, USER)).resolves.toEqual([10, 20]);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('Estatus = 1');
    expect(params).toEqual([1, 2]);

    expect(fragmentoPanelesAsignados([10, 20], 'e.IdPanel')).toEqual({
      sql: ' AND e.IdPanel IN (?, ?) ',
      params: [10, 20],
    });
    expect(panelVisiblePorAsignacion([10, 20], 20)).toBe(true);
    expect(panelVisiblePorAsignacion([10, 20], 30)).toBe(false);
    expect(panelVisiblePorAsignacion([10, 20], null)).toBe(false);
  });
});
