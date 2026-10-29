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
  /** Cámara: disparan la ráfaga de fotos y abren incidente (32–34). */
  COLISION = 32,
  VOLCADURA = 33,
  GNSS_FALLA_MODULO = 34,
  /**
   * Relojes FA100S y S18; el SOS usa HELP_ME y la batería baja BATERIA_BAJA.
   * En MySQL con deploy/sql/CatEventosRelojes.sql.
   */
  RELOJ_CAIDA = 35,
  RELOJ_PULSERA_RETIRADA = 36,
  RELOJ_RITMO_CARDIACO = 37,
  /** 38–39 combustible (TrackGas UL212; la cámara manda 39 con su bit 25). */
  COMBUSTIBLE_CARGA = 38,
  COMBUSTIBLE_DESCARGA = 39,
  /** 40–71 cámara: resto de códigos conocidos (deploy/sql/CatEventosExtension.sql). */
  GNSS_ANTENA_DESCONECTADA = 40,
  GNSS_ANTENA_CORTO = 41,
  ADVERTENCIA_PELIGRO = 42,
  FALLO_PANTALLA = 43,
  FALLO_TTS = 44,
  FALLO_CAMARA = 45,
  FALLO_TARJETA_IC = 46,
  VIDEO_PERDIDA_SENAL = 47,
  VIDEO_FALLO_ALMACENAMIENTO = 48,
  VIDEO_FALLO_DISPOSITIVO = 49,
  VIDEO_UMBRAL_MEMORIA = 50,
  BRUSCA_ACELERACION = 51,
  BRUSCA_FRENADO = 52,
  BRUSCA_GIRO = 53,
  RALENTI = 54,
  APAGADO_ANORMAL_MOTOR = 55,
  PUNTO_MUERTO = 56,
  SOBRE_REVOLUCIONES = 57,
  SIN_CUBREBOCAS = 58,
  CAPTURA_FACIAL = 59,
  BLOQUEO_IR_GAFAS = 60,
  CONDUCCION_EXCEDIDA = 61,
  ESTACIONAMIENTO_EXCEDIDO = 62,
  ENTRADA_SALIDA_AREA = 63,
  ENTRADA_SALIDA_RUTA = 64,
  TIEMPO_TRAMO = 65,
  DESVIO_RUTA = 66,
  FALLO_VSS = 67,
  ROBO_VEHICULO = 68,
  ENCENDIDO_ILEGAL = 69,
  DESPLAZAMIENTO_ILEGAL = 70,
  APERTURA_ILEGAL_PUERTA = 71,
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
  [EnumCatEventos.COLISION]: 'Colisión',
  [EnumCatEventos.VOLCADURA]: 'Volcadura',
  [EnumCatEventos.GNSS_FALLA_MODULO]: 'Falla del módulo GNSS',
  [EnumCatEventos.RELOJ_CAIDA]: 'Caída',
  [EnumCatEventos.RELOJ_PULSERA_RETIRADA]: 'Pulsera Retirada',
  [EnumCatEventos.RELOJ_RITMO_CARDIACO]: 'Ritmo Cardiaco Anormal',
  [EnumCatEventos.COMBUSTIBLE_CARGA]: 'Carga de combustible',
  [EnumCatEventos.COMBUSTIBLE_DESCARGA]: 'Descarga de combustible (posible robo)',
  [EnumCatEventos.GNSS_ANTENA_DESCONECTADA]: 'Antena GNSS desconectada',
  [EnumCatEventos.GNSS_ANTENA_CORTO]: 'Antena GNSS en cortocircuito',
  [EnumCatEventos.ADVERTENCIA_PELIGRO]: 'Advertencia de peligro',
  [EnumCatEventos.FALLO_PANTALLA]: 'Falla de pantalla',
  [EnumCatEventos.FALLO_TTS]: 'Falla del módulo de voz',
  [EnumCatEventos.FALLO_CAMARA]: 'Falla de cámara',
  [EnumCatEventos.FALLO_TARJETA_IC]: 'Falla del lector de tarjeta IC',
  [EnumCatEventos.VIDEO_PERDIDA_SENAL]: 'Video pérdida de señal',
  [EnumCatEventos.VIDEO_FALLO_ALMACENAMIENTO]: 'Video falla de almacenamiento',
  [EnumCatEventos.VIDEO_FALLO_DISPOSITIVO]: 'Video falla de dispositivo',
  [EnumCatEventos.VIDEO_UMBRAL_MEMORIA]: 'Video memoria de alarmas llena',
  [EnumCatEventos.BRUSCA_ACELERACION]: 'Aceleración brusca',
  [EnumCatEventos.BRUSCA_FRENADO]: 'Frenado brusco',
  [EnumCatEventos.BRUSCA_GIRO]: 'Giro brusco',
  [EnumCatEventos.RALENTI]: 'Ralentí prolongado',
  [EnumCatEventos.APAGADO_ANORMAL_MOTOR]: 'Apagado anormal del motor',
  [EnumCatEventos.PUNTO_MUERTO]: 'Punto muerto en marcha',
  [EnumCatEventos.SOBRE_REVOLUCIONES]: 'Sobrerrevolución del motor',
  [EnumCatEventos.SIN_CUBREBOCAS]: 'DSM Sin cubrebocas',
  [EnumCatEventos.CAPTURA_FACIAL]: 'DSM Captura facial',
  [EnumCatEventos.BLOQUEO_IR_GAFAS]: 'DSM Bloqueo infrarrojo (gafas)',
  [EnumCatEventos.CONDUCCION_EXCEDIDA]: 'Tiempo de conducción excedido',
  [EnumCatEventos.ESTACIONAMIENTO_EXCEDIDO]: 'Tiempo de estacionamiento excedido',
  [EnumCatEventos.ENTRADA_SALIDA_AREA]: 'Entrada o salida de área',
  [EnumCatEventos.ENTRADA_SALIDA_RUTA]: 'Entrada o salida de ruta',
  [EnumCatEventos.TIEMPO_TRAMO]: 'Tiempo de tramo fuera de rango',
  [EnumCatEventos.DESVIO_RUTA]: 'Desvío de ruta',
  [EnumCatEventos.FALLO_VSS]: 'Falla del sensor de velocidad',
  [EnumCatEventos.ROBO_VEHICULO]: 'Robo de vehículo',
  [EnumCatEventos.ENCENDIDO_ILEGAL]: 'Encendido ilegal',
  [EnumCatEventos.DESPLAZAMIENTO_ILEGAL]: 'Desplazamiento ilegal',
  [EnumCatEventos.APERTURA_ILEGAL_PUERTA]: 'Apertura ilegal de puerta',
};

export function nombreCatEvento(
  idEvento: number | null | undefined,
): string | null {
  if (idEvento == null || !Number.isFinite(idEvento)) {
    return null;
  }
  return CAT_EVENTOS_NOMBRE[idEvento as EnumCatEventos] ?? null;
}
