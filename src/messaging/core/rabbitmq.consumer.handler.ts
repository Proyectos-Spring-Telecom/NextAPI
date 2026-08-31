import { Channel, ConsumeMessage } from 'amqplib';
import { Logger } from '@nestjs/common';
import { isPermanentIngestError } from './ingest-errors.util';

export async function handleConsumerMessage(
  logger: Logger,
  msg: ConsumeMessage,
  channel: Channel,
  label: string,
  handler: () => Promise<void>,
): Promise<void> {
  try {
    await handler();
    channel.ack(msg);
  } catch (error) {
    const permanent = isPermanentIngestError(error);
    logger.error(
      `${label} falló (requeue=${!permanent}): ${(error as Error)?.message}`,
    );
    channel.nack(msg, false, !permanent);
  }
}
