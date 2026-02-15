import express from "express";
import { prisma } from "../../shared/database/db.js";
import { authenticate, requireAdmin, requireAdminMetrics, sanitizeUser } from "../../shared/lib/auth.js";
import { getRequestContext } from "../../shared/lib/requestContext.js";
import { logEvent } from "../../shared/lib/logging.js";
import { deleteBotWithCleanup } from "../../shared/utils/uploadQueue.js";
import { deleteDocumentVectors } from "../../shared/utils/qdrant.js";
import { invalidateUserCaches } from "../../shared/lib/cache.js";

export const adminRouter = express.Router();

adminRouter.get("/metrics", authenticate, requireAdminMetrics, async (_req, res) => {
  const [
    usersCount,
    documentsCount,
    conversationsCount,
    messagesCount,
    uploadBatchesCount,
    pendingUsersCount,
    botsCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.document.count(),
    prisma.conversation.count(),
    prisma.message.count(),
    prisma.uploadBatch.count(),
    prisma.user.count({ where: { approvalStatus: "pending", role: "user" } }),
    prisma.bot.count(),
  ]);

  res.json({
    usersCount,
    documentsCount,
    conversationsCount,
    messagesCount,
    uploadBatchesCount,
    pendingUsersCount,
    botsCount,
    timestamp: new Date().toISOString(),
  });
});

adminRouter.get("/users", authenticate, requireAdmin, async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          documents: true,
          conversations: true,
          messages: true,
          bots: true,
        },
      },
    },
  });
  res.json(
    users.map((user) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      counts: user._count,
    })),
  );
});

adminRouter.patch("/users/:id", authenticate, requireAdmin, async (req, res) => {
  const { role, isActive } = req.body ?? {};
  if (role === undefined && isActive === undefined) {
    res.status(400).json({ error: "role or isActive is required" });
    return;
  }

  const updated = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      role: role ?? undefined,
      isActive: isActive ?? undefined,
      approvalStatus: role && role !== "user" ? "approved" : undefined,
    },
  });

  res.json(sanitizeUser(updated));
});

adminRouter.delete("/users/:id", authenticate, requireAdmin, async (req, res) => {
  const userId = req.params.id;
  if (req.user?.id === userId) {
    res.status(400).json({ error: "Cannot delete your own account" });
    return;
  }
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  await logEvent({
    event: "admin.user.deleted",
    actorId: req.user.id,
    targetType: "user",
    targetId: userId,
    meta: { email: user.email, name: user.name, ...getRequestContext(req) },
  });
  await prisma.user.delete({ where: { id: userId } });
  res.json({ ok: true });
});

adminRouter.get("/documents", authenticate, requireAdmin, async (_req, res) => {
  const documents = await prisma.document.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      displayName: true,
      createdAt: true,
      owner: { select: { id: true, name: true } },
    },
  });
  res.json(documents);
});

adminRouter.get("/bots", authenticate, requireAdmin, async (_req, res) => {
  const bots = await prisma.bot.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      documents: { include: { document: { select: { id: true, displayName: true } } } },
    },
  });
  res.json(
    bots.map((bot) => ({
      id: bot.id,
      name: bot.name,
      prompt: bot.prompt,
      description: bot.description,
      model: bot.model,
      avatarUrl: bot.avatarUrl,
      createdAt: bot.createdAt,
      updatedAt: bot.updatedAt,
      owner: bot.owner,
      documents: bot.documents.map((link) => link.document),
    })),
  );
});

adminRouter.delete("/documents/:id", authenticate, requireAdmin, async (req, res) => {
  const document = await prisma.document.findUnique({ where: { id: req.params.id } });
  if (!document) {
    res.status(404).json({ error: "Document not found" });
    return;
  }
  await logEvent({
    event: "document.deleted",
    actorId: req.user.id,
    targetType: "document",
    targetId: document.id,
    meta: { displayName: document.displayName, ownerId: document.ownerId, ...getRequestContext(req) },
  });
  await prisma.document.delete({ where: { id: document.id } });
  res.json({ ok: true });
  deleteDocumentVectors(document.id).catch(() => null);
});

adminRouter.delete("/bots/:id", authenticate, requireAdmin, async (req, res) => {
  try {
    const bot = await prisma.bot.findUnique({
      where: { id: req.params.id },
      include: { owner: { select: { id: true, email: true } } },
    });
    if (!bot) {
      res.status(404).json({ error: "Bot not found" });
      return;
    }
    await logEvent({
      event: "bot.deleted",
      actorId: req.user.id,
      targetType: "bot",
      targetId: bot.id,
      meta: { name: bot.name, ownerId: bot.ownerId, ...getRequestContext(req) },
    });
    await deleteBotWithCleanup(bot.id);
    res.json({ ok: true });
    await invalidateUserCaches(bot.ownerId);
  } catch (error) {
    console.error("Failed to delete bot (admin)", error);
    res.status(500).json({ error: "Failed to delete bot" });
  }
});

adminRouter.get("/upload-batches", authenticate, requireAdmin, async (_req, res) => {
  const batches = await prisma.uploadBatch.findMany({
    orderBy: { createdAt: "desc" },
    include: { user: { select: { id: true, name: true } } },
    take: 100,
  });
  res.json(batches);
});

adminRouter.get("/backup", authenticate, requireAdmin, async (_req, res) => {
  const [
    users,
    documents,
    shares,
    bots,
    botDocuments,
    conversations,
    messages,
    uploadBatches,
    uploadFiles,
    usageDaily,
  ] = await Promise.all([
    prisma.user.findMany(),
    prisma.document.findMany(),
    prisma.documentShare.findMany(),
    prisma.bot.findMany(),
    prisma.botDocument.findMany(),
    prisma.conversation.findMany(),
    prisma.message.findMany(),
    prisma.uploadBatch.findMany(),
    prisma.uploadFile.findMany(),
    prisma.usageDaily.findMany(),
  ]);

  res.json({
    users,
    documents,
    shares,
    bots,
    botDocuments,
    conversations,
    messages,
    uploadBatches,
    uploadFiles,
    usageDaily,
  });
});

adminRouter.post("/restore", authenticate, requireAdmin, async (req, res) => {
  const payload = req.body ?? {};
  try {
    await prisma.$transaction(async (tx) => {
      if (Array.isArray(payload.users) && payload.users.length) {
        await tx.user.createMany({ data: payload.users, skipDuplicates: true });
      }
      if (Array.isArray(payload.documents) && payload.documents.length) {
        await tx.document.createMany({ data: payload.documents, skipDuplicates: true });
      }
      if (Array.isArray(payload.shares) && payload.shares.length) {
        await tx.documentShare.createMany({ data: payload.shares, skipDuplicates: true });
      }
      if (Array.isArray(payload.bots) && payload.bots.length) {
        await tx.bot.createMany({ data: payload.bots, skipDuplicates: true });
      }
      if (Array.isArray(payload.botDocuments) && payload.botDocuments.length) {
        await tx.botDocument.createMany({ data: payload.botDocuments, skipDuplicates: true });
      }
      if (Array.isArray(payload.conversations) && payload.conversations.length) {
        await tx.conversation.createMany({ data: payload.conversations, skipDuplicates: true });
      }
      if (Array.isArray(payload.messages) && payload.messages.length) {
        await tx.message.createMany({ data: payload.messages, skipDuplicates: true });
      }
      if (Array.isArray(payload.uploadBatches) && payload.uploadBatches.length) {
        await tx.uploadBatch.createMany({ data: payload.uploadBatches, skipDuplicates: true });
      }
      if (Array.isArray(payload.uploadFiles) && payload.uploadFiles.length) {
        await tx.uploadFile.createMany({ data: payload.uploadFiles, skipDuplicates: true });
      }
      if (Array.isArray(payload.usageDaily) && payload.usageDaily.length) {
        await tx.usageDaily.createMany({ data: payload.usageDaily, skipDuplicates: true });
      }
    });
    await logEvent({
      event: "admin.restore",
      actorId: req.user.id,
      targetType: "backup",
      targetId: null,
      meta: { ...getRequestContext(req) },
    });
    res.json({ ok: true });
  } catch (error) {
    console.error("Restore failed", error);
    await logEvent({
      level: "error",
      event: "admin.restore.failed",
      actorId: req.user.id,
      targetType: "backup",
      targetId: null,
      outcome: "failed",
      meta: { error: error instanceof Error ? error.message : String(error), ...getRequestContext(req) },
    });
    res.status(500).json({ error: "Restore failed" });
  }
});
