/**
 * CatEventos Sion — valores de Posiciones.IdEvento / UltimaPosicion.IdEvento.
 * Referencia: Documentacion Sion.pdf, springTrackCam cat-evento.map.ts
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
  /** DSM 21–28 */
  DSM_FATIGA = 21,
  DSM_BOSTEZO = 22,
  DSM_CELULAR = 23,
  DSM_DISTRACCION = 24,
  DSM_FUMAR = 25,
  DSM_SIN_CONDUCTOR = 26,
  DSM_CINTURON = 27,
  DSM_MIRAR_ABAJO = 28,
  CONDUCCION_ANORMAL = 29,
  CONDUCCION_BRUSCA = 30,
}
