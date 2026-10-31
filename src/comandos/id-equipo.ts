/**
 * Con qué id nombra Next al equipo en el comando (y con cuál lo reconoce en el
 * ack). La TrackCam se identifica por su número de serie (= terminal JT808);
 * los demás, por IMEI.
 */
export function idEquipoComando(protocolo: string, equipo: { imei?: string | number | null; numeroSerie?: string | null }): string {
  const id = protocolo === 'jt808' ? equipo.numeroSerie : equipo.imei;
  return String(id ?? '').trim();
}
