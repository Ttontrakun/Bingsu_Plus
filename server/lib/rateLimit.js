import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS, rateLimitRedisPrefix } from "../config.js";
import { getRedisClient, isRedisReady } from "../redis.js";

const rateLimitBuckets = new Map();

export const rateLimit = async (key) => {
  if (isRedisReady()) {
    const redisKey = `${rateLimitRedisPrefix}:${key}`;
    const client = getRedisClient();
    const count = await client.incr(redisKey);
    if (count === 1) {
      await client.pExpire(redisKey, RATE_LIMIT_WINDOW_MS);
    }
    return count <= RATE_LIMIT_MAX;
  }
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || now - bucket.start > RATE_LIMIT_WINDOW_MS) {
    rateLimitBuckets.set(key, { start: now, count: 1 });
    return true;
  }
  if (bucket.count >= RATE_LIMIT_MAX) {
    return false;
  }
  bucket.count += 1;
  return true;
};
