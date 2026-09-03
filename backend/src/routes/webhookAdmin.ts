import { Router } from "express";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/role";
import { testWebhook } from "../services/webhookDispatcher";

const router = Router();
router.use(requireAuth, requireRole("ADMIN"));

const EVENTS = [
  "task.created",
  "task.updated",
  "task.completed",
  "task.deleted",
  "user.created",
  "user.updated",
  "user.deleted",
  "day.started",
  "day.ended",
] as const;

router.get("/", async (_req, res) => {
  const webhooks = await prisma.webhook.findMany({ orderBy: { createdAt: "desc" } });
  // secret is intentionally masked in list responses
  res.json({
    webhooks: webhooks.map((w: (typeof webhooks)[number]) => ({ ...w, secret: `${w.secret.slice(0, 6)}...` })),
  });
});

const createSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  events: z.array(z.enum(EVENTS)).min(1),
});

router.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const secret = crypto.randomBytes(32).toString("hex");
  const webhook = await prisma.webhook.create({
    data: { name: parsed.data.name, url: parsed.data.url, events: parsed.data.events, secret },
  });

  // secret shown in full only once, at creation
  res.status(201).json({ webhook });
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  url: z.string().url().optional(),
  events: z.array(z.enum(EVENTS)).min(1).optional(),
  isActive: z.boolean().optional(),
});

router.patch("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const webhook = await prisma.webhook.update({ where: { id: req.params.id }, data: parsed.data });
  res.json({ webhook: { ...webhook, secret: `${webhook.secret.slice(0, 6)}...` } });
});

router.post("/:id/rotate-secret", async (req, res) => {
  const secret = crypto.randomBytes(32).toString("hex");
  const webhook = await prisma.webhook.update({ where: { id: req.params.id }, data: { secret } });
  res.json({ webhook }); // full new secret returned once
});

router.delete("/:id", async (req, res) => {
  await prisma.webhook.delete({ where: { id: req.params.id } });
  res.json({ ok: true });
});

router.post("/:id/test", async (req, res) => {
  const log = await testWebhook(req.params.id);
  res.json({ log });
});

router.get("/:id/logs", async (req, res) => {
  const logs = await prisma.webhookLog.findMany({
    where: { webhookId: req.params.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  res.json({ logs });
});

router.get("/logs/all", async (_req, res) => {
  const logs = await prisma.webhookLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { webhook: { select: { name: true, url: true } } },
  });
  res.json({ logs });
});

export default router;
