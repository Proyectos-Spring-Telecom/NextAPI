import { DataSource, Repository } from 'typeorm';
import { TelemetryHuerfanos } from 'src/entities/TelemetryHuerfanos';
import { TelemetriaHuerfanosService } from './telemetria-huerfanos.service';

describe('TelemetriaHuerfanosService.registrar', () => {
  const crear = (query: jest.Mock) =>
    new TelemetriaHuerfanosService(
      { query } as unknown as DataSource,
      {} as Repository<TelemetryHuerfanos>,
    );

  it('fila nueva (affectedRows=1) → nuevo', async () => {
    const query = jest.fn().mockResolvedValue({ affectedRows: 1 });
    const r = await crear(query).registrar({
      protocol: 'jimi',
      deviceId: ' 2300007797 ',
      motivo: 'no_registrado',
      routingKey: 'jimi.position',
      lat: 19.4,
      lng: -99.1,
    });
    expect(r).toEqual({ nuevo: true });
    expect(query.mock.calls[0][1]).toEqual([
      'jimi',
      '2300007797',
      'no_registrado',
      'jimi.position',
      19.4,
      -99.1,
    ]);
  });

  it('repetido (affectedRows=2) → no nuevo; lat/lng inválidos → null', async () => {
    const query = jest.fn().mockResolvedValue({ affectedRows: 2 });
    const r = await crear(query).registrar({
      protocol: 'jt808',
      deviceId: 'AE123',
      motivo: 'sin_imei',
      lat: undefined,
      lng: Number.NaN,
    });
    expect(r).toEqual({ nuevo: false });
    expect(query.mock.calls[0][1].slice(3)).toEqual([null, null, null]);
  });

  it('un error de base no frena la cola', async () => {
    const query = jest.fn().mockRejectedValue(new Error('ER_NO_SUCH_TABLE'));
    await expect(
      crear(query).registrar({ protocol: 'axpro', deviceId: '1234', motivo: 'no_registrado' }),
    ).resolves.toEqual({ nuevo: false });
  });

  it('sin deviceId no escribe', async () => {
    const query = jest.fn();
    await crear(query).registrar({ protocol: 'axpro', deviceId: '  ', motivo: 'no_registrado' });
    expect(query).not.toHaveBeenCalled();
  });
});
