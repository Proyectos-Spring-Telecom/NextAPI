const TZ_MEXICO = 'America/Mexico_City';

/**
 * Instantánea "ahora" como reloj de México (America/Mexico_City),
 * formateada para columnas MySQL DATETIME (sin zona).
 * Evita guardar UTC cuando el proceso/Node corre en UTC.
 */
export function nowMexicoCityMysql(): string {
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
      .formatToParts(new Date())
      .filter((p) => p.type !== 'literal')
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>;

  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}

/**
 * Date cuya representación UTC coincide con la hora de pared en México.
 * Útil si TypeORM serializa el Date en UTC hacia MySQL (DB_TZ = +00:00).
 */
export function nowMexicoCityAsUtcDate(): Date {
  return new Date(nowMexicoCityMysql().replace(' ', 'T') + 'Z');
}
