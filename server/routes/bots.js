import express from "express";
import { prisma } from "../db.js";
import { authenticate } from "../lib/auth.js";
import { getRequestContext } from "../lib/requestContext.js";
import { logEvent } from "../lib/logging.js";
import { invalidateUserCaches } from "../lib/cache.js";
import { deleteBotWithCleanup } from "../services/uploadQueue.js";

export const botsRouter = express.Router();

botsRouter.get("/", authenticate, async (req, res) => {
  const bots = await prisma.bot.findMany({
    where: { ownerId: req.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      documents: {
        include: {
          document: { select: { id: true, displayName: true } },
        },
      },
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
      documents: bot.documents.map((link) => link.document),
    })),
  );
});

botsRouter.post("/", authenticate, async (req, res) => {
  const { name, prompt, description, model, avatarUrl, documentIds } = req.body ?? {};

  if (!name || !prompt) {
    res.status(400).json({ error: "name and prompt are required" });
    return;
  }

  const rawIds = Array.isArray(documentIds) ? documentIds : [];
  const uniqueIds = [...new Set(rawIds.filter(Boolean))];
  let validIds = uniqueIds;
  if (uniqueIds.length > 0) {
    const accessibleDocs = await prisma.document.findMany({
      where: {
        id: { in: uniqueIds },
        OR: [
          { ownerId: req.user.id },
          { shares: { some: { userId: req.user.id } } },
        ],
      },
      select: { id: true },
    });
    const accessibleIdSet = new Set(accessibleDocs.map((doc) => doc.id));
    validIds = uniqueIds.filter((id) => accessibleIdSet.has(id));
  }

  const bot = await prisma.bot.create({
    data: {
      name,
      prompt,
      description: description ?? null,
      model: model ?? null,
      avatarUrl: avatarUrl ?? null,
      ownerId: req.user.id,
      documents: validIds.length
        ? {
            create: validIds.map((id) => ({ documentId: id })),
          }
        : undefined,
    },
    include: {
      documents: {
        include: { document: { select: { id: true, displayName: true } } },
      },
    },
  });

  await logEvent({
    event: "bot.created",
    actorId: req.user.id,
    targetType: "bot",
    targetId: bot.id,
    meta: { name: bot.name, documentIds: validIds, documentCount: validIds.length, ...getRequestContext(req) },
  });

  res.status(201).json({
    id: bot.id,
    name: bot.name,
    prompt: bot.prompt,
    description: bot.description,
    model: bot.model,
    avatarUrl: bot.avatarUrl,
    createdAt: bot.createdAt,
    updatedAt: bot.updatedAt,
    documents: bot.documents.map((link) => link.document),
  });
  await invalidateUserCaches(req.user.id);
});

botsRouter.patch("/:id", authenticate, async (req, res) => {
  const { name, prompt, description, model, avatarUrl, documentIds } = req.body ?? {};

  if (!name && !prompt && !documentIds && description === undefined && model === undefined && avatarUrl === undefined) {
    res.status(400).json({ error: "name, prompt, description, model, avatarUrl or documentIds is required" });
    return;
  }

  const bot = await prisma.bot.findFirst({
    where: { id: req.params.id, ownerId: req.user.id },
  });

  if (!bot) {
    res.status(404).json({ error: "Bot not found" });
    return;
  }

  const rawIds = Array.isArray(documentIds) ? documentIds : null;
  const ids = rawIds ? [...new Set(rawIds.filter(Boolean))] : null;
  let validIds = ids;
  if (ids && ids.length > 0) {
    const accessibleDocs = await prisma.document.findMany({
      where: {
        id: { in: ids },
        OR: [
          { ownerId: req.user.id },
          { shares: { some: { userId: req.user.id } } },
        ],
      },
      select: { id: true },
    });
    const accessibleIdSet = new Set(accessibleDocs.map((doc) => doc.id));
    validIds = ids.filter((id) => accessibleIdSet.has(id));
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedBot = await tx.bot.update({
      where: { id: bot.id },
      data: {
        name: name ?? undefined,
        prompt: prompt ?? undefined,
        description: description ?? undefined,
        model: model ?? undefined,
        avatarUrl: avatarUrl ?? undefined,
      },
    });

    if (ids) {
      await tx.botDocument.deleteMany({ where: { botId: bot.id } });
      if (validIds && validIds.length > 0) {
        await tx.botDocument.createMany({
          data: validIds.map((id) => ({ botId: bot.id, documentId: id })),
        });
      }
    }

    return updatedBot;
  });

  const withDocs = await prisma.bot.findUnique({
    where: { id: updated.id },
    include: { documents: { include: { document: { select: { id: true, displayName: true } } } } },
  });

  await logEvent({
    event: "bot.updated",
    actorId: req.user.id,
    targetType: "bot",
    targetId: withDocs.id,
    meta: {
      name: withDocs.name,
      nameChanged: Boolean(name),
      promptChanged: Boolean(prompt),
      documentCount: withDocs.documents.length,
      ...getRequestContext(req),
    },
  });

  res.json({
    id: withDocs.id,
    name: withDocs.name,
    prompt: withDocs.prompt,
    description: withDocs.description,
    model: withDocs.model,
    avatarUrl: withDocs.avatarUrl,
    createdAt: withDocs.createdAt,
    updatedAt: withDocs.updatedAt,
    documents: withDocs.documents.map((link) => link.document),
  });
  await invalidateUserCaches(req.user.id);
});

botsRouter.delete("/:id", authenticate, async (req, res) => {
  try {
    const bot = await prisma.bot.findFirst({
      where: { id: req.params.id, ownerId: req.user.id },
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
      meta: { name: bot.name, ...getRequestContext(req) },
    });

    await deleteBotWithCleanup(bot.id);
    res.json({ ok: true });
    await invalidateUserCaches(req.user.id);
  } catch (error) {
    console.error("Failed to delete bot", error);
    res.status(500).json({ error: "Failed to delete bot" });
  }
});
