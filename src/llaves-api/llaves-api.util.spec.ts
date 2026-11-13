import { generarLlave, llaveCoincide, prefijoDe } from './llaves-api.util';

describe('llaves de API', () => {
  it('genera llaves con formato, prefijo y hash', () => {
    const { llave, prefijo, hash } = generarLlave();
    expect(llave).toMatch(/^nxt_[0-9a-f]{8}_[A-Za-z0-9_-]{43}$/);
    expect(prefijoDe(llave)).toBe(prefijo);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(llaveCoincide(llave, hash)).toBe(true);
  });

  it('dos llaves nunca se repiten', () => {
    expect(generarLlave().llave).not.toBe(generarLlave().llave);
  });

  it('rechaza una llave alterada o con otro formato', () => {
    const { llave, hash } = generarLlave();
    const alterada = llave.slice(0, -1) + (llave.endsWith('A') ? 'B' : 'A');
    expect(llaveCoincide(alterada, hash)).toBe(false);
    expect(prefijoDe('Bearer abc')).toBeNull();
    expect(prefijoDe('nxt_zzzzzzzz_' + 'a'.repeat(43))).toBeNull();
  });
});
