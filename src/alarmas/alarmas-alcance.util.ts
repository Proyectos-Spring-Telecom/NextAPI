import {
  TenantFilterService,
  UsuarioAlcance,
} from 'src/common/tenant-filter/tenant-filter.service';

type Query = (sql: string, params: unknown[]) => Promise<unknown[]>;

/**
 * Alcance por asignación (F5): un rol 7/9 solo ve los paneles instalados en
 * sus instalaciones asignadas (`UsuariosInstalaciones`) y vigentes
 * (`Instalaciones.Estatus = 1`, igual que el JOIN de los listados).
 * `PanelAlarma.IdDispositivo` = `Instalaciones.IdDispositivo` = `EventoAlarma.IdPanel`.
 * `'all'` = el rol no se limita por asignación (solo por cliente).
 */
export async function idsPanelesAsignados(
  tenantFilter: TenantFilterService,
  query: Query,
  user: UsuarioAlcance,
): Promise<'all' | number[]> {
  const asignadas = await tenantFilter.idsInstalacionAsignadas(user);
  if (asignadas === 'all') return 'all';
  if (!asignadas.length) return [];
  const placeholders = asignadas.map(() => '?').join(', ');
  const rows = (await query(
    `SELECT DISTINCT IdDispositivo AS id FROM Instalaciones
      WHERE Id IN (${placeholders}) AND Estatus = 1 AND IdDispositivo IS NOT NULL`,
    asignadas,
  )) as { id: unknown }[];
  return rows
    .map((r) => Number(r.id))
    .filter((id) => Number.isFinite(id) && id > 0);
}

/** Fragmento SQL (con AND) que limita `columna` a los paneles asignados. */
export function fragmentoPanelesAsignados(
  paneles: 'all' | number[],
  columna: string,
): { sql: string; params: unknown[] } {
  if (paneles === 'all') return { sql: '', params: [] };
  if (!paneles.length) return { sql: ' AND 1 = 0 ', params: [] };
  return {
    sql: ` AND ${columna} IN (${paneles.map(() => '?').join(', ')}) `,
    params: [...paneles],
  };
}

/** ¿El panel está en el alcance por asignación? */
export function panelVisiblePorAsignacion(
  paneles: 'all' | number[],
  idPanel: number | null | undefined,
): boolean {
  if (paneles === 'all') return true;
  return idPanel != null && paneles.includes(Number(idPanel));
}
