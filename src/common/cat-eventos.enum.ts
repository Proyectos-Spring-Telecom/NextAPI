/**
 * CatEventos Sion — valores de Posiciones.IdEvento / UltimaPosicion.IdEvento.
 * Alineado con springTrackCam `cat-evento.map.ts` (contrato AMQP JT808).
 */
export enum EnumCatEventos {
  IGNICION_ON = 1,
  IGNICION_OFF = 2,
  BATERIA_BAJA = 3,
  ENERGY_ALARM = 4,
  HELP_ME = 5,
  SPEED = 6,
  MOVE = 7,
  GEOCERCA = 8,
  TRANSMISION = 9,
  CAMERA = 10,
  OTROS = 11,
  /** ADAS 12–19 */
  ADAS_COLISION_FRONTAL = 12,
  ADAS_CARRIL = 13,
  ADAS_PEATON = 14,
  ADAS_DISTANCIA = 15,
  ADAS_FCW = 16,
  ADAS_LDWS = 17,
  ADAS_PCWS = 18,
  ADAS_HMW = 19,
  /** Sobrecupo (whitelist alarm: VIDEO_SOBRECUPO / ANORMAL_SOBRECUPO) */
  SOBRECUPO = 20,
  /**
   * DSM whitelist alarm → jt808.alarm.*
   * Fatiga=21, Celular=22, Fumar=23
   */
  DSM_FATIGA = 21,
  DSM_CELULAR = 22,
  DSM_FUMAR = 23,
  /** DSM otros (solo position; el gateway ya no publica alarm.*) */
  DSM_DISTRACCION = 24,
  DSM_BOSTEZO = 25,
  DSM_SIN_CONDUCTOR = 26,
  DSM_CINTURON = 27,
  DSM_MIRAR_ABAJO = 28,
  CONDUCCION_ANORMAL = 29,
  CONDUCCION_BRUSCA = 30,
}
