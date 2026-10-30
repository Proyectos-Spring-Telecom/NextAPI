import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Dispositivos } from 'src/entities/Dispositivos';
import { Sims } from 'src/entities/Sims';
import { Productos } from 'src/entities/Productos';
import { PanelAlarma } from 'src/entities/PanelAlarma';
import { CatEstatusRecurso } from 'src/entities/CatEstatusRecurso';
import { MovimientosRecurso } from 'src/entities/MovimientosRecurso';
import { nowMexicoCityAsUtcDate } from 'src/utils/datetime-mexico.util';
import {
  type AccionMovimiento,
  type OrigenMovimiento,
  type TipoRecurso,
  assertTransicionManual,
  EstatusRecurso,
  TRANSICIONES_MANUALES,
  ESTATUS_SALIDA_INSTALACION,
} from './estatus-recurso';

/** Quién y desde dónde: va a cada fila de MovimientosRecurso. */
export interface ContextoMovimiento {
  idUsuario: number | null;
  origen: OrigenMovimiento;
  idInstalacion?: number | null;
  idOrdenServicio?: number | null;
  motivo?: string | null;
}

export interface Movimiento {
  tipo: TipoRecurso;
  id: number;
  idCliente: number | null;
  /** Estatus que debe tener al momento de escribir; si cambió → 409. */
  esperado: number;
  nuevo: number;
  accion: AccionMovimiento;
}

const ENTIDAD = {
  dispositivo: Dispositivos,
  sim: Sims,
  producto: Productos,
} as const;

const ETIQUETA: Record<TipoRecurso, string> = {
  dispositivo: 'El dispositivo',
  sim: 'La SIM',
  producto: 'El producto',
};

/**
 * Registra un movimiento sin cambiar estatus (p. ej. el alta, que ya inserta el
 * recurso en 1). Exportada para los helpers de creación que no tienen DI.
 */
export async function registrarMovimiento(
  manager: EntityManager,
  fila: {
    tipo: TipoRecurso;
    id: number;
    accion: AccionMovimiento;
    estatusAnterior: number | null;
    estatusNuevo: number;
    idClienteAnterior: number | null;
    idClienteNuevo: number | null;
  },
  ctx: ContextoMovimiento,
): Promise<void> {
  await manager.insert(MovimientosRecurso, {
    tipoRecurso: fila.tipo,
    idRecurso: fila.id,
    fecha: nowMexicoCityAsUtcDate(),
    accion: fila.accion,
    estatusAnterior: fila.estatusAnterior,
    estatusNuevo: fila.estatusNuevo,
    idClienteAnterior: fila.idClienteAnterior,
    idClienteNuevo: fila.idClienteNuevo,
    idInstalacion: ctx.idInstalacion ?? null,
    idOrdenServicio: ctx.idOrdenServicio ?? null,
    motivo: ctx.motivo?.trim().slice(0, 500) || null,
    idUsuario: ctx.idUsuario,
    origen: ctx.origen,
  });
}

/**
 * Motor de activos (docs/motor-activos.md §5): único punto que cambia el
 * estatus de dispositivos, SIM y productos. Cada cambio es condicional al
 * estatus esperado (si otro proceso lo movió → 409) y deja su movimiento en
 * MovimientosRecurso dentro de la misma transacción.
 */
@Injectable()
export class MotorActivosService {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(MovimientosRecurso)
    private readonly movimientosRepo: Repository<MovimientosRecurso>,
    @InjectRepository(CatEstatusRecurso)
    private readonly catalogoRepo: Repository<CatEstatusRecurso>,
  ) {}

  /** Cambia el estatus dentro de la transacción del llamador. */
  async mover(manager: EntityManager, m: Movimiento, ctx: ContextoMovimiento): Promise<void> {
    const resultado = await manager
      .createQueryBuilder()
      .update(ENTIDAD[m.tipo])
      .set({ estatus: m.nuevo })
      .where('id = :id AND estatus = :esperado', { id: m.id, esperado: m.esperado })
      .execute();
    if (!resultado.affected) {
      const actual = await manager.findOne(ENTIDAD[m.tipo], { where: { id: m.id }, select: { id: true, estatus: true } });
      throw new ConflictException(
        actual
          ? `${ETIQUETA[m.tipo]} ${m.id} está en estatus ${actual.estatus} y se esperaba ${m.esperado}; ` +
              'pudo cambiar mientras se procesaba la operación. Vuelva a cargar e intente de nuevo.'
          : `${ETIQUETA[m.tipo]} ${m.id} no existe.`,
      );
    }
    if (m.tipo === 'dispositivo') {
      // PanelAlarma.Estatus = 1 es "panel dado de alta" para la ingesta SIA,
      // el heartbeat y los listados: instalado (2) sigue siendo 1 ahí.
      await manager.update(
        PanelAlarma,
        { idDispositivo: m.id },
        { estatus: m.nuevo === EstatusRecurso.INSTALADO ? EstatusRecurso.DISPONIBLE : m.nuevo },
      );
    }
    await registrarMovimiento(
      manager,
      {
        tipo: m.tipo,
        id: m.id,
        accion: m.accion,
        estatusAnterior: m.esperado,
        estatusNuevo: m.nuevo,
        idClienteAnterior: m.idCliente,
        idClienteNuevo: m.idCliente,
      },
      ctx,
    );
  }

  /**
   * `PATCH …/estatus/:id`: valida la transición (§1) y la aplica en su propia
   * transacción. El llamador ya validó el alcance del usuario.
   */
  async cambiarEstatusManual(
    tipo: TipoRecurso,
    recurso: { id: number; idCliente: number | null; estatus: number },
    nuevo: number,
    quien: { idUsuario: number; rol: number; motivo?: string | null },
  ): Promise<void> {
    assertTransicionManual(tipo, Number(recurso.estatus), Number(nuevo), quien);
    await this.dataSource.transaction((manager) =>
      this.mover(
        manager,
        {
          tipo,
          id: Number(recurso.id),
          idCliente: recurso.idCliente != null ? Number(recurso.idCliente) : null,
          esperado: Number(recurso.estatus),
          nuevo: Number(nuevo),
          accion: 'estatus',
        },
        { idUsuario: quien.idUsuario, origen: 'api', motivo: quien.motivo },
      ),
    );
  }

  /** Catálogo con las transiciones a mano y los destinos al salir de una instalación. */
  async catalogo() {
    const filas = await this.catalogoRepo.find({ order: { id: 'ASC' } });
    return {
      data: filas.map((f) => ({
        id: Number(f.id),
        codigo: f.codigo,
        nombre: f.nombre,
        descripcion: f.descripcion,
        transicionesManuales: [...(TRANSICIONES_MANUALES[Number(f.id)] ?? [])],
      })),
      salidaDeInstalacion: [...ESTATUS_SALIDA_INSTALACION],
    };
  }

  /** Historial de vida de un recurso, del más reciente al más antiguo. */
  async historial(tipo: TipoRecurso, id: number) {
    const filas = await this.movimientosRepo.find({
      where: { tipoRecurso: tipo, idRecurso: id },
      order: { fecha: 'DESC', id: 'DESC' },
    });
    return {
      data: filas.map((f) => ({
        id: Number(f.id),
        fecha: f.fecha,
        accion: f.accion,
        estatusAnterior: f.estatusAnterior != null ? Number(f.estatusAnterior) : null,
        estatusNuevo: Number(f.estatusNuevo),
        idClienteAnterior: f.idClienteAnterior != null ? Number(f.idClienteAnterior) : null,
        idClienteNuevo: f.idClienteNuevo != null ? Number(f.idClienteNuevo) : null,
        idInstalacion: f.idInstalacion != null ? Number(f.idInstalacion) : null,
        idOrdenServicio: f.idOrdenServicio != null ? Number(f.idOrdenServicio) : null,
        motivo: f.motivo,
        idUsuario: f.idUsuario != null ? Number(f.idUsuario) : null,
        origen: f.origen,
      })),
    };
  }
}

/**
 * Quita `estatus` de una entidad cargada antes de guardarla con `save()`:
 * TypeORM escribiría el valor leído al inicio de la petición y podría revertir
 * un movimiento del motor que se confirmó en medio. El estatus solo lo cambia el motor.
 */
export function sinEstatus<T extends { estatus?: unknown }>(entidad: T): T {
  delete entidad.estatus;
  return entidad;
}
