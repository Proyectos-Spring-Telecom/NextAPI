import { ConsumeMessage } from 'amqplib';

const RETRY_HEADER = 'x-retry-count';

export function getRetryCount(msg: ConsumeMessage): number {
  const raw = msg.properties.headers?.[RETRY_HEADER];
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

export function nextRetryHeaders(
  msg: ConsumeMessage,
): Record<string, unknown> {
  return {
    ...(msg.properties.headers ?? {}),
    [RETRY_HEADER]: getRetryCount(msg) + 1,
  };
}

export function extractEventId(msg: ConsumeMessage): string | null {
  const fromProp = msg.properties.messageId;
  if (fromProp) {
    return String(fromProp);
  }
  try {
    const body = JSON.parse(msg.content.toString('utf8')) as {
      eventId?: string;
    };
    return body.eventId ?? null;
  } catch {
    return null;
  }
}
