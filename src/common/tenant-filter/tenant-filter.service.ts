import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Clientes } from 'src/entities/Clientes';

/**
 * Roles con visualización global (sin filtro de IdCliente).
 * 1, 2, 3, 4, 5, 8
 */
const ROLES_SIN_FILTRO = new Set([1, 2, 3, 4, 5, 8]);

/**
 * Rol que ve su cliente + hijos (spGetClientes / getClienteHijosIds).
 * 6
 */
const ROLES_CLIENTE_HIJOS = new Set([6]);

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
   * - Rol 6 → su cliente + hijos (`getClienteHijosIds` / `spGetClientes`).
   * - Rol 7 (y cualquier otro) → solo su `idCliente`.
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

    if (ROLES_CLIENTE_HIJOS.has(rolNum)) {
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

    return {
      sql: ` AND ${alias}.${columna} = ? `,
      params: [idCliente],
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

    if (ROLES_CLIENTE_HIJOS.has(rolNum)) {
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

    return {
      sql: ` WHERE ${alias}.${columna} = ? `,
      params: [idCliente],
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
    return rows
      .map((row: { Id?: unknown; id?: unknown }) => Number(row.Id ?? row.id))
      .filter((id: number) => Number.isFinite(id) && id > 0);
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

    if (ROLES_CLIENTE_HIJOS.has(rolNum)) {
      return this.getClienteHijosIds(idClienteToken);
    }

    const id = Number(idClienteToken);
    return Number.isFinite(id) && id > 0 ? [id] : [];
  }

  /**
   * Aplica `?idCliente` sobre el alcance del rol.
   * Si el query pide un cliente fuera del set → `{ forbidden: true }` (403).
   */
  aplicarFiltroListado(
    scope: 'all' | number[],
    queryIdCliente: number | undefined,
    alias: string,
    columna: string = 'IdCliente',
  ): TenantListadoResult {
    if (scope === 'all') {
      if (queryIdCliente != null) {
        return {
          sql: ` AND ${alias}.${columna} = ? `,
          params: [queryIdCliente],
          sinAcceso: false,
        };
      }
      return { sql: '', params: [], sinAcceso: false };
    }

    if (scope.length === 0) {
      return { sql: ' AND 1 = 0 ', params: [], sinAcceso: true };
    }

    if (queryIdCliente != null) {
      if (!scope.includes(Number(queryIdCliente))) {
        return { forbidden: true };
      }
      return {
        sql: ` AND ${alias}.${columna} = ? `,
        params: [queryIdCliente],
        sinAcceso: false,
      };
    }

    const placeholders = scope.map(() => '?').join(', ');
    return {
      sql: ` AND ${alias}.${columna} IN (${placeholders}) `,
      params: [...scope],
      sinAcceso: false,
    };
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

    if (ROLES_CLIENTE_HIJOS.has(rolNum)) {
      const ids = await this.getClienteHijosIds(idCliente);
      if (ids.length === 0) {
        return { sinAcceso: true };
      }
      return { sinAcceso: false, idCliente: In(ids) };
    }

    return { sinAcceso: false, idCliente };
  }
}
