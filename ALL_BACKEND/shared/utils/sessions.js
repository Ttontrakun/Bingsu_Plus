import crypto from "crypto";
import { prisma } from "../database/db.js";
import { sessionTtlDaysSafe } from "../config.js";

export const createSession = async (userId) => {
  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + sessionTtlDaysSafe * 24 * 60 * 60 * 1000);
  return prisma.session.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });
};

export const startSessionCleanup = () => {
  const cleanupIntervalMinutes = Number(process.env.CLEANUP_INTERVAL_MINUTES || 30);
  const cleanupIntervalMs = Number.isFinite(cleanupIntervalMinutes)
    ? cleanupIntervalMinutes * 60 * 1000
    : 30 * 60 * 1000;
  setInterval(async () => {
    try {
      await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    } catch (error) {
      console.error("Cleanup failed:", error);
    }
  }, cleanupIntervalMs);
};
