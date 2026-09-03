import "dotenv/config";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import cron from "node-cron";
import authRoutes from "./routes/auth";
import taskRoutes from "./routes/tasks";
import userRoutes from "./routes/users";
import webhookAdminRoutes from "./routes/webhookAdmin";
import webhooksInboundRoutes from "./routes/webhooksInbound";
import { dispatchEvent } from "./services/webhookDispatcher";

const requiredEnv = ["DATABASE_URL", "JWT_SECRET"];
for (const key of requiredEnv) {
  if (!process.env[key]) {
    console.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || true,
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/users", userRoutes);
app.use("/api/admin/webhooks", webhookAdminRoutes);
app.use("/api/webhooks", webhooksInboundRoutes);

// Serve the built frontend in production (single-service Railway deploy)
// Serve the built frontend in production (single-service Railway deploy)
if (process.env.NODE_ENV === "production") {
  const path = require("path");

  const frontendDist = path.join(process.cwd(), "../frontend/dist");

  console.log("Frontend directory:", frontendDist);

  app.use(express.static(frontendDist));

  app.get("*", (_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

// day.started / day.ended: fired once a day at midnight UTC.
// This does NOT move any tasks between days — task_date already determines
// which day a task belongs to. This is purely a notification hook for
// anything listening (e.g. a Slack digest, an analytics pipeline).
cron.schedule("0 0 * * *", async () => {
  const today = new Date().toISOString().slice(0, 10);
  await dispatchEvent("day.ended", { date_ended: today });
  await dispatchEvent("day.started", { date: today });
});

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
