import { TEXT_CHUNK_OVERLAP, TEXT_CHUNK_SIZE } from "../config.js";

export const normalizeMatchText = (text) =>
  (text || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

const chunkText = (text, chunkSize = 1200, overlap = 150) => {
  const normalized = (text || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const chunks = [];
  let start = 0;
  while (start < normalized.length) {
    const end = Math.min(start + chunkSize, normalized.length);
    const slice = normalized.slice(start, end).trim();
    if (slice) chunks.push(slice);
    if (end === normalized.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
};

const getSourceFiles = (sourceFiles) => {
  if (!sourceFiles) return [];
  if (Array.isArray(sourceFiles)) return sourceFiles;
  if (typeof sourceFiles === "string") {
    try {
      const parsed = JSON.parse(sourceFiles);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const buildFileBlocks = (documents) => {
  const fileBlocks = [];
  (documents || []).forEach((doc) => {
    const files = getSourceFiles(doc?.sourceFiles);
    files.forEach((file) => {
      const blocks = Array.isArray(file?.blocks) && file.blocks.length > 0
        ? file.blocks
        : chunkText(file?.text || "").map((text, index) => ({
            label: `Chunk ${index + 1}`,
            text,
          }));
      if (!blocks.length) return;
      fileBlocks.push({ docId: doc.id, fileName: file?.name, blocks });
    });
  });
  return fileBlocks;
};

const buildBigrams = (text) => {
  const normalized = normalizeMatchText(text);
  const pairs = new Set();
  if (normalized.length < 2) return pairs;
  for (let i = 0; i < normalized.length - 1; i += 1) {
    pairs.add(normalized.slice(i, i + 2));
  }
  return pairs;
};

const jaccardSimilarity = (a, b) => {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  a.forEach((item) => {
    if (b.has(item)) intersection += 1;
  });
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
};

const selectBestBlocks = (documents, query, maxPieces) => {
  const tokens = normalizeMatchText(query)
    .split(" ")
    .filter((token) => token.length > 2);
  if (!tokens.length) return [];
  const uniqueTokens = new Set(tokens);
  const fileBlocks = buildFileBlocks(documents);
  const scoredBlocks = [];
  fileBlocks.forEach((file) => {
    (file.blocks || []).forEach((block) => {
      const text = block?.text || "";
      const normalized = normalizeMatchText(text);
      if (!normalized) return;
      let score = 0;
      uniqueTokens.forEach((token) => {
        if (normalized.includes(token)) score += 1;
      });
      if (score > 0) {
        scoredBlocks.push({ text, score });
      }
    });
  });
  if (scoredBlocks.length > 0) {
    return scoredBlocks
      .sort((a, b) => b.score - a.score)
      .slice(0, maxPieces)
      .map((item) => item.text);
  }

  const normalizedQuery = normalizeMatchText(query);
  if (!normalizedQuery || normalizedQuery.length < 2) return [];
  const queryBigrams = buildBigrams(normalizedQuery);
  if (!queryBigrams.size) return [];
  const fuzzyMatches = [];
  const scanLimit = 400;
  const scanTextLimit = 500;
  const minScore = 0.22;
  let scanned = 0;

  fileBlocks.forEach((file) => {
    if (scanned >= scanLimit) return;
    (file.blocks || []).forEach((block) => {
      if (scanned >= scanLimit) return;
      const text = block?.text || "";
      const normalized = normalizeMatchText(text);
      if (!normalized) return;
      const sample = normalized.slice(0, scanTextLimit);
      const score = jaccardSimilarity(queryBigrams, buildBigrams(sample));
      if (score >= minScore) {
        fuzzyMatches.push({ text, score });
      }
      scanned += 1;
    });
  });

  return fuzzyMatches
    .sort((a, b) => b.score - a.score)
    .slice(0, maxPieces)
    .map((item) => item.text);
};

const findBestBlockIndex = (blocks, chunkTextValue) => {
  const normalizedChunk = normalizeMatchText(chunkTextValue);
  if (!normalizedChunk) return -1;
  const snippetSize = 180;
  const midStart = Math.max(0, Math.floor(normalizedChunk.length / 2 - snippetSize / 2));
  const snippets = [
    normalizedChunk.slice(0, snippetSize),
    normalizedChunk.slice(midStart, midStart + snippetSize),
    normalizedChunk.slice(Math.max(0, normalizedChunk.length - snippetSize)),
  ].filter(Boolean);

  let bestIndex = -1;
  let bestScore = 0;
  blocks.forEach((block, index) => {
    const normalizedBlock = normalizeMatchText(block?.text);
    if (!normalizedBlock) return;
    const matches = snippets.some(
      (snippet) =>
        normalizedBlock.includes(snippet) || snippet.includes(normalizedBlock),
    );
    if (!matches) return;
    const score = normalizedBlock.length;
    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });
  return bestIndex;
};

export const buildContextPiecesWithNeighbors = (groundingChunks, documents, query, options = {}) => {
  const maxPieces = options.maxPieces ?? 10;
  const neighborWindow = options.neighborWindow ?? 1;
  const basePieces = (groundingChunks || [])
    .map((chunk) => chunk?.retrievedContext?.text)
    .filter(Boolean);

  if (basePieces.length === 0) {
    return selectBestBlocks(documents, query, maxPieces);
  }

  const neighborPieces = [];
  const seen = new Set();
  const addUnique = (value) => {
    const normalized = normalizeMatchText(value);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    neighborPieces.push(value);
  };

  basePieces.forEach((piece) => addUnique(piece));

  if (neighborWindow <= 0) {
    return neighborPieces.slice(0, maxPieces);
  }

  const fileBlocks = buildFileBlocks(documents);
  basePieces.forEach((chunkTextValue) => {
    fileBlocks.forEach((file) => {
      const matchIndex = findBestBlockIndex(file.blocks, chunkTextValue);
      if (matchIndex === -1) return;
      for (let delta = -neighborWindow; delta <= neighborWindow; delta += 1) {
        if (delta === 0) continue;
        const neighbor = file.blocks[matchIndex + delta];
        if (neighbor?.text) addUnique(neighbor.text);
      }
    });
  });

  const scored = neighborPieces.map((piece) => {
    const normalizedPiece = normalizeMatchText(piece);
    const tokens = normalizeMatchText(query)
      .split(" ")
      .filter((token) => token.length > 2);
    const uniqueTokens = new Set(tokens);
    let score = 0;
    uniqueTokens.forEach((token) => {
      if (normalizedPiece.includes(token)) score += 1;
    });
    return { piece, score };
  });

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxPieces)
    .map((item) => item.piece);
};

export const chunkTextForBlocks = (text, chunkSize = TEXT_CHUNK_SIZE, overlap = TEXT_CHUNK_OVERLAP) => {
  const normalized = (text || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const chunks = [];
  let start = 0;
  while (start < normalized.length) {
    const end = Math.min(start + chunkSize, normalized.length);
    const slice = normalized.slice(start, end).trim();
    if (slice) chunks.push(slice);
    if (end === normalized.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks;
};

export const buildBlocksFromText = (text, labelPrefix) =>
  chunkTextForBlocks(text).map((chunk, index) => ({
    label: labelPrefix ? `${labelPrefix} • Chunk ${index + 1}` : `Chunk ${index + 1}`,
    text: chunk,
  }));

export const ensureSourceFileBlocks = (sourceFiles) => {
  const files = Array.isArray(sourceFiles) ? sourceFiles : [];
  return files.map((file) => {
    if (Array.isArray(file?.blocks) && file.blocks.length > 0) {
      return file;
    }
    const text = file?.text || "";
    return { ...file, blocks: buildBlocksFromText(text) };
  });
};
