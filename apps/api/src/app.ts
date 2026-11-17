import fs from "node:fs";
import path from "node:path";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import pinoHttp from "pino-http";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  // KEEP THIS. One log line per request (status code + responseTime) is where the workspace's
  // Monitoring tab reads requests per second, error rate and response time from. Removing it,
  // or turning it off in production, empties those charts. Don't log bodies, cookies or
  // Authorization headers.
  app.use(pinoHttp());
  app.use(express.json());
  app.use(cookieParser());
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 300,
      standardHeaders: "draft-7",
      legacyHeaders: false,
      skip: (req) => req.path === "/api/health",
    }),
  );

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // In production, serve the built web client from the same process.
  const clientDist = path.resolve(process.cwd(), "../web/dist");
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.use((_req, res) => {
      res.sendFile(path.join(clientDist, "index.html"));
    });
  }

  return app;
}
