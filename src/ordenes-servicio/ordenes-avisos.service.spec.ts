import { idsDeRespuesta, OrdenesAvisosService } from './ordenes-avisos.service';

const esperar = () => new Promise((r) => setImmediate(r));

describe('OrdenesAvisosService', () => {
  const orden = { id: 7, folio: 'OS-000007', estatus: 'borrador', tipoServicio: 'revision', idCliente: 13, idTecnico: 33, autorizacion: null };
  const armar = () => {
    const gateway = { emitPorRoles: jest.fn() };
    const repo = { find: jest.fn(async () => [orden]) };
    return { gateway, svc: new OrdenesAvisosService(repo as never, gateway as never) };
  };

  it('idsDeRespuesta: data.id, data[].id o nada', () => {
    expect(idsDeRespuesta({ data: { id: 5 } })).toEqual([5]);
    expect(idsDeRespuesta({ data: [{ id: 5 }, { id: 6 }] })).toEqual([5, 6]);
    expect(idsDeRespuesta({ data: { claveMotivo: 'x' } })).toEqual([]);
    expect(idsDeRespuesta(null)).toEqual([]);
  });

  it('ordenes:actualizacion a administración y monitoreo, y al técnico de la orden', async () => {
    const { gateway, svc } = armar();
    await svc.tras(Promise.resolve({ data: { id: 7 } }), (ids) => svc.orden(ids, 'cerrada'));
    await esperar();
    expect(gateway.emitPorRoles).toHaveBeenCalledWith(
      'ordenes:actualizacion',
      { idOrden: 7, folio: 'OS-000007', estatus: 'borrador', tipoServicio: 'revision', idCliente: 13, accion: 'cerrada' },
      [1, 2, 3, 4, 5],
      [33],
    );
  });

  it('validaciones:codigo a los roles en turno; la autorización a los que autorizan', async () => {
    const { gateway, svc } = armar();
    svc.codigo([7], 'visto');
    svc.autorizacion([7], 'pedida');
    await esperar();
    expect(gateway.emitPorRoles).toHaveBeenCalledWith('validaciones:codigo', { idOrden: 7, folio: 'OS-000007', accion: 'visto' }, [1, 2, 3, 4, 5]);
    expect(gateway.emitPorRoles).toHaveBeenCalledWith(
      'validaciones:autorizacion',
      { idOrden: 7, folio: 'OS-000007', accion: 'pedida', autorizacion: null },
      [1, 2, 3, 4],
    );
  });

  it('si la acción falla no avisa y el error sale igual', async () => {
    const { gateway, svc } = armar();
    await expect(svc.tras(Promise.reject(new Error('400')), (ids) => svc.orden(ids, 'cerrada'), 7)).rejects.toThrow('400');
    await esperar();
    expect(gateway.emitPorRoles).not.toHaveBeenCalled();
  });
});
