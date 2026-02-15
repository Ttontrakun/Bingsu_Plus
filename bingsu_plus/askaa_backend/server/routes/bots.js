import express from "express";
import { prisma } from "../db.js";
import { authenticate } from "../lib/auth.js";
import { getRequestContext } from "../lib/requestContext.js";
import { logEvent } from "../lib/logging.js";
import { invalidateUserCaches } from "../lib/cache.js";
import { deleteBotWithCleanup } from "../services/uploadQueue.js";

export const botsRouter = express.Router();
const HELP_BOT_NAME = "บอทช่วยสอน";

const formatBot = (bot) => ({
  id: bot.id,
  name: bot.name,
  prompt: bot.prompt,
  description: bot.description,
  model: bot.model,
  avatarUrl: bot.avatarUrl,
  enabled: bot.enabled !== false,
  createdAt: bot.createdAt,
  updatedAt: bot.updatedAt,
  documents: (bot.documents || []).map((link) => link.document),
});

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
  const hasHelpBot = bots.some((b) => b.name === HELP_BOT_NAME);
  if (!hasHelpBot) {
    const helpBot = await prisma.bot.findFirst({
      where: { name: HELP_BOT_NAME },
      include: {
        documents: {
          include: {
            document: { select: { id: true, displayName: true } },
          },
        },
      },
    });
    if (helpBot) bots.push(helpBot);
  }
  res.json(bots.map(formatBot));
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
      enabled: true,
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
    enabled: true,
    createdAt: bot.createdAt,
    updatedAt: bot.updatedAt,
    documents: bot.documents.map((link) => link.document),
  });
  await invalidateUserCaches(req.user.id);
});

botsRouter.patch("/:id", authenticate, async (req, res) => {
  try {
    const { name, prompt, description, model, avatarUrl, documentIds, enabled } = req.body ?? {};

    const hasAny =
      name !== undefined || prompt !== undefined || documentIds !== undefined ||
      description !== undefined || model !== undefined || avatarUrl !== undefined || enabled !== undefined;
    if (!hasAny) {
      res.status(400).json({ error: "at least one of name, prompt, description, model, avatarUrl, documentIds, enabled is required" });
      return;
    }

    const bot = await prisma.bot.findFirst({
      where: { id: req.params.id, ownerId: req.user.id },
    });

    if (!bot) {
      res.status(404).json({ error: "Bot not found" });
      return;
    }

    if (bot.name === HELP_BOT_NAME) {
      res.status(403).json({ error: "ไม่สามารถแก้ไขบอทช่วยสอนได้" });
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

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (prompt !== undefined) updateData.prompt = prompt;
    if (description !== undefined) updateData.description = description;
    if (model !== undefined) updateData.model = model;
    if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
    if (enabled !== undefined) updateData.enabled = Boolean(enabled);

    const updated = await prisma.$transaction(async (tx) => {
      const updatedBot = Object.keys(updateData).length > 0
        ? await tx.bot.update({
            where: { id: bot.id },
            data: updateData,
          })
        : bot;

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
      enabled: withDocs.enabled !== false,
      createdAt: withDocs.createdAt,
      updatedAt: withDocs.updatedAt,
      documents: withDocs.documents.map((link) => link.document),
    });
    await invalidateUserCaches(req.user.id);
  } catch (err) {
    console.error("PATCH /api/bots/:id error:", err);
    res.status(500).json({
      error: "เซิร์ฟเวอร์ตอบ 500 — backend อาจยังไม่พร้อม ลองรีเฟรชหรือตรวจสอบ Docker (api/legacy)",
      detail: err?.message || String(err),
    });
  }
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

    if (bot.name === HELP_BOT_NAME) {
      res.status(403).json({ error: "ไม่สามารถลบบอทช่วยสอนได้" });
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
