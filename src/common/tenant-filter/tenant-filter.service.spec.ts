import { In } from 'typeorm';
import { TenantFilterService } from './tenant-filter.service';

/** Árbol: 10 → 11 → 13, 10 → 12. spGetClientes regresa la raíz y sus descendientes. */
const ARBOL: Record<number, number[]> = { 10: [10, 11, 12, 13], 11: [11, 13], 12: [12], 13: [13] };

const crear = (arbol = ARBOL) =>
  new TenantFilterService({
    query: jest.fn(async (_sql: string, [id]: [number]) => [(arbol[id] ?? []).map((x) => ({ Id: x }))]),
  } as never);

describe('TenantFilterService: siempre los hijos del cliente que pide (spGetClientes)', () => {
  it.each([6, 7, 9, 10])('rol %i ve su cliente y sus hijos', async (rol) => {
    const t = crear();
    expect(await t.idsClientePermitidos(rol, 11)).toEqual([11, 13]);
    expect(await t.forTypeOrmIdCliente(rol, 10)).toEqual({ sinAcceso: false, idCliente: In([10, 11, 12, 13]) });
    expect((await t.build(rol, 11, 'x')).params).toEqual([11, 13]);
  });

  it('roles globales sin filtro', async () => {
    expect(await crear().idsClientePermitidos(1, 11)).toBe('all');
  });

  it('el propio cliente va aunque el SP no lo regrese', async () => {
    expect(await crear({ 11: [13] }).getClienteHijosIds(11)).toEqual([11, 13]);
  });

  it('?idCliente trae ese cliente y sus hijos, sin salir del alcance', async () => {
    const t = crear();
    expect(await t.clienteConHijosEnAlcance(1, 1, 10)).toEqual(In([10, 11, 12, 13]));
    expect(await t.clienteConHijosEnAlcance(6, 11, 11)).toEqual(In([11, 13]));
    expect(await t.clienteConHijosEnAlcance(6, 11, 13)).toBe(13);
    expect(await t.clienteConHijosEnAlcance(6, 11, 12)).toBeNull();
    const f = await t.aplicarFiltroListado(await t.idsClientePermitidos(6, 10), 11, 'e');
    expect(f).toMatchObject({ params: [11, 13], sinAcceso: false });
    expect(await t.aplicarFiltroListado([11, 13], 12, 'e')).toEqual({ forbidden: true });
  });
});
