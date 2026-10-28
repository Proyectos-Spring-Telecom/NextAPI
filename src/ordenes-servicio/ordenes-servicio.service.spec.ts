import { BadRequestException } from '@nestjs/common';

// S3Service importa uuid (ESM) y aquí no se usa; InstalacionesService se reemplaza abajo.
jest.mock('src/s3/s3.service', () => ({ S3Service: class {} }));
jest.mock('src/instalaciones/instalaciones.service', () => ({ InstalacionesService: class {} }));

import { OrdenesServicioService } from './ordenes-servicio.service';

const catalogo = [
  { seccion: 'pruebas', clave: 'transmision', obligatorio: 0, estatus: 1 },
  { seccion: 'firmas', clave: 'firma_cliente', obligatorio: 1, estatus: 1 },
];
const respuestas = [{ seccion: 'pruebas', clave: 'transmision', valor: 1 }];
const archivos = [{ clave: 'firma_cliente' }];
const tecnico = { userId: 50, idCliente: 1, rol: 8 };

function build(orden: Record<string, unknown>, extra: { instalacionVigente?: boolean } = {}) {
  const updates: Array<Record<string, unknown>> = [];
  const manager = {
    findOne: jest.fn(async (entity: { name: string }, opts: { where: { id: number } }) => {
      if (entity.name === 'OrdenesServicio') return orden;
      if (entity.name === 'Instalaciones') {
        if (opts.where.id === 99) return { id: 99, idHistoricoInstalacion: 777 };
        return extra.instalacionVigente === false ? null : { id: opts.where.id };
      }
      return null;
    }),
    find: jest.fn(async (entity: { name: string }) => {
      if (entity.name === 'OrdenServicioRespuestas') return respuestas;
      if (entity.name === 'OrdenServicioArchivos') return archivos;
      return catalogo;
    }),
    update: jest.fn(async (_e: unknown, _w: unknown, cambios: Record<string, unknown>) => {
      updates.push(cambios);
    }),
  };
  const qr = {
    manager,
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    isTransactionActive: true,
  };
  const instalaciones = {
    create: jest.fn(async () => ({ status: 'success', message: '', data: { id: 98 } })),
    update: jest.fn(async () => ({ status: 'success', message: '', data: { id: 99 } })),
    baja: jest.fn(async () => ({ status: 'success', message: '', data: { id: 10 } })),
  };
  const usuarios = { findOne: jest.fn(async () => ({ id: 7 })) };
  const bitacora = { logToBitacora: jest.fn() };
  const ds = { createQueryRunner: () => qr };
  const service = new OrdenesServicioService(
    {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never,
    usuarios as never, instalaciones as never, {} as never, ds as never, bitacora as never,
  );
  return { service, qr, instalaciones, updates };
}

const base = {
  id: 1,
  folio: 'OS-000001',
  estatus: 'borrador',
  idCliente: 1,
  idInstalacion: 10,
  idProducto: 5,
  idDispositivoNuevo: null,
  idSimNuevo: null,
  estatusSalienteAnterior: null,
  estatusInstalacionBaja: null,
  idTecnico: 50,
  idMonitorista: 7,
  observaciones: null,
};

describe('OrdenesServicioService.cerrar', () => {
  it('alta: crea la instalación dentro de la misma transacción', async () => {
    const { service, qr, instalaciones, updates } = build({
      ...base, tipoServicio: 'instalacion', idInstalacion: null, idDispositivoNuevo: 20, idSimNuevo: 30,
    });
    const r = await service.cerrar(1, tecnico);
    expect(instalaciones.create).toHaveBeenCalledWith(
      expect.objectContaining({ idCliente: 1, idProducto: 5, idDispositivo: 20, idSim: 30 }),
      50,
      qr,
    );
    expect(updates[0]).toMatchObject({ estatus: 'cerrada', idInstalacion: 98, idInstalacionResultado: 98 });
    expect(qr.commitTransaction).toHaveBeenCalled();
    expect(r.data).toMatchObject({ idInstalacionResultado: 98 });
  });

  it('cambio de equipo: nueva versión, baja por reemplazo y liga al histórico', async () => {
    const { service, qr, instalaciones, updates } = build({
      ...base, tipoServicio: 'c_equipo', idDispositivoNuevo: 21, estatusSalienteAnterior: 4,
    });
    await service.cerrar(1, tecnico);
    expect(instalaciones.update).toHaveBeenCalledWith(
      10,
      expect.objectContaining({ estatusInstalacionAnterior: 3, idDispositivo: 21, estatusDispositivoAnterior: 4 }),
      1, 8, 50, qr,
    );
    expect(updates[0]).toMatchObject({ idInstalacion: 10, idInstalacionResultado: 99, idHistoricoInstalacion: 777 });
  });

  it('desinstalación: baja con el estatus elegido', async () => {
    const { service, qr, instalaciones } = build({ ...base, tipoServicio: 'desinstalacion', estatusInstalacionBaja: 5 });
    await service.cerrar(1, tecnico);
    expect(instalaciones.baja).toHaveBeenCalledWith(10, expect.objectContaining({ estatusInstalacion: 5 }), 1, 8, 50, qr);
  });

  it('revisión: no toca la instalación', async () => {
    const { service, instalaciones, updates } = build({ ...base, tipoServicio: 'revision' });
    await service.cerrar(1, tecnico);
    expect(instalaciones.create).not.toHaveBeenCalled();
    expect(instalaciones.update).not.toHaveBeenCalled();
    expect(instalaciones.baja).not.toHaveBeenCalled();
    expect(updates[0]).toMatchObject({ estatus: 'cerrada', idInstalacionResultado: 10 });
  });

  it('incompleta: 400 con faltantes y rollback', async () => {
    const { service, qr } = build({ ...base, tipoServicio: 'c_sim' });
    await expect(service.cerrar(1, tecnico)).rejects.toBeInstanceOf(BadRequestException);
    expect(qr.rollbackTransaction).toHaveBeenCalled();
    expect(qr.commitTransaction).not.toHaveBeenCalled();
  });

  it('instalación que ya cambió por otra orden: 400 y rollback', async () => {
    const { service, qr } = build({ ...base, tipoServicio: 'revision' }, { instalacionVigente: false });
    await expect(service.cerrar(1, tecnico)).rejects.toThrow('ya no está vigente');
    expect(qr.rollbackTransaction).toHaveBeenCalled();
  });

  it('ya cerrada: devuelve el resultado sin repetir el movimiento', async () => {
    const { service, instalaciones } = build({ ...base, tipoServicio: 'c_equipo', estatus: 'cerrada', idInstalacionResultado: 99 });
    const r = await service.cerrar(1, tecnico);
    expect(instalaciones.update).not.toHaveBeenCalled();
    expect(r.message).toBe('La orden ya estaba cerrada');
  });

  it('otro técnico no puede cerrarla', async () => {
    const { service } = build({ ...base, tipoServicio: 'revision' });
    await expect(service.cerrar(1, { userId: 51, idCliente: 1, rol: 8 })).rejects.toThrow('no encontrada');
  });
});
