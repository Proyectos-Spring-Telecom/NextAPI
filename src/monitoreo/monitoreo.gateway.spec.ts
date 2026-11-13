import { MonitoreoGateway } from './monitoreo.gateway';

/** La room de operación (bandeja e inservibles) es solo para los roles 1–5. */
describe('MonitoreoGateway: rooms', () => {
  const tenant = {
    esPorAsignacion: (rol: number) => rol === 7 || rol === 9,
    idsClientePermitidos: async (rol: number) => (rol <= 5 ? 'all' : [1, 4]),
  };
  const conectar = async (rol: number) => {
    const jwt = { verify: () => ({ type: 'access', id: 1, rol, idCliente: 1 }) };
    const servicio = {
      idsInstalacionesVisibles: async () => [10],
      listado: async () => ({ posicion: [], 'puntos-interes': [] }),
      consola: async () => ({ posicion: [] }),
    };
    const gw = new MonitoreoGateway(jwt as never, servicio as never, tenant as never);
    const rooms: string[] = [];
    const client = {
      handshake: { auth: { token: 't' }, headers: {}, query: {} },
      join: async (r: string | string[]) => void rooms.push(...[r].flat()),
      emit: () => true,
      disconnect: () => undefined,
    };
    await gw.handleConnection(client as never);
    return rooms;
  };

  it('roles 1–5 entran a operación y a los comandos de sus instalaciones', async () => {
    for (const rol of [1, 2, 3, 4, 5]) {
      expect(await conectar(rol)).toEqual(['instalacion:10', 'operacion', 'comandos-op:10', `rol:${rol}`, 'usuario:1', 'incidentes:todos']);
    }
  });

  it('el cliente (6) a sus instalaciones y a los comandos del reloj; 7 y 9 sin comandos', async () => {
    expect(await conectar(6)).toEqual([
      'instalacion:10',
      'comandos-cliente:10',
      'rol:6',
      'usuario:1',
      'incidentes-cliente:1',
      'incidentes-cliente:4',
    ]);
    // Por asignación: los incidentes les llegan solo por la sala de la instalación.
    expect(await conectar(7)).toEqual(['instalacion:10', 'rol:7', 'usuario:1']);
    expect(await conectar(9)).toEqual(['instalacion:10', 'rol:9', 'usuario:1']);
  });

  it('comando:actualizacion va a operación; al cliente solo si la audiencia lo incluye', () => {
    const gw = new MonitoreoGateway({} as never, {} as never, {} as never);
    const salas: string[][] = [];
    const destino = (acum: string[]) => ({ to: (r: string) => destino([...acum, r]), emit: () => void salas.push(acum) });
    gw.server = { to: (r: string) => destino([r]) } as never;
    const ev = { idInstalacion: 10, idDispositivo: 3, comando: {} };
    gw.emitComando(ev, 'operacion');
    gw.emitComando(ev, 'operacion_y_cliente');
    expect(salas).toEqual([['comandos-op:10'], ['comandos-op:10', 'comandos-cliente:10']]);
  });

  it('sin avisos no se emite nada', () => {
    const gw = new MonitoreoGateway({} as never, {} as never, {} as never);
    const emit = jest.fn();
    gw.server = { to: () => ({ emit }) } as never;
    gw.emitAvisosSinTransmision({ motivo: 'cierre', avisos: [] });
    expect(emit).not.toHaveBeenCalled();
    gw.emitAvisosSinTransmision({ motivo: 'cierre', avisos: [{ id: 1 }] });
    expect(emit).toHaveBeenCalledWith('vigilancia:avisos', { motivo: 'cierre', avisos: [{ id: 1 }] });
  });

  it('consola:incidente y su cierre van a todos, al cliente y, si hay, a la instalación', () => {
    const gw = new MonitoreoGateway({} as never, {} as never, {} as never);
    const emit = jest.fn();
    const to = jest.fn(() => ({ emit }));
    gw.server = { to } as never;
    gw.emitConsolaIncidente({ idIncidente: 62, nuevo: true, tipoOrigen: 2, idCliente: 13, idInstalacion: null });
    expect(to).toHaveBeenLastCalledWith(['incidentes:todos', 'incidentes-cliente:13']);
    gw.emitConsolaIncidenteCerrado({ idIncidente: 62, idCliente: 13, idInstalacion: 7, fechaCierre: null });
    expect(to).toHaveBeenLastCalledWith(['incidentes:todos', 'incidentes-cliente:13', 'instalacion:7']);
    expect(emit).toHaveBeenLastCalledWith('consola:incidente-cerrado', expect.objectContaining({ idIncidente: 62 }));
  });

  it('emitPorRoles: salas de rol más usuarios puntuales', () => {
    const gw = new MonitoreoGateway({} as never, {} as never, {} as never);
    const to = jest.fn(() => ({ emit: jest.fn() }));
    gw.server = { to } as never;
    gw.emitPorRoles('ordenes:actualizacion', {}, [1, 4], [33, 0]);
    expect(to).toHaveBeenCalledWith(['rol:1', 'rol:4', 'usuario:33']);
  });
});
