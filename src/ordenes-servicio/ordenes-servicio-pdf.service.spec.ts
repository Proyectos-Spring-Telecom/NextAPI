import { BadRequestException } from '@nestjs/common';

jest.mock('src/s3/s3.service', () => ({ S3Service: class {} }));
jest.mock('src/mail/mail.service', () => ({ MailService: class {} }));

import { OrdenesServicioPdfService } from './ordenes-servicio-pdf.service';

const repo = (filas: Array<Record<string, unknown>>) => ({
  find: jest.fn(async () => filas),
  findOne: jest.fn(async () => filas[0] ?? null),
  update: jest.fn(),
});

function build(orden: Record<string, unknown>) {
  const s3 = {
    uploadFile: jest.fn(async () => ({ url: 'https://bucket.s3.us-east-1.amazonaws.com/ordenes-servicio/pdf/x.pdf' })),
    getPresignedUrl: jest.fn(async () => 'https://firmada/x.pdf?X-Amz-Expires=604800'),
  };
  const mail = { enviar: jest.fn() };
  const ordenes = repo([orden]);
  const service = new OrdenesServicioPdfService(
    ordenes as never,
    repo([{ seccion: 'pruebas', clave: 'paro_motor', valor: 1 }]) as never,
    repo([]) as never,
    repo([{ clave: 'paro_motor', estatus: 'correcta', nombreValido: 'Ana', fechaValidacion: new Date('2026-10-30T10:00:00Z') }]) as never,
    repo([{ seccion: 'pruebas', clave: 'paro_motor', nombre: 'Paro de motor', orden: 1 }]) as never,
    repo([]) as never,
    repo([{ id: 1, nombre: 'Transportes Uno' }]) as never,
    repo([{ id: 50, nombre: 'Juan', apellidoPaterno: 'Pérez' }]) as never,
    repo([{ idProducto: 5, placa: 'ABC123', numeroEconomico: 'E1' }]) as never,
    repo([]) as never,
    repo([{ id: 20, imei: '866000000000001', numeroSerie: 'S1' }]) as never,
    repo([]) as never,
    s3 as never,
    mail as never,
  );
  return { service, s3, mail, ordenes };
}

const base = {
  id: 7, folio: 'OS-000007', tipoServicio: 'instalacion', estatus: 'cerrada', idCliente: 1, idProducto: 5,
  idTecnico: 50, idMonitorista: null, idDispositivoNuevo: 20, observaciones: 'Todo bien', cita: null,
};
const tecnico = { userId: 50, idCliente: 1, rol: 8 };

describe('OrdenesServicioPdfService', () => {
  it('genera un PDF', async () => {
    const { service } = build(base);
    const { nombre, buffer } = await service.pdf(7, tecnico);
    expect(nombre).toBe('OS-000007.pdf');
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it('compartir sube el PDF y arma el enlace de WhatsApp de 7 días', async () => {
    const { service, s3, ordenes } = build(base);
    const r = await service.compartir(7, '527771234567', tecnico);
    expect(s3.uploadFile).toHaveBeenCalledWith(expect.objectContaining({ mimetype: 'application/pdf' }), 'ordenes-servicio/pdf', 50, expect.any(Number));
    expect(s3.getPresignedUrl).toHaveBeenCalledWith('ordenes-servicio/pdf/x.pdf', 604800);
    expect(r.data[0].whatsapp).toMatch(/^https:\/\/wa\.me\/527771234567\?text=/);
    expect(ordenes.update).toHaveBeenCalledWith({ id: 7 }, expect.objectContaining({ rutaPdf: expect.stringContaining('x.pdf') }));
  });

  it('el correo lleva el PDF adjunto; una orden en borrador no se comparte', async () => {
    const { service, mail } = build(base);
    await service.enviarCorreo(7, ['cliente@empresa.com'], tecnico);
    expect(mail.enviar).toHaveBeenCalledWith(expect.objectContaining({
      para: ['cliente@empresa.com'],
      adjuntos: [expect.objectContaining({ filename: 'OS-000007.pdf', contentType: 'application/pdf' })],
    }));
    const borrador = build({ ...base, estatus: 'borrador' });
    await expect(borrador.service.compartir(7, undefined, tecnico)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('otro técnico no ve la orden', async () => {
    const { service } = build(base);
    await expect(service.pdf(7, { userId: 51, idCliente: 1, rol: 8 })).rejects.toThrow('no encontrada');
  });
});
