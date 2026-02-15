import crypto from "crypto";
import {
  qdrantApiKey,
  qdrantCollectionName,
  qdrantDistance,
  qdrantTopK,
  qdrantUrl,
} from "../config.js";
import { embedTexts } from "./embeddings.js";

const headers = () => {
  const base = { "Content-Type": "application/json" };
  if (qdrantApiKey) {
    return { ...base, "api-key": qdrantApiKey };
  }
  return base;
};

const qdrantFetch = async (path, options = {}) => {
  const url = `${qdrantUrl}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      ...headers(),
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Qdrant request failed: ${response.status}`);
  }
  if (response.status === 204) return null;
  return response.json();
};

let collectionReady = false;
let collectionSize = null;

export const ensureCollection = async (vectorSize) => {
  if (collectionReady && collectionSize === vectorSize) return;
  try {
    const existing = await qdrantFetch(`/collections/${qdrantCollectionName}`, { method: "GET" });
    const size = existing?.result?.config?.params?.vectors?.size;
    if (size && size !== vectorSize) {
      throw new Error(`Qdrant collection size mismatch (expected ${vectorSize}, got ${size})`);
    }
    collectionReady = true;
    collectionSize = size || vectorSize;
    return;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      message.includes("404")
      || message.includes("Not found")
      || message.includes("doesn't exist")
    ) {
      await qdrantFetch(`/collections/${qdrantCollectionName}`, {
        method: "PUT",
        body: JSON.stringify({
          vectors: {
            size: vectorSize,
            distance: qdrantDistance,
          },
        }),
      });
      collectionReady = true;
      collectionSize = vectorSize;
      return;
    }
    throw error;
  }
};

export const upsertPoints = async (points) => {
  if (!points.length) return;
  await qdrantFetch(`/collections/${qdrantCollectionName}/points?wait=true`, {
    method: "PUT",
    body: JSON.stringify({ points }),
  });
};

export const deleteDocumentVectors = async (documentId) => {
  if (!documentId) return;
  await qdrantFetch(`/collections/${qdrantCollectionName}/points/delete?wait=true`, {
    method: "POST",
    body: JSON.stringify({
      filter: {
        must: [
          {
            key: "docId",
            match: { value: documentId },
          },
        ],
      },
    }),
  });
};

export const searchQdrant = async (vector, { docIds = [], limit } = {}) => {
  if (!vector || !vector.length) return [];
  const must = [];
  if (docIds.length) {
    must.push({
      key: "docId",
      match: { any: docIds },
    });
  }

  const response = await qdrantFetch(`/collections/${qdrantCollectionName}/points/search`, {
    method: "POST",
    body: JSON.stringify({
      vector,
      limit: limit || qdrantTopK,
      with_payload: true,
      filter: must.length ? { must } : undefined,
    }),
  });

  return response?.result || [];
};

export const indexDocumentChunks = async ({ documentId, userId, sourceFiles }) => {
  const chunks = [];
  (sourceFiles || []).forEach((file, fileIndex) => {
    const blocks = Array.isArray(file?.blocks) ? file.blocks : [];
    blocks.forEach((block, index) => {
      const text = block?.text?.trim();
      if (!text) return;
      chunks.push({
        text,
        payload: {
          docId: documentId,
          userId,
          fileName: file?.name || `file-${fileIndex + 1}`,
          label: block?.label || `Chunk ${index + 1}`,
          chunkIndex: index,
        },
      });
    });
  });

  if (!chunks.length) return;
  let vectors = [];
  try {
    vectors = await embedTexts(chunks.map((chunk) => chunk.text));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // Local/dev-friendly behavior: allow uploads to complete even if embeddings are not configured.
    // Chat will fall back to keyword-based matching over stored blocks when Qdrant has no vectors.
    if (message.includes("GEMINI_API_KEY") || message.includes("EMBEDDING_API_KEY")) {
      console.warn("Skipping Qdrant indexing because embeddings are not configured:", message);
      return;
    }
    // If the embedding provider is rate-limited / quota exceeded, don't fail the whole upload.
    // The app can still work with keyword-based fallback until quota resets.
    const status = typeof error === "object" && error && "status" in error ? Number(error.status) : null;
    if (status === 429 || message.includes("RESOURCE_EXHAUSTED") || message.includes("quota") || message.includes("429")) {
      console.warn("Skipping Qdrant indexing due to embedding quota/rate limit:", message);
      return;
    }
    throw error;
  }
  const vectorSize = vectors[0]?.length || 0;
  if (!vectorSize) {
    console.warn("Skipping Qdrant indexing because embedding returned empty vector");
    return;
  }
  await ensureCollection(vectorSize);

  const points = vectors.map((vector, index) => ({
    id: crypto.randomUUID(),
    vector,
    payload: {
      ...chunks[index].payload,
      text: chunks[index].text,
    },
  }));

  const batchSize = 128;
  for (let i = 0; i < points.length; i += batchSize) {
    await upsertPoints(points.slice(i, i + batchSize));
  }
};
