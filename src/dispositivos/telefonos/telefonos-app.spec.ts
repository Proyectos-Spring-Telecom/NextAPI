import { ConflictException, HttpException } from '@nestjs/common';
import { TelefonosAppService } from './telefonos-app.service';

/** Código de alta con la app dada de baja (10/11/2026: daba 500). */
describe('TelefonosAppService.codigoAlta', () => {
  const disp = { id: 7, idCliente: 41, idTipoDispositivo: 4, imei: '861923073360407', eco: 'Tableta', numeroSerie: null };
  const armar = (llamar: jest.Mock) => {
    const servicio = new TelefonosAppService(
      { manager: { update: jest.fn() } } as any,
      {} as any,
      { llamar } as any,
    );
    jest.spyOn(servicio as any, 'telefono').mockResolvedValue(disp);
    return servicio;
  };

  it('roles 1–3 piden reactivar; 4–5 no', async () => {
    const llamar = jest.fn().mockResolvedValue({ imei: disp.imei, codigo: 'ABCD-EF23', venceAt: 'x', estado: 'pendiente' });
    const s = armar(llamar);
    await s.codigoAlta({ rol: 3 } as any, 7);
    expect(llamar).toHaveBeenLastCalledWith('telefono.codigo', 41, { imei: disp.imei, reactivar: true });
    await s.codigoAlta({ rol: 5 } as any, 7);
    expect(llamar).toHaveBeenLastCalledWith('telefono.codigo', 41, { imei: disp.imei, reactivar: false });
  });

  it('el 409 del socket (dada de baja) llega como 409 con un mensaje claro, no como 500', async () => {
    const s = armar(jest.fn().mockRejectedValue(new HttpException('La app de este teléfono está dada de baja', 409)));
    await expect(s.codigoAlta({ rol: 5 } as any, 7)).rejects.toThrow(ConflictException);
    await expect(s.codigoAlta({ rol: 5 } as any, 7)).rejects.toThrow(/solo administración/);
  });
});
