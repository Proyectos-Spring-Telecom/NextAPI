import { createHmac } from 'crypto';
import {
  esIpPublica,
  esperaMinutos,
  firmar,
  validarUrlWebhook,
} from './webhooks-cliente.util';

describe('firmar', () => {
  it('HMAC-SHA256 de timestamp.cuerpo, verificable del otro lado', () => {
    const cuerpo = '{"evento":"prueba"}';
    const esperada = createHmac('sha256', 's3cr3t')
      .update(`1731490000.${cuerpo}`)
      .digest('hex');
    expect(firmar('s3cr3t', '1731490000', cuerpo)).toBe(esperada);
  });
});

describe('esperaMinutos', () => {
  it('crece al doble y se topa en 6 h', () => {
    expect([1, 2, 3, 4, 10, 20].map(esperaMinutos)).toEqual([1, 2, 4, 8, 360, 360]);
  });
});

describe('esIpPublica', () => {
  it.each([
    '10.0.0.1',
    '127.0.0.1',
    '169.254.169.254',
    '172.16.5.4',
    '192.168.1.10',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    'fd00::1',
    'fe80::1',
    '::ffff:127.0.0.1',
  ])('%s no es pública', (ip) => expect(esIpPublica(ip)).toBe(false));
  it.each(['216.238.90.14', '8.8.8.8', '2606:4700::1111'])('%s es pública', (ip) =>
    expect(esIpPublica(ip)).toBe(true),
  );
});

describe('validarUrlWebhook', () => {
  it('acepta https a un dominio', () => {
    expect(validarUrlWebhook('https://torre.fisfiber.mx/next/eventos')).toBeNull();
  });
  it.each([
    ['http://torre.fisfiber.mx/x', 'https'],
    ['https://localhost/x', 'público'],
    ['https://127.0.0.1/x', 'público'],
    ['https://169.254.169.254/latest', 'público'],
    ['https://[::1]/x', 'público'],
    ['https://user:pw@torre.fisfiber.mx/x', 'usuario'],
    ['no es url', 'válida'],
  ])('rechaza %s', (url, texto) => {
    expect(validarUrlWebhook(url)).toContain(texto);
  });
});
