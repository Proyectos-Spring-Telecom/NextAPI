import { of } from 'rxjs';
import { WebhooksClienteService } from './webhooks-cliente.service';
import { firmar } from './webhooks-cliente.util';

jest.mock('dns/promises', () => ({ lookup: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { lookup } = require('dns/promises') as { lookup: jest.Mock };

const pendiente = {
  id: 7,
  evento: 'prueba',
  cuerpo: '{"evento":"prueba","data":{}}',
  intentos: 0,
  url: 'https://torre.fisfiber.mx/eventos',
  secreto: 's3cr3t',
  estatus: 1,
};

function servicio(status: number) {
  const consultas: Array<{ sql: string; params: unknown[] }> = [];
  const dataSource = {
    query: jest.fn(async (sql: string, params: unknown[] = []) => {
      consultas.push({ sql, params });
      return sql.includes("WHERE e.Estatus = 'pendiente'") ? [pendiente] : [];
    }),
  };
  const http = { post: jest.fn(() => of({ status })) };
  const s = new WebhooksClienteService(
    dataSource as never,
    http as never,
    {} as never,
    {} as never,
    { get: () => 'false' } as never,
  );
  return { s, http, consultas };
}

describe('WebhooksClienteService.despachar', () => {
  beforeEach(() => lookup.mockResolvedValue([{ address: '216.238.90.14', family: 4 }]));

  it('manda el cuerpo exacto con la firma y lo cierra como enviado', async () => {
    const { s, http, consultas } = servicio(200);
    await s.despachar();
    const [url, cuerpo, opciones] = http.post.mock.calls[0] as unknown as [string, string, { headers: Record<string, string>; maxRedirects: number }];
    expect(url).toBe(pendiente.url);
    expect(cuerpo).toBe(pendiente.cuerpo);
    expect(opciones.maxRedirects).toBe(0);
    const ts = opciones.headers['X-Next-Timestamp'];
    expect(opciones.headers['X-Next-Firma']).toBe(`sha256=${firmar('s3cr3t', ts, pendiente.cuerpo)}`);
    expect(consultas.some((c) => c.sql.startsWith('UPDATE EnviosWebhook SET Estatus') && c.params[0] === 'enviado')).toBe(true);
  });

  it('un 500 deja el envío pendiente con el siguiente intento programado', async () => {
    const { s, consultas } = servicio(500);
    await s.despachar();
    const reintento = consultas.find((c) => c.sql.includes('ProximoIntento = DATE_ADD'));
    expect(reintento?.params.slice(0, 3)).toEqual([1, 500, 'HTTP 500']);
  });

  it('un host que resuelve a una IP interna no recibe la petición', async () => {
    lookup.mockResolvedValue([{ address: '10.0.0.5', family: 4 }]);
    const { s, http, consultas } = servicio(200);
    await s.despachar();
    expect(http.post).not.toHaveBeenCalled();
    const reintento = consultas.find((c) => c.sql.includes('ProximoIntento = DATE_ADD'));
    expect(String(reintento?.params[2])).toContain('IP no pública');
  });
});
