import { cacheTtlSeconds } from "../config.js";
import { getRedisClient, isRedisReady } from "../redis.js";

export const cacheGet = async (key) => {
  if (!isRedisReady()) return null;
  try {
    const value = await getRedisClient().get(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error("Redis cache get failed", error);
    return null;
  }
};

export const cacheSet = async (key, value, ttlSeconds = cacheTtlSeconds) => {
  if (!isRedisReady()) return;
  try {
    const ttl = Number.isFinite(ttlSeconds) ? ttlSeconds : 30;
    await getRedisClient().setEx(key, ttl, JSON.stringify(value));
  } catch (error) {
    console.error("Redis cache set failed", error);
  }
};

export const cacheDel = async (keys) => {
  if (!isRedisReady()) return;
  try {
    const list = Array.isArray(keys) ? keys : [keys];
    if (list.length) {
      await getRedisClient().del(list);
    }
  } catch (error) {
    console.error("Redis cache delete failed", error);
  }
};

export const cacheDelPrefix = async (prefix) => {
  if (!isRedisReady()) return;
  try {
    const client = getRedisClient();
    for await (const key of client.scanIterator({ MATCH: `${prefix}*`, COUNT: 100 })) {
      await client.del(key);
    }
  } catch (error) {
    console.error("Redis cache prefix delete failed", error);
  }
};

export const userCacheKey = (type, userId) => `cache:${type}:${userId}`;
export const conversationMessagesKey = (conversationId, limit) =>
  `cache:messages:${conversationId}:limit:${limit}`;

export const invalidateUserCaches = async (userId) => {
  if (!userId) return;
  await cacheDel([
    userCacheKey("docs", userId),
    userCacheKey("bots", userId),
    userCacheKey("conversations", userId),
  ]);
};

export const invalidateConversationCaches = async (conversationId, userId) => {
  if (userId) {
    await cacheDel(userCacheKey("conversations", userId));
  }
  await cacheDelPrefix(`cache:messages:${conversationId}:`);
};
