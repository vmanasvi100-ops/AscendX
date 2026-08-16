import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import { runMigrations } from "./backend/db/migrate.js";
import { startRetentionScheduler } from "./backend/lib/retention.js";
import consentRoutes from "./backend/routes/consent.js";
import sessionRoutes from "./backend/routes/sessions.js";
import flagRoutes from "./backend/routes/flags.js";
import analyticsRoutes from "./backend/routes/analyticsEvents.js";
import snapshotRoutes from "./backend/routes/snapshots.js";
import participantRoutes from "./backend/routes/participants.js";
import aiRoutes from "./backend/routes/ai.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' })); // CV + JD text can be large

  // ── Backend API routes ─────────────────────────────────────────────────────
  // These are mounted before Vite middleware so they are always intercepted first.
  // The frontend continues to work independently — these routes are additive only.

  app.use("/api/consent", consentRoutes);
  app.use("/api/sessions", sessionRoutes);
  app.use("/api/sessions", flagRoutes);   // /api/sessions/:sessionId/flags
  app.use("/api/analytics", analyticsRoutes);
  app.use("/api/snapshots", snapshotRoutes);
  app.use("/api/participants", participantRoutes);
  app.use("/api/ai", aiRoutes);

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    const distPath = path.resolve(__dirname, "dist");
    res.json({
      status: "ok",
      env: process.env.NODE_ENV,
      cwd: process.cwd(),
      distPath,
      distExists: fs.existsSync(distPath),
      indexExists: fs.existsSync(path.join(distPath, "index.html"))
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting in DEVELOPMENT mode");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting in PRODUCTION mode");
    const distPath = path.resolve(__dirname, "dist");
    
    // Serve static files
    app.use(express.static(distPath));
    
    // Fallback for SPA
    app.get("*", (_req, res) => {
      const indexPath = path.resolve(distPath, "index.html");
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        console.error(`Index file not found at ${indexPath}`);
        res.status(404).send("Application build not found. Please ensure 'npm run build' was successful.");
      }
    });
  }

  // ── Database setup ─────────────────────────────────────────────────────────
  // Run migrations and start retention scheduler only if DATABASE_URL is set.
  // If not set, the server starts normally — frontend continues to work as before.

  if (process.env.DATABASE_URL) {
    try {
      await runMigrations();
      startRetentionScheduler();
    } catch (err) {
      console.error("[DB] Startup failed — server will run without backend persistence:", err);
    }
  } else {
    console.warn("[DB] DATABASE_URL not set — backend API routes inactive. Frontend unaffected.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
