import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { InmovilizadorService } from './inmovilizador.service';

jest.mock('src/utils/datetime-mexico.util', () => ({
  nowMexicoCityAsUtcDate: () => new Date('2026-11-13T12:00:00Z'),
}));

const usuario = { userId: 7, idCliente: 1, rol: 1 };

function armar(opts: { clases?: string; velocidad?: number | null; fecha?: string | null } = {}) {
  const posicion = { velocidad: opts.velocidad ?? 0, fecha: opts.fecha === undefined ? '2026-11-13T11:58:00' : opts.fecha };
  const dataSource = {
    query: jest.fn(async () => [
      {
        clase: 'AVL',
        idDispositivo: 55,
        estatus: 1,
        placa: 'PXP613F',
        velocidad: posicion.velocidad,
        fechaPosicion: posicion.fecha,
      },
    ]),
  };
  const comandos = { encolar: jest.fn().mockResolvedValue([901]), publicar: jest.fn() };
  const bitacora = { logToBitacora: jest.fn() };
  const tenant = { assertInstalacionVisible: jest.fn().mockResolvedValue({ idDispositivo: 55 }) };
  const config = { get: (k: string) => ({ INMOVILIZADOR_CLASES: opts.clases ?? 'AVL:jimi' })[k] };
  const s = new InmovilizadorService(dataSource as never, tenant as never, comandos as never, bitacora as never, config as never);
  return { s, comandos, bitacora, posicion };
}

describe('InmovilizadorService', () => {
  it('sin la clase habilitada: no se puede', async () => {
    const { s } = armar({ clases: '' });
    await expect(s.solicitar(usuario, 1000325, 'paro', 'Prueba de paro')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('en marcha: rechaza y deja la solicitud en bitácora', async () => {
    const { s, bitacora } = armar({ velocidad: 60 });
    await expect(s.solicitar(usuario, 1000325, 'paro', 'Prueba de paro')).rejects.toBeInstanceOf(ConflictException);
    expect(bitacora.logToBitacora).toHaveBeenCalled();
  });

  it('detenida: solicita, confirma el mismo usuario y sale con vigencia corta', async () => {
    const { s, comandos } = armar();
    const { data } = await s.solicitar(usuario, 1000325, 'paro', 'Robo reportado, folio 1');
    const r = await s.confirmar(usuario, data.codigo);
    expect(r.data).toMatchObject({ idComando: 901, accion: 'paro', estatus: 'pendiente', venceEnMinutos: 5 });
    const [args] = comandos.encolar.mock.calls[0];
    expect(args).toMatchObject({ idDispositivo: 55, protocolo: 'jimi', vigenciaMs: 300_000 });
    expect(args.comandos[0].tipo).toBe('PARO_MOTOR');
    expect(comandos.publicar).toHaveBeenCalledWith([901]);
  });

  it('otro usuario no puede confirmar', async () => {
    const { s, comandos } = armar();
    const { data } = await s.solicitar(usuario, 1000325, 'paro', 'Robo reportado, folio 1');
    await expect(s.confirmar({ ...usuario, userId: 8 }, data.codigo)).rejects.toBeInstanceOf(ForbiddenException);
    expect(comandos.encolar).not.toHaveBeenCalled();
  });

  it('si arrancó entre la solicitud y la confirmación, no manda nada', async () => {
    const { s, comandos, posicion } = armar();
    const { data } = await s.solicitar(usuario, 1000325, 'paro', 'Robo reportado, folio 1');
    posicion.velocidad = 40;
    await expect(s.confirmar(usuario, data.codigo)).rejects.toBeInstanceOf(ConflictException);
    expect(comandos.encolar).not.toHaveBeenCalled();
  });

  it('el código sirve una sola vez', async () => {
    const { s } = armar();
    const { data } = await s.solicitar(usuario, 1000325, 'reanudar', 'Unidad recuperada, folio 1');
    await s.confirmar(usuario, data.codigo);
    await expect(s.confirmar(usuario, data.codigo)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reanudar se permite aunque no haya posición', async () => {
    const { s, comandos } = armar({ fecha: null, velocidad: null });
    const { data } = await s.solicitar(usuario, 1000325, 'reanudar', 'Unidad recuperada, folio 1');
    await s.confirmar(usuario, data.codigo);
    expect(comandos.encolar.mock.calls[0][0].comandos[0].tipo).toBe('REANUDAR_MOTOR');
  });
});
