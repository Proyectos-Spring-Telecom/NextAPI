import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Clientes } from 'src/entities/Clientes';

/** Roles que ven todo sin filtro de cliente. */
const ROLES_SIN_FILTRO = new Set([1, 2]);

/** Roles que ven su cliente + hijos (spGetClientes). */
const ROLES_CLIENTE_HIJOS = new Set([3, 4]);

/** Resultado del fragmento SQL de tenant. */
export interface TenantFragment {
  /** Fragmento SQL para concatenar al WHERE (incluye AND). Vacío si no hay filtro. */
  sql: string;
  /** Parámetros del fragmento (para pasar al query como spread). */
  params: unknown[];
  /** true si el rol no tiene acceso (ids vacíos en jerarquía de clientes). */
  sinAcceso: boolean;
}

@Injectable()
export class TenantFilterService {
  constructor(
    @InjectRepository(Clientes)
    private readonly clienteRepository: Repository<Clientes>,
  ) {}

  /**
   * Genera un fragmento SQL + params para filtrar por tenant según el rol.
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
      .map((row: { Id?: unknown }) => Number(row.Id))
      .filter((id: number) => Number.isFinite(id) && id > 0);
  }

  /**
   * Condición de `idCliente` para `repository.find` / `findAndCount` (conserva relaciones).
   * Roles 1–2: sin restricción de cliente. 3–4: In(ids jerarquía). 5–6 y otros: igual al token.
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
