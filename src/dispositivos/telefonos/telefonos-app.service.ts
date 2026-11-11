import { BadRequestException, ConflictException, HttpException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Dispositivos } from 'src/entities/Dispositivos';
import { EnumRoles, EnumTipoDispositivo } from 'src/common/estatus.enum';
import { TenantFilterService, type UsuarioAlcance } from 'src/common/tenant-filter/tenant-filter.service';
import { TelefonoApp, TrackPhoneClient } from './trackphone.client';

/**
 * Alta de la app de rastreo en un teléfono (springTrackPhone). El
 * dispositivo tipo Teléfono (4) ya existe en Next con su cliente; aquí se
 * pide el código de alta que se teclea en la app (8 caracteres, 24 h, un
 * solo uso). Con IMEI (los de la app 2.x) lo conserva; sin IMEI el socket
 * genera uno (`99…`) y se guarda en el dispositivo.
 */
/** Quien da de baja la app es quien la puede reactivar con un código nuevo. */
const ROLES_REACTIVAR: readonly number[] = [EnumRoles.SA, EnumRoles.DEV, EnumRoles.ADMIN];

@Injectable()
export class TelefonosAppService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantFilter: TenantFilterService,
    private readonly trackphone: TrackPhoneClient,
  ) {}

  private async telefono(alcance: UsuarioAlcance, idDispositivo: number) {
    const disp = await this.dataSource.manager.findOne(Dispositivos, {
      where: { id: idDispositivo },
      select: { id: true, idCliente: true, idTipoDispositivo: true, imei: true, eco: true, numeroSerie: true },
    });
    if (!disp) throw new NotFoundException('Dispositivo no encontrado');
    await this.tenantFilter.assertClienteVisible(alcance, disp.idCliente, 'Dispositivo');
    if (Number(disp.idTipoDispositivo) !== EnumTipoDispositivo.TELEFONO) {
      throw new BadRequestException('El dispositivo no es un teléfono');
    }
    if (disp.idCliente == null) {
      throw new BadRequestException('Asigna el teléfono a un cliente antes de darlo de alta en la app');
    }
    return { ...disp, idCliente: Number(disp.idCliente) };
  }

  /** Estado del teléfono en el socket: activado, último reporte, modelo y versión de la app. */
  async estado(alcance: UsuarioAlcance, idDispositivo: number) {
    const disp = await this.telefono(alcance, idDispositivo);
    if (!disp.imei) return { status: 'success', data: null };
    try {
      const r = await this.trackphone.llamar<{ telefonos: TelefonoApp[] }>('telefono.consultar', disp.idCliente, { imei: disp.imei });
      return { status: 'success', data: r.telefonos[0] ?? null };
    } catch (error) {
      if (error instanceof HttpException && error.getStatus() === 404) return { status: 'success', data: null };
      throw error;
    }
  }

  /**
   * Código de alta (anula el anterior). Sirve para la primera instalación,
   * para la migración de la app 2.x y para cambiar de aparato. Si la app se
   * dio de baja, el código la reactiva, pero solo para quien puede darla de
   * baja (roles 1–3); a los demás, 409.
   */
  async codigoAlta(alcance: UsuarioAlcance, idDispositivo: number) {
    const disp = await this.telefono(alcance, idDispositivo);
    const etiqueta = disp.eco || disp.numeroSerie || null;
    let r: TelefonoApp;
    if (!disp.imei) {
      r = await this.trackphone.llamar('telefono.alta', disp.idCliente, { etiqueta });
      await this.dataSource.manager.update(Dispositivos, { id: disp.id }, { imei: r.imei });
    } else {
      try {
        const reactivar = ROLES_REACTIVAR.includes(Number(alcance.rol));
        r = await this.trackphone.llamar('telefono.codigo', disp.idCliente, { imei: disp.imei, reactivar });
      } catch (error) {
        if (error instanceof HttpException && error.getStatus() === 409) {
          throw new ConflictException('La app de este teléfono está dada de baja: solo administración (roles 1–3) la reactiva con un código nuevo');
        }
        if (!(error instanceof HttpException) || error.getStatus() !== 404) throw error;
        r = await this.trackphone.llamar('telefono.alta', disp.idCliente, { imei: disp.imei, etiqueta });
      }
    }
    return {
      status: 'success',
      message: 'Código de alta generado: se muestra una sola vez.',
      data: { imei: r.imei, codigo: r.codigo, venceAt: r.venceAt, estado: r.estado },
    };
  }

  /** La app deja de valer en ese teléfono al momento (robo, baja del empleado). */
  async baja(alcance: UsuarioAlcance, idDispositivo: number) {
    const disp = await this.telefono(alcance, idDispositivo);
    if (!disp.imei) throw new BadRequestException('El teléfono no tiene IMEI');
    const r = await this.trackphone.llamar('telefono.baja', disp.idCliente, { imei: disp.imei });
    return { status: 'success', message: 'La app del teléfono quedó dada de baja.', data: r };
  }
}
