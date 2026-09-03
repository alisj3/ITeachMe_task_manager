import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../db";
import { requireAuth } from "../middleware/auth";
import { requireRole } from "../middleware/role";
import { dispatchEvent } from "../services/webhookDispatcher";

const router = Router();
router.use(requireAuth);

// Managers and admins can list team members
router.get("/", requireRole("ADMIN", "MANAGER"), async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, firstName: true, lastName: true, email: true, role: true, isActive: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });
  res.json({ users });
});

const createSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["ADMIN", "MANAGER", "EMPLOYEE"]).default("EMPLOYEE"),
});

router.post("/", requireRole("ADMIN"), async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { firstName, lastName, email, password, role } = parsed.data;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "Email already in use" });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { firstName, lastName, email, passwordHash, role },
  });

  await dispatchEvent("user.created", {
    user: { id: user.id, name: `${user.firstName} ${user.lastName}`, email: user.email, role: user.role },
  });

  res.status(201).json({
    user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role },
  });
});

const updateSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  role: z.enum(["ADMIN", "MANAGER", "EMPLOYEE"]).optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(8).optional(),
});

router.patch("/:id", requireRole("ADMIN"), async (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.password) {
    data.passwordHash = await bcrypt.hash(parsed.data.password, 10);
    delete data.password;
  }

  const user = await prisma.user.update({ where: { id: req.params.id }, data });

  await dispatchEvent("user.updated", {
    user: { id: user.id, name: `${user.firstName} ${user.lastName}`, email: user.email, role: user.role },
  });

  res.json({
    user: { id: user.id, firstName: user.firstName, lastName: user.lastName, email: user.email, role: user.role },
  });
});

router.delete("/:id", requireRole("ADMIN"), async (req, res) => {
  const user = await prisma.user.delete({ where: { id: req.params.id } });
  await dispatchEvent("user.deleted", { user: { id: user.id, email: user.email } });
  res.json({ ok: true });
});

export default router;
