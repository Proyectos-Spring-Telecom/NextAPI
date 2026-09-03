export enum WebhookEvent {
  VEHICULO_CREATED = 'vehiculo.created',
  VEHICULO_UPDATED = 'vehiculo.updated',
  VEHICULO_DELETED = 'vehiculo.deleted',
  CLIENTE_CREATED = 'cliente.created',
  CLIENTE_UPDATED = 'cliente.updated',
  TRACKCAM_CREATED = 'trackcam.created',
  TRACKCAM_UPDATED = 'trackcam.updated',
}

/** Payload firmado (orden de claves fijo para HMAC compatible con Shift). */
export interface WebhookPayloadUnsigned {
  event: WebhookEvent;
  timestamp: string;
  tenantId: number;
  entityId: number;
  data: Record<string, unknown>;
}

export interface WebhookPayloadSigned extends WebhookPayloadUnsigned {
  signature: string;
}
