import { ForbiddenException, NotFoundException } from '@nestjs/common';

// S3Service importa uuid (ESM) y aquí no se usa.
jest.mock('src/s3/s3.service', () => ({ S3Service: class {} }));

import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';
import { ActivosService } from './activos/activos.service';
import { PersonasService } from './personas/personas.service';
import { ProductosService } from './productos.service';
import { VehiculosService } from './vehiculos/vehiculos.service';

// Jerarquía: el cliente 10 tiene un hijo (11); el 20 es ajeno.
const admin = { userId: 1, idCliente: 1, rol: 1 };
const padre = { userId: 2, idCliente: 10, rol: 6 };
const operador = { userId: 3, idCliente: 10, rol: 7 };

function tenant(): TenantFilterService {
  const clientes = {
    query: jest.fn(async (_sql: string, [id]: number[]) =>
      Number(id) === 10 ? [[{ Id: 10 }, { Id: 11 }]] : [[{ Id: id }]],
    ),
  };
  return new TenantFilterService(clientes as never);
}

const bitacora = { logToBitacora: jest.fn() };

function activos(registro: { idProducto: number; idCliente: number } | null) {
  const repository = {
    findOne: jest.fn(async () => (registro ? { ...registro, nombre: 'A' } : null)),
    save: jest.fn(async (e: unknown) => e),
  };
  const productosRepo = { update: jest.fn() };
  const manager = { findOne: jest.fn(), create: jest.fn(), save: jest.fn() };
  const qr = {
    manager,
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    isTransactionActive: true,
  };
  const service = new ActivosService(
    repository as never,
    productosRepo as never,
    { createQueryRunner: () => qr } as never,
    bitacora as never,
    tenant(),
  );
  return { service, repository, productosRepo, manager };
}

describe('Alcance de productos (detalle, edición y alta)', () => {
  it('detalle de un activo ajeno → 404; de uno propio o de un hijo → 200', async () => {
    await expect(activos({ idProducto: 5, idCliente: 20 }).service.findOne(5, operador)).rejects.toThrow(
      new NotFoundException('Activo no encontrado'),
    );
    await expect(activos({ idProducto: 5, idCliente: 11 }).service.findOne(5, padre)).resolves.toHaveProperty('data');
    await expect(activos({ idProducto: 5, idCliente: 20 }).service.findOne(5, admin)).resolves.toHaveProperty('data');
  });

  it('administración y padre editan el activo de un cliente hijo (se busca por id, no por el token)', async () => {
    for (const user of [admin, padre]) {
      const { service, repository, productosRepo } = activos({ idProducto: 5, idCliente: 11 });
      await service.update(5, { nombre: 'Nuevo' }, user, user.userId);
      expect(repository.findOne).toHaveBeenCalledWith({ where: { idProducto: 5 } });
      expect(productosRepo.update).toHaveBeenCalledWith({ id: 5, idCliente: 11 }, { nombre: 'Nuevo' });
    }
  });

  it('editar un activo fuera del alcance → 404 y no se guarda', async () => {
    const { service, repository } = activos({ idProducto: 5, idCliente: 20 });
    await expect(service.update(5, { nombre: 'X' }, padre, padre.userId)).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('alta en un cliente fuera del alcance → 403 antes de tocar la base', async () => {
    const { service, manager } = activos(null);
    await expect(
      service.create({ idCliente: 20, nombre: 'A' } as never, operador.userId, operador),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(manager.findOne).not.toHaveBeenCalled();
  });

  it('persona ajena → 404 con el mismo mensaje que si no existiera', async () => {
    const repository = { findOne: jest.fn(async () => ({ idProducto: 7, idCliente: 20 })) };
    const service = new PersonasService(repository as never, {} as never, {} as never, bitacora as never, tenant());
    await expect(service.findOne(7, operador)).rejects.toThrow(new NotFoundException('Persona no encontrada'));
  });

  it('producto ajeno → 404 en detalle y edición', async () => {
    const repository = { findOne: jest.fn(async () => ({ id: 3, idCliente: 20 })), save: jest.fn() };
    const service = new ProductosService(repository as never, bitacora as never, tenant());
    await expect(service.findOne(3, padre)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.update(3, { nombre: 'X' }, padre, padre.userId)).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('vehículo: la placa única se valida contra el cliente del vehículo, no el del token', async () => {
    const repository = {
      findOne: jest.fn(async (opts: { where: { placa?: string } }) =>
        opts.where.placa ? null : { idProducto: 9, idCliente: 11, placa: 'AAA' },
      ),
      update: jest.fn(),
    };
    const productosRepo = { update: jest.fn() };
    const webhook = { emit: jest.fn() };
    const service = new VehiculosService(
      repository as never,
      {} as never,
      {} as never,
      {} as never,
      productosRepo as never,
      {} as never,
      bitacora as never,
      tenant(),
      webhook as never,
      {} as never,
    );
    await service.update(9, { placa: 'BBB' }, admin, admin.userId);
    expect(repository.findOne).toHaveBeenCalledWith({ where: { placa: 'BBB', idCliente: 11 } });
    expect(productosRepo.update).toHaveBeenCalledWith({ id: 9, idCliente: 11 }, { nombre: 'BBB' });
    expect(webhook.emit).toHaveBeenCalledWith(expect.anything(), 11, 9, expect.anything());
  });
});
