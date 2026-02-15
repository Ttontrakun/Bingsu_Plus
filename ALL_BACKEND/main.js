// Main Entry Point for ALL_BACKEND
// Combines all services from askaa_backend and legacy website

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// Load config
import { port, corsOptions } from './shared/config.js';
import { prisma } from './shared/database/db.js';

// Import services
import { authRouter } from './services/auth/auth.js';
import { conversationsRouter, messagesRouter, chatRouter } from './services/chat/conversations.js';
import { documentsRouter } from './services/documents/documents.js';
import { botsRouter } from './services/bots/bots.js';
import { uploadsRouter } from './services/uploads/uploads.js';
import { adminRouter } from './services/admin/admin.js';
import { supportRouter } from './services/support/support.js';
import { integrationsRouter } from './services/integrations/integrations.js';
import { statsRouter } from './services/stats/stats.js';
import { subscriptionRouter } from './services/subscription/subscription.js';
import { healthRouter } from './services/health/health.js';

const app = express();

// Setup uploads directory
const uploadsDir = path.join(projectRoot, 'uploads');
fs.mkdirSync(uploadsDir, { recursive: true });
fs.mkdirSync(path.join(uploadsDir, 'avatars'), { recursive: true });

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request ID middleware
app.use((req, res, next) => {
  const headerValue = req.headers['x-request-id'];
  const requestId = Array.isArray(headerValue) ? headerValue[0] : headerValue || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('x-request-id', requestId);
  next();
});

// Static files
app.use('/uploads', express.static(uploadsDir));

// Health check
app.get('/api/ping', (_req, res) => res.status(200).json({ ok: true }));
app.use('/api/health', healthRouter);

// Avatar endpoint
app.get('/api/avatars/:filename', (req, res) => {
  const filename = req.params.filename;
  if (!filename || !/^[a-zA-Z0-9._-]+$/.test(filename)) {
    return res.status(400).send('Invalid filename');
  }
  const filePath = path.join(uploadsDir, 'avatars', filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Not found');
  }
  res.sendFile(path.resolve(filePath));
});

// API Routes
app.use('/api/auth', authRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/messages', messagesRouter);
app.use('/api/chat', chatRouter);
app.use('/api/documents', documentsRouter);
app.use('/api/bots', botsRouter);
app.use('/api/uploads', uploadsRouter);
// Alias for frontend compatibility (frontend calls /api/upload-batches)
app.use('/api/upload-batches', uploadsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/support', supportRouter);
app.use('/api/integrations', integrationsRouter);
app.use('/api/stats', statsRouter);
app.use('/api/subscription', subscriptionRouter);

// Error handling
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

const PORT = port || 5050;
const listenHost = process.env.LISTEN_HOST || '0.0.0.0';

app.listen(PORT, listenHost, () => {
  console.log(`🚀 ALL_BACKEND server running on http://${listenHost}:${PORT}`);
  console.log(`📚 Services available at http://localhost:${PORT}/api`);
  console.log(`✅ All services loaded successfully`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

export default app;
