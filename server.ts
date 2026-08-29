/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { applySupabaseEnvFromFiles, describeSupabaseEnvPresence } from "./src/lib/supabaseEnvFiles";
import { CANONICAL_SUPABASE_URL, CANONICAL_SUPABASE_PUBLISHABLE_KEY } from "./src/lib/supabaseProject";

const projectRoot = process.cwd();
dotenv.config({ path: path.join(projectRoot, ".env.local") });
dotenv.config({ path: path.join(projectRoot, ".env") });
const supabaseEnv = applySupabaseEnvFromFiles(
  projectRoot,
  process.env.NODE_ENV === "production" ? "production" : "development"
);

const app = express();
const PORT = 3000;

// Security headers middleware
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  res.removeHeader("X-Powered-By");
  next();
});

app.use(express.json({ limit: "100kb" }));

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err && (err.type === "entity.too.large" || err.status === 413)) {
    return res.status(413).json({ error: "Tamanho do conteúdo excede o limite permitido." });
  }
  next(err);
});

app.use((req, res, next) => {
  if (req.path.startsWith("/api")) {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      console.log(`[API LOG] ${req.method} ${req.path} | Status: ${res.statusCode} | ${duration}ms`);
    });
  }
  next();
});

// Public Health Check. Gemini AI lives in Supabase Edge Functions (onda 5).
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Publishable key only — same class of secret as VITE_* in the browser bundle.
app.get("/api/public-config", (_req, res) => {
  const url = (process.env.VITE_SUPABASE_URL || CANONICAL_SUPABASE_URL).trim();
  const key = (
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    CANONICAL_SUPABASE_PUBLISHABLE_KEY ||
    ""
  ).trim();
  res.json({
    supabaseUrl: url || null,
    supabasePublishableKey: key && !key.includes("xxxxxxxx") ? key : null
  });
});

async function setupVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      root: projectRoot,
      envDir: projectRoot,
      envPrefix: "VITE_",
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development middleware mounted successfully.");
    console.log(describeSupabaseEnvPresence(supabaseEnv.url, supabaseEnv.key));
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Serving compiled static assets in production mode.");
    console.log(describeSupabaseEnvPresence(supabaseEnv.url, supabaseEnv.key));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express server running on http://localhost:${PORT}`);
  });
}

setupVite().catch((err) => {
  console.error("Failed to start server:", err);
});
