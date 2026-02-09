import cors from "cors";
import crypto from "crypto";
import express from "express";
import { corsOptions, port } from "./config.js";
import { startSessionCleanup } from "./services/sessions.js";
import { hydrateUploadQueue, startUploadWorker, useRedisQueue } from "./services/uploadQueue.js";
import { authRouter } from "./routes/auth.js";
import { uploadsRouter } from "./routes/uploads.js";
import { botsRouter } from "./routes/bots.js";
import { documentsRouter } from "./routes/documents.js";
import { adminRouter } from "./routes/admin.js";
import { supportRouter } from "./routes/support.js";
import { conversationsRouter, messagesRouter, chatRouter } from "./routes/conversations.js";
import { healthRouter } from "./routes/health.js";
import { integrationsRouter } from "./routes/integrations.js";
import { statsRouter } from "./routes/stats.js";
import { subscriptionRouter } from "./routes/subscription.js";

const app = express();

app.use(cors(corsOptions));
app.use(express.json());
app.use((req, res, next) => {
  const headerValue = req.headers["x-request-id"];
  const requestId = Array.isArray(headerValue) ? headerValue[0] : headerValue || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  next();
});
app.use((req, res, next) => {
  const startTime = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - startTime;
    console.log(
      `[${new Date().toISOString()}] ${req.method} ${req.originalUrl} ${res.statusCode} ${durationMs}ms (${req.requestId})`,
    );
  });
  next();
});

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api", uploadsRouter);
app.use("/api/bots", botsRouter);
app.use("/api/documents", documentsRouter);
app.use("/api/admin", adminRouter);
app.use("/api/support", supportRouter);
app.use("/api/conversations", conversationsRouter);
app.use("/api/messages", messagesRouter);
app.use("/api/chat", chatRouter);
app.use("/api", integrationsRouter);
app.use("/api", statsRouter);
app.use("/api", subscriptionRouter);

export const startServer = () => {
  if (!useRedisQueue()) {
    hydrateUploadQueue();
  }
  startSessionCleanup();
  const listenHost = process.env.LISTEN_HOST || "0.0.0.0";
  app.listen(port, listenHost, () => {
    console.log(`API server listening on http://${listenHost}:${port}`);
  });
};

export { startUploadWorker };
export { app };
