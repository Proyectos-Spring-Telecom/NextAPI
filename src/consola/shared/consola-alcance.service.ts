import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { Instalaciones } from 'src/entities/Instalaciones';
import { UsuariosInstalaciones } from 'src/entities/UsuariosInstalaciones';
import { TrackcamConfig } from 'src/entities/TrackcamConfig';
import { TenantFilterService } from 'src/common/tenant-filter/tenant-filter.service';
import {
  EnumRoles,
  EnumTipoDispositivo,
  EstatusEnum,
} from 'src/common/estatus.enum';
import {
  applyPaginadoBaseJoins,
  applyPaginadoSelectBase,
  applyPaginadoTodosTiposProducto,
  mapInstalacionPaginadaPlana,
} from 'src/instalaciones/helpers/instalaciones-paginado.helpers';
import { TramosInstalacionService } from 'src/motor-activos/tramos-instalacion.service';
import { recortarTramos, type TramoEnPeriodo } from 'src/motor-activos/tramos-instalacion';
import {
  canalesActivosDesdeFila,
  etiquetaInstalacion,
} from '../galeria/consola-galeria.helpers';

/** Mensaje único: no revela si el IMEI existe en otro cliente. */
export const MSG_IMEI_NO_ENCONTRADO = 'IMEI no encontrado o sin acceso';

/**
 * Unidad activa resuelta por IMEI (alcance del token ya aplicado).
 * Compartida por Galería y Transmisiones.
 */
export type UnidadConsolaPorImei = {
  idInstalacion: number;
  imei: string;
  idCliente: number;
  nombreCliente: string | null;
  etiqueta: string;
  placas: string | null;
  economico: string | null;
  marca: string | null;
  modelo: string | null;
  anio: number | null;
  descripcion: string | null;
  idTipoDispositivo: number | null;
  nombreTipoDispositivo: string | null;
  /** Canales TrackCam activos (1..3); vacío en AVL u otros. */
  canalesActivos: number[];
};

export type UnidadImeiResuelta = {
  unidad: UnidadConsolaPorImei;
  idCliente: number;
  idDispositivo: number;
};

/**
 * Alcance de Consola por IMEI: misma resolución de unidad + tramos de
 * vigencia que usa la galería (roles, paneles, UsuariosInstalaciones).
 */
@Injectable()
export class ConsolaAlcanceService {
  constructor(
    @InjectRepository(Instalaciones)
    private readonly instalacionesRepo: Repository<Instalaciones>,
    private readonly tenantFilter: TenantFilterService,
    private readonly tramos: TramosInstalacionService,
  ) {}

  /** Roles que solo ven las unidades asignadas a ellos. */
  private esRolAsignado(rol: number): boolean {
    const r = Number(rol);
    return r === EnumRoles.OPERADOR || r === EnumRoles.USUARIO;
  }

  /**
   * Instalación activa con el IMEI, dentro del alcance del token.
   * Roles 7/9: solo unidades asignadas. Rol 6: clientes de la jerarquía.
   * Globales (1–5, 8): cualquier cliente. Null → no existe o sin acceso.
   */
  async resolverUnidadPorImei(
    imei: string,
    rol: number,
    idUsuarioToken: number,
    idClienteToken: number,
  ): Promise<UnidadImeiResuelta | null> {
    const qb = this.qbInstalacionesAlcance(rol, idUsuarioToken);
    const ok = await this.aplicarAlcanceClientes(qb, rol, idClienteToken);
    if (!ok) return null;

    qb.andWhere('CAST(d.imei AS CHAR) = :imei', { imei }).andWhere(
      'd.idTipoDispositivo <> :panel',
      { panel: EnumTipoDispositivo.PANEL_ALARMA },
    );

    const row = await qb.getRawOne<Record<string, unknown>>();
    if (!row) return null;

    const mapped = this.mapFilaUnidad(row);
    if (!mapped) return null;

    const plano = mapInstalacionPaginadaPlana(row) as Record<string, unknown>;
    const idDispositivo = Number(plano.idDispositivo);
    if (!Number.isFinite(idDispositivo) || idDispositivo < 1) return null;

    return {
      unidad: mapped.unidad,
      idCliente: mapped.unidad.idCliente,
      idDispositivo,
    };
  }

  /**
   * Todas las unidades activas con dispositivo dentro del alcance del token
   * (sin paneles). `idClienteFiltro` opcional: debe estar en el alcance; si no,
   * devuelve null (el que llama responde 403). Usado por Sin Transmisión.
   */
  async unidadesEnAlcance(
    rol: number,
    idUsuarioToken: number,
    idClienteToken: number,
    idClienteFiltro?: number | null,
  ): Promise<UnidadConsolaPorImei[] | null> {
    if (idClienteFiltro != null) {
      const scope = await this.tenantFilter.idsClientePermitidos(rol, idClienteToken);
      if (!this.tenantFilter.clienteVisibleEnScope(scope, idClienteFiltro)) {
        return null;
      }
    }

    const qb = this.qbInstalacionesAlcance(rol, idUsuarioToken);
    const ok = await this.aplicarAlcanceClientes(qb, rol, idClienteToken);
    if (!ok) return [];

    qb.andWhere('d.idTipoDispositivo <> :panel', {
      panel: EnumTipoDispositivo.PANEL_ALARMA,
    });
    if (idClienteFiltro != null) {
      qb.andWhere('i.idCliente = :idClienteFiltro', { idClienteFiltro });
    }
    qb.orderBy('i.id', 'ASC');

    const rows = await qb.getRawMany<Record<string, unknown>>();
    const unidades: UnidadConsolaPorImei[] = [];
    for (const row of rows) {
      const mapped = this.mapFilaUnidad(row);
      if (mapped) unidades.push(mapped.unidad);
    }
    return unidades;
  }

  /**
   * Tramos del IMEI en la instalación (docs/motor-activos.md §6), recortados a
   * `[inicio, fin]`: solo lo que el equipo transmitió mientras estuvo instalado
   * en ella, no con un cliente anterior ni en otra unidad.
   */
  async tramosImeiEnInstalacion(
    idInstalacion: number,
    imei: string,
    inicio: string,
    fin: string,
  ): Promise<TramoEnPeriodo[]> {
    const tramos = await this.tramos.tramosDeInstalacion(idInstalacion);
    return recortarTramos(
      tramos.filter((t) => t.imei === imei),
      inicio,
      fin,
    );
  }

  /**
   * Unidades activas con dispositivo (base de alcance por IMEI).
   * Roles 7 / 9: solo las asignadas al usuario del token.
   */
  private qbInstalacionesAlcance(
    rol: number,
    idUsuarioToken: number,
  ): SelectQueryBuilder<Instalaciones> {
    const qb = this.instalacionesRepo.createQueryBuilder('i');
    applyPaginadoBaseJoins(qb);
    applyPaginadoSelectBase(qb);
    applyPaginadoTodosTiposProducto(qb);
    // Canales TrackCam (galería los necesita; transmisiones los ignora).
    qb.leftJoin(
      TrackcamConfig,
      'tcGal',
      'tcGal.idDispositivo = d.id',
    )
      .addSelect('tcGal.canal1Activo', 'canal1Activo')
      .addSelect('tcGal.canal2Activo', 'canal2Activo')
      .addSelect('tcGal.canal3Activo', 'canal3Activo');
    qb.where('i.estatus = :activo', { activo: EstatusEnum.ACTIVO }).andWhere(
      'i.idDispositivo IS NOT NULL',
    );

    if (this.esRolAsignado(rol)) {
      qb.innerJoin(
        UsuariosInstalaciones,
        'uiTok',
        'uiTok.idInstalacion = i.id AND uiTok.idUsuario = :idUsuarioToken AND uiTok.estatus = :uiActivo',
        { idUsuarioToken, uiActivo: EstatusEnum.ACTIVO },
      );
    }
    return qb;
  }

  /** Fila cruda → unidad (null si no tiene IMEI o es panel). */
  private mapFilaUnidad(
    row: Record<string, unknown>,
  ): { unidad: UnidadConsolaPorImei } | null {
    const plano = mapInstalacionPaginadaPlana(row) as Record<string, unknown>;

    const imei =
      typeof plano.imeiDispositivo === 'string'
        ? plano.imeiDispositivo.trim()
        : '';
    const idTipoDispositivo =
      plano.idTipoDispositivo != null ? Number(plano.idTipoDispositivo) : null;
    if (!imei || idTipoDispositivo === EnumTipoDispositivo.PANEL_ALARMA) {
      return null;
    }

    const idCliente = Number(plano.idCliente ?? row.idCliente);
    const base = {
      imei,
      placas: (plano.placaVehiculo as string | null) ?? null,
      economico: (plano.ecoVehiculo as string | null) ?? null,
      descripcion: (plano.nombreProducto as string | null) ?? null,
    };

    return {
      unidad: {
        idInstalacion: Number(plano.id),
        idCliente,
        nombreCliente: (plano.nombreCliente as string | null) ?? null,
        etiqueta: etiquetaInstalacion(base),
        ...base,
        marca: (plano.nombreMarcaVehiculo as string | null) ?? null,
        modelo: (plano.nombreModeloVehiculo as string | null) ?? null,
        anio: plano.anioVehiculo != null ? Number(plano.anioVehiculo) : null,
        idTipoDispositivo,
        nombreTipoDispositivo:
          (plano.nombreTipoDispositivo as string | null) ?? null,
        canalesActivos:
          idTipoDispositivo === EnumTipoDispositivo.TRACKCAM
            ? canalesActivosDesdeFila(row)
            : [],
      },
    };
  }

  /**
   * Limita el query al alcance de clientes del rol
   * (1–5, 8: todos; 6: jerarquía; 7/9: el suyo).
   */
  private async aplicarAlcanceClientes(
    qb: SelectQueryBuilder<Instalaciones>,
    rol: number,
    idClienteToken: number,
  ): Promise<boolean> {
    const scope = await this.tenantFilter.idsClientePermitidos(
      rol,
      idClienteToken,
    );
    if (scope === 'all') return true;
    if (!scope.length) return false;
    qb.andWhere('i.idCliente IN (:...idsClienteScope)', {
      idsClienteScope: scope,
    });
    return true;
  }
}
