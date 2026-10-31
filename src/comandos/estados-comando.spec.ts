import { aplicaAck, estatusQueAceptan } from './estados-comando';

describe('estados del comando', () => {
  it('avanza y nunca retrocede', () => {
    expect(aplicaAck('publicado', 'recibido')).toBe(true);
    expect(aplicaAck('enviado', 'recibido')).toBe(false);
    expect(aplicaAck('enviado', 'enviado')).toBe(false);
  });
  it('confirmado es final y gana a vencido', () => {
    expect(aplicaAck('vencido', 'confirmado')).toBe(true);
    expect(aplicaAck('confirmado', 'vencido')).toBe(false);
    expect(aplicaAck('fallido', 'enviado')).toBe(false);
  });
  it('estatus desde los que aplica cada ack (escritura condicional)', () => {
    expect(estatusQueAceptan('enviado')).toEqual(['pendiente', 'publicado', 'recibido']);
    expect(estatusQueAceptan('confirmado')).toEqual(['pendiente', 'publicado', 'recibido', 'enviado', 'vencido', 'fallido']);
  });
});
