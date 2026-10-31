import { OrdenPorEquipo } from './orden-por-equipo';

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('OrdenPorEquipo', () => {
  it('un mismo equipo en orden de llegada, aunque el primero tarde más', async () => {
    const orden = new OrdenPorEquipo();
    const hecho: string[] = [];
    await Promise.all([
      orden.run('A', async () => { await espera(30); hecho.push('A1'); }),
      orden.run('A', async () => { await espera(1); hecho.push('A2'); }),
      orden.run('A', async () => { hecho.push('A3'); }),
    ]);
    expect(hecho).toEqual(['A1', 'A2', 'A3']);
    expect(orden.activas).toBe(0);
  });

  it('equipos distintos en paralelo', async () => {
    const orden = new OrdenPorEquipo();
    const hecho: string[] = [];
    await Promise.all([
      orden.run('A', async () => { await espera(30); hecho.push('A'); }),
      orden.run('B', async () => { hecho.push('B'); }),
    ]);
    expect(hecho).toEqual(['B', 'A']);
  });

  it('un fallo no detiene a los siguientes del mismo equipo y se propaga a su llamador', async () => {
    const orden = new OrdenPorEquipo();
    const hecho: string[] = [];
    const r1 = orden.run('A', async () => { throw new Error('x'); });
    const r2 = orden.run('A', async () => { hecho.push('A2'); });
    await expect(r1).rejects.toThrow('x');
    await r2;
    expect(hecho).toEqual(['A2']);
  });
});

describe('llaveEquipo', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { llaveEquipo } = require('./rabbitmq.connection.service');
  const msg = (headers: Record<string, unknown>, body: Record<string, unknown> = {}) =>
    ({ properties: { headers }, content: Buffer.from(JSON.stringify(body)) }) as never;

  it('protocolo y equipo de los headers, o del cuerpo', () => {
    expect(llaveEquipo(msg({ protocol: 'jt808', deviceId: '0123' }))).toBe('jt808|0123');
    expect(llaveEquipo(msg({}, { protocol: 'jimi', deviceId: '950204084' }))).toBe('jimi|950204084');
    expect(llaveEquipo(msg({}, {}))).toBeNull();
  });
});
