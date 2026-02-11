import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

if (!process.env.DATABASE_URL) {
  console.error("Missing DATABASE_URL. Set it in .env.local or .env.");
  process.exit(1);
}

export const port = Number(process.env.PORT || 5050);
export const sessionTtlDaysSafe = Number.isFinite(Number(process.env.SESSION_TTL_DAYS || 30))
  ? Number(process.env.SESSION_TTL_DAYS || 30)
  : 30;
export const gatewayBaseUrl = process.env.GATEWAY_BASE_URL || "https://aigateway.ntictsolution.com/v1";
export const openaiKey = process.env.OPENAI_API_KEY;
export const openaiModel = process.env.OPENAI_MODEL || "gpt-4o-mini";
export const redisUrl = process.env.REDIS_URL;
export const cacheTtlSeconds = Number(process.env.CACHE_TTL_SECONDS || 30);
export const rateLimitRedisPrefix = process.env.RATE_LIMIT_REDIS_PREFIX || "rate";
export const qdrantUrl = process.env.QDRANT_URL || "http://localhost:6333";
export const qdrantApiKey = process.env.QDRANT_API_KEY || "";
export const qdrantCollectionName = process.env.QDRANT_COLLECTION || "documents";
export const qdrantDistance = process.env.QDRANT_DISTANCE || "Cosine";
export const qdrantTopK = Number(process.env.QDRANT_TOP_K || 6);
// Embeddings: openai or gemini
export const embeddingProvider = (process.env.EMBEDDING_PROVIDER || "openai").trim().toLowerCase();
export const embeddingBaseUrl = (process.env.EMBEDDING_BASE_URL || "https://api.openai.com/v1").replace(/\/+$/, "");
export const embeddingApiKey = process.env.EMBEDDING_API_KEY || "";
export const embeddingModel = process.env.EMBEDDING_MODEL
  || (embeddingProvider === "gemini" ? "models/gemini-embedding-001" : "text-embedding-3-small");
export const embeddingBatchSize = Number(process.env.EMBEDDING_BATCH_SIZE || 32);
export const embeddingTimeoutMs = Number(process.env.EMBEDDING_TIMEOUT_MS || 10000);
const parseCsvEnv = (value, fallback) => {
  if (!value) return fallback;
  const parsed = String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return parsed.length ? parsed : fallback;
};
export const allowedUploadMimeTypes = parseCsvEnv(
  process.env.ALLOWED_UPLOAD_MIME_TYPES,
  ["application/pdf", "text/plain", "text/markdown"],
);
export const allowedUploadExtensions = parseCsvEnv(
  process.env.ALLOWED_UPLOAD_EXTENSIONS,
  [".pdf", ".txt", ".md"],
);
export const maxUploadFileBytes = Number.isFinite(Number(process.env.MAX_UPLOAD_FILE_MB || 200))
  ? Number(process.env.MAX_UPLOAD_FILE_MB || 200) * 1024 * 1024
  : 200 * 1024 * 1024;

// Raw/original file storage policy
// - When false: we keep only extracted text/blocks + embeddings for RAG, and do NOT store original files.
// - This also disables original file download endpoint.
export const storeRawFiles = (process.env.STORE_RAW_FILES || "true") === "true";
export const fileStorageProvider =
  process.env.FILE_STORAGE_PROVIDER || (process.env.S3_BUCKET ? "s3" : "local");
export const s3Endpoint = process.env.S3_ENDPOINT || "";
export const s3Region = process.env.S3_REGION || "us-east-1";
export const s3AccessKeyId = process.env.S3_ACCESS_KEY_ID || "";
export const s3SecretAccessKey = process.env.S3_SECRET_ACCESS_KEY || "";
export const s3Bucket = process.env.S3_BUCKET || "";
export const s3PublicUrl = process.env.S3_PUBLIC_URL || "";
export const s3ForcePathStyle = (process.env.S3_FORCE_PATH_STYLE || "true") === "true";

export const isProduction = process.env.NODE_ENV === "production";
const envCorsOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const devCorsOrigins = isProduction ? [] : ["http://localhost:3000", "http://127.0.0.1:3000"];
const corsOrigins = Array.from(new Set([...envCorsOrigins, ...devCorsOrigins]));
export const corsOptions = !isProduction
  ? { origin: true, credentials: true }
  : corsOrigins.length
    ? {
        origin: (origin, callback) => {
          if (!origin || corsOrigins.includes(origin)) {
            callback(null, true);
          } else {
            callback(new Error("Not allowed by CORS"));
          }
        },
        credentials: true,
      }
    : { origin: true, credentials: true };

export const MAX_UPLOAD_PART_MB = Number(process.env.MAX_UPLOAD_PART_MB || 20);
export const MAX_UPLOAD_PART_BYTES = Number.isFinite(MAX_UPLOAD_PART_MB)
  ? MAX_UPLOAD_PART_MB * 1024 * 1024
  : 10 * 1024 * 1024;
export const PDF_SPLIT_PAGE_THRESHOLD = Number(process.env.PDF_SPLIT_PAGE_THRESHOLD || 400);
export const PDF_PAGES_PER_CHUNK = Number(process.env.PDF_PAGES_PER_CHUNK || 50);
export const TEXT_CHUNK_SIZE = Number(process.env.TEXT_CHUNK_SIZE || 1800);
export const TEXT_CHUNK_OVERLAP = Number(process.env.TEXT_CHUNK_OVERLAP || 100);
export const RAG_TIMEOUT_MS = Number(process.env.RAG_TIMEOUT_MS || 2000);
export const requireEmailVerification = (process.env.REQUIRE_EMAIL_VERIFICATION || "false") === "true";
export const emailVerificationTokenTtlHours = Number(process.env.EMAIL_VERIFICATION_TOKEN_TTL_HOURS || 24);
export const passwordResetTokenTtlHours = Number(process.env.PASSWORD_RESET_TOKEN_TTL_HOURS || 2);
const parseJsonEnv = (value) => {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};
const defaultRagSynonyms = {
  "ความสามารถ": ["skill", "ability", "competency"],
  "ทักษะ": ["skill", "ability", "competency"],
  "skill": ["ความสามารถ", "ทักษะ", "ability", "competency"],
  "ability": ["ความสามารถ", "ทักษะ", "skill", "competency"],
  "competency": ["ความสามารถ", "ทักษะ", "skill", "ability"],
};
const envRagSynonyms = parseJsonEnv(process.env.RAG_QUERY_SYNONYMS);
export const ragQuerySynonyms = envRagSynonyms && typeof envRagSynonyms === "object"
  ? { ...defaultRagSynonyms, ...envRagSynonyms }
  : defaultRagSynonyms;
export const ragQueryVariantLimit = Number(process.env.RAG_QUERY_VARIANT_LIMIT || 4);

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));
const parseNumberEnv = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const CHAT_TIMEOUT_MS = Number(process.env.CHAT_TIMEOUT_MS || 8000);
export const CHAT_TEMPERATURE = clampNumber(parseNumberEnv(process.env.CHAT_TEMPERATURE, 0.2), 0, 2);
export const CHAT_MAX_TOKENS = Math.max(1, Math.floor(parseNumberEnv(process.env.CHAT_MAX_TOKENS, 600)));
export const MAX_CONTEXT_PIECES = Number(process.env.MAX_CONTEXT_PIECES || 3);
export const CONTEXT_NEIGHBOR_WINDOW = Number(process.env.CONTEXT_NEIGHBOR_WINDOW || 0);
export const GREETING_REPLY = process.env.GREETING_REPLY || "สวัสดีครับ มีอะไรให้ช่วยไหมครับ";
export const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
export const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX || 120);
export const MAX_DAILY_UPLOAD_BYTES = Number(process.env.MAX_DAILY_UPLOAD_BYTES || 2_000_000_000);
export const MAX_DAILY_CHAT_MESSAGES = Number(process.env.MAX_DAILY_CHAT_MESSAGES || 2000);
export const FREE_DAILY_TOKEN_LIMIT = Math.max(0, Math.floor(parseNumberEnv(process.env.FREE_DAILY_TOKEN_LIMIT, 50_000)));
export const FREE_KNOWLEDGE_LIMIT = Math.max(0, Math.floor(parseNumberEnv(process.env.FREE_KNOWLEDGE_LIMIT, 30)));

export const uploadQueueName = process.env.UPLOAD_QUEUE_NAME || "upload:queue";
export const uploadQueueMode = process.env.UPLOAD_QUEUE_MODE || (redisUrl ? "redis" : "memory");
