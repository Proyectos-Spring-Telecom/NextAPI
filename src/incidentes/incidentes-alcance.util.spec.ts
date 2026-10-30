import { FindOperator } from 'typeorm';
import { TipoOrigenIncidente } from 'src/common/estatus.enum';
import {
  origenVisiblePorAsignacion,
  whereIncidentesAsignados,
} from './incidentes-alcance.util';

const ALCANCE = { imeis: ['860000000000001'], idsDispositivo: [10, 20] };

function sql(op: unknown): string {
  return (op as FindOperator<unknown>).getSql!('col');
}

describe('incidentes-alcance.util', () => {
  it('sin tipoOrigen arma una rama por posición y otra por evento', () => {
    const ramas = whereIncidentesAsignados({ idCliente: 3 }, ALCANCE);
    expect(ramas).toHaveLength(2);

    const [pos, evt] = ramas as Record<string, unknown>[];
    expect(pos.idCliente).toBe(3);
    expect(pos.tipoOrigen).toBe(TipoOrigenIncidente.POSICION);
    expect(sql(pos.datosOrigen)).toContain("JSON_EXTRACT(col, '$.imei')");
    expect((pos.datosOrigen as FindOperator<unknown>).objectLiteralParameters)
      .toEqual({ imeisAsignados: ALCANCE.imeis });

    expect(evt.idCliente).toBe(3);
    expect(evt.tipoOrigen).toBe(TipoOrigenIncidente.EVENTO_ALARMA);
    expect(sql(evt.idEventoAlarmaOrigen)).toContain('ea.IdPanel IN');
    expect(
      (evt.idEventoAlarmaOrigen as FindOperator<unknown>).objectLiteralParameters,
    ).toEqual({ panelesAsignados: [10, 20] });
  });

  it('respeta el tipoOrigen pedido', () => {
    const soloPos = whereIncidentesAsignados(
      { tipoOrigen: TipoOrigenIncidente.POSICION },
      ALCANCE,
    );
    expect(soloPos).toHaveLength(1);
    expect(soloPos[0].tipoOrigen).toBe(TipoOrigenIncidente.POSICION);

    const soloEvt = whereIncidentesAsignados(
      { tipoOrigen: TipoOrigenIncidente.EVENTO_ALARMA },
      ALCANCE,
    );
    expect(soloEvt).toHaveLength(1);
    expect(soloEvt[0].tipoOrigen).toBe(TipoOrigenIncidente.EVENTO_ALARMA);
  });

  it('sin unidades asignadas no hay ramas (no ve nada)', () => {
    expect(
      whereIncidentesAsignados({ id: 1 }, { imeis: [], idsDispositivo: [] }),
    ).toEqual([]);
  });

  it('valida el origen al crear', () => {
    expect(
      origenVisiblePorAsignacion(
        TipoOrigenIncidente.POSICION,
        { imei: '860000000000001' },
        ALCANCE,
      ),
    ).toBe(true);
    expect(
      origenVisiblePorAsignacion(
        TipoOrigenIncidente.POSICION,
        { imei: '860000000000999' },
        ALCANCE,
      ),
    ).toBe(false);
    expect(
      origenVisiblePorAsignacion(
        TipoOrigenIncidente.EVENTO_ALARMA,
        { idPanel: 20 },
        ALCANCE,
      ),
    ).toBe(true);
    expect(
      origenVisiblePorAsignacion(
        TipoOrigenIncidente.EVENTO_ALARMA,
        { idPanel: null },
        ALCANCE,
      ),
    ).toBe(false);
  });
});
