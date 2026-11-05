import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOperator, In, Repository } from 'typeorm';
import { Clientes } from 'src/entities/Clientes';

/**
 * Roles con visualización global (sin filtro de IdCliente).
 * 1, 2, 3, 4, 5, 8
 */
const ROLES_SIN_FILTRO = new Set([1, 2, 3, 4, 5, 8]);

/*
 * Los demás roles (6, 7, 9…) ven su cliente y todos sus hijos (`spGetClientes`):
 * siempre se contemplan los clientes hijos del idCliente que pide el API
 * (decisión del 5/11/2026). Los 7/9 además se limitan a lo asignado.
 */

/**
 * Roles que, además de su cliente, solo ven las instalaciones asignadas en
 * `UsuariosInstalaciones` (operador 7 y usuario 9).
 */
const ROLES_POR_ASIGNACION = new Set([7, 9]);

/** Lo que el alcance necesita del usuario del token. */
export interface UsuarioAlcance {
  userId: number;
  idCliente: number;
  rol: number;
}

/** Resultado del fragmento SQL de tenant. */
export interface TenantFragment {
  /** Fragmento SQL para concatenar al WHERE (incluye AND). Vacío si no hay filtro. */
  sql: string;
  /** Parámetros del fragmento (para pasar al query como spread). */
  params: unknown[];
  /** true si el rol no tiene acceso (ids vacíos en jerarquía de clientes). */
  sinAcceso: boolean;
}

export type TenantListadoResult = TenantFragment | { forbidden: true };

export function isTenantForbidden(
  result: TenantListadoResult,
): result is { forbidden: true } {
  return 'forbidden' in result && result.forbidden === true;
}

@Injectable()
export class TenantFilterService {
  constructor(
    @InjectRepository(Clientes)
    private readonly clienteRepository: Repository<Clientes>,
  ) {}

  /**
   * Genera un fragmento SQL + params para filtrar por tenant según el rol.
   *
   * - Roles 1, 2, 3, 4, 5, 8 → sin filtro (ven todo).
   * - Cualquier otro rol (6, 7, 9…) → su cliente + hijos (`spGetClientes`).
   */
  async build(
    rol: number,
    idCliente: number,
    alias: string,
    columna: string = 'IdCliente',
  ): Promise<TenantFragment> {
    const rolNum = Number(rol);

    if (ROLES_SIN_FILTRO.has(rolNum)) {
      return { sql: '', params: [], sinAcceso: false };
    }

    const ids = await this.getClienteHijosIds(idCliente);
    if (ids.length === 0) {
      return { sql: ' AND 1 = 0 ', params: [], sinAcceso: true };
    }
    const placeholders = ids.map(() => '?').join(', ');
    return {
      sql: ` AND ${alias}.${columna} IN (${placeholders}) `,
      params: [...ids],
      sinAcceso: false,
    };
  }

  /**
   * Variante para queries donde el filtro es el WHERE principal (sin AND previo).
   */
  async buildWhere(
    rol: number,
    idCliente: number,
    alias: string,
    columna: string = 'IdCliente',
  ): Promise<TenantFragment> {
    const rolNum = Number(rol);

    if (ROLES_SIN_FILTRO.has(rolNum)) {
      return { sql: '', params: [], sinAcceso: false };
    }

    const ids = await this.getClienteHijosIds(idCliente);
    if (ids.length === 0) {
      return { sql: ' WHERE 1 = 0 ', params: [], sinAcceso: true };
    }
    const placeholders = ids.map(() => '?').join(', ');
    return {
      sql: ` WHERE ${alias}.${columna} IN (${placeholders}) `,
      params: [...ids],
      sinAcceso: false,
    };
  }

  /**
   * IDs del cliente raíz y descendientes (spGetClientes).
   */
  async getClienteHijosIds(idCliente: number): Promise<number[]> {
    const result = await this.clienteRepository.query(
      'CALL spGetClientes(?);',
      [idCliente],
    );
    const rows = result?.[0] ?? [];
    const ids: number[] = rows
      .map((row: { Id?: unknown; id?: unknown }) => Number(row.Id ?? row.id))
      .filter((id: number) => Number.isFinite(id) && id > 0);
    // El propio cliente siempre va, aunque el SP no lo regrese.
    const propio = Number(idCliente);
    return Number.isFinite(propio) && propio > 0 && !ids.includes(propio) ? [propio, ...ids] : ids;
  }

  /**
   * Alcance de clientes para listados REST/socket.
   * `'all'` = sin filtro (roles 1–5 y 8).
   */
  async idsClientePermitidos(
    rol: number,
    idClienteToken: number,
  ): Promise<'all' | number[]> {
    const rolNum = Number(rol);

    if (ROLES_SIN_FILTRO.has(rolNum)) {
      return 'all';
    }

    return this.getClienteHijosIds(idClienteToken);
  }

  /**
   * Aplica `?idCliente` sobre el alcance del rol: ese cliente y sus hijos
   * (`spGetClientes`) que estén en el alcance.
   * Si el query pide un cliente fuera del set → `{ forbidden: true }` (403).
   */
  async aplicarFiltroListado(
    scope: 'all' | number[],
    queryIdCliente: number | undefined,
    alias: string,
    columna: string = 'IdCliente',
  ): Promise<TenantListadoResult> {
    if (scope !== 'all' && scope.length === 0) {
      return { sql: ' AND 1 = 0 ', params: [], sinAcceso: true };
    }
    let ids: number[];
    if (queryIdCliente != null) {
      if (!this.clienteVisibleEnScope(scope, queryIdCliente)) {
        return { forbidden: true };
      }
      ids = (await this.getClienteHijosIds(Number(queryIdCliente))).filter((id) =>
        this.clienteVisibleEnScope(scope, id),
      );
    } else if (scope === 'all') {
      return { sql: '', params: [], sinAcceso: false };
    } else {
      ids = scope;
    }
    const placeholders = ids.map(() => '?').join(', ');
    return {
      sql: ` AND ${alias}.${columna} IN (${placeholders}) `,
      params: [...ids],
      sinAcceso: false,
    };
  }

  /** Fragmento del alcance ya resuelto, sin `?idCliente` (síncrono). */
  filtroAlcance(scope: 'all' | number[], alias: string, columna: string = 'IdCliente'): TenantFragment {
    if (scope === 'all') return { sql: '', params: [], sinAcceso: false };
    if (scope.length === 0) return { sql: ' AND 1 = 0 ', params: [], sinAcceso: true };
    return { sql: ` AND ${alias}.${columna} IN (${scope.map(() => '?').join(', ')}) `, params: [...scope], sinAcceso: false };
  }

  clienteVisibleEnScope(
    scope: 'all' | number[],
    idCliente: number | null | undefined,
  ): boolean {
    if (scope === 'all') {
      return true;
    }
    if (idCliente == null) {
      return false;
    }
    return scope.includes(Number(idCliente));
  }

  /**
   * Condición de `idCliente` para `repository.find` / `findAndCount`.
   * Roles 1–5 y 8: sin restricción. Rol 6: In(ids jerarquía). Rol 7 u otros: igual al token.
   */
  async forTypeOrmIdCliente(
    rol: number,
    idCliente: number,
  ): Promise<
    | { sinAcceso: true }
    | { sinAcceso: false; idCliente?: number | ReturnType<typeof In> }
  > {
    const rolNum = Number(rol);

    if (ROLES_SIN_FILTRO.has(rolNum)) {
      return { sinAcceso: false };
    }

    const ids = await this.getClienteHijosIds(idCliente);
    if (ids.length === 0) {
      return { sinAcceso: true };
    }
    return { sinAcceso: false, idCliente: In(ids) };
  }

  /**
   * `?idCliente` de un listado: ese cliente y sus hijos (`spGetClientes`), solo
   * los que están en el alcance del rol. `null` si el pedido queda fuera.
   */
  async clienteConHijosEnAlcance(
    rol: number,
    idClienteToken: number,
    idCliente: number,
  ): Promise<number | FindOperator<number> | null> {
    const scope = await this.idsClientePermitidos(rol, idClienteToken);
    if (!this.clienteVisibleEnScope(scope, idCliente)) return null;
    const familia = (await this.getClienteHijosIds(idCliente)).filter((id) =>
      this.clienteVisibleEnScope(scope, id),
    );
    return familia.length > 1 ? In(familia) : Number(idCliente);
  }

  // ---------------------------------------------------------------------------
  // Asserts de alcance por recurso (un solo lugar para "¿este usuario puede ver X?")
  // ---------------------------------------------------------------------------

  /** Rol que solo ve las instalaciones que tiene asignadas. */
  esPorAsignacion(rol: number): boolean {
    return ROLES_POR_ASIGNACION.has(Number(rol));
  }

  /**
   * El cliente está en el alcance del usuario; si no, 404 (no se revela que existe).
   */
  async assertClienteVisible(user: UsuarioAlcance, idCliente: number | null | undefined, que = 'Recurso'): Promise<void> {
    const scope = await this.idsClientePermitidos(user.rol, user.idCliente);
    if (!this.clienteVisibleEnScope(scope, idCliente)) {
      throw new NotFoundException(`${que} no encontrado`);
    }
  }

  /**
   * La instalación (vigente) existe y el usuario la puede ver: por cliente según
   * el rol y, para 7/9, además asignada a él. Devuelve sus datos básicos.
   */
  async assertInstalacionVisible(
    user: UsuarioAlcance,
    idInstalacion: number,
  ): Promise<{ id: number; idCliente: number; idProducto: number; idDispositivo: number | null }> {
    const [fila]: { id: string; idCliente: string; idProducto: string; idDispositivo: string | null }[] =
      await this.clienteRepository.query(
        'SELECT Id AS id, IdCliente AS idCliente, IdProducto AS idProducto, IdDispositivo AS idDispositivo FROM Instalaciones WHERE Id = ?',
        [idInstalacion],
      );
    if (!fila) throw new NotFoundException('Instalación no encontrada');
    await this.assertClienteVisible(user, Number(fila.idCliente), 'Instalación');
    if (this.esPorAsignacion(user.rol)) {
      const asignada = await this.clienteRepository.query(
        'SELECT 1 FROM UsuariosInstalaciones WHERE IdUsuario = ? AND IdInstalacion = ? AND Estatus = 1 LIMIT 1',
        [user.userId, idInstalacion],
      );
      if (!asignada.length) throw new NotFoundException('Instalación no encontrada');
    }
    return {
      id: Number(fila.id),
      idCliente: Number(fila.idCliente),
      idProducto: Number(fila.idProducto),
      idDispositivo: fila.idDispositivo == null ? null : Number(fila.idDispositivo),
    };
  }

  /**
   * Instalaciones a las que se limita un rol 7/9 (`'all'` para los demás, que se
   * filtran por cliente). Para listados y reportes.
   */
  async idsInstalacionAsignadas(user: UsuarioAlcance): Promise<'all' | number[]> {
    if (!this.esPorAsignacion(user.rol)) return 'all';
    const filas: { id: string }[] = await this.clienteRepository.query(
      'SELECT IdInstalacion AS id FROM UsuariosInstalaciones WHERE IdUsuario = ? AND Estatus = 1',
      [user.userId],
    );
    return filas.map((f) => Number(f.id));
  }

  /**
   * Cambiar el cliente padre: solo roles 1–3, el padre nuevo debe estar en su
   * alcance y no puede ser el mismo cliente ni uno de sus descendientes (ciclo).
   */
  async assertPadreValido(user: UsuarioAlcance, idCliente: number, idPadre: number | null): Promise<void> {
    if (![1, 2, 3].includes(Number(user.rol))) {
      throw new ForbiddenException('Solo administración puede cambiar el cliente padre');
    }
    if (idPadre == null) return;
    if (Number(idPadre) === Number(idCliente)) {
      throw new ForbiddenException('Un cliente no puede ser su propio padre');
    }
    const descendientes = await this.getClienteHijosIds(idCliente);
    if (descendientes.includes(Number(idPadre))) {
      throw new ForbiddenException('El padre no puede ser un cliente que depende de este (ciclo)');
    }
  }

  /**
   * Alta o cambio que deja un registro en `idCliente`: debe estar en el alcance
   * de quien escribe (403 si no; el cliente destino no es secreto, viene en el body).
   */
  async assertClienteDestino(user: UsuarioAlcance, idCliente: number | null | undefined): Promise<void> {
    if (idCliente == null) throw new ForbiddenException('Indica el cliente');
    const scope = await this.idsClientePermitidos(user.rol, user.idCliente);
    if (!this.clienteVisibleEnScope(scope, idCliente)) {
      throw new ForbiddenException('El cliente está fuera de tu alcance');
    }
  }
  /** Roles sin filtro de cliente (la operación): ven y usan el almacén. */
  esRolSinFiltro(rol: number): boolean {
    return ROLES_SIN_FILTRO.has(Number(rol));
  }

  /**
   * Alta o reserva de un equipo o SIM: con cliente, igual que assertClienteDestino;
   * sin cliente (almacén) solo los roles sin filtro de cliente (la operación).
   */
  async assertClienteDestinoOAlmacen(user: UsuarioAlcance, idCliente: number | null | undefined): Promise<void> {
    if (idCliente == null) {
      if (!ROLES_SIN_FILTRO.has(Number(user.rol))) {
        throw new ForbiddenException('Indica el cliente: solo operación da de alta en el almacén');
      }
      return;
    }
    await this.assertClienteDestino(user, idCliente);
  }

}
