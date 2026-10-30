import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { OrdenesFlujoService } from './ordenes-flujo.service';

/**
 * Repositorio en memoria: suficiente para probar las transiciones del flujo
 * (programar, iniciar, código, autorización, no cumplida, cancelar).
 */
type Fila = Record<string, unknown> & { id: number };

function fakeRepo(filas: Fila[]) {
  const coincide = (f: Fila, where: Record<string, unknown> = {}) =>
    Object.entries(where).every(([k, v]) => {
      if (v && typeof v === 'object' && '_type' in (v as object)) return true; // operadores de TypeORM
      return f[k] === v || Number(f[k]) === v;
    });
  let seq = filas.reduce((m, f) => Math.max(m, f.id), 0);
  return {
    filas,
    findOne: jest.fn(async (opts: { where: Record<string, unknown> }) => filas.find((f) => coincide(f, opts.where)) ?? null),
    find: jest.fn(async (opts: { where?: Record<string, unknown> } = {}) => filas.filter((f) => coincide(f, opts.where))),
    update: jest.fn(async (where: Record<string, unknown>, cambios: Record<string, unknown>) => {
      filas.filter((f) => coincide(f, where)).forEach((f) => Object.assign(f, cambios));
    }),
    create: (data: Record<string, unknown>) => ({ ...data }),
    save: jest.fn(async (data: Record<string, unknown>) => {
      const fila = { ...data, id: ++seq } as Fila;
      filas.push(fila);
      return fila;
    }),
  };
}

const motivos = [
  { clave: 'cliente_ausente', resultado: 'no_cumplida', quien: 'tecnico,operacion', cobrable: 1, requiereObservaciones: 0, estatus: 1 },
  { clave: 'falta_material', resultado: 'no_cumplida', quien: 'tecnico,operacion', cobrable: 0, requiereObservaciones: 1, estatus: 1 },
  { clave: 'sin_autorizacion_desinstalacion', resultado: 'no_cumplida', quien: 'tecnico,operacion,crm', cobrable: 1, requiereObservaciones: 0, estatus: 1 },
  { clave: 'cancelada_por_cliente', resultado: 'cancelada', quien: 'operacion,crm', cobrable: 0, requiereObservaciones: 0, estatus: 1 },
];
const tecnico = { userId: 50, idCliente: 1, rol: 8 };
const admin = { userId: 2, idCliente: 1, rol: 3 };
const crm = { tipo: 'crm' as const, nombre: 'Ana' };

function build(ordenes: Fila[] = []) {
  const ordenesRepo = fakeRepo(ordenes);
  const motivosRepo = fakeRepo(motivos.map((m, i) => ({ ...m, id: i + 1 })));
  const clientes = fakeRepo([{ id: 1, estatus: 1, nombre: 'Cliente Uno' }]);
  const instalaciones = fakeRepo([{ id: 10, idCliente: 1, idProducto: 5, estatus: 1 }, { id: 11, idCliente: 1, idProducto: 6, estatus: 1 }]);
  const productos = fakeRepo([{ id: 5, idCliente: 1 }]);
  const usuarios = fakeRepo([{ id: 50, idRol: 8, estatus: 1, nombre: 'Téc' }, { id: 2, idRol: 3, estatus: 1, nombre: 'Admin' }]);
  const vehiculos = fakeRepo([{ id: 1, idProducto: 5, placa: 'ABC123', numeroEconomico: 'E1' }]);
  const ds = { transaction: async (cb: (m: unknown) => Promise<void>) => cb({
    findOne: (_e: unknown, o: { where: Record<string, unknown> }) => ordenesRepo.findOne(o),
    create: (_e: unknown, d: Record<string, unknown>) => d,
    save: (d: Record<string, unknown>) => ordenesRepo.save(d),
    update: (_e: unknown, w: Record<string, unknown>, c: Record<string, unknown>) => ordenesRepo.update(w, c),
  }) };
  const bitacora = { logToBitacora: jest.fn() };
  const config = { get: () => undefined };
  const service = new OrdenesFlujoService(
    ordenesRepo as never, motivosRepo as never, clientes as never, instalaciones as never, productos as never,
    usuarios as never, vehiculos as never, ds as never, bitacora as never, config as never,
  );
  return { service, ordenes: ordenesRepo.filas };
}

const programadaCrm = (extra: Record<string, unknown> = {}): Fila => ({
  id: 1, folio: 'OS-000001', estatus: 'programada', origen: 'crm', tipoServicio: 'revision', tipoProgramado: 'revision',
  idCliente: 1, idInstalacion: 10, idInstalacionProgramada: 10, idProducto: 5, idTecnico: 50, claveApp: null,
  codigo: null, codigoExpira: null, codigoIntentos: 0, fechaCodigoValidado: null, autorizacion: null, observaciones: null,
  ...extra,
});

describe('OrdenesFlujoService', () => {
  describe('programar', () => {
    it('un alta de 3 unidades crea 3 órdenes independientes, idempotente por referenciaCrm', async () => {
      const { service, ordenes } = build();
      const dto = { tipo: 'instalacion' as const, idCliente: 1, unidades: 3, cita: '2026-10-30T10:00:00-06:00', idTecnico: 50, referenciaCrm: 'OI-7' };
      const r1 = await service.programar(dto, crm);
      expect(ordenes).toHaveLength(3);
      expect(ordenes.map((o) => [o.estatus, o.origen, o.unidad, o.unidadesTotal])).toEqual([
        ['programada', 'crm', 1, 3], ['programada', 'crm', 2, 3], ['programada', 'crm', 3, 3],
      ]);
      expect(ordenes[0].cita).toEqual(new Date('2026-10-30T10:00:00Z'));
      expect(ordenes[0].nombreProgramo).toBe('CRM: Ana');
      const r2 = await service.programar(dto, crm);
      expect(ordenes).toHaveLength(3);
      expect(r2.data.map((d) => d.id)).toEqual(r1.data.map((d) => d.id));
      expect(r2.message).toBe('Las órdenes ya estaban programadas');
    });

    it('un mantenimiento lleva el vehículo y es de una sola unidad', async () => {
      const { service, ordenes } = build();
      await service.programar({ tipo: 'c_sim', idCliente: 1, idInstalacion: 10, cita: '2026-10-30T10:00:00-06:00', idTecnico: 50 }, { tipo: 'usuario', user: admin });
      expect(ordenes[0]).toMatchObject({ origen: 'next', idInstalacionProgramada: 10, idProducto: 5, referenciaCrm: null });
      await expect(
        service.programar({ tipo: 'revision', idCliente: 1, cita: '2026-10-30T10:00:00-06:00', idTecnico: 50, referenciaCrm: 'MT-1' }, crm),
      ).rejects.toThrow('idInstalacion');
      await expect(
        service.programar({ tipo: 'revision', idCliente: 1, idInstalacion: 10, unidades: 2, cita: '2026-10-30T10:00:00-06:00', idTecnico: 50, referenciaCrm: 'MT-2' }, crm),
      ).rejects.toThrow('un solo vehículo');
    });

    it('rechaza un técnico que no tiene rol 8', async () => {
      const { service } = build();
      await expect(
        service.programar({ tipo: 'instalacion', idCliente: 1, cita: '2026-10-30T10:00:00-06:00', idTecnico: 2 }, { tipo: 'usuario', user: admin }),
      ).rejects.toThrow('rol 8');
    });
  });

  describe('iniciar', () => {
    it('confirma o corrige entre mantenimientos y guarda lo programado', async () => {
      const { service, ordenes } = build([programadaCrm()]);
      await service.iniciar(1, { claveApp: '3f2b8c1e-6a4d-4f7e-9b21-0c5d8e7a1f90', tipoServicio: 'c_equipo', idInstalacion: 11 }, tecnico);
      expect(ordenes[0]).toMatchObject({ estatus: 'borrador', tipoServicio: 'c_equipo', tipoProgramado: 'revision', idInstalacion: 11, idProducto: 6, idInstalacionProgramada: 10 });
      const r = await service.iniciar(1, { claveApp: '3f2b8c1e-6a4d-4f7e-9b21-0c5d8e7a1f90' }, tecnico);
      expect(r.message).toBe('La orden ya estaba iniciada');
    });

    it('no cruza de mantenimiento a alta, y otro técnico no la ve', async () => {
      const { service } = build([programadaCrm()]);
      await expect(service.iniciar(1, { claveApp: '3f2b8c1e-6a4d-4f7e-9b21-0c5d8e7a1f90', tipoServicio: 'instalacion' }, tecnico))
        .rejects.toThrow('operación debe programar otra orden');
      await expect(service.iniciar(1, { claveApp: '3f2b8c1e-6a4d-4f7e-9b21-0c5d8e7a1f90' }, { ...tecnico, userId: 51 }))
        .rejects.toThrow('no encontrada');
    });
  });

  describe('código de verificación', () => {
    it('pedir, ver (registra quién) y validar', async () => {
      const { service, ordenes } = build([programadaCrm({ estatus: 'borrador' })]);
      await service.solicitarCodigo(1, tecnico);
      const codigo = ordenes[0].codigo as string;
      expect(codigo).toMatch(/^\d{6}$/);
      const visto = await service.verCodigo(1, { userId: 15, idCliente: 1, rol: 5 });
      expect(visto.data[0]).toMatchObject({ codigo, placa: 'ABC123', cliente: 'Cliente Uno' });
      expect(ordenes[0].idUsuarioCodigo).toBe(15);
      const malo = codigo === '000000' ? '000001' : '000000';
      await expect(service.validarCodigo(1, { codigo: malo }, tecnico)).rejects.toThrow('quedan 4 intentos');
      await service.validarCodigo(1, { codigo }, tecnico);
      expect(ordenes[0].fechaCodigoValidado).toBeInstanceOf(Date);
      expect(ordenes[0].codigo).toBeNull();
    });

    it('al quinto error el código se borra y hay que pedir otro', async () => {
      const { service, ordenes } = build([programadaCrm({ estatus: 'borrador' })]);
      await service.solicitarCodigo(1, tecnico);
      const malo = ordenes[0].codigo === '000000' ? '000001' : '000000';
      for (let i = 0; i < 4; i += 1) await expect(service.validarCodigo(1, { codigo: malo }, tecnico)).rejects.toThrow(BadRequestException);
      await expect(service.validarCodigo(1, { codigo: malo }, tecnico)).rejects.toThrow('se agotaron los intentos');
      expect(ordenes[0].codigo).toBeNull();
      await expect(service.validarCodigo(1, { codigo: malo }, tecnico)).rejects.toThrow('No hay código');
    });

    it('no aplica a un alta', async () => {
      const { service } = build([programadaCrm({ estatus: 'borrador', tipoServicio: 'instalacion', idInstalacion: null })]);
      await expect(service.solicitarCodigo(1, tecnico)).rejects.toThrow('solo aplica a mantenimientos');
    });
  });

  describe('autorización de desinstalación', () => {
    const alta = () => programadaCrm({ estatus: 'borrador', tipoServicio: 'instalacion', tipoProgramado: 'instalacion', idInstalacion: null });

    it('rechazada por el CRM: la orden queda no cumplida y cobrable', async () => {
      const { service, ordenes } = build([alta()]);
      await service.solicitarAutorizacion(1, { observaciones: 'Equipo de otra marca' }, tecnico);
      expect(ordenes[0].autorizacion).toBe('pendiente');
      await service.decidirAutorizacion(1, { autorizada: false }, crm);
      expect(ordenes[0]).toMatchObject({
        autorizacion: 'rechazada', estatus: 'no_cumplida', claveMotivo: 'sin_autorizacion_desinstalacion', cobrable: 1,
        origenAutorizacion: 'crm', nombreAutorizo: 'CRM: Ana',
      });
    });

    it('autorizada por operación: sigue en borrador; decidir otra vez lo contrario da 409', async () => {
      const { service, ordenes } = build([alta()]);
      await service.solicitarAutorizacion(1, {}, tecnico);
      await service.decidirAutorizacion(1, { autorizada: true }, { tipo: 'usuario', user: admin });
      expect(ordenes[0]).toMatchObject({ autorizacion: 'autorizada', estatus: 'borrador', idUsuarioAutorizo: 2 });
      const otra = await service.decidirAutorizacion(1, { autorizada: true }, crm);
      expect(otra.message).toMatch(/ya estaba autorizada/);
      await expect(service.decidirAutorizacion(1, { autorizada: false }, crm)).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('no cumplida y cancelar', () => {
    it('el técnico marca no cumplida con el cobro del motivo, sin poder cambiarlo', async () => {
      const { service, ordenes } = build([programadaCrm({ estatus: 'borrador' })]);
      await expect(service.noCumplida(1, { claveMotivo: 'cliente_ausente', cobrable: false }, tecnico)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.noCumplida(1, { claveMotivo: 'falta_material' }, tecnico)).rejects.toThrow('requiere observaciones');
      await expect(service.noCumplida(1, { claveMotivo: 'cancelada_por_cliente' }, tecnico)).rejects.toThrow('no aplica');
      await service.noCumplida(1, { claveMotivo: 'cliente_ausente' }, tecnico);
      expect(ordenes[0]).toMatchObject({ estatus: 'no_cumplida', cobrable: 1, claveMotivo: 'cliente_ausente', idUsuarioCierre: 50 });
    });

    it('operación sí ajusta el cobro', async () => {
      const { service, ordenes } = build([programadaCrm({ estatus: 'borrador' })]);
      await service.noCumplida(1, { claveMotivo: 'cliente_ausente', cobrable: false }, admin);
      expect(ordenes[0].cobrable).toBe(0);
    });

    it('el CRM cancela una programada con motivo, pero una iniciada da 409', async () => {
      const { service, ordenes } = build([programadaCrm(), programadaCrm({ id: 2, estatus: 'borrador' })]);
      await expect(service.cancelar(1, {}, crm)).rejects.toThrow('claveMotivo');
      await service.cancelar(1, { claveMotivo: 'cancelada_por_cliente' }, crm);
      expect(ordenes[0]).toMatchObject({ estatus: 'cancelada', claveMotivo: 'cancelada_por_cliente', cobrable: 0 });
      await expect(service.cancelar(2, { claveMotivo: 'cancelada_por_cliente' }, crm)).rejects.toBeInstanceOf(ConflictException);
    });

    it('el técnico no cancela una programada; una orden de la etapa 1 sí, sin motivo', async () => {
      const { service, ordenes } = build([
        programadaCrm({ estatus: 'borrador' }),
        programadaCrm({ id: 2, estatus: 'borrador', origen: null }),
      ]);
      await expect(service.cancelar(1, {}, { tipo: 'usuario', user: tecnico })).rejects.toThrow('use no cumplida');
      await service.cancelar(2, {}, { tipo: 'usuario', user: tecnico });
      expect(ordenes[1].estatus).toBe('cancelada');
    });

    it('el CRM no toca órdenes programadas por operación', async () => {
      const { service } = build([programadaCrm({ origen: 'next' })]);
      await expect(service.reprogramar(1, { cita: '2026-10-31T10:00:00-06:00' }, crm)).rejects.toThrow('no encontrada');
    });
  });
});
