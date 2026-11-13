import { OrdenesFlujoService } from './ordenes-flujo.service';

/** Autorización de desinstalar en un alta (13/11, OS-000014: GPS de otro proveedor daba 400). */
describe('OrdenesFlujoService.solicitarAutorizacion', () => {
  const user = { userId: 5, rol: 8, idCliente: 1 } as never;

  function armar(instalacionNext: object | null) {
    const svc = Object.create(OrdenesFlujoService.prototype) as OrdenesFlujoService & Record<string, unknown>;
    const orden = { id: 14, folio: 'OS-000014', estatus: 'borrador', tipoServicio: 'instalacion', idProducto: 77, idDispositivoNuevo: null, autorizacion: null, observaciones: null };
    const transicion = jest.fn().mockResolvedValue(undefined);
    Object.assign(svc, {
      ordenEditable: jest.fn().mockResolvedValue(orden),
      instalacionesRepo: { findOne: jest.fn().mockResolvedValue(instalacionNext) },
      transicion,
      bitacora: jest.fn().mockResolvedValue(undefined),
    });
    return { svc, transicion };
  }

  it('sin equipo de Next la pide igual, como equipo de otro proveedor', async () => {
    const { svc, transicion } = armar(null);
    const r = await svc.solicitarAutorizacion(14, { observaciones: 'Cuenta con equipo GPS instalado.', equipoTercero: true }, user);
    expect(r.message).toMatch(/otro proveedor/);
    const cambios = transicion.mock.calls[0][2];
    expect(cambios).toMatchObject({ autorizacion: 'pendiente', idProductoAutorizacion: 77, equipoTercero: 1 });
    expect(cambios.observaciones).toContain('Equipo de otro proveedor');
  });

  it('con equipo de Next sigue siendo la desinstalación de siempre', async () => {
    const { svc, transicion } = armar({ id: 9 });
    await svc.solicitarAutorizacion(14, { observaciones: 'GPS de Next' }, user);
    expect(transicion.mock.calls[0][2]).toMatchObject({ equipoTercero: 0 });
    expect(transicion.mock.calls[0][2].observaciones).toContain('Equipo existente');
  });
});
