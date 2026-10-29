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
  PUERTA = 8,
  TRANSMISION = 9,
  CAMERA = 10,
  DISTANCIA = 11,
  /** ADAS 12–19 */
  ADAS_COLISION_FRONTAL = 12,
  ADAS_SALIDA_CARRIL = 13,
  ADAS_DISTANCIA_INSUFICIENTE = 14,
  ADAS_COLISION_PEATON = 15,
  ADAS_CAMBIOS_CARRIL_FRECUENTES = 16,
  ADAS_OBSTACULO = 17,
  ADAS_FALLO_SISTEMA = 18,
  ADAS_RECONOCIMIENTO_SENAL = 19,
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
  DSM_CONDUCTOR_AUSENTE = 25,
  DSM_SIN_CINTURON = 26,
  DSM_CAMARA_OBSTRUIDA = 27,
  DSM_CAMBIO_CONDUCTOR = 28,
  CONDUCCION_ANORMAL = 29,
  CONDUCCION_BRUSCA = 30,
  VIDEO_SENAL_ENMASCARADA = 31,
  /**
   * Relojes FA100S y S18; el SOS usa HELP_ME y la batería baja BATERIA_BAJA.
   * Faltan en CatEventos de MySQL: deploy/sql/CatEventosRelojes.sql.
   */
  RELOJ_CAIDA = 35,
  RELOJ_PULSERA_RETIRADA = 36,
  RELOJ_RITMO_CARDIACO = 37,
}

/**
 * Nombres de negocio CatEventos (UI / histórico monitoreo). Siguen la tabla
 * CatEventos de MySQL (28/10/2026) en español.
 */
export const CAT_EVENTOS_NOMBRE: Readonly<Record<EnumCatEventos, string>> = {
  [EnumCatEventos.IGNICION_ON]: 'Ignición On',
  [EnumCatEventos.IGNICION_OFF]: 'Ignición Off',
  [EnumCatEventos.BATERIA_BAJA]: 'Batería Baja',
  [EnumCatEventos.ENERGY_ALARM]: 'Alarma de Energía',
  [EnumCatEventos.HELP_ME]: 'Help Me',
  [EnumCatEventos.SPEED]: 'Exceso de Velocidad',
  [EnumCatEventos.MOVE]: 'Movimiento',
  [EnumCatEventos.PUERTA]: 'Puerta',
  [EnumCatEventos.TRANSMISION]: 'Transmisión',
  [EnumCatEventos.CAMERA]: 'Cámara',
  [EnumCatEventos.DISTANCIA]: 'Distancia',
  [EnumCatEventos.ADAS_COLISION_FRONTAL]: 'ADAS Colisión frontal',
  [EnumCatEventos.ADAS_SALIDA_CARRIL]: 'ADAS Salida de carril',
  [EnumCatEventos.ADAS_DISTANCIA_INSUFICIENTE]: 'ADAS Distancia insuficiente',
  [EnumCatEventos.ADAS_COLISION_PEATON]: 'ADAS Colisión peatón',
  [EnumCatEventos.ADAS_CAMBIOS_CARRIL_FRECUENTES]: 'ADAS Cambios carril frecuentes',
  [EnumCatEventos.ADAS_OBSTACULO]: 'ADAS Obstáculo',
  [EnumCatEventos.ADAS_FALLO_SISTEMA]: 'ADAS Fallo sistema',
  [EnumCatEventos.ADAS_RECONOCIMIENTO_SENAL]: 'ADAS Reconocimiento señal',
  [EnumCatEventos.SOBRECUPO]: 'Sobrecupo',
  [EnumCatEventos.DSM_FATIGA]: 'DSM Fatiga',
  [EnumCatEventos.DSM_CELULAR]: 'DSM Uso celular',
  [EnumCatEventos.DSM_FUMAR]: 'DSM Fumar',
  [EnumCatEventos.DSM_DISTRACCION]: 'DSM Distracción',
  [EnumCatEventos.DSM_CONDUCTOR_AUSENTE]: 'DSM Conductor ausente',
  [EnumCatEventos.DSM_SIN_CINTURON]: 'DSM Sin cinturón',
  [EnumCatEventos.DSM_CAMARA_OBSTRUIDA]: 'DSM Cámara obstruida',
  [EnumCatEventos.DSM_CAMBIO_CONDUCTOR]: 'DSM Cambio conductor',
  [EnumCatEventos.CONDUCCION_ANORMAL]: 'Conducción anormal',
  [EnumCatEventos.CONDUCCION_BRUSCA]: 'Conducción brusca',
  [EnumCatEventos.VIDEO_SENAL_ENMASCARADA]: 'Video señal enmascarada',
  [EnumCatEventos.RELOJ_CAIDA]: 'Caída',
  [EnumCatEventos.RELOJ_PULSERA_RETIRADA]: 'Pulsera Retirada',
  [EnumCatEventos.RELOJ_RITMO_CARDIACO]: 'Ritmo Cardiaco Anormal',
};

export function nombreCatEvento(
  idEvento: number | null | undefined,
): string | null {
  if (idEvento == null || !Number.isFinite(idEvento)) {
    return null;
  }
  return CAT_EVENTOS_NOMBRE[idEvento as EnumCatEventos] ?? null;
}
