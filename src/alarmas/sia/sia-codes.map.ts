const ETIQUETAS_TIPO_EVENTO: Record<string, string> = {
  intrusion: 'Intrusión',
  panico: 'Pánico',
  panico_asalto: 'Pánico asalto',
  desarmado: 'Desarmado',
  armado_total: 'Armado total',
  armado_casa: 'Armado en casa',
  sabotaje: 'Sabotaje',
  perdida_conexion: 'Pérdida de conexión del componente',
  restauracion_conexion: 'Restauración de conexión del componente',
  desconocido: 'Desconocido',
};

export function etiquetaTipoEvento(tipoEvento: string | null | undefined): string {
  if (!tipoEvento) {
    return 'Desconocido';
  }
  return ETIQUETAS_TIPO_EVENTO[tipoEvento] ?? tipoEvento.replace(/_/g, ' ');
}
