const TZ_MEXICO = 'America/Mexico_City';

/**
 * Instantánea "ahora" como reloj de México (America/Mexico_City),
 * formateada para columnas MySQL DATETIME (sin zona).
 * Evita guardar UTC cuando el proceso/Node corre en UTC.
 */
export function nowMexicoCityMysql(): string {
  return formatInstantMexicoCityMysql(new Date());
}

function formatInstantMexicoCityMysql(instant: Date): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TZ_MEXICO,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(instant)
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

export function isoUtcToMexicoCityMysql(iso: string): string {
  const instant = new Date(iso);
  if (!Number.isFinite(instant.getTime())) {
    throw new Error(`Fecha ISO inválida: ${iso}`);
  }
  return formatInstantMexicoCityMysql(instant);
}

/**
 * Convierte ISO UTC (p. ej. del gateway AX PRO) a Date para MySQL DATETIME
 * con hora de pared en America/Mexico_City (misma convención que nowMexicoCityAsUtcDate).
 */
export function isoUtcToMexicoCityAsUtcDate(iso: string): Date {
  return new Date(isoUtcToMexicoCityMysql(iso).replace(' ', 'T') + 'Z');
}

/**
 * Date cuya representación UTC coincide con la hora de pared en México.
 * Útil si TypeORM serializa el Date en UTC hacia MySQL (DB_TZ = +00:00).
 */
export function nowMexicoCityAsUtcDate(): Date {
  return new Date(nowMexicoCityMysql().replace(' ', 'T') + 'Z');
}
