/**
 * Alcance por asignación (F5, roles 7/9) para los reportes.
 *
 * `asignadas` viene de `TenantFilterService.idsInstalacionAsignadas`:
 * `'all'` = el rol no se limita por asignación (ya se filtra por cliente).
 *
 * `idsFiltro` sigue la convención de `resolverIdsInstalacionPorFiltro`:
 * `null` = sin filtro (todas las del cliente), `[]` = filtro sin coincidencias.
 *
 * - Sin filtro → solo las asignadas (lista vacía si no tiene ninguna).
 * - Con filtro → la intersección; las no asignadas se excluyen en silencio,
 *   igual que un IMEI/placa que no es del cliente.
 */
export function limitarIdsInstalacionPorAsignacion(
  asignadas: 'all' | number[],
  idsFiltro: number[] | null,
): number[] | null {
  if (asignadas === 'all') return idsFiltro;
  if (idsFiltro === null) return [...new Set(asignadas)];
  const set = new Set(asignadas);
  return idsFiltro.filter((id) => set.has(id));
}
