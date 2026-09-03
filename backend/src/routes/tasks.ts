import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/role";
import { dispatchEvent } from "../services/webhookDispatcher";

const router = Router();
router.use(requireAuth);

function parseDate(input?: string): Date {
  const d = input ? new Date(input) : new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

const taskDetailInclude = {
  comments: {
    include: { author: { select: { id: true, firstName: true, lastName: true } } },
    orderBy: { createdAt: "asc" as const },
  },
  links: { orderBy: { createdAt: "asc" as const } },
};

// An employee may only touch their own tasks; managers/admins may touch any task.
async function canEditTask(req: import("express").Request, taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return { task: null, allowed: false };
  const allowed = task.userId === req.user!.userId || req.user!.role !== "EMPLOYEE";
  return { task, allowed };
}

async function taskWithEmployee(taskId: string) {
  const task = await prisma.task.findUniqueOrThrow({ where: { id: taskId }, include: { user: true } });
  return {
    task: {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      task_date: task.taskDate.toISOString().slice(0, 10),
    },
    employee: { id: task.user.id, name: `${task.user.firstName} ${task.user.lastName}` },
  };
}

// GET /api/tasks?date=YYYY-MM-DD  (defaults to today) — current user's tasks for that day
router.get("/", async (req, res) => {
  const date = parseDate(req.query.date as string | undefined);
  const tasks = await prisma.task.findMany({
    where: { userId: req.user!.userId, taskDate: date },
    include: taskDetailInclude,
    orderBy: { createdAt: "asc" },
  });
  res.json({ date: date.toISOString().slice(0, 10), tasks });
});

// GET /api/tasks/history — all of the current user's past tasks, most recent day first
router.get("/history", async (req, res) => {
  const tasks = await prisma.task.findMany({
    where: { userId: req.user!.userId },
    include: taskDetailInclude,
    orderBy: [{ taskDate: "desc" }, { createdAt: "asc" }],
  });
  res.json({ tasks });
});

// GET /api/tasks/team?date=YYYY-MM-DD — manager/admin view across the whole team
router.get("/team", requireRole("ADMIN", "MANAGER"), async (req, res) => {
  const date = parseDate(req.query.date as string | undefined);
  const tasks = await prisma.task.findMany({
    where: { taskDate: date },
    include: { user: { select: { id: true, firstName: true, lastName: true } }, ...taskDetailInclude },
    orderBy: { createdAt: "asc" },
  });
  res.json({ date: date.toISOString().slice(0, 10), tasks });
});

// GET /api/tasks/:id — full detail for one task (used to refresh the modal)
router.get("/:id", async (req, res) => {
  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
    include: { user: { select: { id: true, firstName: true, lastName: true } }, ...taskDetailInclude },
  });
  if (!task) return res.status(404).json({ error: "Not found" });
  if (task.userId !== req.user!.userId && req.user!.role === "EMPLOYEE") {
    return res.status(403).json({ error: "Forbidden" });
  }
  res.json({ task });
});

const createSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  task_date: z.string().optional(),
});

router.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const task = await prisma.task.create({
    data: {
      userId: req.user!.userId,
      title: parsed.data.title,
      description: parsed.data.description,
      priority: parsed.data.priority,
      taskDate: parseDate(parsed.data.task_date),
    },
  });

  await dispatchEvent("task.created", await taskWithEmployee(task.id));
  res.status(201).json({ task });
});

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["pending", "in_progress", "completed"]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
});

router.patch("/:id", async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.userId !== req.user!.userId && req.user!.role === "EMPLOYEE") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const wasCompleted = existing.status === "completed";
  const willBeCompleted = parsed.data.status === "completed";

  const task = await prisma.task.update({
    where: { id: req.params.id },
    data: {
      ...parsed.data,
      completedAt: willBeCompleted && !wasCompleted ? new Date() : existing.completedAt,
    },
  });

  await dispatchEvent("task.updated", await taskWithEmployee(task.id));
  if (willBeCompleted && !wasCompleted) {
    await dispatchEvent("task.completed", await taskWithEmployee(task.id));
  }

  res.json({ task });
});

router.delete("/:id", async (req, res) => {
  const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
  if (!existing) return res.status(404).json({ error: "Not found" });
  if (existing.userId !== req.user!.userId && req.user!.role === "EMPLOYEE") {
    return res.status(403).json({ error: "Forbidden" });
  }

  const info = await taskWithEmployee(existing.id);
  await prisma.task.delete({ where: { id: req.params.id } });
  await dispatchEvent("task.deleted", info);

  res.json({ ok: true });
});

// ---- Comments ----

const commentSchema = z.object({ body: z.string().min(1) });

router.post("/:id/comments", async (req, res) => {
  const parsed = commentSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { allowed } = await canEditTask(req, req.params.id);
  if (!allowed) return res.status(403).json({ error: "Forbidden" });

  const comment = await prisma.comment.create({
    data: { taskId: req.params.id, authorId: req.user!.userId, body: parsed.data.body },
    include: { author: { select: { id: true, firstName: true, lastName: true } } },
  });
  res.status(201).json({ comment });
});

router.delete("/:id/comments/:commentId", async (req, res) => {
  const { allowed } = await canEditTask(req, req.params.id);
  if (!allowed) return res.status(403).json({ error: "Forbidden" });

  await prisma.comment.delete({ where: { id: req.params.commentId } });
  res.json({ ok: true });
});

// ---- Links ----

const linkSchema = z.object({ url: z.string().url(), label: z.string().optional() });

router.post("/:id/links", async (req, res) => {
  const parsed = linkSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { allowed } = await canEditTask(req, req.params.id);
  if (!allowed) return res.status(403).json({ error: "Forbidden" });

  const link = await prisma.link.create({
    data: { taskId: req.params.id, url: parsed.data.url, label: parsed.data.label },
  });
  res.status(201).json({ link });
});

router.delete("/:id/links/:linkId", async (req, res) => {
  const { allowed } = await canEditTask(req, req.params.id);
  if (!allowed) return res.status(403).json({ error: "Forbidden" });

  await prisma.link.delete({ where: { id: req.params.linkId } });
  res.json({ ok: true });
});

export default router;
