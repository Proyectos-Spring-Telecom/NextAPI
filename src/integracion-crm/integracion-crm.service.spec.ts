import { ConflictException, ServiceUnavailableException } from '@nestjs/common';

jest.mock('src/clientes/clientes.service', () => ({ ClientesService: class {} }));

import { IntegracionCrmService } from './integracion-crm.service';

function build(filas: unknown[] = [], idUsuario?: string) {
  const ds = { query: jest.fn(async () => filas) };
  const clientes = { createCliente: jest.fn(async () => ({ status: 'success', data: { id: 90 } })) };
  const config = { get: () => idUsuario };
  return { service: new IntegracionCrmService(ds as never, clientes as never, config as never), ds, clientes };
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
});
