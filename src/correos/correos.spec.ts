import { BadRequestException, HttpException } from '@nestjs/common';
import { AvisosMasivosWorker } from './avisos-masivos.worker';
import { asuntoFinal, enLotes, idsDeTexto, mensajeFinal, nombreOriginal, validarAdjunto } from './correos.reglas';
import { CorreosService } from './correos.service';

const archivo = (originalname: string, mimetype: string, size = 10) =>
  ({ originalname, mimetype, size, buffer: Buffer.alloc(size, 1) }) as Express.Multer.File;
const config = (env: Record<string, string> = {}) => ({ get: (k: string) => env[k] }) as never;

describe('correos: reglas', () => {
  it('adjunto: tipos permitidos, 10 MB y nombre original con acentos', () => {
    expect(validarAdjunto(undefined)).toBeNull();
    expect(validarAdjunto(archivo('informe.pdf', 'application/pdf'))?.contentType).toBe('application/pdf');
    expect(validarAdjunto(archivo('datos.CSV', 'application/vnd.ms-excel'))?.filename).toBe('datos.CSV');
    expect(validarAdjunto(archivo('foto.webp', 'application/octet-stream'))?.contentType).toBe('image/webp');
    expect(() => validarAdjunto(archivo('virus.exe', 'application/octet-stream'))).toThrow(BadRequestException);
    expect(() => validarAdjunto(archivo('falso.pdf', 'image/png'))).toThrow(BadRequestException);
    expect(() => validarAdjunto(archivo('grande.pdf', 'application/pdf', 10 * 1024 * 1024 + 1))).toThrow('El archivo pesa más de 10 MB');
    expect(nombreOriginal(Buffer.from('informe-año.pdf', 'utf8').toString('latin1'))).toBe('informe-año.pdf');
  });

  it('asunto y mensaje por omisión', () => {
    expect(asuntoFinal('  ')).toBe('Aviso de Spring Telecom');
    expect(mensajeFinal(undefined, false)).toBe('Buen día.\n\nQuedamos a sus órdenes.\nSpring Telecom');
    expect(mensajeFinal('', true)).toContain('Le compartimos el archivo adjunto.');
    expect(mensajeFinal('Hola', true)).toBe('Hola');
  });

  it('ids y lotes', () => {
    expect(idsDeTexto('12, 45,45,x,78')).toEqual([12, 45, 78]);
    expect(() => idsDeTexto('')).toThrow('Elige al menos un usuario');
    expect(enLotes([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});

describe('correos: servicio', () => {
  const armar = (opts: { recientes?: number; usuarios?: Array<{ id: number; correo: string }>; env?: Record<string, string> } = {}) => {
    const mail = { enviar: jest.fn(async () => undefined) };
    const inserts: unknown[][] = [];
    const m = {
      query: jest.fn(async (sql: string, p: unknown[]) => {
        inserts.push([sql, p]);
        return sql.startsWith('INSERT INTO AvisosMasivos ') ? { insertId: 42 } : {};
      }),
    };
    const dataSource = {
      query: jest.fn(async (sql: string): Promise<any> => {
        if (sql.includes('COUNT(*) AS recientes')) return [{ recientes: opts.recientes ?? 0 }];
        if (sql.includes('FROM Usuarios u')) return opts.usuarios ?? [];
        return [];
      }),
      transaction: jest.fn(async (fn: (x: typeof m) => unknown) => fn(m)),
    };
    const tenantFilter = { build: jest.fn(async () => ({ sql: '', params: [], sinAcceso: false })) };
    const bitacora = { logToBitacora: jest.fn(async () => undefined) };
    const worker = { despertar: jest.fn(), minutosEstimados: jest.fn(() => 1) };
    const s = new CorreosService(mail as never, dataSource as never, tenantFilter as never, bitacora as never, worker as never, config(opts.env));
    return { s, mail, inserts, worker, dataSource };
  };
  const alcance = { userId: 1, idCliente: 1, rol: 1 };

  it('correo libre: uno va en Para; varios en CCO', async () => {
    const { s, mail } = armar();
    await s.enviarLibre(undefined, { correos: 'Ana@x.com', origen: 'informe-sucesos' }, 1);
    expect(mail.enviar).toHaveBeenLastCalledWith(expect.objectContaining({ para: ['ana@x.com'], cco: undefined, asunto: 'Aviso de Spring Telecom' }));
    const r = await s.enviarLibre(archivo('i.pdf', 'application/pdf'), { correos: 'a@x.com,b@x.com', origen: 'informe-sucesos' }, 1);
    expect(mail.enviar).toHaveBeenLastCalledWith(expect.objectContaining({ para: [], cco: ['a@x.com', 'b@x.com'] }));
    expect(r.data).toEqual({ correos: ['a@x.com', 'b@x.com'], adjunto: 'i.pdf' });
    await expect(s.enviarLibre(undefined, { correos: 'a@x.com,b@x.com,c@x.com,d@x.com,e@x.com,f@x.com', origen: 'x' }, 1)).rejects.toThrow(BadRequestException);
  });

  it('aviso: omite sin correo y repetidos, arma lotes y despierta al envío', async () => {
    const usuarios = [
      { id: 1, correo: 'a@x.com' }, { id: 2, correo: 'A@x.com' }, { id: 3, correo: 'usuario7' },
      { id: 4, correo: 'b@x.com' }, { id: 5, correo: 'c@x.com' },
    ];
    const { s, inserts, worker } = armar({ usuarios, env: { AVISO_MASIVO_LOTE: '2' } });
    const r = await s.avisoMasivo(undefined, { idUsuarios: '1,2,3,4,5,6' }, alcance);
    expect(r.data).toMatchObject({ idEnvio: 42, total: 3, omitidos: 3, lotes: 2 });
    const dest = inserts.find(([sql]) => String(sql).startsWith('INSERT INTO AvisosMasivosDestinatarios'))!;
    expect(dest[1]).toEqual([42, 1, 'a@x.com', 1, 42, 4, 'b@x.com', 1, 42, 5, 'c@x.com', 2]);
    expect(worker.despertar).toHaveBeenCalled();
  });

  it('aviso: máximo, ninguno con correo y límite por hora', async () => {
    await expect(armar({ env: { AVISO_MASIVO_MAX: '2' } }).s.avisoMasivo(undefined, { idUsuarios: '1,2,3' }, alcance)).rejects.toThrow('Máximo 2 usuarios por aviso');
    await expect(armar({ usuarios: [] }).s.avisoMasivo(undefined, { idUsuarios: '1' }, alcance)).rejects.toThrow('Ninguno de los usuarios elegidos tiene correo');
    const e = await armar({ recientes: 2 }).s.avisoMasivo(undefined, { idUsuarios: '1' }, alcance).catch((x) => x);
    expect(e).toBeInstanceOf(HttpException);
    expect((e as HttpException).getStatus()).toBe(429);
  });
});

describe('correos: envío por lotes', () => {
  const armar = (fallar = false) => {
    const updates: string[] = [];
    const dataSource = {
      query: jest.fn(async (sql: string): Promise<any> => {
        if (sql.includes("WHERE Estatus = 'enviando'")) return [{ id: 7, idUsuario: 1, asunto: 'A', mensaje: 'Hola\nmundo', adjunto: null }];
        if (sql.includes('MIN(Lote)')) return [{ lote: 1 }];
        if (sql.includes('AND Lote = ? AND Estatus = 0') && sql.startsWith('SELECT')) return [{ correo: 'a@x.com' }, { correo: 'b@x.com' }];
        if (sql.startsWith('UPDATE')) updates.push(sql);
        return [];
      }),
    };
    const mail = { enviar: jest.fn(async () => { if (fallar) throw new Error('limite'); }) };
    const w = new AvisosMasivosWorker(dataSource as never, mail as never, { logToBitacora: jest.fn() } as never, config());
    return { w, mail, updates };
  };

  it('manda el lote en CCO y lo marca enviado', async () => {
    const { w, mail, updates } = armar();
    expect(await w.tick()).toBe(7);
    expect(mail.enviar).toHaveBeenCalledWith(expect.objectContaining({ para: [], cco: ['a@x.com', 'b@x.com'], html: '<p>Hola<br>mundo</p>' }));
    expect(updates[0]).toContain('SET Estatus = 1');
  });

  it('si falla, cuenta el intento y espera antes de reintentar', async () => {
    const { w, mail, updates } = armar(true);
    await w.tick();
    expect(updates[0]).toContain('Intentos = Intentos + 1');
    expect(await w.tick()).toBeNull();
    expect(mail.enviar).toHaveBeenCalledTimes(1);
  });

  it('estimado: 300 usuarios en lotes de 50 cada 60 s ≈ 5 min', () => {
    expect(armar().w.minutosEstimados(300, 50)).toBe(5);
  });
});
