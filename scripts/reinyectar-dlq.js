#!/usr/bin/env node
/**
 * Reinyecta mensajes de una DLQ a su routing key original (header
 * x-original-routing-key) en el exchange `telemetry`, solo los que cayeron por
 * un motivo dado (header x-death-reason). Los demás se devuelven al final de la
 * DLQ sin cambios. La ingesta es idempotente por eventId: repetir no duplica.
 *
 * Uso (en el directorio de NextAPI, con su .env):
 *   node scripts/reinyectar-dlq.js --motivo "Unknown column" [--cola telemetry.avl.dlq] [--prueba]
 *
 * --prueba solo cuenta lo que haría.
 */
const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env') });
const amqp = require('amqplib');

function arg(nombre, porDefecto) {
  const i = process.argv.indexOf(`--${nombre}`);
  if (i === -1) return porDefecto;
  const v = process.argv[i + 1];
  return v && !v.startsWith('--') ? v : true;
}

async function main() {
  const motivo = arg('motivo', null);
  if (!motivo || motivo === true) {
    console.error('Falta --motivo "<texto del x-death-reason>"');
    process.exit(2);
  }
  const cola = arg('cola', 'telemetry.avl.dlq');
  const prueba = arg('prueba', false) === true;
  const e = process.env;
  const url =
    `amqp://${encodeURIComponent(e.RABBITMQ_USERNAME || 'backend')}:${encodeURIComponent(e.RABBITMQ_PASSWORD || '')}` +
    `@${e.RABBITMQ_HOST || '127.0.0.1'}:${e.RABBITMQ_PORT || 5672}/${encodeURIComponent(e.RABBITMQ_VHOST || '/')}`;
  const exchange = e.RABBITMQ_EXCHANGE || 'telemetry';
  const dlx = e.RABBITMQ_DLX || 'telemetry.dlx';

  const conn = await amqp.connect(url);
  const ch = await conn.createConfirmChannel();
  const { messageCount } = await ch.checkQueue(cola);
  console.log(`${cola}: ${messageCount} mensajes; motivo: "${motivo}"${prueba ? ' (prueba)' : ''}`);

  let reinyectados = 0;
  let devueltos = 0;
  for (let n = 0; n < messageCount; n++) {
    const msg = await ch.get(cola, { noAck: false });
    if (!msg) break;
    const h = msg.properties.headers || {};
    const razon = String(h['x-death-reason'] ?? '');
    const rk = h['x-original-routing-key'];
    const coincide = razon.includes(motivo) && rk;
    if (prueba) {
      // Sin ack: al cerrar el canal todos regresan a la DLQ en su lugar.
      coincide ? reinyectados++ : devueltos++;
      continue;
    }
    const props = {
      contentType: msg.properties.contentType,
      contentEncoding: msg.properties.contentEncoding,
      deliveryMode: msg.properties.deliveryMode || 2,
      messageId: msg.properties.messageId,
    };
    if (coincide) {
      const headers = { ...h };
      delete headers['x-death-reason'];
      delete headers['x-original-routing-key'];
      delete headers['x-retry-count'];
      delete headers['x-death'];
      ch.publish(exchange, String(rk), msg.content, { ...props, headers });
      reinyectados++;
    } else {
      ch.publish(dlx, msg.fields.routingKey, msg.content, { ...props, headers: h });
      devueltos++;
    }
    await ch.waitForConfirms();
    ch.ack(msg);
  }
  await ch.close();
  await conn.close();
  console.log(`${prueba ? 'Se reinyectarían' : 'Reinyectados'}: ${reinyectados}. ${prueba ? 'Se quedarían' : 'Devueltos'} en la DLQ: ${devueltos}.`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
