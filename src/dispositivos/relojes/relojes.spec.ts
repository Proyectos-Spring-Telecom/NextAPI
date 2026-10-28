import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { RelojConfig } from 'src/entities/RelojConfig';
import { mapRelojPlano, pickRelojConfig } from '../map-relaciones.util';
import { CreateRelojDto } from './dto/create-reloj.dto';
import { UpdateRelojDto } from './dto/update-reloj.dto';

const valido = {
  idCliente: 1,
  numeroSerie: '6907850461',
  imei: '863269078504617',
  intervaloGpsSegundos: 600,
  sensibilidadCaida: 5,
};

const errores = (cls: new () => object, body: object) =>
  validateSync(plainToInstance(cls, body)).map((e) => e.property);

describe('Relojes', () => {
  it('acepta el reloj real: ID de 10 dígitos e IMEI de 15', () => {
    expect(errores(CreateRelojDto, valido)).toEqual([]);
  });

  it('rechaza ID e IMEI con otro formato y la sensibilidad fuera de 1–6', () => {
    expect(
      errores(CreateRelojDto, {
        ...valido,
        numeroSerie: '86326907850461',
        imei: '6907850461',
        sensibilidadCaida: 7,
      }).sort(),
    ).toEqual(['imei', 'numeroSerie', 'sensibilidadCaida']);
  });

  it('acepta el IMEI como número de serie (así se dio de alta el primero)', () => {
    expect(errores(UpdateRelojDto, { numeroSerie: '863269078504617' })).toEqual([]);
  });

  it('el IMEI es obligatorio al crear (la telemetría se busca por IMEI)', () => {
    const { imei: _omit, ...sinImei } = valido;
    expect(errores(CreateRelojDto, sinImei)).toEqual(['imei']);
  });

  it('el reporte no baja de 60 s; el GPS acepta 0 (solo en alarmas)', () => {
    expect(errores(UpdateRelojDto, { intervaloReporteSegundos: 30 })).toEqual([
      'intervaloReporteSegundos',
    ]);
    expect(errores(UpdateRelojDto, { intervaloGpsSegundos: 0 })).toEqual([]);
  });

  it('pickRelojConfig solo toma los campos de configuración que llegaron', () => {
    expect(pickRelojConfig({ ...valido, deteccionCaida: 0 } as never)).toEqual({
      intervaloGpsSegundos: 600,
      sensibilidadCaida: 5,
      deteccionCaida: 0,
    });
  });

  it('mapRelojPlano junta dispositivo y configuración', () => {
    const plano = mapRelojPlano({
      idDispositivo: 42,
      idCliente: 1,
      intervaloReporteSegundos: 300,
      intervaloGpsSegundos: 600,
      deteccionCaida: 1,
      llamadaPorCaida: 0,
      sensibilidadCaida: 5,
    } as RelojConfig);
    expect(plano).toMatchObject({
      id: 42,
      idCliente: 1,
      intervaloGpsSegundos: 600,
      llamadaPorCaida: 0,
      sensibilidadCaida: 5,
    });
  });
});
