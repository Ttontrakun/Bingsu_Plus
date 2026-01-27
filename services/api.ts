import { Bot, Conversation, ConversationSummary, Document, User } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE || '';
const SESSION_KEY = 'sessionToken';
const rawTimeoutMs = Number(import.meta.env.VITE_API_TIMEOUT_MS || 8000);
const DEFAULT_API_TIMEOUT_MS = Number.isFinite(rawTimeoutMs) ? rawTimeoutMs : 8000;

const getSessionToken = () => localStorage.getItem(SESSION_KEY);

const getApiBases = () => {
  const bases: string[] = [];
  if (API_BASE) {
    bases.push(API_BASE);
  }
  if (typeof window === 'undefined') {
    if (!bases.length) {
      bases.push('http://localhost:5050');
    }
    return Array.from(new Set(bases));
  }
  if (import.meta.env.DEV) {
    const hostname = window.location.hostname;
    const protocol = window.location.protocol;
    const hostBase = `${protocol}//${hostname}:5050`;
    bases.push('', hostBase, 'http://127.0.0.1:5050', 'http://localhost:5050');
  }
  return Array.from(new Set(bases));
};

const buildUrl = (base: string, path: string) => {
  if (base) {
    return `${base}${path}`;
  }
  if (typeof window !== 'undefined') {
    return `${window.location.origin}${path}`;
  }
  return path;
};

const isAbortError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;
  if ('name' in error && (error as { name?: string }).name === 'AbortError') return true;
  const message = error instanceof Error ? error.message : String(error);
  return message.toLowerCase().includes('aborted') || message.toLowerCase().includes('timeout');
};

const fetchWithTimeout = async (url: string, options: RequestInit, timeoutMs = DEFAULT_API_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
};

const fetchWithFallback = async (path: string, options: RequestInit) => {
  const bases = getApiBases();
  const errors: string[] = [];
  for (const base of bases) {
    const url = base ? `${base}${path}` : path;
    try {
      return await fetchWithTimeout(url, options);
    } catch (error) {
      const label = buildUrl(base, path);
      const message = isAbortError(error) ? 'Request timed out' : error instanceof Error ? error.message : String(error);
      errors.push(`${label} -> ${message}`);
    }
  }
  const errorMessage = errors.length
    ? `Failed to reach API. Tried: ${errors.join(' | ')}`
    : 'Failed to fetch';
  throw new Error(errorMessage);
};

export const setSessionToken = (token: string | null) => {
  if (token) {
    localStorage.setItem(SESSION_KEY, token);
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
};

const apiFetch = async <T>(path: string, options: RequestInit = {}): Promise<T> => {
  const token = getSessionToken();
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetchWithFallback(path, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const contentType = response.headers.get('content-type') || '';
    let message = response.statusText;
    try {
      if (contentType.includes('application/json')) {
        const data = await response.json();
        message = data?.error || JSON.stringify(data);
      } else {
        message = await response.text();
      }
    } catch {
      message = response.statusText;
    }
    throw new Error(message || response.statusText);
  }

  return response.json() as Promise<T>;
};

const apiFetchBinary = async (path: string, body: Blob): Promise<void> => {
  const token = getSessionToken();
  const headers = new Headers();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  headers.set('Content-Type', 'application/octet-stream');

  const response = await fetchWithFallback(path, {
    method: 'PUT',
    headers,
    body,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || response.statusText);
  }
};

export const signup = async (name: string, email: string, password: string) => {
  return apiFetch<{ user: User; token?: string; pending?: boolean; verificationRequired?: boolean; verificationToken?: string }>(
    '/api/auth/signup',
    {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    },
  );
};

export const login = async (email: string, password: string) => {
  return apiFetch<{ user: User; token: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
};

export const logout = async () => {
  return apiFetch<{ ok: boolean }>('/api/auth/logout', {
    method: 'POST',
  });
};

export const getMe = async () => {
  return apiFetch<{ user: User }>('/api/auth/me');
};

export const changePassword = async (currentPassword: string, newPassword: string) => {
  return apiFetch<{ ok: boolean }>('/api/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
};

export const requestPasswordReset = async (email: string) => {
  return apiFetch<{ ok: boolean; resetToken?: string }>('/api/auth/request-password-reset', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
};

export const resetPassword = async (token: string, newPassword: string) => {
  return apiFetch<{ ok: boolean }>('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, newPassword }),
  });
};

export const verifyEmail = async (token: string) => {
  return apiFetch<{ ok: boolean }>('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
};

export const resendVerification = async (email: string) => {
  return apiFetch<{ ok: boolean; verificationToken?: string }>('/api/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
};

export const getDocuments = async () => {
  return apiFetch<Document[]>('/api/documents?summary=1');
};

export const getDocument = async (documentId: string) => {
  return apiFetch<Document>(`/api/documents/${documentId}`);
};

export const createDocument = async (data: {
  displayName: string;
  ragStoreName: string;
  sourceFiles: { name: string; size: number; type: string; text?: string; blocks?: { label: string; text: string }[] }[];
  tags?: string[];
}) => {
  return apiFetch<Document>('/api/documents', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const updateDocument = async (
  documentId: string,
  data: { displayName?: string; sourceFiles?: { name: string; size: number; type: string; text?: string; blocks?: { label: string; text: string }[] }[]; tags?: string[] },
) => {
  return apiFetch<Document>(`/api/documents/${documentId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
};

export const deleteDocument = async (documentId: string) => {
  return apiFetch<{ ok: boolean }>(`/api/documents/${documentId}`, {
    method: 'DELETE',
  });
};

export const getDocumentShares = async (documentId: string) => {
  return apiFetch<Array<{ id: string; role?: 'viewer' | 'editor'; user: { id: string; email: string; name: string } }>>(
    `/api/documents/${documentId}/shares`,
  );
};

export const addDocumentShare = async (documentId: string, email: string, role?: 'viewer' | 'editor') => {
  return apiFetch<Array<{ id: string; role?: 'viewer' | 'editor'; user: { id: string; email: string; name: string } }>>(
    `/api/documents/${documentId}/shares`,
    {
      method: 'POST',
      body: JSON.stringify({ email, role }),
    },
  );
};

export const removeDocumentShare = async (documentId: string, email: string) => {
  return apiFetch<Array<{ id: string; role?: 'viewer' | 'editor'; user: { id: string; email: string; name: string } }>>(
    `/api/documents/${documentId}/shares`,
    {
      method: 'DELETE',
      body: JSON.stringify({ email }),
    },
  );
};

export const getBots = async () => {
  return apiFetch<Bot[]>('/api/bots');
};

export const createBot = async (data: {
  name: string;
  prompt: string;
  description?: string | null;
  model?: string | null;
  avatarUrl?: string | null;
  documentIds?: string[];
}) => {
  return apiFetch<Bot>('/api/bots', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const updateBot = async (
  botId: string,
  data: { name?: string; prompt?: string; description?: string | null; model?: string | null; avatarUrl?: string | null; documentIds?: string[] },
) => {
  return apiFetch<Bot>(`/api/bots/${botId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
};

export const deleteBot = async (botId: string) => {
  return apiFetch<{ ok: boolean }>(`/api/bots/${botId}`, {
    method: 'DELETE',
  });
};

export const getConversations = async () => {
  return apiFetch<ConversationSummary[]>('/api/conversations');
};

export const deleteConversation = async (conversationId: string) => {
  return apiFetch<{ ok: boolean }>(`/api/conversations/${conversationId}`, {
    method: 'DELETE',
  });
};

export const clearConversations = async () => {
  return apiFetch<{ ok: boolean }>('/api/conversations', {
    method: 'DELETE',
  });
};

export const createConversation = async (documentId: string, botId?: string | null) => {
  return apiFetch<Conversation>('/api/conversations', {
    method: 'POST',
    body: JSON.stringify({ documentId, botId }),
  });
};

export const getConversationMessages = async (conversationId: string, limit = 50) => {
  return apiFetch<Array<{ id: string; role: string; content: string; groundingChunks?: unknown; createdAt: string; feedback?: 'up' | 'down' | null }>>(
    `/api/conversations/${conversationId}/messages?limit=${limit}`,
  );
};

export const createMessage = async (data: {
  conversationId: string;
  role: 'user' | 'model';
  content: string;
  groundingChunks?: unknown;
}) => {
  return apiFetch<{ id: string }>('/api/messages', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const chat = async (data: { conversationId: string; message: string }) => {
  return apiFetch<{ reply: string; groundingChunks?: unknown[]; messageId?: string }>('/api/chat', {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const sendMessageFeedback = async (messageId: string, rating: 'up' | 'down', comment?: string) => {
  return apiFetch<{ ok: boolean; rating: 'up' | 'down' }>(`/api/messages/${messageId}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ rating, comment }),
  });
};

export const createUploadBatch = async (displayName: string) => {
  return apiFetch<{ id: string }>('/api/upload-batches', {
    method: 'POST',
    body: JSON.stringify({ displayName }),
  });
};

export const createUploadFileSession = async (
  batchId: string,
  data: { name: string; size: number; type: string; totalParts: number },
) => {
  return apiFetch<{ uploadId: string }>(`/api/upload-batches/${batchId}/files`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
};

export const uploadFilePart = async (uploadId: string, partNumber: number, body: Blob) => {
  return apiFetchBinary(`/api/uploads/${uploadId}/parts/${partNumber}`, body);
};

export const completeUploadFile = async (uploadId: string) => {
  return apiFetch<{ ok: boolean }>(`/api/uploads/${uploadId}/complete`, {
    method: 'POST',
  });
};

export const completeUploadBatch = async (batchId: string) => {
  return apiFetch<{ ok: boolean }>(`/api/upload-batches/${batchId}/complete`, {
    method: 'POST',
  });
};

export const getUploadBatchStatus = async (batchId: string) => {
  return apiFetch<{
    id: string;
    status: 'uploading' | 'processing' | 'done' | 'error';
    progress?: { current: number; total: number; message?: string; fileName?: string };
    document?: Document;
    error?: string;
  }>(`/api/upload-batches/${batchId}`);
};

export const getAdminMetrics = async () => {
  return apiFetch<{
    usersCount: number;
    documentsCount: number;
    conversationsCount: number;
    messagesCount: number;
    uploadBatchesCount: number;
    pendingUsersCount: number;
    botsCount: number;
    timestamp: string;
  }>('/api/admin/metrics');
};

export const getSupportPendingUsers = async () => {
  return apiFetch<Array<{ id: string; name: string; email: string; createdAt: string }>>('/api/support/pending-users');
};

export const updateSupportPendingUser = async (userId: string, status: 'approved' | 'rejected') => {
  return apiFetch<{ id: string; approvalStatus: string; isActive: boolean }>(
    `/api/support/pending-users/${userId}`,
    {
      method: 'PATCH',
      body: JSON.stringify({ approvalStatus: status }),
    },
  );
};

export const getSupportLogs = async () => {
  return apiFetch<Array<{ id: string; level: string; message: string; meta?: unknown; createdAt: string }>>(
    '/api/support/logs',
  );
};

export const getSupportReport = async () => {
  return apiFetch<any>('/api/support/report');
};

export const getHealth = async () => {
  return apiFetch<{
    ok: boolean;
    database?: { ok: boolean; error?: string };
    redis?: { ok: boolean; enabled?: boolean; error?: string };
    qdrant?: { ok: boolean; error?: string };
  }>('/api/health');
};

export const getAdminUsers = async () => {
  return apiFetch<Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
    createdAt: string;
    counts: { documents: number; conversations: number; messages: number; bots: number };
  }>>('/api/admin/users');
};

export const updateAdminUser = async (userId: string, data: { role?: string; isActive?: boolean }) => {
  return apiFetch<User>(`/api/admin/users/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
};

export const deleteAdminUser = async (userId: string) => {
  return apiFetch<{ ok: boolean }>(`/api/admin/users/${userId}`, {
    method: 'DELETE',
  });
};

export const getAdminDocuments = async () => {
  return apiFetch<Document[]>('/api/admin/documents');
};

export const deleteAdminDocument = async (documentId: string) => {
  return apiFetch<{ ok: boolean }>(`/api/admin/documents/${documentId}`, {
    method: 'DELETE',
  });
};

export const getAdminBots = async () => {
  return apiFetch<Array<{
    id: string;
    name: string;
    prompt: string;
    description?: string | null;
    model?: string | null;
    avatarUrl?: string | null;
    createdAt: string;
    updatedAt: string;
    owner: { id: string; name: string; email: string };
    documents: { id: string; displayName: string }[];
  }>>('/api/admin/bots');
};

export const deleteAdminBot = async (botId: string) => {
  return apiFetch<{ ok: boolean }>(`/api/admin/bots/${botId}`, {
    method: 'DELETE',
  });
};

export const getAdminUploadBatches = async () => {
  return apiFetch<Array<{
    id: string;
    displayName: string;
    status: string;
    progressCurrent: number;
    progressTotal: number;
    progressMessage?: string;
    progressFileName?: string;
    createdAt: string;
    user: { id: string; name: string };
  }>>('/api/admin/upload-batches');
};

export const getAdminBackup = async () => {
  return apiFetch<any>('/api/admin/backup');
};

export const restoreAdminBackup = async (payload: any) => {
  return apiFetch<{ ok: boolean }>('/api/admin/restore', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
};
