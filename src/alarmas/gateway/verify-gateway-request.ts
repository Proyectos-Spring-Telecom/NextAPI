import { createHmac, timingSafeEqual } from 'crypto';

const MAX_SKEW_MS = 5 * 60 * 1000;

export function verifyGatewayRequest(opts: {
  secret: string;
  timestampHeader: string | null;
  signatureHeader: string | null;
  rawBody: string;
  apiKeyExpected?: string;
  apiKeyHeader?: string | null;
}): { ok: true } | { ok: false; status: number; error: string } {
  const { secret, timestampHeader, signatureHeader, rawBody } = opts;

  if (opts.apiKeyExpected) {
    if (!opts.apiKeyHeader || opts.apiKeyHeader !== opts.apiKeyExpected) {
      return { ok: false, status: 401, error: 'API key inválida' };
    }
  }

  if (!timestampHeader || !signatureHeader) {
    return { ok: false, status: 401, error: 'Faltan headers de gateway' };
  }

  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts) || Math.abs(Date.now() - ts) > MAX_SKEW_MS) {
    return { ok: false, status: 401, error: 'Timestamp inválido o expirado' };
  }

  const expected = createHmac('sha256', secret)
    .update(`${timestampHeader}.${rawBody}`)
    .digest('hex');

  const a = Buffer.from(signatureHeader, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, status: 401, error: 'Firma inválida' };
  }

  return { ok: true };
}
