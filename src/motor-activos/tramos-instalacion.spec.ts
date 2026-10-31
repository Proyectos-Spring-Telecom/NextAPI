import {
  condicionTramosPosicional,
  fusionarTramos,
  instalacionPorTramos,
  posicionEnTramos,
  recortarTramos,
  type TramoEnPeriodo,
  type TramoInstalacion,
} from './tramos-instalacion';

function tramo(idInstalacion: number, imei: string, desde: string, hasta: string): TramoEnPeriodo {
  return {
    idInstalacion,
    idDispositivo: 1,
    idProducto: null,
    imei,
    desde,
    hasta,
    vigenteDesde: desde,
    vigenteHasta: hasta,
    hastaExclusivo: false,
  };
}

describe('tramos-instalacion (SQL crudo y CASE)', () => {
  // a termina por vigencia (12:00 excluido: es de b); b, por el fin del periodo (incluido).
  const a = { ...tramo(10, '861', '2026-10-01 00:00:00', '2026-10-05 12:00:00'), hastaExclusivo: true };
  const b = tramo(20, '861', '2026-10-05 12:00:00', '2026-10-30 23:59:59');

  it('condicionTramosPosicional: un paréntesis por tramo con imei, desde y hasta', () => {
    const { sql, params } = condicionTramosPosicional('p', [a, b]);
    expect(sql).toBe(
      '((p.Imei = ? AND p.FechaHora >= ? AND p.FechaHora < ?) OR (p.Imei = ? AND p.FechaHora >= ? AND p.FechaHora <= ?))',
    );
    expect(params).toEqual([
      '861', '2026-10-01 00:00:00', '2026-10-05 12:00:00',
      '861', '2026-10-05 12:00:00', '2026-10-30 23:59:59',
    ]);
  });

  it('condicionTramosPosicional sin tramos no devuelve filas', () => {
    expect(condicionTramosPosicional('p', [])).toEqual({ sql: '1 = 0', params: [] });
  });

  it('instalacionPorTramos: mismo IMEI en dos unidades se atribuye por fecha', () => {
    const { sql, params } = instalacionPorTramos('p', [a, b], 'g');
    expect(sql).toBe(
      '(CASE WHEN p.imei = :g0i AND p.fechaHora >= :g0d AND p.fechaHora < :g0h THEN 10 ' +
        'WHEN p.imei = :g1i AND p.fechaHora >= :g1d AND p.fechaHora <= :g1h THEN 20 END)',
    );
    expect(params).toEqual({
      g0i: '861', g0d: a.desde, g0h: a.hasta,
      g1i: '861', g1d: b.desde, g1h: b.hasta,
    });
  });

  it('instalacionPorTramos sin tramos es NULL', () => {
    expect(instalacionPorTramos('p', [])).toEqual({ sql: 'NULL', params: {} });
  });
});

describe('tramos-instalacion (fusión, recorte y pertenencia)', () => {
  const t = (imei: string, desde: string, hasta: string | null, idDispositivo = 1): TramoInstalacion => ({
    idInstalacion: 10,
    idDispositivo,
    idProducto: 5,
    imei,
    desde,
    hasta,
  });

  it('fusionarTramos une el mismo IMEI consecutivo (cambio de SIM) y respeta el abierto', () => {
    const r = fusionarTramos([
      t('A', '2026-10-02 00:00:00', null),
      t('A', '2026-10-01 00:00:00', '2026-10-02 00:00:00'),
    ]);
    expect(r).toEqual([t('A', '2026-10-01 00:00:00', null)]);
  });

  it('fusionarTramos no une equipos distintos ni huecos del mismo equipo', () => {
    const r = fusionarTramos([
      t('A', '2026-10-01 00:00:00', '2026-10-02 00:00:00'),
      t('B', '2026-10-02 00:00:00', '2026-10-03 00:00:00', 2),
      t('A', '2026-10-03 00:00:00', null),
    ]);
    expect(r.map((x) => `${x.imei}:${x.desde}`)).toEqual([
      'A:2026-10-01 00:00:00',
      'B:2026-10-02 00:00:00',
      'A:2026-10-03 00:00:00',
    ]);
  });

  it('recortarTramos interseca con el periodo, cierra el abierto y guarda la vigencia original', () => {
    const r = recortarTramos(
      [t('A', '2026-10-01 00:00:00', '2026-10-02 00:00:00'), t('B', '2026-10-02 00:00:00', null, 2)],
      '2026-10-01 12:00:00',
      '2026-10-05 00:00:00',
    );
    expect(r).toEqual([
      expect.objectContaining({ imei: 'A', desde: '2026-10-01 12:00:00', hasta: '2026-10-02 00:00:00', hastaExclusivo: true, vigenteDesde: '2026-10-01 00:00:00' }),
      expect.objectContaining({ imei: 'B', desde: '2026-10-02 00:00:00', hasta: '2026-10-05 00:00:00', hastaExclusivo: false, vigenteHasta: null }),
    ]);
    expect(recortarTramos([t('A', '2026-10-06 00:00:00', null)], '2026-10-01 00:00:00', '2026-10-05 00:00:00')).toEqual([]);
  });

  it('posicionEnTramos: antes de la instalación o con otro equipo no pertenece', () => {
    const tramos = [t('A', '2026-10-01 00:00:00', '2026-10-02 00:00:00')];
    expect(posicionEnTramos(tramos, 'A', '2026-10-01 08:00:00')).toBe(true);
    expect(posicionEnTramos(tramos, 'A', '2026-09-30 23:59:59')).toBe(false);
    expect(posicionEnTramos(tramos, 'A', '2026-10-02 00:00:00')).toBe(false); // el segundo del cambio es del siguiente
    expect(posicionEnTramos(tramos, 'A', '2026-10-01 23:59:59')).toBe(true);
    expect(posicionEnTramos(tramos, 'B', '2026-10-01 08:00:00')).toBe(false);
  });
});
