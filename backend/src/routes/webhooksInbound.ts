import { Router } from "express";
import { verifySignature, isTimestampFresh } from "../utils/hmac";

const router = Router();

/**
 * Inbound webhook receiver.
 *
 * External systems can POST events to these endpoints. Requests must be
 * signed the same way this app signs its own outbound webhooks:
 *   X-Webhook-Signature: HMAC-SHA256(secret, `${timestamp}.${rawBody}`)
 *   X-Webhook-Timestamp: unix seconds
 * using the shared secret in the WEBHOOK_SECRET environment variable.
 *
 * These endpoints only acknowledge receipt; wire up handling logic (e.g.
 * writing to the database) per event as your integration needs grow.
 */

function verifyInbound(req: import("express").Request, res: import("express").Response): boolean {
  const signature = req.header("X-Webhook-Signature");
  const timestamp = req.header("X-Webhook-Timestamp");
  const secret = process.env.WEBHOOK_SECRET;

  if (!secret) {
    res.status(500).json({ error: "Server is missing WEBHOOK_SECRET" });
    return false;
  }
  if (!signature || !timestamp) {
    res.status(401).json({ error: "Missing signature headers" });
    return false;
  }
  if (!isTimestampFresh(timestamp)) {
    res.status(401).json({ error: "Stale or invalid timestamp" });
    return false;
  }

  const rawBody = JSON.stringify(req.body ?? {});
  if (!verifySignature(secret, timestamp, rawBody, signature)) {
    res.status(401).json({ error: "Invalid signature" });
    return false;
  }
  return true;
}

const endpoints = [
  "task-created",
  "task-updated",
  "task-completed",
  "task-deleted",
  "user-created",
  "day-changed",
] as const;

for (const name of endpoints) {
  router.post(`/${name}`, (req, res) => {
    if (!verifyInbound(req, res)) return;
    console.log(`[inbound webhook] ${name}:`, JSON.stringify(req.body));
    res.status(200).json({ received: true });
  });
}

export default router;
