import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RelojConfig } from 'src/entities/RelojConfig';
import { mapRelojPlano, pickRelojConfig } from '../map-relaciones.util';
import { CreateRelojDto } from './dto/create-reloj.dto';
import { UpdateRelojDto } from './dto/update-reloj.dto';
import { RelojesService } from './relojes.service';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';

const valido = {
  idCliente: 1,
  numeroSerie: '6907850461',
  imei: '863269078504617',
  intervaloGpsSegundos: 600,
  sensibilidadCaida: 5,
};

const errores = (cls: new () => object, body: object) =>
  validateSync(plainToInstance(cls, body)).map((e) => e.property);

describe('Relojes', () => {
  it('acepta el reloj real: ID de 10 dígitos e IMEI de 15', () => {
    expect(errores(CreateRelojDto, valido)).toEqual([]);
  });

  it('rechaza ID e IMEI con otro formato y la sensibilidad fuera de 1–6', () => {
    expect(
      errores(CreateRelojDto, {
        ...valido,
        numeroSerie: '86326907850461',
        imei: '6907850461',
        sensibilidadCaida: 7,
      }).sort(),
    ).toEqual(['imei', 'numeroSerie', 'sensibilidadCaida']);
  });

  it('acepta el IMEI como número de serie (así se dio de alta el primero)', () => {
    expect(errores(UpdateRelojDto, { numeroSerie: '863269078504617' })).toEqual([]);
  });

  it('el IMEI es obligatorio al crear (la telemetría se busca por IMEI)', () => {
    const { imei: _omit, ...sinImei } = valido;
    expect(errores(CreateRelojDto, sinImei)).toEqual(['imei']);
  });

  it('el reporte no baja de 60 s; el GPS acepta 0 (solo en alarmas)', () => {
    expect(errores(UpdateRelojDto, { intervaloReporteSegundos: 30 })).toEqual([
      'intervaloReporteSegundos',
    ]);
    expect(errores(UpdateRelojDto, { intervaloGpsSegundos: 0 })).toEqual([]);
  });

  it('pickRelojConfig solo toma los campos de configuración que llegaron', () => {
    expect(pickRelojConfig({ ...valido, deteccionCaida: 0 } as never)).toEqual({
      intervaloGpsSegundos: 600,
      sensibilidadCaida: 5,
      deteccionCaida: 0,
    });
  });

  it('mapRelojPlano junta dispositivo y configuración', () => {
    const plano = mapRelojPlano({
      idDispositivo: 42,
      idCliente: 1,
      intervaloReporteSegundos: 300,
      intervaloGpsSegundos: 600,
      deteccionCaida: 1,
      llamadaPorCaida: 0,
      sensibilidadCaida: 5,
    } as RelojConfig);
    expect(plano).toMatchObject({
      id: 42,
      idCliente: 1,
      intervaloGpsSegundos: 600,
      llamadaPorCaida: 0,
      sensibilidadCaida: 5,
    });
  });
});

describe('RelojesService: alcance por cliente', () => {
  // Rol 6 del cliente 10 ve 10 y su hijo 11; el reloj del cliente 99 es ajeno.
  const clienteRepo = { query: jest.fn().mockResolvedValue([[{ Id: 10 }, { Id: 11 }]]) };
  const tenant = new TenantFilterService(clienteRepo as never);
  const padre = { userId: 1, idCliente: 10, rol: 6 };
  const bitacora = { logToBitacora: jest.fn() };

  const servicio = (reloj: Partial<RelojConfig> | null) => {
    const repository = {
      findOne: jest.fn().mockResolvedValue(reloj),
      save: jest.fn(async (e: unknown) => e),
    };
    const dataSource = { createQueryRunner: jest.fn() };
    const svc = new RelojesService(
      repository as never,
      { findOne: jest.fn() } as never,
      dataSource as never,
      bitacora as never,
      tenant, {} as never,
    );
    return { svc, repository, dataSource };
  };

  it('detalle de un cliente hijo: lo ve; de un cliente ajeno: 404', async () => {
    const { svc } = servicio({ idDispositivo: 5, idCliente: 11 });
    await expect(svc.findOne(5, padre)).resolves.toMatchObject({ data: { id: 5 } });
    const ajeno = servicio({ idDispositivo: 6, idCliente: 99 });
    await expect(ajeno.svc.findOne(6, padre)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('editar busca por id (no por el cliente del token) y valida el cliente del reloj', async () => {
    const { svc, repository } = servicio({ idDispositivo: 5, idCliente: 11 });
    await expect(svc.update(5, { intervaloGpsSegundos: 600 }, 10, 1, padre)).resolves.toMatchObject({
      status: 'success',
    });
    expect(repository.findOne).toHaveBeenCalledWith({ where: { idDispositivo: 5 } });

    const ajeno = servicio({ idDispositivo: 6, idCliente: 99 });
    await expect(ajeno.svc.update(6, { intervaloGpsSegundos: 600 }, 10, 1, padre)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(ajeno.repository.save).not.toHaveBeenCalled();
  });

  it('alta en un cliente fuera del alcance: 403 sin escribir', async () => {
    const qr = {
      connect: jest.fn(),
      startTransaction: jest.fn(),
      rollbackTransaction: jest.fn(),
      release: jest.fn(),
      isTransactionActive: true,
      manager: { save: jest.fn(), create: jest.fn(), findOne: jest.fn() },
    };
    const { svc, dataSource } = servicio(null);
    dataSource.createQueryRunner.mockReturnValue(qr);
    await expect(svc.create({ ...valido, idCliente: 99 } as CreateRelojDto, 1, padre)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(qr.manager.save).not.toHaveBeenCalled();
    expect(qr.rollbackTransaction).toHaveBeenCalled();
  });
});
