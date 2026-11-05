import { In } from 'typeorm';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';
import { GeocercasService } from './geocercas.service';

describe('GeocercasService.findAllList: cliente con hijos', () => {
  const crear = (hijos: Record<number, number[]>) => {
    const repo = { find: jest.fn(async () => []) };
    const tenant = new TenantFilterService({} as never);
    jest.spyOn(tenant, 'getClienteHijosIds').mockImplementation(async (id: number) => hijos[id] ?? [id]);
    const service = new GeocercasService(repo as never, {} as never, {} as never, {} as never, {} as never, {} as never, tenant);
    return { service, repo };
  };
  const donde = (repo: { find: jest.Mock }) => (repo.find.mock.calls[0] as unknown as [{ where: { idCliente: unknown } }])[0].where.idCliente;

  it('admin (1) que filtra por un cliente ve también las de sus hijos', async () => {
    const { service, repo } = crear({ 10: [10, 11, 12] });
    await service.findAllList(1, 1, 10);
    expect(donde(repo)).toEqual(In([10, 11, 12]));
  });

  it('cliente sin hijos: solo el suyo', async () => {
    const { service, repo } = crear({});
    await service.findAllList(1, 1, 20);
    expect(donde(repo)).toBe(20);
  });

  it('cliente 6 que filtra por un hijo no sale de su alcance', async () => {
    // El 6 del cliente 10 ve 10, 11 y 12; el hijo 11 tiene al 13, que no es de él.
    const { service, repo } = crear({ 10: [10, 11, 12], 11: [11, 13] });
    await service.findAllList(10, 6, 11);
    expect(donde(repo)).toBe(11);
  });
});
