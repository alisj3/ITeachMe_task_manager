import crypto from "crypto";

export function signPayload(secret: string, timestamp: string, body: string): string {
  return crypto.createHmac("sha256", secret).update(`${timestamp}.${body}`).digest("hex");
}

export function verifySignature(secret: string, timestamp: string, body: string, signature: string): boolean {
  const expected = signPayload(secret, timestamp, body);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

// Reject webhooks/requests whose timestamp is older than this to prevent replay attacks
export const MAX_TIMESTAMP_SKEW_SECONDS = 5 * 60;

export function isTimestampFresh(timestamp: string): boolean {
  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return Math.abs(nowSeconds - ts) <= MAX_TIMESTAMP_SKEW_SECONDS;
}
