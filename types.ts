/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
export interface RagStore {
    name: string;
    displayName: string;
}

export interface CustomMetadata {
  key?: string;
  stringValue?: string;
  stringListValue?: string[];
  numericValue?: number;
}

export interface Document {
    id: string;
    displayName: string;
    ragStoreName?: string;
    sourceFiles?: { name: string; size: number; type: string; text?: string; blocks?: { label: string; text: string }[] }[];
    shares?: { id: string; role?: 'viewer' | 'editor'; user: { id: string; email: string; name: string } }[];
    ownerId?: string;
    owner?: { id: string; email: string; name: string };
    createdAt?: string;
    name?: string;
    customMetadata?: CustomMetadata[];
    tags?: string[];
}

export interface Bot {
    id: string;
    name: string;
    prompt: string;
    description?: string | null;
    model?: string | null;
    avatarUrl?: string | null;
    documents?: { id: string; displayName: string }[];
    createdAt?: string;
    updatedAt?: string;
}

export interface User {
    id: string;
    email: string;
    name: string;
    emailVerifiedAt?: string | null;
    role?: 'user' | 'support' | 'admin_metrics' | 'admin';
    isActive?: boolean;
    approvalStatus?: 'pending' | 'approved' | 'rejected';
    createdAt?: string;
}

export interface Conversation {
    id: string;
    documentId: string;
    botId?: string | null;
    title?: string | null;
    createdAt?: string;
    updatedAt?: string;
}

export interface ConversationSummary {
    id: string;
    title?: string | null;
    createdAt?: string;
    updatedAt?: string;
    document: { id: string; displayName: string };
    bot?: { id: string; name: string } | null;
    lastMessage?: string | null;
}

export interface GroundingChunk {
    retrievedContext?: {
        text?: string;
    };
}

export interface QueryResult {
    text: string;
    groundingChunks: GroundingChunk[];
}

export enum AppStatus {
    Initializing,
    Welcome,
    Uploading,
    Chatting,
    Error,
}

export interface ChatMessage {
    role: 'user' | 'model';
    parts: { text: string }[];
    groundingChunks?: GroundingChunk[];
    id?: string;
    feedback?: 'up' | 'down' | null;
    createdAt?: string;
}

export interface UploadBatchStatus {
  id: string;
  status: 'uploading' | 'processing' | 'done' | 'error';
  progress?: { current: number; total: number; message?: string; fileName?: string };
  document?: Document;
  error?: string;
}
