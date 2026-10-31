import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Instalaciones } from 'src/entities/Instalaciones';
import { NumerosEmergenciaReloj } from 'src/entities/NumerosEmergenciaReloj';
import { RelojConfig } from 'src/entities/RelojConfig';
import { EstatusEnum } from 'src/common/estatus.enum';
import { TenantFilterService, type UsuarioAlcance } from 'src/common/tenant-filter/tenant-filter.service';
import { nowMexicoCityAsUtcDate } from 'src/utils/datetime-mexico.util';
import { ComandosService } from './comandos.service';
import {
  comandoCaida,
  comandoCentro,
  comandoIntervalo,
  comandoSensibilidad,
  comandoSos,
  comandosAgenda,
  type ComandoFa100s,
} from './comandos-fa100s';
import type { NumerosEmergenciaRelojDto } from './dto/numeros-emergencia.dto';
import type { ConfiguracionRelojDto } from './dto/configuracion-reloj.dto';

const PROTOCOLO = 'fa100s';

/**
 * Números de emergencia y configuración del reloj FA100S de una instalación
 * (docs/motor-activos.md §8). Los números son de la persona (producto): se
 * guardan en Next y se mandan al reloj de su instalación activa. Nada se manda
 * solo: cada envío lo pide alguien desde el portal.
 */
@Injectable()
export class RelojComandosService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantFilter: TenantFilterService,
    private readonly comandos: ComandosService,
  ) {}

  /** Instalación activa de un reloj, visible para el usuario. */
  private async instalacionReloj(alcance: UsuarioAlcance, id: number, manager?: EntityManager) {
    await this.tenantFilter.assertInstalacionVisible(alcance, id);
    const inst = await (manager ?? this.dataSource.manager).findOne(Instalaciones, {
      where: { id, estatus: EstatusEnum.ACTIVO },
      select: { id: true, idCliente: true, idProducto: true, idDispositivo: true, clase: true },
    });
    if (!inst) throw new NotFoundException('Instalación no encontrada');
    if (inst.clase !== 'RELOJ' || inst.idDispositivo == null) {
      throw new BadRequestException('La instalación no es de un reloj');
    }
    return inst;
  }

  async obtenerNumeros(alcance: UsuarioAlcance, idInstalacion: number) {
    const inst = await this.instalacionReloj(alcance, idInstalacion);
    const filas = await this.dataSource.getRepository(NumerosEmergenciaReloj).find({
      where: { idProducto: inst.idProducto },
      order: { tipo: 'ASC', orden: 'ASC' },
    });
    return {
      data: {
        idProducto: Number(inst.idProducto),
        sos: (() => {
          // Con huecos: el número 2 sin el 1 se queda en el lugar 2.
          const sos = filas.filter((f) => f.tipo === 'sos');
          const lugares = Math.max(0, ...sos.map((f) => Number(f.orden)));
          return Array.from({ length: lugares }, (_, i) => sos.find((f) => Number(f.orden) === i + 1)?.telefono ?? '');
        })(),
        centro: filas.find((f) => f.tipo === 'centro')?.telefono ?? null,
        agenda: filas.filter((f) => f.tipo === 'agenda').map((f) => ({ nombre: f.nombre ?? '', telefono: f.telefono })),
      },
    };
  }

  /**
   * Reemplaza los números de la persona y los manda al reloj: SOS, centro (si
   * se envía) y la agenda en sus tres bloques. Solo se mandan las partes
   * incluidas en el cuerpo.
   */
  async guardarNumeros(alcance: UsuarioAlcance, idInstalacion: number, dto: NumerosEmergenciaRelojDto) {
    // Valida y arma los comandos antes de escribir nada.
    const comandos: ComandoFa100s[] = [];
    if (dto.sos !== undefined) comandos.push(comandoSos(dto.sos));
    if (dto.centro) comandos.push(comandoCentro(dto.centro));
    if (dto.agenda !== undefined) comandos.push(...comandosAgenda(dto.agenda));
    if (!comandos.length && dto.centro !== null) throw new BadRequestException('Envía sos, centro o agenda');

    const ids = await this.dataSource.transaction(async (manager) => {
      const inst = await this.instalacionReloj(alcance, idInstalacion, manager);
      const ahora = nowMexicoCityAsUtcDate();
      const base = { idCliente: Number(inst.idCliente), idProducto: Number(inst.idProducto), idUsuario: alcance.userId, fechaActualizacion: ahora };
      const reemplazar = async (tipo: string, filas: Array<{ nombre: string | null; telefono: string }>) => {
        await manager.delete(NumerosEmergenciaReloj, { idProducto: inst.idProducto, tipo });
        if (filas.length) {
          await manager.insert(
            NumerosEmergenciaReloj,
            filas.map((f, i) => ({ ...base, tipo, orden: i + 1, nombre: f.nombre, telefono: f.telefono.replace(/[\s-]/g, '') })),
          );
        }
      };
      if (dto.sos !== undefined) {
        // El lugar importa (el reloj marca en ese orden): se guarda la posición, con huecos.
        await manager.delete(NumerosEmergenciaReloj, { idProducto: inst.idProducto, tipo: 'sos' });
        const filas = dto.sos
          .map((t, i) => ({ orden: i + 1, telefono: String(t ?? '').replace(/[\s-]/g, '') }))
          .filter((f) => f.telefono);
        if (filas.length) {
          await manager.insert(NumerosEmergenciaReloj, filas.map((f) => ({ ...base, tipo: 'sos', orden: f.orden, nombre: null, telefono: f.telefono })));
        }
      }
      if (dto.centro !== undefined) await reemplazar('centro', dto.centro ? [{ nombre: null, telefono: dto.centro }] : []);
      if (dto.agenda !== undefined) await reemplazar('agenda', dto.agenda.map((c) => ({ nombre: c.nombre.trim(), telefono: c.telefono })));
      return this.comandos.encolar(
        { idDispositivo: Number(inst.idDispositivo), protocolo: PROTOCOLO, comandos, idUsuario: alcance.userId },
        manager,
      );
    });
    await this.comandos.publicar(ids);
    return { status: 'success', message: 'Números guardados; se mandan al reloj.', data: { comandos: ids } };
  }

  /**
   * Guarda en RelojConfig los campos enviados y manda al reloj solo esos
   * (UPLOAD, FALLDOWN, LSSET). La caída va completa: si llega uno de sus dos
   * campos, el otro sale de lo guardado.
   */
  async aplicarConfiguracion(alcance: UsuarioAlcance, idInstalacion: number, dto: ConfiguracionRelojDto) {
    if (
      dto.intervaloReporteSegundos === undefined &&
      dto.deteccionCaida === undefined &&
      dto.llamadaPorCaida === undefined &&
      dto.sensibilidadCaida === undefined
    ) {
      throw new BadRequestException('Envía al menos un campo de la configuración');
    }
    const ids = await this.dataSource.transaction(async (manager) => {
      const inst = await this.instalacionReloj(alcance, idInstalacion, manager);
      const idDispositivo = Number(inst.idDispositivo);
      const actual = await manager.findOne(RelojConfig, { where: { idDispositivo } });
      if (!actual) throw new BadRequestException('El reloj no tiene configuración (RelojConfig)');
      const comandos: ComandoFa100s[] = [];
      const cambios: Partial<RelojConfig> = {};
      if (dto.intervaloReporteSegundos !== undefined) {
        comandos.push(comandoIntervalo(dto.intervaloReporteSegundos));
        cambios.intervaloReporteSegundos = dto.intervaloReporteSegundos;
      }
      if (dto.deteccionCaida !== undefined || dto.llamadaPorCaida !== undefined) {
        const deteccion = dto.deteccionCaida ?? Number(actual.deteccionCaida) === 1;
        const llamada = dto.llamadaPorCaida ?? Number(actual.llamadaPorCaida) === 1;
        comandos.push(comandoCaida(deteccion, llamada));
        cambios.deteccionCaida = deteccion ? 1 : 0;
        cambios.llamadaPorCaida = llamada ? 1 : 0;
      }
      if (dto.sensibilidadCaida !== undefined) {
        comandos.push(comandoSensibilidad(dto.sensibilidadCaida));
        cambios.sensibilidadCaida = dto.sensibilidadCaida;
      }
      await manager.update(RelojConfig, { idDispositivo }, cambios);
      return this.comandos.encolar({ idDispositivo, protocolo: PROTOCOLO, comandos, idUsuario: alcance.userId }, manager);
    });
    await this.comandos.publicar(ids);
    return { status: 'success', message: 'Configuración guardada; se manda al reloj.', data: { comandos: ids } };
  }

  async listarComandos(alcance: UsuarioAlcance, idInstalacion: number) {
    const inst = await this.instalacionReloj(alcance, idInstalacion);
    return this.comandos.listar(Number(inst.idDispositivo));
  }
}
