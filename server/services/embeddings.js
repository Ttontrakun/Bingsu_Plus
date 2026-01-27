import { GoogleGenAI } from "@google/genai";
import { embeddingBatchSize, embeddingModel, embeddingTimeoutMs } from "../config.js";

let geminiClient;

const withTimeout = async (promise, ms, label) => {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out.`));
    }, ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
};

const getGeminiClient = () => {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return geminiClient;
};

export const embedTexts = async (texts) => {
  const ai = getGeminiClient();
  if (!ai) {
    throw new Error("Missing GEMINI_API_KEY in .env.local or .env.");
  }
  const inputs = Array.isArray(texts) ? texts : [];
  if (!inputs.length) return [];

  const batchSize = Number.isFinite(embeddingBatchSize) ? embeddingBatchSize : 32;
  const vectors = [];
  for (let i = 0; i < inputs.length; i += batchSize) {
    const batch = inputs.slice(i, i + batchSize);
    const response = await withTimeout(
      ai.models.embedContent({
        model: embeddingModel,
        contents: batch,
      }),
      Number.isFinite(embeddingTimeoutMs) ? embeddingTimeoutMs : 10000,
      "Embedding",
    );
    const embeddings = response.embeddings || [];
    if (embeddings.length !== batch.length) {
      throw new Error("Embedding response size mismatch");
    }
    embeddings.forEach((item) => {
      const values = item?.values || [];
      const arrayValues = Array.isArray(values) ? values : Array.from(values);
      vectors.push(arrayValues.map((value) => Number(value)));
    });
  }

  return vectors;
};
