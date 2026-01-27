import express from "express";
import path from "path";
import { prisma } from "../db.js";
import { authenticate } from "../lib/auth.js";
import { invalidateUserCaches } from "../lib/cache.js";
import { allowedUploadExtensions, allowedUploadMimeTypes, qdrantCollectionName } from "../config.js";
import { deleteDocumentVectors, indexDocumentChunks } from "../services/qdrant.js";
import { ensureSourceFileBlocks } from "../services/text.js";

export const documentsRouter = express.Router();

const allowedShareRoles = new Set(["viewer", "editor"]);
const MAX_TAGS = 20;
const MAX_TAG_LENGTH = 32;

const stripSourceFiles = (sourceFiles) => {
  if (!Array.isArray(sourceFiles)) return sourceFiles;
  return sourceFiles.map((file) => {
    if (!file || typeof file !== "object") return file;
    const { text, blocks, ...rest } = file;
    return rest;
  });
};

const normalizeExtension = (name = "") => path.extname(String(name)).toLowerCase();
const isAllowedSourceFile = (file) => {
  if (!file || typeof file !== "object") return true;
  const name = file.name || "";
  const type = file.type || "";
  const ext = normalizeExtension(name);
  const hasAllowedExt = ext ? allowedUploadExtensions.includes(ext) : false;
  const hasAllowedType = type ? allowedUploadMimeTypes.includes(String(type)) : false;
  return !(type || ext) || hasAllowedExt || hasAllowedType;
};

const normalizeTags = (tags = []) => {
  const normalized = tags
    .filter((tag) => typeof tag === "string")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .map((tag) => tag.slice(0, MAX_TAG_LENGTH));
  const seen = new Set();
  const deduped = [];
  for (const tag of normalized) {
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(tag);
    if (deduped.length >= MAX_TAGS) break;
  }
  return deduped;
};

const parseTags = (value) => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return null;
  return normalizeTags(value);
};

documentsRouter.get("/", authenticate, async (req, res) => {
  const summary = ["1", "true", "yes"].includes(String(req.query.summary || "").toLowerCase());
  const documents = await prisma.document.findMany({
    where: {
      OR: [
        { ownerId: req.user.id },
        { shares: { some: { userId: req.user.id } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    ...(summary
      ? {
          select: {
            id: true,
            displayName: true,
            ragStoreName: true,
            sourceFiles: true,
            createdAt: true,
            ownerId: true,
            tags: true,
            shares: {
              select: {
                id: true,
                role: true,
                user: { select: { id: true, email: true, name: true } },
              },
            },
          },
        }
      : {
          include: {
            shares: {
              select: {
                id: true,
                role: true,
                user: { select: { id: true, email: true, name: true } },
              },
            },
          },
        }),
  });
  if (summary) {
    res.json(
      documents.map((doc) => ({
        ...doc,
        sourceFiles: stripSourceFiles(doc.sourceFiles),
      })),
    );
    return;
  }
  res.json(documents);
});

documentsRouter.post("/", authenticate, async (req, res) => {
  const { displayName, sourceFiles, tags } = req.body ?? {};

  if (!displayName || !sourceFiles) {
    res.status(400).json({ error: "displayName and sourceFiles are required" });
    return;
  }

  if (!Array.isArray(sourceFiles) || sourceFiles.some((file) => !isAllowedSourceFile(file))) {
    res.status(400).json({ error: "Unsupported file type" });
    return;
  }
  const normalizedTags = parseTags(tags);
  if (normalizedTags === null) {
    res.status(400).json({ error: "tags must be an array" });
    return;
  }
  const preparedFiles = ensureSourceFileBlocks(sourceFiles);
  const document = await prisma.document.create({
    data: {
      displayName,
      ragStoreName: qdrantCollectionName,
      sourceFiles: preparedFiles,
      ownerId: req.user.id,
      tags: normalizedTags ?? [],
    },
  });

  try {
    await indexDocumentChunks({
      documentId: document.id,
      userId: req.user.id,
      sourceFiles: preparedFiles,
    });
    res.status(201).json(document);
  } catch (error) {
    await prisma.document.delete({ where: { id: document.id } }).catch(() => null);
    res.status(500).json({ error: "Failed to index document" });
    return;
  }

  await invalidateUserCaches(req.user.id);
});

documentsRouter.delete("/:id", authenticate, async (req, res) => {
  const document = await prisma.document.findFirst({
    where: { id: req.params.id, ownerId: req.user.id },
  });

  if (!document) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  await prisma.document.delete({ where: { id: document.id } });
  res.json({ ok: true });
  deleteDocumentVectors(document.id).catch(() => null);
  await invalidateUserCaches(req.user.id);
});

documentsRouter.patch("/:id", authenticate, async (req, res) => {
  const { displayName, sourceFiles, tags } = req.body ?? {};

  if (!displayName && !sourceFiles && tags === undefined) {
    res.status(400).json({ error: "displayName, sourceFiles, or tags is required" });
    return;
  }

  const document = await prisma.document.findFirst({
    where: {
      id: req.params.id,
      OR: [
        { ownerId: req.user.id },
        { shares: { some: { userId: req.user.id, role: "editor" } } },
      ],
    },
  });

  if (!document) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  if (sourceFiles && (!Array.isArray(sourceFiles) || sourceFiles.some((file) => !isAllowedSourceFile(file)))) {
    res.status(400).json({ error: "Unsupported file type" });
    return;
  }
  const normalizedTags = parseTags(tags);
  if (normalizedTags === null) {
    res.status(400).json({ error: "tags must be an array" });
    return;
  }
  const preparedFiles = sourceFiles ? ensureSourceFileBlocks(sourceFiles) : undefined;
  const updated = await prisma.document.update({
    where: { id: document.id },
    data: {
      displayName: displayName ?? undefined,
      sourceFiles: preparedFiles ?? undefined,
      tags: normalizedTags ?? undefined,
    },
    include: {
      shares: {
        select: {
          id: true,
          role: true,
          user: { select: { id: true, email: true, name: true } },
        },
      },
    },
  });

  if (preparedFiles) {
    await deleteDocumentVectors(updated.id).catch(() => null);
    await indexDocumentChunks({
      documentId: updated.id,
      userId: req.user.id,
      sourceFiles: preparedFiles,
    });
  }

  res.json(updated);
  await invalidateUserCaches(req.user.id);
});

documentsRouter.get("/:id/shares", authenticate, async (req, res) => {
  const document = await prisma.document.findFirst({
    where: { id: req.params.id, ownerId: req.user.id },
    include: {
      shares: {
        select: {
          id: true,
          role: true,
          user: { select: { id: true, email: true, name: true } },
        },
      },
    },
  });

  if (!document) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  res.json(document.shares);
});

documentsRouter.post("/:id/shares", authenticate, async (req, res) => {
  const { email, role } = req.body ?? {};
  if (!email) {
    res.status(400).json({ error: "email is required" });
    return;
  }
  const desiredRole = role || "viewer";
  if (!allowedShareRoles.has(desiredRole)) {
    res.status(400).json({ error: "role must be viewer or editor" });
    return;
  }

  const document = await prisma.document.findFirst({
    where: { id: req.params.id, ownerId: req.user.id },
  });

  if (!document) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (user.id === req.user.id) {
    res.status(400).json({ error: "Owner already has access" });
    return;
  }

  await prisma.documentShare.upsert({
    where: {
      documentId_userId: { documentId: document.id, userId: user.id },
    },
    update: { role: desiredRole },
    create: { documentId: document.id, userId: user.id, role: desiredRole },
  });

  const shares = await prisma.documentShare.findMany({
    where: { documentId: document.id },
    select: {
      id: true,
      role: true,
      user: { select: { id: true, email: true, name: true } },
    },
  });

  res.json(shares);
  await invalidateUserCaches(req.user.id);
});

documentsRouter.delete("/:id/shares", authenticate, async (req, res) => {
  const { email } = req.body ?? {};
  if (!email) {
    res.status(400).json({ error: "email is required" });
    return;
  }

  const document = await prisma.document.findFirst({
    where: { id: req.params.id, ownerId: req.user.id },
  });

  if (!document) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await prisma.documentShare.deleteMany({
    where: { documentId: document.id, userId: user.id },
  });

  const shares = await prisma.documentShare.findMany({
    where: { documentId: document.id },
    select: {
      id: true,
      role: true,
      user: { select: { id: true, email: true, name: true } },
    },
  });

  res.json(shares);
  await invalidateUserCaches(req.user.id);
});

documentsRouter.get("/:id", authenticate, async (req, res) => {
  const document = await prisma.document.findFirst({
    where: {
      id: req.params.id,
      OR: [
        { ownerId: req.user.id },
        { shares: { some: { userId: req.user.id } } },
      ],
    },
    include: {
      shares: {
        select: {
          id: true,
          role: true,
          user: { select: { id: true, email: true, name: true } },
        },
      },
    },
  });

  if (!document) {
    res.status(404).json({ error: "Document not found" });
    return;
  }

  res.json(document);
});
