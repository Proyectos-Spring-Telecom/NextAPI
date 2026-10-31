import { BadRequestException } from '@nestjs/common';
import { comandoLeerParametros, comandoParametros, porNombre } from './comandos-jt808';
import { idEquipoComando } from './id-equipo';

describe('comandos de la TrackCam (JT808)', () => {
  it('PARAMS con id hex de 4 dígitos, en el orden del catálogo', () => {
    expect(comandoParametros({ velocidadMaximaKmh: 100, intervaloReporteSegundos: 30 })).toEqual({
      tipo: 'PARAMS',
      contenido: 'PARAMS,0029=30,0055=100',
    });
    expect(comandoLeerParametros()).toEqual({ tipo: 'LEERPARAMS', contenido: 'LEERPARAMS' });
  });

  it('fuera de rango, no entero o vacío → 400', () => {
    expect(() => comandoParametros({ intervaloReporteSegundos: 4 })).toThrow(BadRequestException);
    expect(() => comandoParametros({ velocidadMaximaKmh: 90.5 })).toThrow(BadRequestException);
    expect(() => comandoParametros({})).toThrow('al menos un parámetro');
  });

  it('la lectura por hex se traduce a nombres; lo que no está en el catálogo se ignora', () => {
    expect(porNombre({ '0x0029': 179, '0x0055': 91, '0x0001': 30, '0x0013': 'tc.springtelecom.mx' })).toEqual({
      intervaloReporteSegundos: 179,
      velocidadMaximaKmh: 91,
    });
    expect(porNombre(null)).toEqual({});
  });

  it('la TrackCam se nombra por número de serie; los demás por IMEI', () => {
    const equipo = { imei: '8664960749891928', numeroSerie: '007775005494' };
    expect(idEquipoComando('jt808', equipo)).toBe('007775005494');
    expect(idEquipoComando('fa100s', equipo)).toBe('8664960749891928');
    expect(idEquipoComando('jt808', { imei: '1' })).toBe('');
  });
});
