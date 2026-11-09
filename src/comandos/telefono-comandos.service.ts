import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Dispositivos } from 'src/entities/Dispositivos';
import { Instalaciones } from 'src/entities/Instalaciones';
import { EnumTipoDispositivo, EstatusEnum } from 'src/common/estatus.enum';
import { TenantFilterService, type UsuarioAlcance } from 'src/common/tenant-filter/tenant-filter.service';
import { ComandosService } from './comandos.service';
import { comandoEstado, comandoIntervaloPhone, comandoSms, comandoUbicar, type ComandoPhone } from './comandos-phone';
import type { ComandoTelefonoDto } from './dto/comando-telefono.dto';

const PROTOCOLO = 'phone';

/**
 * Comandos a la app de rastreo de un teléfono instalado (springTrackPhone).
 * El teléfono los recibe en la respuesta de su siguiente reporte (a lo más
 * un intervalo) y confirma en el que sigue.
 */
@Injectable()
export class TelefonoComandosService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantFilter: TenantFilterService,
    private readonly comandos: ComandosService,
  ) {}

  /** Instalación activa de un teléfono, visible para el usuario. */
  private async instalacionTelefono(alcance: UsuarioAlcance, id: number) {
    await this.tenantFilter.assertInstalacionVisible(alcance, id);
    const inst = await this.dataSource.manager.findOne(Instalaciones, {
      where: { id, estatus: EstatusEnum.ACTIVO },
      select: { id: true, idDispositivo: true },
    });
    if (!inst || inst.idDispositivo == null) throw new NotFoundException('Instalación no encontrada');
    const disp = await this.dataSource.manager.findOne(Dispositivos, {
      where: { id: inst.idDispositivo },
      select: { id: true, idTipoDispositivo: true },
    });
    if (Number(disp?.idTipoDispositivo) !== EnumTipoDispositivo.TELEFONO) {
      throw new BadRequestException('La instalación no es de un teléfono');
    }
    return { idDispositivo: Number(inst.idDispositivo) };
  }

  async enviar(alcance: UsuarioAlcance, idInstalacion: number, dto: ComandoTelefonoDto) {
    let comando: ComandoPhone;
    switch (dto.tipo) {
      case 'INTERVALO':
        if (dto.intervaloSeg === undefined) throw new BadRequestException('INTERVALO requiere intervaloSeg');
        comando = comandoIntervaloPhone(dto.intervaloSeg);
        break;
      case 'UBICAR':
        comando = comandoUbicar();
        break;
      case 'ESTADO':
        comando = comandoEstado();
        break;
      case 'SMS':
        comando = comandoSms(dto.pin, dto.numeros);
        break;
      default:
        throw new BadRequestException('tipo inválido');
    }
    const { idDispositivo } = await this.instalacionTelefono(alcance, idInstalacion);
    const ids = await this.comandos.encolar({ idDispositivo, protocolo: PROTOCOLO, comandos: [comando], idUsuario: alcance.userId });
    await this.comandos.publicar(ids);
    return { status: 'success', message: 'Comando enviado; el teléfono lo recibe en su siguiente reporte.', data: { comandos: ids } };
  }

  async listarComandos(alcance: UsuarioAlcance, idInstalacion: number) {
    const { idDispositivo } = await this.instalacionTelefono(alcance, idInstalacion);
    return this.comandos.listar(idDispositivo);
  }
}
