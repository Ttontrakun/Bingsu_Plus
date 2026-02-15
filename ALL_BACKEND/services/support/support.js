import express from "express";
import { prisma } from "../../shared/database/db.js";
import { authenticate, requireRole } from "../../shared/lib/auth.js";
import { getRequestContext } from "../../shared/lib/requestContext.js";
import { logEvent } from "../../shared/lib/logging.js";

export const supportRouter = express.Router();

supportRouter.get("/pending-users", authenticate, requireRole("support", "admin"), async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { approvalStatus: "pending", role: "user" },
    orderBy: { createdAt: "desc" },
  });
  res.json(users);
});

supportRouter.patch("/pending-users/:id", authenticate, requireRole("support", "admin"), async (req, res) => {
  const { approvalStatus } = req.body ?? {};
  if (!approvalStatus || !["approved", "rejected"].includes(approvalStatus)) {
    res.status(400).json({ error: "approvalStatus must be approved or rejected" });
    return;
  }
  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      approvalStatus,
      isActive: approvalStatus === "approved" ? true : undefined,
    },
  });
  await logEvent({
    event: "user.approval.updated",
    actorId: req.user.id,
    targetType: "user",
    targetId: updated.id,
    meta: { email: updated.email, name: updated.name, ...getRequestContext(req) },
  });
  res.json(updated);
});

supportRouter.get("/logs", authenticate, requireRole("support", "admin"), async (_req, res) => {
  const logs = await prisma.systemLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  res.json(logs);
});

supportRouter.get("/report", authenticate, requireRole("support", "admin"), async (_req, res) => {
  const [
    usersCount,
    documentsCount,
    conversationsCount,
    messagesCount,
    uploadBatchesCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.document.count(),
    prisma.conversation.count(),
    prisma.message.count(),
    prisma.uploadBatch.count(),
  ]);

  res.json({
    usersCount,
    documentsCount,
    conversationsCount,
    messagesCount,
    uploadBatchesCount,
    timestamp: new Date().toISOString(),
  });
});
