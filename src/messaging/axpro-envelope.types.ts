export type AxproTelemetryKind = 'event' | 'heartbeat';

export type AxproTelemetryEnvelope<T = AxproEventPayload | AxproHeartbeatPayload> =
  {
    eventId: string;
    protocol: 'axpro';
    kind: AxproTelemetryKind;
    deviceId: string;
    receivedAt: string;
    payload: T;
  };

export type AxproEventPayload = {
  codigoSia: string;
  tipoEvento: string;
  tipoEventoEtiqueta?: string;
  esRestauracion?: boolean;
  esHeartbeat?: boolean;
  zona?: number | null;
  particion?: number | null;
  codigoUsuario?: number | null;
  nombreDispositivo?: string | null;
  severidad: number;
  seq: string;
  frameCrudo?: string | null;
  dataDescifrada?: string | null;
  ipOrigen?: string | null;
  timestampPanel?: string | null;
  cifrado?: boolean;
  idDispositivo?: number | null;
  idCliente?: number | null;
};

export type AxproHeartbeatPayload = {
  ultimoHeartbeat: string;
  seq?: string;
  ipOrigen?: string | null;
  idDispositivo?: number | null;
  idCliente?: number | null;
};
