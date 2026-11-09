import { comandoEstado, comandoIntervaloPhone, comandoSms, comandoUbicar } from './comandos-phone';

describe('comandos del teléfono', () => {
  it('arma el contenido que entiende springTrackPhone', () => {
    expect(comandoIntervaloPhone(120)).toEqual({ tipo: 'INTERVALO', contenido: 'INTERVALO,120' });
    expect(comandoUbicar().contenido).toBe('UBICAR');
    expect(comandoEstado().contenido).toBe('ESTADO');
    expect(comandoSms(null, ['55 1234-5678', '+525587654321'])).toEqual({
      tipo: 'SMS',
      contenido: 'SMS,-,5512345678;+525587654321',
    });
    expect(comandoSms('1234', null).contenido).toBe('SMS,1234,-');
  });

  it('rechaza lo que el socket no acepta', () => {
    expect(() => comandoIntervaloPhone(10)).toThrow('30 a 3600');
    expect(() => comandoSms('12', null)).toThrow('PIN');
    expect(() => comandoSms(null, null)).toThrow('pin o numeros');
    expect(() => comandoSms(null, ['123'])).toThrow('números');
  });
});
