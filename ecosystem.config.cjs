module.exports = {
  apps: [
    {
      name: "ask-aa-api",
      script: "server/index.js",
      exec_mode: "cluster",
      instances: process.env.WEB_CONCURRENCY || "max",
      env: {
        NODE_ENV: "production",
        REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
        CACHE_TTL_SECONDS: process.env.CACHE_TTL_SECONDS || "30",
        RATE_LIMIT_REDIS_PREFIX: process.env.RATE_LIMIT_REDIS_PREFIX || "rate",
        UPLOAD_QUEUE_MODE: process.env.UPLOAD_QUEUE_MODE || "redis",
        UPLOAD_QUEUE_NAME: process.env.UPLOAD_QUEUE_NAME || "upload:queue",
      },
    },
    {
      name: "ask-aa-worker",
      script: "server/worker.js",
      exec_mode: "fork",
      instances: process.env.UPLOAD_WORKER_CONCURRENCY || 2,
      env: {
        NODE_ENV: "production",
        WORKER_MODE: "upload",
        REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
        UPLOAD_QUEUE_MODE: process.env.UPLOAD_QUEUE_MODE || "redis",
        UPLOAD_QUEUE_NAME: process.env.UPLOAD_QUEUE_NAME || "upload:queue",
      },
    },
  ],
};
