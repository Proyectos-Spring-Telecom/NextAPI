import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Sims } from 'src/entities/Sims';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';
import { SimsService } from './sims.service';

describe('SimsService: detalle y alta con alcance', () => {
  // Rol 7 del cliente 10: solo su cliente.
  const tenant = new TenantFilterService({ query: jest.fn() } as never);
  const operador = { userId: 3, idCliente: 10, rol: 7 };
  const bitacora = { logToBitacora: jest.fn() };

  const sim = (idCliente: number) =>
    ({
      id: '5',
      imei: '356938035643809',
      numeroTelefono: '5512345678',
      idTelefonia: 1,
      idPlanTelefonia: 3,
      idCliente,
      notas: null,
      estatus: 1,
      idCliente2: { nombre: 'Cliente Diez' },
      idTelefonia2: { nombreTelefonia: 'Telcel' },
      idPlanTelefonia2: { descripcion: 'Plan 10 GB', datos: '10240', costoMensual: '499.90' },
    }) as unknown as Sims;

  const servicio = (encontrado: Sims | null) => {
    const repository = {
      findOne: jest.fn().mockResolvedValue(encontrado),
      create: jest.fn(),
      save: jest.fn(),
    };
    const vacio = {} as never;
    const svc = new SimsService(
      repository as never,
      vacio,
      vacio,
      vacio,
      bitacora as never,
      tenant, {} as never,
    );
    return { svc, repository };
  };

  it('GET /sims/:id trae cliente, telefonía, plan y costo (como el paginado)', async () => {
    const { svc, repository } = servicio(sim(10));
    const { data } = await svc.findOne(5, operador);
    expect(repository.findOne).toHaveBeenCalledWith({
      where: { id: 5 },
      relations: ['idCliente2', 'idTelefonia2', 'idPlanTelefonia2'],
    });
    expect(data).toMatchObject({
      id: 5,
      nombreTelefonia: 'Telcel',
      descripcionPlanTelefonia: 'Plan 10 GB',
      datosPlanTelefonia: '10240',
      costoMensualPlanTelefonia: '499.90',
    });
    expect(data).toHaveProperty('nombreCliente');
  });

  it('el SIM de otro cliente responde 404', async () => {
    const { svc } = servicio(sim(99));
    await expect(svc.findOne(5, operador)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('alta en un cliente fuera del alcance: 403 sin escribir', async () => {
    const { svc, repository } = servicio(null);
    await expect(
      svc.create({ idCliente: 99, idTelefonia: 1, idPlanTelefonia: 3 } as never, 3, operador),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(repository.save).not.toHaveBeenCalled();
  });
});
