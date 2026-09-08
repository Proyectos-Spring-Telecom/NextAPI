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

/** Nombres de negocio CatEventos (UI / histórico monitoreo). */
export const CAT_EVENTOS_NOMBRE: Readonly<Record<EnumCatEventos, string>> = {
  [EnumCatEventos.IGNICION_ON]: 'Ignición On',
  [EnumCatEventos.IGNICION_OFF]: 'Ignición Off',
  [EnumCatEventos.BATERIA_BAJA]: 'Batería Baja',
  [EnumCatEventos.ENERGY_ALARM]: 'Alarma de Energía',
  [EnumCatEventos.HELP_ME]: 'Help Me',
  [EnumCatEventos.SPEED]: 'Exceso de Velocidad',
  [EnumCatEventos.MOVE]: 'Movimiento',
  [EnumCatEventos.GEOCERCA]: 'Geocerca',
  [EnumCatEventos.TRANSMISION]: 'Transmisión',
  [EnumCatEventos.CAMERA]: 'Cámara',
  [EnumCatEventos.OTROS]: 'Otros',
  [EnumCatEventos.ADAS_COLISION_FRONTAL]: 'ADAS Colisión Frontal',
  [EnumCatEventos.ADAS_CARRIL]: 'ADAS Carril',
  [EnumCatEventos.ADAS_PEATON]: 'ADAS Peatón',
  [EnumCatEventos.ADAS_DISTANCIA]: 'ADAS Distancia',
  [EnumCatEventos.ADAS_FCW]: 'ADAS FCW',
  [EnumCatEventos.ADAS_LDWS]: 'ADAS LDWS',
  [EnumCatEventos.ADAS_PCWS]: 'ADAS PCWS',
  [EnumCatEventos.ADAS_HMW]: 'ADAS HMW',
  [EnumCatEventos.SOBRECUPO]: 'Sobrecupo',
  [EnumCatEventos.DSM_FATIGA]: 'DSM Fatiga',
  [EnumCatEventos.DSM_CELULAR]: 'DSM Celular',
  [EnumCatEventos.DSM_FUMAR]: 'DSM Fumar',
  [EnumCatEventos.DSM_DISTRACCION]: 'DSM Distracción',
  [EnumCatEventos.DSM_BOSTEZO]: 'DSM Bostezo',
  [EnumCatEventos.DSM_SIN_CONDUCTOR]: 'DSM Sin Conductor',
  [EnumCatEventos.DSM_CINTURON]: 'DSM Cinturón',
  [EnumCatEventos.DSM_MIRAR_ABAJO]: 'DSM Mirar Abajo',
  [EnumCatEventos.CONDUCCION_ANORMAL]: 'Conducción Anormal',
  [EnumCatEventos.CONDUCCION_BRUSCA]: 'Conducción Brusca',
};

export function nombreCatEvento(
  idEvento: number | null | undefined,
): string | null {
  if (idEvento == null || !Number.isFinite(idEvento)) {
    return null;
  }
  return CAT_EVENTOS_NOMBRE[idEvento as EnumCatEventos] ?? null;
}
