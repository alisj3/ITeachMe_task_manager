import { prisma } from "../db";
import { signPayload } from "../utils/hmac";

/**
 * Simple in-process webhook dispatcher.
 *
 * Why no Redis/queue library:
 * This app runs as a single Railway service with modest traffic (an internal
 * team tool). An in-memory queue with setTimeout-based retries is enough to
 * decouple webhook delivery from the request/response cycle and to retry
 * failures with backoff, without adding an extra paid/self-hosted service.
 * The trade-off: if the process restarts mid-retry, in-flight retries are
 * lost (though the original attempt and its result are already persisted in
 * webhook_logs). For an internal tool this is an acceptable trade-off for
 * staying free/simple; if delivery guarantees ever become critical, swap
 * this module for a durable queue (e.g. Redis + BullMQ) without touching
 * the rest of the app.
 */

const MAX_ATTEMPTS = 3;
const BACKOFF_BASE_MS = 2000; // 2s, 4s, 8s...
const REQUEST_TIMEOUT_MS = 8000;

export type WebhookEvent =
  | "task.created"
  | "task.updated"
  | "task.completed"
  | "task.deleted"
  | "user.created"
  | "user.updated"
  | "user.deleted"
  | "day.started"
  | "day.ended";

export async function dispatchEvent(event: WebhookEvent, data: Record<string, unknown>) {
  const webhooks = await prisma.webhook.findMany({
    where: { isActive: true, events: { has: event } },
  });

  for (const webhook of webhooks) {
    const payload = {
      event,
      timestamp: new Date().toISOString(),
      ...data,
    };

    const log = await prisma.webhookLog.create({
      data: {
        webhookId: webhook.id,
        event,
        payload,
        success: false,
        attempts: 0,
      },
    });

    void attemptDelivery(webhook.id, webhook.url, webhook.secret, log.id, payload, 1);
  }
}

async function attemptDelivery(
  webhookId: string,
  url: string,
  secret: string,
  logId: string,
  payload: Record<string, unknown>,
  attempt: number
) {
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const signature = signPayload(secret, timestamp, body);

  let responseStatus: number | null = null;
  let responseBody: string | null = null;
  let success = false;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Webhook-Signature": signature,
        "X-Webhook-Event": String(payload.event),
        "X-Webhook-Timestamp": timestamp,
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timer);

    responseStatus = res.status;
    responseBody = (await res.text()).slice(0, 2000);
    success = res.status >= 200 && res.status < 300;
  } catch (err) {
    responseBody = err instanceof Error ? err.message : "Unknown error";
  }

  const isFinalAttempt = attempt >= MAX_ATTEMPTS;

  await prisma.webhookLog.update({
    where: { id: logId },
    data: {
      attempts: attempt,
      responseStatus: responseStatus ?? undefined,
      responseBody: responseBody ?? undefined,
      success,
      completedAt: success || isFinalAttempt ? new Date() : undefined,
    },
  });

  if (!success && !isFinalAttempt) {
    const delay = BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
    setTimeout(() => {
      void attemptDelivery(webhookId, url, secret, logId, payload, attempt + 1);
    }, delay);
  }
}

export async function testWebhook(webhookId: string) {
  const webhook = await prisma.webhook.findUniqueOrThrow({ where: { id: webhookId } });
  const payload = {
    event: "webhook.test",
    timestamp: new Date().toISOString(),
    message: "This is a test webhook delivery",
  };

  const log = await prisma.webhookLog.create({
    data: {
      webhookId: webhook.id,
      event: "webhook.test",
      payload,
      success: false,
      attempts: 0,
    },
  });

  await attemptDelivery(webhook.id, webhook.url, webhook.secret, log.id, payload, 1);
  return prisma.webhookLog.findUnique({ where: { id: log.id } });
}
