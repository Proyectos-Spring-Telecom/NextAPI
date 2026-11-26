import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ROLES_KEY } from 'src/common/decorators/roles.decorator';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';
import { RolesGuard } from 'src/guard/roles.guard';
import { WebhookEvent } from 'src/webhook-emitter/interfaces/webhook-event.interface';
import { DispositivosController } from './dispositivos.controller';
import { DispositivosService } from './dispositivos.service';
import { CorregirNumeroSerieDto } from './dto/corregir-numero-serie.dto';

describe('PATCH /dispositivos/:id/corregir-numero-serie', () => {
  // Rol 3 (admin) sin filtro de cliente; rol 7 del cliente 10, solo su cliente.
  const tenant = new TenantFilterService({ query: jest.fn() } as never);
  const admin = { userId: 3, idCliente: 1, rol: 3 };
  const operadorCliente10 = { userId: 9, idCliente: 10, rol: 7 };
  const dto = { numeroSerie: ' 863269078504617 ', motivo: 'Se capturó mal en el alta' };

  const servicio = (opts: { equipo?: object | null; duplicado?: object | null; affected?: number; updateError?: unknown } = {}) => {
    const equipo = opts.equipo === undefined ? { id: '1000436', numeroSerie: '86326907850461', idCliente: 10, imei: '863269078504617' } : opts.equipo;
    const execute = opts.updateError
      ? jest.fn().mockRejectedValue(opts.updateError)
      : jest.fn().mockResolvedValue({ affected: opts.affected ?? 1 });
    const qb = { update: jest.fn(), set: jest.fn(), where: jest.fn(), execute };
    qb.update.mockReturnValue(qb);
    qb.set.mockReturnValue(qb);
    qb.where.mockReturnValue(qb);
    const repository = {
      findOne: jest
        .fn()
        .mockImplementation(({ where }) => Promise.resolve(where.id != null ? equipo : (opts.duplicado ?? null))),
      createQueryBuilder: jest.fn().mockReturnValue(qb),
    };
    const bitacora = { logToBitacora: jest.fn() };
    const registroTrackcam = { emitir: jest.fn() };
    const vacio = {} as never;
    const svc = new DispositivosService(
      repository as never,
      vacio,
      vacio,
      vacio,
      vacio,
      bitacora as never,
      tenant,
      vacio,
      registroTrackcam as never,
    );
    return { svc, qb, bitacora, registroTrackcam };
  };

  it('corrige aunque el equipo esté instalado o tenga historial: solo el número, con bitácora', async () => {
    const { svc, qb, bitacora, registroTrackcam } = servicio();
    const r = await svc.corregirNumeroSerie(1000436, dto, admin);
    expect(r.data).toEqual({ id: 1000436, nombre: '863269078504617', numeroSerieAnterior: '86326907850461' });
    // Solo NumeroSerie, y solo si nadie lo cambió en medio (no consulta instalaciones ni toca el IMEI).
    expect(qb.set).toHaveBeenCalledWith({ numeroSerie: '863269078504617' });
    expect(qb.where).toHaveBeenCalledWith('id = :id AND numeroSerie = :anterior', { id: 1000436, anterior: '86326907850461' });
    expect(bitacora.logToBitacora).toHaveBeenCalledWith(
      'Dispositivos',
      expect.stringContaining('de 86326907850461 a 863269078504617'),
      'UPDATE',
      { id: 1000436, campo: 'NumeroSerie', valorAnterior: '86326907850461', valorNuevo: '863269078504617', motivo: dto.motivo },
      3,
      expect.anything(),
      expect.anything(),
    );
    // Si es TrackCam, el gateway la vuelve a reconocer con el número nuevo.
    expect(registroTrackcam.emitir).toHaveBeenCalledWith(WebhookEvent.TRACKCAM_UPDATED, [1000436]);
  });

  it('número ya registrado en otro dispositivo → 409 sin escribir', async () => {
    const { svc, qb } = servicio({ duplicado: { id: '77' } });
    await expect(svc.corregirNumeroSerie(1000436, dto, admin)).rejects.toBeInstanceOf(ConflictException);
    expect(qb.execute).not.toHaveBeenCalled();
  });

  it('carrera con el índice único (1062) o el equipo cambió → 409', async () => {
    await expect(
      servicio({ updateError: { driverError: { errno: 1062 } } }).svc.corregirNumeroSerie(1000436, dto, admin),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(servicio({ affected: 0 }).svc.corregirNumeroSerie(1000436, dto, admin)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('sin motivo, motivo corto, vacío o igual al actual → 400', async () => {
    const { svc, qb } = servicio();
    await expect(svc.corregirNumeroSerie(1, { ...dto, motivo: '' }, admin)).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.corregirNumeroSerie(1, { ...dto, motivo: 'error    ' }, admin)).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.corregirNumeroSerie(1, { ...dto, numeroSerie: '  ' }, admin)).rejects.toBeInstanceOf(BadRequestException);
    await expect(svc.corregirNumeroSerie(1, { ...dto, numeroSerie: '86326907850461' }, admin)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(qb.execute).not.toHaveBeenCalled();
  });

  it('el DTO exige motivo de 10 caracteres', async () => {
    const errores = await validate(plainToInstance(CorregirNumeroSerieDto, { numeroSerie: 'ABC', motivo: 'corto' }));
    expect(errores.map((e) => e.property)).toEqual(['motivo']);
  });

  it('inexistente o de otro cliente → 404', async () => {
    await expect(servicio({ equipo: null }).svc.corregirNumeroSerie(1, dto, admin)).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      servicio({ equipo: { id: '5', numeroSerie: 'X', idCliente: 99 } }).svc.corregirNumeroSerie(5, dto, operadorCliente10),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('solo roles 1–4: rol 5 o mayor → 403', () => {
    const roles = Reflect.getMetadata(ROLES_KEY, DispositivosController.prototype.corregirNumeroSerie);
    expect(roles).toEqual([1, 2, 3, 4]);
    const guard = new RolesGuard(new Reflector());
    const ctx = (rol: number) =>
      ({
        getHandler: () => DispositivosController.prototype.corregirNumeroSerie,
        getClass: () => DispositivosController,
        switchToHttp: () => ({ getRequest: () => ({ user: { rol } }) }),
      }) as never;
    expect(guard.canActivate(ctx(4))).toBe(true);
    let error: unknown;
    try {
      const ok = guard.canActivate(ctx(5));
      if (ok === false) error = new ForbiddenException();
    } catch (e) {
      error = e;
    }
    expect(error).toBeInstanceOf(ForbiddenException);
  });
});
