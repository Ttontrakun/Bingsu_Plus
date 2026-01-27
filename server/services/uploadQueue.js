import fs from "fs/promises";
import fsSync from "fs";
import path from "path";
import crypto from "crypto";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { prisma } from "../db.js";
import { getRedisClient, isRedisReady } from "../redis.js";
import {
  MAX_DAILY_UPLOAD_BYTES,
  qdrantCollectionName,
  uploadQueueMode,
  uploadQueueName,
} from "../config.js";
import { logEvent } from "../lib/logging.js";
import { getDateKey, getOrCreateUsageDaily } from "./usage.js";
import { buildBlocksFromText, ensureSourceFileBlocks } from "./text.js";
import { indexDocumentChunks } from "./qdrant.js";
import { storeOriginalFile } from "./fileStorage.js";

const uploadRoot = path.join(process.cwd(), ".uploads");
fs.mkdir(uploadRoot, { recursive: true }).catch((error) => {
  console.error("Failed to create upload folder", error);
});

const uploadQueue = [];
let isUploadProcessing = false;

export const useRedisQueue = () => uploadQueueMode === "redis" && isRedisReady();

const sanitizeFileName = (name) => name.replace(/[^\w.\-() ]+/g, "_");

export const getUploadPaths = (uploadId, fileName) => {
  const sessionDir = path.join(uploadRoot, uploadId);
  const partsDir = path.join(sessionDir, "parts");
  const assembledPath = path.join(sessionDir, fileName);
  return { sessionDir, partsDir, assembledPath };
};

export const createUploadBatch = async (userId, displayName) => {
  return prisma.uploadBatch.create({
    data: {
      userId,
      displayName,
      status: "uploading",
      progressMessage: "Waiting for upload...",
    },
  });
};

export const createUploadSession = async (batchId, userId, metadata) => {
  const batch = await prisma.uploadBatch.findFirst({
    where: { id: batchId, userId },
  });
  if (!batch) {
    throw new Error("Upload batch not found");
  }

  const uploadId = crypto.randomUUID();
  const safeName = sanitizeFileName(metadata.name);
  const { sessionDir, partsDir, assembledPath } = getUploadPaths(uploadId, safeName);

  await fs.mkdir(partsDir, { recursive: true }).catch(() => null);

  const session = await prisma.uploadFile.create({
    data: {
      id: uploadId,
      batchId,
      name: safeName,
      size: metadata.size,
      type: metadata.type,
      totalParts: metadata.totalParts,
      assembledPath,
      status: "uploading",
    },
  });

  await prisma.uploadBatch.update({
    where: { id: batchId },
    data: {
      uploadPartsTotal: { increment: metadata.totalParts },
    },
  });

  return { ...session, sessionDir, partsDir };
};

export const assembleUploadParts = async (session, partsDir, assembledPath) => {
  const outputStream = fsSync.createWriteStream(assembledPath);
  for (let partNumber = 1; partNumber <= session.totalParts; partNumber += 1) {
    const partPath = path.join(
      partsDir,
      `part-${String(partNumber).padStart(6, "0")}`,
    );
    const data = await fs.readFile(partPath);
    outputStream.write(data);
  }
  await new Promise((resolve, reject) => {
    outputStream.end();
    outputStream.on("finish", resolve);
    outputStream.on("error", reject);
  });
};

export const enqueueUploadBatch = async (batchId) => {
  if (useRedisQueue()) {
    await getRedisClient().lPush(uploadQueueName, batchId);
    return;
  }
  uploadQueue.push(batchId);
  if (!isUploadProcessing) {
    processUploadQueue();
  }
};

const processUploadQueue = async () => {
  if (useRedisQueue()) return;
  if (isUploadProcessing) return;
  isUploadProcessing = true;

  while (uploadQueue.length > 0) {
    const batchId = uploadQueue.shift();
    const batch = await prisma.uploadBatch.findUnique({
      where: { id: batchId },
    });
    if (!batch || batch.status === "processing" || batch.status === "done") continue;
    try {
      await processUploadBatch(batchId);
    } catch (error) {
      await prisma.uploadBatch.update({
        where: { id: batchId },
        data: {
          status: "error",
          error: error instanceof Error ? error.message : "Upload processing failed",
        },
      });
      console.error("Batch processing failed:", error);
      await logEvent({
        level: "error",
        event: "upload.batch.failed",
        actorId: batch?.userId ?? undefined,
        targetType: "upload_batch",
        targetId: batchId,
        outcome: "failed",
        meta: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  isUploadProcessing = false;
};

const getQueueElement = (result) => {
  if (!result) return null;
  if (Array.isArray(result)) return result[1];
  if (typeof result === "object" && result.element) return result.element;
  return null;
};

const startRedisUploadWorker = async () => {
  if (!useRedisQueue()) return;
  console.log("Upload worker listening on Redis queue", uploadQueueName);
  while (true) {
    const result = await getRedisClient().brPop(uploadQueueName, 0);
    const batchId = getQueueElement(result);
    if (!batchId) continue;
    const batch = await prisma.uploadBatch.findUnique({
      where: { id: batchId },
    });
    if (!batch || batch.status === "processing" || batch.status === "done") {
      continue;
    }
    try {
      await processUploadBatch(batchId);
    } catch (error) {
      await prisma.uploadBatch.update({
        where: { id: batchId },
        data: {
          status: "error",
          error: error instanceof Error ? error.message : "Upload processing failed",
        },
      });
      console.error("Batch processing failed:", error);
      await logEvent({
        level: "error",
        event: "upload.batch.failed",
        actorId: batch?.userId ?? undefined,
        targetType: "upload_batch",
        targetId: batchId,
        outcome: "failed",
        meta: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  }
};

const extractPdfPageText = async (page) => {
  const content = await page.getTextContent();
  return content.items
    .map((item) => {
      if (!("str" in item)) return "";
      const text = item.str ?? "";
      const hasEol = "hasEOL" in item && item.hasEOL;
      return text + (hasEol ? "\n" : " ");
    })
    .join("")
    .trim();
};

const copyBinaryData = (data) => {
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(data)) {
    return new Uint8Array(data);
  }
  if (data instanceof Uint8Array) {
    return new Uint8Array(data);
  }
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data.slice(0));
  }
  return data;
};

const extractPdfText = async (buffer) => {
  const pdfData = copyBinaryData(buffer);
  const pdf = await getDocument({ data: pdfData, disableWorker: true }).promise;
  const blocks = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const pageText = await extractPdfPageText(page);
    if (pageText) {
      blocks.push(...buildBlocksFromText(pageText, `Page ${pageNumber}`));
    }
  }
  const text = blocks.map((block) => block.text).join("\n\n");
  return { text, blocks, pageCount: pdf.numPages };
};

const processUploadBatch = async (batchId) => {
  const batch = await prisma.uploadBatch.findUnique({
    where: { id: batchId },
    include: { files: true },
  });
  if (!batch) {
    throw new Error("Upload batch not found");
  }

  await prisma.uploadBatch.update({
    where: { id: batchId },
    data: {
      status: "processing",
      progressCurrent: 0,
      progressTotal: 0,
      progressMessage: "Preparing...",
      progressFileName: null,
    },
  });

  const sessions = batch.files;

  const processingPlan = [];
  for (const session of sessions) {
    const buffer = await fs.readFile(session.assembledPath);
    if (session.type === "application/pdf" || /\.pdf$/i.test(session.name)) {
      const pdfData = copyBinaryData(buffer);
      const pdf = await getDocument({ data: pdfData, disableWorker: true }).promise;
      processingPlan.push({ session, buffer, pdf });
    } else {
      processingPlan.push({ session, buffer });
    }
  }

  const totalSteps = sessions.length + 1;
  let completedSteps = 0;
  const updateProgress = (message, fileName) => {
    completedSteps += 1;
    prisma.uploadBatch.update({
      where: { id: batchId },
      data: {
        progressCurrent: completedSteps,
        progressTotal: totalSteps,
        progressMessage: message,
        progressFileName: fileName ?? null,
      },
    }).catch(() => null);
  };

  const sourceFiles = [];

  for (const plan of processingPlan) {
    const { session, buffer } = plan;
    const isPdf = session.type === "application/pdf" || /\.pdf$/i.test(session.name);
    const storage = await storeOriginalFile({
      buffer,
      fileName: session.name,
      contentType: session.type,
      userId: batch.userId,
      documentId: batch.id,
    });

    if (isPdf) {
      const pdf = plan.pdf ?? await getDocument({ data: copyBinaryData(buffer), disableWorker: true }).promise;
      const { text, blocks } = await extractPdfText(buffer);
      sourceFiles.push({
        name: session.name,
        size: session.size,
        type: session.type,
        text,
        blocks,
        storage,
      });

      updateProgress("Extracting PDF text...", session.name);
    } else {
      const fileText = buffer.toString("utf-8");
      const blocks = buildBlocksFromText(fileText);
      sourceFiles.push({
        name: session.name,
        size: session.size,
        type: session.type,
        text: fileText,
        blocks,
        storage,
      });
      updateProgress("Preparing text...", session.name);
    }
  }

  const preparedFiles = ensureSourceFileBlocks(sourceFiles);
  const document = await prisma.document.create({
    data: {
      displayName: batch.displayName,
      ragStoreName: qdrantCollectionName,
      sourceFiles: preparedFiles,
      ownerId: batch.userId,
    },
  });

  updateProgress("Indexing chunks...", null);
  await indexDocumentChunks({
    documentId: document.id,
    userId: batch.userId,
    sourceFiles: preparedFiles,
  });

  await prisma.uploadBatch.update({
    where: { id: batchId },
    data: {
      status: "done",
      progressCurrent: totalSteps,
      progressTotal: totalSteps,
      progressMessage: "All set!",
      progressFileName: null,
      documentId: document.id,
    },
  });

  const totalUploadBytes = sessions.reduce((sum, session) => sum + (session.size || 0), 0);
  const usage = await getOrCreateUsageDaily(batch.userId);
  await prisma.usageDaily.update({
    where: { id: usage.id },
    data: { uploadBytes: usage.uploadBytes + totalUploadBytes },
  });

  await prisma.uploadFile.updateMany({
    where: { batchId },
    data: { status: "complete" },
  });

  for (const session of sessions) {
    const { sessionDir } = getUploadPaths(session.id, session.name);
    fs.rm(sessionDir, { recursive: true, force: true }).catch(() => null);
  }
};

export const startUploadWorker = async () => {
  await hydrateUploadQueue();
  if (useRedisQueue()) {
    await startRedisUploadWorker();
  } else {
    processUploadQueue();
  }
};

export const hydrateUploadQueue = async () => {
  try {
    const pending = await prisma.uploadBatch.findMany({
      where: { status: { in: ["processing"] } },
      select: { id: true },
    });
    for (const batch of pending) {
      await enqueueUploadBatch(batch.id);
    }
  } catch (error) {
    console.error("Failed to hydrate upload queue", error);
  }
};

export const deleteBotWithCleanup = async (botId) => {
  await prisma.botDocument.deleteMany({ where: { botId } });
  await prisma.conversation.updateMany({
    where: { botId },
    data: { botId: null },
  });
  await prisma.bot.delete({ where: { id: botId } });
};

export const canUploadMoreToday = async (userId, additionalBytes) => {
  const dateKey = getDateKey();
  const usage = await prisma.usageDaily.findUnique({
    where: { userId_dateKey: { userId, dateKey } },
  });
  if (!usage) return true;
  return usage.uploadBytes + additionalBytes <= MAX_DAILY_UPLOAD_BYTES;
};
