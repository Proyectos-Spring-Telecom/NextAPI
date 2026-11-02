import { BadRequestException, ConflictException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';

jest.mock('src/clientes/clientes.service', () => ({ ClientesService: class {} }));
jest.mock('src/instalaciones/instalaciones.service', () => ({ InstalacionesService: class {} }));

import { IntegracionCrmService } from './integracion-crm.service';

function build(filas: unknown[] = [], idUsuario?: string, inicio: { vigenteDesde: Date } | null = null) {
  const ds = { query: jest.fn(async () => filas), manager: { findOne: jest.fn(async () => filas[0] ?? null) } };
  const clientes = { createCliente: jest.fn(async () => ({ status: 'success', data: { id: 90 } })) };
  const config = { get: () => idUsuario };
  const instalaciones = {
    inicioMismoEquipo: jest.fn(async () => inicio),
    corregirInicioEquipo: jest.fn(async () => ({ status: 'success', message: 'ok', data: { id: 7, vigenteDesde: '2021-03-12 00:00:00' } })),
  };
  return {
    service: new IntegracionCrmService(ds as never, clientes as never, config as never, instalaciones as never),
    ds,
    clientes,
    instalaciones,
  };
}
const dto = { rfc: 'XAXX010101000', tipoPersona: 2, nombre: 'Transportes', numerosEmergencia: [{ telefono: '7771234567' }] };

describe('IntegracionCrmService', () => {
  it('da de alta el cliente con el usuario del CRM', async () => {
    const { service, clientes } = build([], '33');
    await service.crearCliente(dto as never);
    expect(clientes.createCliente).toHaveBeenCalledWith(dto, 33);
  });

  it('RFC repetido: 409 con el Id para ligarlo; sin CRM_ID_USUARIO: 503', async () => {
    const { service } = build([{ id: '12' }], '33');
    await expect(service.crearCliente(dto as never)).rejects.toBeInstanceOf(ConflictException);
    await expect(build([], undefined).service.crearCliente(dto as never)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('realizadas: pagables suma las no cumplidas cobrables y filtra por técnico', async () => {
    const { service, ds } = build([{ id: '5', idClienteNext: '1', idTecnico: '50' }]);
    const r = await service.realizadas({ idTecnicos: [50], pagables: true });
    const [sql, params] = ds.query.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain("o.Estatus = 'no_cumplida' AND o.Cobrable = 1");
    expect(params).toEqual([[50]]);
    expect(r).toEqual([expect.objectContaining({ id: 5, idTecnico: 50 })]);
    expect(await service.realizadas({ idTecnicos: [] })).toEqual([]);
  });

  describe('fecha de instalación desde el CRM', () => {
    const fecha = (f: string, idClienteNext = 4) => ({ idClienteNext, fecha: f, motivo: 'Fecha del contrato', usuario: 'Ana' });
    // Next guarda la hora de pared de México en los campos UTC del Date.
    const inst = [{ id: 7, idCliente: '4', estatus: 1, vigenteDesde: new Date('2024-05-10T15:00:00Z') }];

    it('hacia atrás: la corrige con las reglas de Next, a las 00:00, origen crm y quién en el motivo', async () => {
      const { service, instalaciones } = build(inst, '33');
      const r = await service.fechaInstalacion(7, fecha('2021-03-12'));
      expect(instalaciones.corregirInicioEquipo).toHaveBeenCalledWith(
        7,
        { vigenteDesde: '2021-03-12 00:00:00', motivo: 'CRM (Ana): Fecha del contrato' },
        33,
        'crm',
      );
      expect(r.data).toMatchObject({ sinCambio: false });
    });

    it('mismo día: sin cambio; hacia adelante: 400; de otro cliente o inactiva: no se toca', async () => {
      const { service, instalaciones } = build(inst, '33');
      expect((await service.fechaInstalacion(7, fecha('2024-05-10'))).data).toMatchObject({ sinCambio: true });
      await expect(service.fechaInstalacion(7, fecha('2024-06-01'))).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.fechaInstalacion(7, fecha('2021-03-12', 5))).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        build([{ ...inst[0], estatus: 0 }], '33').service.fechaInstalacion(7, fecha('2021-03-12')),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(build(inst).service.fechaInstalacion(7, fecha('2021-03-12'))).rejects.toBeInstanceOf(ServiceUnavailableException);
      // Tras un cambio de SIM, el día que cuenta es el del inicio del mismo equipo.
      const conSim = build(inst, '33', { vigenteDesde: new Date('2020-02-01T00:00:00Z') });
      expect((await conSim.service.fechaInstalacion(7, fecha('2020-02-01'))).data).toMatchObject({ sinCambio: true });
      await expect(conSim.service.fechaInstalacion(7, fecha('2021-03-12'))).rejects.toBeInstanceOf(BadRequestException);
      expect(instalaciones.corregirInicioEquipo).not.toHaveBeenCalled();
    });
  });

  it('resumen: cliente, vehículo y clase (sin clase = AVL)', async () => {
    const { service } = build([
      { idClienteNext: '4', idProducto: '10', clase: 'TRACKCAM' },
      { idClienteNext: '4', idProducto: '10', clase: null },
    ]);
    expect(await service.resumen()).toEqual([
      { idClienteNext: 4, idProducto: 10, clase: 'TRACKCAM' },
      { idClienteNext: 4, idProducto: 10, clase: 'AVL' },
    ]);
  });
});
