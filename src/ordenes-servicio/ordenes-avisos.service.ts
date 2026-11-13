import { Injectable, Logger, OnModuleDestroy, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrdenesServicio } from 'src/entities/OrdenesServicio';
import { MonitoreoGateway } from 'src/monitoreo/monitoreo.gateway';
import { nowMexicoCityAsUtcDate } from 'src/utils/datetime-mexico.util';
import { ROLES_ADMIN, ROLES_AUTORIZAN, ROLES_MONITOREO, ROLES_TURNO } from './ordenes-servicio.acceso';

/** Ven todas las órdenes (el técnico solo las suyas: le llega por su usuario). */
const ROLES_VEN_TODAS = [...ROLES_ADMIN, ...ROLES_MONITOREO];

export type AccionOrden =
  | 'creada'
  | 'programada'
  | 'reprogramada'
  | 'iniciada'
  | 'cerrada'
  | 'cancelada'
  | 'no_cumplida'
  | 'autorizacion';
export type AccionCodigo = 'pedido' | 'visto' | 'validado' | 'vencido' | 'agotado' | 'reiniciado';
export type AccionPrueba = 'pedida' | 'validada';
export type AccionAutorizacion = 'pedida' | 'decidida';

/** Margen tras la expiración antes de avisar `vencido` (la lista filtra por hora). */
const MARGEN_VENCIDO_MS = 2_000;

/**
 * Avisos por Socket.IO (namespace `/monitoreo`) de órdenes de servicio y de
 * lo pendiente de validar, para que Operación → Validaciones y el grid de
 * órdenes se actualicen solos. Solo avisa: el front vuelve a pedir la lista.
 *
 * - `ordenes:actualizacion` → administración y monitoreo (ven todas) y el
 *   técnico de la orden.
 * - `validaciones:codigo` / `validaciones:prueba` → ROLES_TURNO.
 * - `validaciones:autorizacion` → ROLES_AUTORIZAN.
 *
 * Nunca frena ni rompe la respuesta: se llama después de que la acción se
 * confirmó y cualquier error queda en el log.
 */
@Injectable()
export class OrdenesAvisosService implements OnModuleDestroy {
  private readonly logger = new Logger(OrdenesAvisosService.name);
  /** Un temporizador por orden para avisar cuando su código vence sin validarse. */
  private readonly vencimientos = new Map<number, NodeJS.Timeout>();

  constructor(
    @InjectRepository(OrdenesServicio)
    private readonly ordenesRepo: Repository<OrdenesServicio>,
    @Optional() private readonly gateway?: MonitoreoGateway,
  ) {}

  onModuleDestroy() {
    for (const t of this.vencimientos.values()) clearTimeout(t);
    this.vencimientos.clear();
  }

  /**
   * Espera la acción y, si salió bien, avisa con los ids de su respuesta
   * (`data.id` o `data[].id`) o con `idOrden` si se da.
   */
  async tras<T>(accion: Promise<T>, aviso: (ids: number[]) => void, idOrden?: number): Promise<T> {
    const resultado = await accion;
    try {
      const ids = idOrden != null ? [idOrden] : idsDeRespuesta(resultado);
      if (ids.length) aviso(ids);
    } catch (error) {
      this.logger.warn(`No se pudo avisar el cambio de orden: ${(error as Error)?.message}`);
    }
    return resultado;
  }

  orden(ids: number[], accion: AccionOrden): void {
    void this.cargar(ids).then((ordenes) => {
      for (const o of ordenes) {
        this.gateway?.emitPorRoles(
          'ordenes:actualizacion',
          {
            idOrden: Number(o.id),
            folio: o.folio,
            estatus: o.estatus,
            tipoServicio: o.tipoServicio,
            idCliente: o.idCliente != null ? Number(o.idCliente) : null,
            accion,
          },
          ROLES_VEN_TODAS,
          [Number(o.idTecnico)],
        );
        // Al cerrar, cancelar o no cumplir, lo pendiente de esa orden sale de Validaciones.
        if (accion === 'cerrada' || accion === 'cancelada' || accion === 'no_cumplida') {
          this.cancelarVencimiento(Number(o.id));
        }
      }
    });
  }

  codigo(ids: number[], accion: AccionCodigo): void {
    void this.cargar(ids).then((ordenes) => {
      for (const o of ordenes) {
        this.gateway?.emitPorRoles(
          'validaciones:codigo',
          { idOrden: Number(o.id), folio: o.folio, accion },
          ROLES_TURNO,
        );
        if (accion === 'pedido' || accion === 'reiniciado') this.programarVencimiento(o);
        else if (accion === 'validado' || accion === 'agotado') this.cancelarVencimiento(Number(o.id));
      }
    });
  }

  prueba(ids: number[], clave: string, accion: AccionPrueba): void {
    void this.cargar(ids).then((ordenes) => {
      for (const o of ordenes) {
        this.gateway?.emitPorRoles(
          'validaciones:prueba',
          { idOrden: Number(o.id), folio: o.folio, clave, accion, estatus: o.estatus },
          ROLES_TURNO,
        );
      }
    });
  }

  autorizacion(ids: number[], accion: AccionAutorizacion): void {
    void this.cargar(ids).then((ordenes) => {
      for (const o of ordenes) {
        this.gateway?.emitPorRoles(
          'validaciones:autorizacion',
          { idOrden: Number(o.id), folio: o.folio, accion, autorizacion: o.autorizacion ?? null },
          ROLES_AUTORIZAN,
        );
      }
    });
  }

  /**
   * El código vence por hora (no hay proceso que lo marque): al llegar
   * `codigoExpira` sin validarse, se avisa `vencido` para que salga de la
   * lista. Si el proceso se reinicia antes, la lista ya no lo trae al recargar.
   */
  private programarVencimiento(o: OrdenesServicio): void {
    const id = Number(o.id);
    this.cancelarVencimiento(id);
    if (!o.codigoExpira || o.fechaCodigoValidado) return;
    const espera = new Date(o.codigoExpira).getTime() - nowMexicoCityAsUtcDate().getTime() + MARGEN_VENCIDO_MS;
    if (!(espera > 0) || espera > 24 * 3_600_000) return;
    const t = setTimeout(() => {
      this.vencimientos.delete(id);
      void this.cargar([id]).then(([actual]) => {
        if (!actual || actual.fechaCodigoValidado) return;
        if (!actual.codigoExpira || new Date(actual.codigoExpira).getTime() > nowMexicoCityAsUtcDate().getTime()) return;
        this.gateway?.emitPorRoles(
          'validaciones:codigo',
          { idOrden: id, folio: actual.folio, accion: 'vencido' },
          ROLES_TURNO,
        );
      });
    }, espera);
    t.unref?.();
    this.vencimientos.set(id, t);
  }

  private cancelarVencimiento(id: number): void {
    const t = this.vencimientos.get(id);
    if (t) clearTimeout(t);
    this.vencimientos.delete(id);
  }

  private async cargar(ids: number[]): Promise<OrdenesServicio[]> {
    const validos = [...new Set(ids.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
    if (!validos.length || !this.gateway) return [];
    try {
      return await this.ordenesRepo.find({
        where: validos.map((id) => ({ id })),
        select: {
          id: true,
          folio: true,
          estatus: true,
          tipoServicio: true,
          idCliente: true,
          idTecnico: true,
          autorizacion: true,
          codigoExpira: true,
          fechaCodigoValidado: true,
        },
      });
    } catch (error) {
      this.logger.warn(`No se pudieron leer las órdenes ${validos.join(',')} para avisar: ${(error as Error)?.message}`);
      return [];
    }
  }
}

/** Ids de orden de una respuesta `{ data: { id } }` o `{ data: [{ id }] }`. */
export function idsDeRespuesta(resultado: unknown): number[] {
  const data = (resultado as { data?: unknown } | null)?.data;
  const filas = Array.isArray(data) ? data : data != null ? [data] : [];
  return filas
    .map((f) => Number((f as { id?: unknown } | null)?.id))
    .filter((id) => Number.isInteger(id) && id > 0);
}
