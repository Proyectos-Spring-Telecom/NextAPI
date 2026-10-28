import { QueryFailedError } from 'typeorm';
import { Posiciones } from 'src/entities/Posiciones';
import { TelemetryIngestLog } from 'src/entities/TelemetryIngestLog';
import { UltimaPosicion } from 'src/entities/UltimaPosicion';
import { PosicionIngestService } from './posicion-ingest.service';

jest.mock('src/monitoreo/monitoreo.gateway', () => ({ MonitoreoGateway: class {} }));
jest.mock('src/incidentes/auto/incidentes-auto.service', () => ({
  IncidentesAutoService: class {},
}));

describe('PosicionIngestService.ingestAlarmLocation', () => {
  const fechaHora = new Date('2026-10-28T13:31:50.000Z');
  const req = {
    eventId: 'b'.repeat(64),
    protocol: 'fa100s',
    kind: 'alarm_location',
    deviceId: '863269078504617',
    routingKey: 'fa100s.alarm.caida',
    imei: '863269078504617',
    posicion: { imei: '863269078504617', fechaHora, idEvento: 35, lat: 18.953224, lng: -99.235805, estado: 2 },
  };
  const manager = { insert: jest.fn(), update: jest.fn() };
  const repo = { findOne: jest.fn() };
  const dataSource = {
    getRepository: jest.fn(() => repo),
    transaction: jest.fn((cb: (m: typeof manager) => unknown) => cb(manager)),
  };
  const gateway = { notificarImei: jest.fn() };
  let service: PosicionIngestService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PosicionIngestService(dataSource as never, gateway as never, {} as never);
  });

  it('corrige Lat/Lng de la posición de la alarma, sin insertar otra', async () => {
    repo.findOne.mockResolvedValue({ id: 777 });
    const ingestPosition = jest.spyOn(service, 'ingestPosition');

    await expect(service.ingestAlarmLocation(req as never)).resolves.toEqual({ posicionId: 777 });

    expect(repo.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { imei: req.imei, fechaHora, idEvento: 35 } }),
    );
    expect(manager.insert).toHaveBeenCalledWith(TelemetryIngestLog, expect.anything());
    expect(manager.insert).not.toHaveBeenCalledWith(Posiciones, expect.anything());
    expect(manager.update).toHaveBeenCalledWith(Posiciones, { id: 777 }, { lat: 18.953224, lng: -99.235805 });
    expect(manager.update).toHaveBeenCalledWith(
      UltimaPosicion,
      { imei: req.imei, fechaHora },
      { lat: 18.953224, lng: -99.235805 },
    );
    expect(ingestPosition).not.toHaveBeenCalled();
    expect(gateway.notificarImei).toHaveBeenCalledWith(req.imei);
  });

  it('repetido → duplicado, sin tocar Posiciones', async () => {
    repo.findOne.mockResolvedValue({ id: 777 });
    manager.insert.mockRejectedValueOnce(
      new QueryFailedError('INSERT', [], Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY', errno: 1062 })),
    );

    await expect(service.ingestAlarmLocation(req as never)).resolves.toEqual({ duplicate: true });
    expect(manager.update).not.toHaveBeenCalled();
  });

  it('si la alarma no llegó a Posiciones, se inserta como posición', async () => {
    repo.findOne.mockResolvedValue(null);
    const ingestPosition = jest
      .spyOn(service, 'ingestPosition')
      .mockResolvedValue({ posicionId: 5 });

    await expect(service.ingestAlarmLocation(req as never)).resolves.toEqual({ posicionId: 5 });
    expect(ingestPosition).toHaveBeenCalledWith(req);
  });
});
