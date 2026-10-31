import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { Instalaciones } from 'src/entities/Instalaciones';
import { ParametrosTrackCam } from 'src/entities/ParametrosTrackCam';
import { EstatusEnum } from 'src/common/estatus.enum';
import { TenantFilterService, type UsuarioAlcance } from 'src/common/tenant-filter/tenant-filter.service';
import { fechaPared, nowMexicoCityAsUtcDate } from 'src/utils/datetime-mexico.util';
import { ComandosService } from './comandos.service';
import {
  comandoLeerParametros,
  comandoParametros,
  hexParametro,
  NOMBRES_PARAMETROS_TRACKCAM,
  PARAMETROS_TRACKCAM,
  porNombre,
} from './comandos-jt808';
import type { ParametrosTrackCamDto } from './dto/parametros-trackcam.dto';

const PROTOCOLO = 'jt808';

/**
 * Parámetros de la TrackCam de una instalación (docs/motor-activos.md §8.5).
 * Next guarda lo que se pidió (`Deseado`) y la última lectura de la cámara
 * (`Leido`, la escribe la confirmación del gateway). Nada se manda solo: cada
 * envío lo pide alguien desde la consola.
 */
@Injectable()
export class TrackCamComandosService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly tenantFilter: TenantFilterService,
    private readonly comandos: ComandosService,
  ) {}

  /** Instalación activa de una TrackCam, visible para el usuario. */
  private async instalacionTrackCam(alcance: UsuarioAlcance, id: number, manager?: EntityManager) {
    await this.tenantFilter.assertInstalacionVisible(alcance, id);
    const inst = await (manager ?? this.dataSource.manager).findOne(Instalaciones, {
      where: { id, estatus: EstatusEnum.ACTIVO },
      select: { id: true, idCliente: true, idDispositivo: true, clase: true },
    });
    if (!inst) throw new NotFoundException('Instalación no encontrada');
    if (inst.clase !== 'TRACKCAM' || inst.idDispositivo == null) {
      throw new BadRequestException('La instalación no es de una TrackCam');
    }
    return inst;
  }

  /** Catálogo, lo pedido y lo que la cámara tiene, por parámetro. */
  async obtener(alcance: UsuarioAlcance, idInstalacion: number) {
    const inst = await this.instalacionTrackCam(alcance, idInstalacion);
    const fila = await this.dataSource.getRepository(ParametrosTrackCam).findOne({ where: { idDispositivo: inst.idDispositivo! } });
    const deseado = porNombre(fila?.deseado);
    const leido = porNombre(fila?.leido);
    return {
      data: {
        idDispositivo: Number(inst.idDispositivo),
        fechaLectura: fila?.fechaLectura ? fechaPared(new Date(fila.fechaLectura)) : null,
        fechaActualizacion: fila?.fechaActualizacion ? fechaPared(new Date(fila.fechaActualizacion)) : null,
        parametros: NOMBRES_PARAMETROS_TRACKCAM.map((nombre) => {
          const p = PARAMETROS_TRACKCAM[nombre];
          return {
            nombre,
            id: hexParametro(p.id),
            etiqueta: p.etiqueta,
            unidad: 'unidad' in p ? p.unidad : null,
            min: p.min,
            max: p.max,
            deseado: deseado[nombre] ?? null,
            leido: leido[nombre] ?? null,
            // Pedido y la cámara tiene otro valor (aún no llega, o la última lectura es anterior).
            pendiente: deseado[nombre] !== undefined && deseado[nombre] !== leido[nombre],
          };
        }),
      },
    };
  }

  /** Guarda como deseados los campos enviados y los manda en un solo PARAMS. */
  async aplicar(alcance: UsuarioAlcance, idInstalacion: number, dto: ParametrosTrackCamDto) {
    const valores = Object.fromEntries(NOMBRES_PARAMETROS_TRACKCAM.filter((n) => dto[n] !== undefined).map((n) => [n, dto[n]!]));
    const comando = comandoParametros(valores);
    const ids = await this.dataSource.transaction(async (manager) => {
      const inst = await this.instalacionTrackCam(alcance, idInstalacion, manager);
      const idDispositivo = Number(inst.idDispositivo);
      const repo = manager.getRepository(ParametrosTrackCam);
      // FOR UPDATE: dos cambios a la vez no se pisan el Deseado.
      const actual = await repo.findOne({ where: { idDispositivo }, lock: { mode: 'pessimistic_write' } });
      const deseado = { ...(actual?.deseado ?? {}) };
      for (const [nombre, v] of Object.entries(valores)) deseado[hexParametro(PARAMETROS_TRACKCAM[nombre as keyof typeof PARAMETROS_TRACKCAM].id)] = v;
      const cambios = { deseado, idUsuario: alcance.userId, fechaActualizacion: nowMexicoCityAsUtcDate() };
      if (actual) await repo.update({ idDispositivo }, cambios);
      else await repo.insert({ idDispositivo, ...cambios });
      return this.comandos.encolar({ idDispositivo, protocolo: PROTOCOLO, comandos: [comando], idUsuario: alcance.userId }, manager);
    });
    await this.comandos.publicar(ids);
    return { status: 'success', message: 'Parámetros guardados; se mandan a la cámara.', data: { comandos: ids } };
  }

  /** Pide a la cámara todos sus parámetros; la lectura llega con la confirmación. */
  async leer(alcance: UsuarioAlcance, idInstalacion: number) {
    const inst = await this.instalacionTrackCam(alcance, idInstalacion);
    const ids = await this.comandos.encolar({
      idDispositivo: Number(inst.idDispositivo),
      protocolo: PROTOCOLO,
      comandos: [comandoLeerParametros()],
      idUsuario: alcance.userId,
    });
    await this.comandos.publicar(ids);
    return { status: 'success', message: 'Lectura pedida a la cámara.', data: { comandos: ids } };
  }

  async listarComandos(alcance: UsuarioAlcance, idInstalacion: number) {
    const inst = await this.instalacionTrackCam(alcance, idInstalacion);
    return this.comandos.listar(Number(inst.idDispositivo));
  }
}
