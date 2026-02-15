import express from "express";
import { prisma } from "../../shared/database/db.js";
import { qdrantUrl, redisUrl } from "../../shared/config.js";
import { isRedisReady } from "../../shared/redis.js";

export const healthRouter = express.Router();

const withTimeout = async (promise, ms) => {
  const timeoutMs = Number.isFinite(ms) ? ms : 0;
  if (!timeoutMs || timeoutMs <= 0) return promise;
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("Health check timed out")), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
};

const checkQdrant = async () => {
  if (!qdrantUrl) return { ok: false, error: "Missing QDRANT_URL" };
  try {
    const response = await withTimeout(fetch(`${qdrantUrl}/collections`), 1500);
    if (!response.ok) {
      const text = await response.text();
      return { ok: false, error: text || `HTTP ${response.status}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
};

healthRouter.get("/", async (_req, res) => {
  const health = {
    ok: true,
    database: { ok: false },
    redis: { ok: false, enabled: Boolean(redisUrl) },
    qdrant: { ok: false },
  };
  try {
    await prisma.$queryRaw`SELECT 1`;
    health.database.ok = true;
  } catch (error) {
    console.error("Database connection failed", error);
    health.ok = false;
    health.database = { ok: false, error: "Database connection failed" };
  }

  if (redisUrl) {
    health.redis.ok = isRedisReady();
  } else {
    health.redis.ok = true;
  }

  const qdrant = await checkQdrant();
  health.qdrant = qdrant;
  if (!health.redis.ok || !health.database.ok || !health.qdrant.ok) {
    health.ok = false;
  }

  res.status(health.ok ? 200 : 503).json(health);
});
