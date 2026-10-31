/** Labels de métricas/logs por cola de trabajo (claves de RabbitMqMetricsService). */
export const QUEUE_LABEL = {
  axproEvents: 'axpro:event',
  axproHeartbeats: 'axpro:heartbeat',
  avlEvents: 'avl:events',
  avlAlarms: 'avl:alarms',
  comandosAcks: 'comandos:acks',
} as const;
