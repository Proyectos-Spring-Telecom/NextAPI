import {
  comandoCaida,
  comandoCentro,
  comandoIntervalo,
  comandoSensibilidad,
  comandoSos,
  comandosAgenda,
  nombreUnicode,
} from './comandos-fa100s';

describe('comandos del FA100S', () => {
  it('SOS con tres lugares; los vacíos van vacíos', () => {
    expect(comandoSos(['777 123 4567', '+525551234567'])).toEqual({ tipo: 'SOS', contenido: 'SOS,7771234567,+525551234567,' });
    expect(() => comandoSos(['1', '2', '3', '4'])).toThrow('hasta 3');
    expect(() => comandoSos(['abc'])).toThrow('teléfono inválido');
  });

  it('centro', () => {
    expect(comandoCentro('7771234567').contenido).toBe('CENTER,7771234567');
  });

  it('nombre en Unicode como el ejemplo del proveedor', () => {
    expect(nombreUnicode('张三')).toBe('5F204E09');
    expect(nombreUnicode('Ana')).toBe('0041006E0061');
    expect(() => nombreUnicode('Nombre muy largo')).toThrow('10 caracteres');
  });

  it('agenda en tres bloques; los vacíos borran', () => {
    const r = comandosAgenda(
      Array.from({ length: 7 }, (_, i) => ({ nombre: `C${i + 1}`, telefono: `55500000${i + 1}` })),
    );
    expect(r.map((c) => c.tipo)).toEqual(['PHB', 'PHB2', 'PHB3']);
    expect(r[0].contenido.split(',').length).toBe(11);
    expect(r[1].contenido).toBe(`PHB2,555000006,${nombreUnicode('C6')},555000007,${nombreUnicode('C7')}`);
    expect(r[2].contenido).toBe('PHB3');
  });

  it('caída, sensibilidad e intervalo', () => {
    expect(comandoCaida(true, false).contenido).toBe('FALLDOWN,1,0');
    expect(comandoSensibilidad(6).contenido).toBe('LSSET,6+6');
    expect(() => comandoSensibilidad(7)).toThrow();
    expect(comandoIntervalo(600).contenido).toBe('UPLOAD,600');
    expect(() => comandoIntervalo(10)).toThrow();
  });
});
