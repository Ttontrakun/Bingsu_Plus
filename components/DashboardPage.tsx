import React, { useEffect, useMemo, useState } from 'react';
import { Bot, ChatMessage, ConversationSummary, Document, User } from '../types';
import AdminPanel from './dashboard/AdminPanel';
import BotsPanel from './dashboard/BotsPanel';
import ChatPanel from './dashboard/ChatPanel';
import IntegrationPanel from './dashboard/IntegrationPanel';
import KnowledgePanel from './dashboard/KnowledgePanel';
import Sidebar from './dashboard/Sidebar';
import BotAvatarModal from './dashboard/modals/BotAvatarModal';
import ConfirmDialogModal from './dashboard/modals/ConfirmDialogModal';
import EditBotModal from './dashboard/modals/EditBotModal';
import EditDocumentModal from './dashboard/modals/EditDocumentModal';
import SelectKnowledgeModal from './dashboard/modals/SelectKnowledgeModal';
import SettingsModal from './dashboard/modals/SettingsModal';
import type { PDFDocumentProxy } from 'pdfjs-dist';

type Panel = 'chat' | 'knowledge' | 'bots' | 'admin' | 'integration';

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;

const loadPdfjs = async () => {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker?url'),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = (worker as { default?: string }).default ?? (worker as any);
      return pdfjs;
    });
  }
  return pdfjsPromise;
};

const parseTagInput = (value: string) => {
  const raw = value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const deduped: string[] = [];
  raw.forEach((tag) => {
    const key = tag.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    deduped.push(tag);
  });
  return deduped;
};

interface DashboardPageProps {
  user: User;
  bots: Bot[];
  selectedBot: Bot | null;
  documents: Document[];
  documentsLoading: boolean;
  conversations: ConversationSummary[];
  conversationsLoading: boolean;
  selectedConversationId: string | null;
  selectedDocument: Document | null;
  activePanel: Panel;
  hasApiKey: boolean;
  chatHistory: ChatMessage[];
  isQueryLoading: boolean;
  onFeedback: (messageId: string, rating: 'up' | 'down') => void;
  retryPrompt: string | null;
  onRetryPrompt: () => void;
  onSelectBot: (bot: Bot) => void;
  onSelectBotForChat: (bot: Bot) => void;
  onCreateBot: (name: string, prompt: string, documentIds: string[], description?: string | null, model?: string | null, avatarUrl?: string | null) => Promise<void>;
  onUpdateBot: (
    botId: string,
    data: { name?: string; prompt?: string; description?: string | null; model?: string | null; avatarUrl?: string | null; documentIds?: string[] },
  ) => Promise<void>;
  onDeleteBot: (botId: string) => Promise<void>;
  onSelectDocument: (doc: Document) => void;
  onLoadDocument: (documentId: string) => Promise<Document>;
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  onSelectConversation: (conversation: ConversationSummary) => void;
  onDeleteConversation: (conversationId: string) => void;
  onClearConversations: () => void;
  onShowHistory: () => void;
  onEnsureBotsLoaded: () => void;
  onUpdateDocument: (
    documentId: string,
    data: { displayName?: string; sourceFiles?: { name: string; size: number; type: string; text?: string; blocks?: { label: string; text: string }[] }[]; tags?: string[] },
  ) => Promise<void>;
  onDeleteDocument: (documentId: string) => Promise<void>;
  onShareDocument: (documentId: string, email: string, role?: 'viewer' | 'editor') => Promise<Array<{ id: string; role?: 'viewer' | 'editor'; user: { id: string; email: string; name: string } }>>;
  onRemoveDocumentShare: (documentId: string, email: string) => Promise<Array<{ id: string; role?: 'viewer' | 'editor'; user: { id: string; email: string; name: string } }>>;
  onUploadComplete: (doc: Document) => void;
  onSendMessage: (message: string) => void;
  onNewChat: () => void;
  onChangePanel: (panel: Panel) => void;
  onLogout: () => void;
  adminMetrics: {
    usersCount: number;
    documentsCount: number;
    conversationsCount: number;
    messagesCount: number;
    uploadBatchesCount: number;
    pendingUsersCount: number;
    botsCount: number;
    timestamp: string;
  } | null;
  healthStatus: {
    ok: boolean;
    database?: { ok: boolean; error?: string };
    redis?: { ok: boolean; enabled?: boolean; error?: string };
    qdrant?: { ok: boolean; error?: string };
  } | null;
  adminUsers: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    isActive: boolean;
    createdAt: string;
    counts: { documents: number; conversations: number; messages: number; bots: number };
  }>;
  adminDocuments: Document[];
  adminBots: Array<{
    id: string;
    name: string;
    prompt: string;
    createdAt: string;
    updatedAt: string;
    owner: { id: string; name: string; email: string };
    documents: { id: string; displayName: string }[];
  }>;
  adminUploadBatches: Array<{
    id: string;
    displayName: string;
    status: string;
    progressCurrent: number;
    progressTotal: number;
    progressMessage?: string;
    progressFileName?: string;
    createdAt: string;
    user: { id: string; name: string };
  }>;
  adminLoading: boolean;
  adminError: string | null;
  onLoadAdminData: () => Promise<void>;
  onLoadSupportData: () => Promise<void>;
  supportPendingUsers: Array<{ id: string; name: string; email: string; createdAt: string }>;
  supportLogs: Array<{ id: string; level: string; message: string; meta?: unknown; createdAt: string }>;
  onSupportApproval: (userId: string, status: 'approved' | 'rejected') => Promise<void>;
  onDownloadSupportReport: () => Promise<any>;
  onAdminUpdateUser: (userId: string, data: { role?: string; isActive?: boolean }) => Promise<void>;
  onAdminDeleteUser: (userId: string) => Promise<void>;
  onAdminDeleteDocument: (documentId: string) => Promise<void>;
  onAdminDeleteBot: (botId: string) => Promise<void>;
  onAdminBackup: () => Promise<any>;
  onAdminRestore: (payload: any) => Promise<void>;
}

const DashboardPage: React.FC<DashboardPageProps> = ({
  user,
  bots,
  selectedBot,
  documents,
  documentsLoading,
  conversations,
  conversationsLoading,
  selectedConversationId,
  selectedDocument,
  activePanel,
  hasApiKey,
  chatHistory,
  isQueryLoading,
  onFeedback,
  retryPrompt,
  onRetryPrompt,
  onSelectBot,
  onSelectBotForChat,
  onCreateBot,
  onUpdateBot,
  onDeleteBot,
  onSelectDocument,
  onLoadDocument,
  onChangePassword,
  onSelectConversation,
  onDeleteConversation,
  onClearConversations,
  onShowHistory,
  onEnsureBotsLoaded,
  onUpdateDocument,
  onDeleteDocument,
  onShareDocument,
  onRemoveDocumentShare,
  onUploadComplete,
  onSendMessage,
  onNewChat,
  onChangePanel,
  onLogout,
  adminMetrics,
  adminUsers,
  adminDocuments,
  adminBots,
  adminUploadBatches,
  healthStatus,
  adminLoading,
  adminError,
  onLoadAdminData,
  onLoadSupportData,
  supportPendingUsers,
  supportLogs,
  onSupportApproval,
  onDownloadSupportReport,
  onAdminUpdateUser,
  onAdminDeleteUser,
  onAdminDeleteDocument,
  onAdminDeleteBot,
  onAdminBackup,
  onAdminRestore,
}) => {
  const [botName, setBotName] = useState('');
  const [botPrompt, setBotPrompt] = useState('');
  const [botDescription, setBotDescription] = useState('');
  const [botModel, setBotModel] = useState('Model 1');
  const [botAvatarUrl, setBotAvatarUrl] = useState<string | null>(null);
  const [botError, setBotError] = useState<string | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [isCreatingBot, setIsCreatingBot] = useState(false);
  const [createBotDocIds, setCreateBotDocIds] = useState<string[]>([]);
  const [isCreateBotView, setIsCreateBotView] = useState(false);
  const [isSelectKnowledgeOpen, setIsSelectKnowledgeOpen] = useState(false);
  const [isEditBotOpen, setIsEditBotOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editBotName, setEditBotName] = useState('');
  const [editBotPrompt, setEditBotPrompt] = useState('');
  const [editBotDescription, setEditBotDescription] = useState('');
  const [editBotModel, setEditBotModel] = useState('');
  const [editBotAvatarUrl, setEditBotAvatarUrl] = useState<string | null>(null);
  const [isBotAvatarOpen, setIsBotAvatarOpen] = useState(false);
  const [avatarSourceType, setAvatarSourceType] = useState<'url' | 'file'>('url');
  const [avatarUrlInput, setAvatarUrlInput] = useState('');
  const [avatarTarget, setAvatarTarget] = useState<'create' | 'edit'>('create');
  const [editBotError, setEditBotError] = useState<string | null>(null);
  const [isSavingBot, setIsSavingBot] = useState(false);
  const [editBotDocIds, setEditBotDocIds] = useState<string[]>([]);
  const [expandedDocId, setExpandedDocId] = useState<string | null>(null);
  const [isEditDocOpen, setIsEditDocOpen] = useState(false);
  const [isEditDocLoading, setIsEditDocLoading] = useState(false);
  const [editingDoc, setEditingDoc] = useState<Document | null>(null);
  const [editDocName, setEditDocName] = useState('');
  const [editDocFiles, setEditDocFiles] = useState<Array<{ name: string; size: number; type: string; text?: string; blocks?: { label: string; text: string }[]; source?: 'text' | 'pdf' }>>([]);
  const [editDocError, setEditDocError] = useState<string | null>(null);
  const [isSavingDoc, setIsSavingDoc] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareRole, setShareRole] = useState<'viewer' | 'editor'>('viewer');
  const [shareError, setShareError] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isRemovingShare, setIsRemovingShare] = useState<string | null>(null);
  const [editDocShares, setEditDocShares] = useState<Array<{ id: string; role?: 'viewer' | 'editor'; user: { id: string; email: string; name: string } }>>([]);
  const [botSearch, setBotSearch] = useState('');
  const [knowledgeSearch, setKnowledgeSearch] = useState('');
  const [knowledgeTagFilter, setKnowledgeTagFilter] = useState('all');
  const [knowledgeSort, setKnowledgeSort] = useState<'created_desc' | 'created_asc' | 'name_asc' | 'name_desc'>('created_desc');
  const [editDocTagsInput, setEditDocTagsInput] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [autoOpenUpload, setAutoOpenUpload] = useState(false);
  const [isSidebarHidden, setIsSidebarHidden] = useState(false);
  const [hideOnboarding, setHideOnboarding] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    onConfirm: () => void;
  } | null>(null);

  const conversationTitle = useMemo(() => {
    const conversation = conversations.find((item) => item.id === selectedConversationId);
    return conversation?.title || conversation?.lastMessage || conversation?.document.displayName;
  }, [conversations, selectedConversationId]);
  const isSupportOnly = user.role === 'support' || user.role === 'admin_metrics';
  const botModelOptions = ['gpt-4o-mini', 'gpt-4o'];

  useEffect(() => {
    if (editingDoc) {
      setEditDocShares(editingDoc.shares ?? []);
      setEditDocTagsInput((editingDoc.tags ?? []).join(', '));
    } else {
      setEditDocShares([]);
      setEditDocTagsInput('');
    }
    setShareEmail('');
    setShareRole('viewer');
    setShareError(null);
  }, [editingDoc]);

  useEffect(() => {
    if (activePanel === 'admin') {
      onLoadAdminData();
      onLoadSupportData();
    }
  }, [activePanel, onLoadAdminData, onLoadSupportData]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = `onboarding:${user.id}`;
    const value = window.localStorage.getItem(key);
    setHideOnboarding(value === 'true');
  }, [user.id]);

  useEffect(() => {
    if (activePanel === 'knowledge') {
      if (autoOpenUpload) {
        setShowUpload(true);
        setAutoOpenUpload(false);
      } else {
        setShowUpload(false);
      }
    }
  }, [activePanel, autoOpenUpload]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const updateStatus = () => setIsOffline(!navigator.onLine);
    updateStatus();
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  const onboardingSteps = useMemo(() => ([
    {
      id: 'knowledge',
      label: 'Create your first knowledge',
      done: documents.length > 0,
      action: () => onChangePanel('knowledge'),
    },
    {
      id: 'bot',
      label: 'Create your first bot',
      done: bots.length > 0,
      action: () => onChangePanel('bots'),
    },
    {
      id: 'chat',
      label: 'Start your first chat',
      done: conversations.length > 0,
      action: () => onChangePanel('chat'),
    },
  ]), [bots.length, conversations.length, documents.length, onChangePanel]);

  const completedOnboarding = onboardingSteps.every((step) => step.done);
  const showOnboarding = !isSupportOnly && !hideOnboarding && !completedOnboarding;

  const handleDismissOnboarding = () => {
    try {
      window.localStorage.setItem(`onboarding:${user.id}`, 'true');
    } catch {
      // Ignore storage errors
    }
    setHideOnboarding(true);
  };

  useEffect(() => {
    setChatError(null);
  }, [selectedDocument?.id]);

  const handleCreateBot = async () => {
    if (!botName.trim() || !botPrompt.trim()) {
      setBotError('Name and prompt are required.');
      return;
    }
    setBotError(null);
    setIsCreatingBot(true);
    try {
      await onCreateBot(
        botName.trim(),
        botPrompt.trim(),
        createBotDocIds,
        botDescription.trim() || null,
        botModel,
        botAvatarUrl,
      );
      setBotName('');
      setBotPrompt('');
      setBotDescription('');
      setBotModel(botModelOptions[0]);
      setBotAvatarUrl(null);
      setCreateBotDocIds([]);
      setIsCreateBotView(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create bot.';
      setBotError(message);
    } finally {
      setIsCreatingBot(false);
    }
  };

  const openCreateBotView = () => {
    setBotName('');
    setBotPrompt('');
    setBotDescription('');
    setBotModel(botModelOptions[0]);
    setBotAvatarUrl(null);
    setCreateBotDocIds([]);
    setBotError(null);
    setIsCreateBotView(true);
  };

  const openAvatarPopup = (target: 'create' | 'edit') => {
    setAvatarTarget(target);
    const current = target === 'create' ? botAvatarUrl : editBotAvatarUrl;
    setAvatarUrlInput(current ?? '');
    setAvatarSourceType('url');
    setIsBotAvatarOpen(true);
  };

  const applyAvatarUrl = (url: string | null) => {
    if (avatarTarget === 'create') {
      setBotAvatarUrl(url);
    } else {
      setEditBotAvatarUrl(url);
    }
  };

  const fileToDataUrl = (blob: Blob) =>
    new Promise<string | null>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });

  const compressAvatarFile = async (file: File) => {
    if (!file.type.startsWith('image/') || typeof createImageBitmap !== 'function') {
      return file;
    }
    try {
      const bitmap = await createImageBitmap(file);
      const maxSize = 256;
      const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
      const targetWidth = Math.max(1, Math.round(bitmap.width * scale));
      const targetHeight = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.8),
      );
      return blob ?? file;
    } catch {
      return file;
    }
  };

  const handleAvatarFile = async (file: File) => {
    try {
      const compressed = await compressAvatarFile(file);
      const result = await fileToDataUrl(compressed);
      if (result) {
        applyAvatarUrl(result);
        setAvatarUrlInput('');
        setIsBotAvatarOpen(false);
      }
    } catch {
      setBotError('Failed to load avatar file.');
    }
  };

  const openEditBot = (bot: Bot) => {
    setEditBotName(bot.name);
    setEditBotPrompt(bot.prompt);
    setEditBotDescription(bot.description ?? '');
    setEditBotModel(bot.model ?? botModelOptions[0]);
    setEditBotAvatarUrl(bot.avatarUrl ?? null);
    setEditBotDocIds(bot.documents?.map((doc) => doc.id) ?? []);
    setEditBotError(null);
    setIsEditBotOpen(true);
  };

  const handleUpdateBot = async () => {
    if (!selectedBot) return;
    if (!editBotName.trim() || !editBotPrompt.trim()) {
      setEditBotError('Name and prompt are required.');
      return;
    }
    setIsSavingBot(true);
    try {
      await onUpdateBot(selectedBot.id, {
        name: editBotName.trim(),
        prompt: editBotPrompt.trim(),
        description: editBotDescription.trim() || null,
        model: editBotModel,
        avatarUrl: editBotAvatarUrl,
        documentIds: editBotDocIds,
      });
      setIsEditBotOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update bot.';
      setEditBotError(message);
    } finally {
      setIsSavingBot(false);
    }
  };

  const openEditDocument = async (doc: Document) => {
    setEditDocError(null);
    setIsEditDocLoading(true);
    setEditingDoc(doc);
    setEditDocName(doc.displayName);
    setEditDocTagsInput((doc.tags ?? []).join(', '));
    setEditDocFiles(
      (doc.sourceFiles ?? []).map((file) => ({
        ...file,
        blocks: file.blocks && file.blocks.length > 0
          ? file.blocks
          : file.text
            ? buildBlocksFromText(file.text)
            : [],
      })),
    );
    setIsEditDocOpen(true);

    try {
      const fullDoc = await onLoadDocument(doc.id);
      setEditingDoc(fullDoc);
      setEditDocName(fullDoc.displayName);
      setEditDocTagsInput((fullDoc.tags ?? []).join(', '));
      setEditDocFiles(
        (fullDoc.sourceFiles ?? []).map((file) => ({
          ...file,
          blocks: file.blocks && file.blocks.length > 0
            ? file.blocks
            : file.text
              ? buildBlocksFromText(file.text)
              : [],
        })),
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load document.';
      setEditDocError(message);
    } finally {
      setIsEditDocLoading(false);
    }
  };

  const handleUpdateDocument = async () => {
    if (!editingDoc) return;
    if (!editDocName.trim()) {
      setEditDocError('Document name is required.');
      return;
    }
    if (editDocFiles.some((file) => !file.name.trim())) {
      setEditDocError('File name cannot be empty.');
      return;
    }
    const tags = parseTagInput(editDocTagsInput);
    setIsSavingDoc(true);
    try {
      await onUpdateDocument(editingDoc.id, {
        displayName: editDocName.trim(),
        sourceFiles: editDocFiles.map((file) => ({ ...file, name: file.name.trim() })),
        tags,
      });
      setIsEditDocOpen(false);
      setEditingDoc(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update document.';
      setEditDocError(message);
    } finally {
      setIsSavingDoc(false);
    }
  };

  const handleAddShare = async () => {
    if (!editingDoc) return;
    if (!shareEmail.trim()) {
      setShareError('Email is required.');
      return;
    }
    setShareError(null);
    setIsSharing(true);
    try {
      const shares = await onShareDocument(editingDoc.id, shareEmail.trim(), shareRole);
      setEditDocShares(shares);
      setShareEmail('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to share document.';
      setShareError(message);
    } finally {
      setIsSharing(false);
    }
  };

  const handleRemoveShare = async (email: string, shareId: string) => {
    if (!editingDoc) return;
    setShareError(null);
    setIsRemovingShare(shareId);
    try {
      const shares = await onRemoveDocumentShare(editingDoc.id, email);
      setEditDocShares(shares);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to remove share.';
      setShareError(message);
    } finally {
      setIsRemovingShare(null);
    }
  };

  const handleUpdateShareRole = async (email: string, role: 'viewer' | 'editor') => {
    if (!editingDoc) return;
    setShareError(null);
    setIsSharing(true);
    try {
      const shares = await onShareDocument(editingDoc.id, email, role);
      setEditDocShares(shares);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update share role.';
      setShareError(message);
    } finally {
      setIsSharing(false);
    }
  };

  

  const openConfirmDialog = (dialog: { title: string; message: string; confirmLabel?: string; onConfirm: () => void }) => {
    setConfirmDialog(dialog);
  };

  type ExtractResult = { text: string; blocks: { label: string; text: string }[]; source: 'text' | 'pdf' };

  const extractTextFromPdf = async (pdf: PDFDocumentProxy): Promise<ExtractResult> => {
    const blocks: { label: string; text: string }[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => {
          if (!('str' in item)) return '';
          const text = item.str ?? '';
          const hasEol = 'hasEOL' in item && item.hasEOL;
          return text + (hasEol ? '\n' : ' ');
        })
        .join('')
        .trim();
      if (pageText) {
        blocks.push(...buildBlocksFromText(pageText, `Page ${pageNumber}`));
      }
    }
    const text = blocks.map((block) => block.text).join('\n\n');
    return { text, blocks, source: 'pdf' };
  };

  const extractTextFromFile = async (file: File): Promise<ExtractResult> => {
    const isText =
      file.type.startsWith('text/') || /\.(txt|md)$/i.test(file.name);
    if (isText) {
      const text = await file.text();
      return { text, blocks: buildBlocksFromText(text), source: 'text' };
    }
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      const buffer = await file.arrayBuffer();
      const pdfjs = await loadPdfjs();
      const pdf = await pdfjs.getDocument({ data: buffer }).promise;
      return await extractTextFromPdf(pdf);
    }
    return { text: '', blocks: [], source: 'text' };
  };

  const handleLoadFileText = async (index: number, file: File) => {
    setEditDocError(null);
    try {
      const { text, blocks, source } = await extractTextFromFile(file);
      const next = [...editDocFiles];
      next[index] = {
        ...next[index],
        text,
        blocks,
        source,
        size: file.size,
        type: file.type,
      };
      setEditDocFiles(next);
      if (!text) {
        setEditDocError('No text extracted. Paste text manually if needed.');
      }
    } catch (error) {
      console.error('Failed to extract text', error);
      setEditDocError('Failed to extract text from the file.');
    }
  };

  const toggleDocId = (docId: string, list: string[], setList: (next: string[]) => void) => {
    if (list.includes(docId)) {
      setList(list.filter((id) => id !== docId));
    } else {
      setList([...list, docId]);
    }
  };

  const buildBlocksFromText = (text: string, labelPrefix?: string) => {
    const normalized = text.replace(/\r\n/g, '\n').trim();
    if (!normalized) return [];

    const chunkSize = 1800;
    const overlap = 100;
    const chunks: string[] = [];
    let start = 0;
    while (start < normalized.length) {
      const end = Math.min(start + chunkSize, normalized.length);
      const slice = normalized.slice(start, end).trim();
      if (slice) {
        chunks.push(slice);
      }
      if (end === normalized.length) break;
      start = Math.max(0, end - overlap);
    }

    return chunks.map((chunk, index) => ({
      label: labelPrefix ? `${labelPrefix} • Chunk ${index + 1}` : `Chunk ${index + 1}`,
      text: chunk,
    }));
  };

  const removeEditDocFile = (index: number) => {
    setEditDocFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const activeDocName = conversationTitle || selectedDocument?.displayName || 'Home';

  return (
    <div className="h-screen bg-slate-50 text-slate-800 flex">
      <Sidebar
        user={user}
        isSidebarHidden={isSidebarHidden}
        isSupportOnly={isSupportOnly}
        activePanel={activePanel}
        conversations={conversations}
        conversationsLoading={conversationsLoading}
        selectedConversationId={selectedConversationId}
        pendingUsersCount={adminMetrics?.pendingUsersCount ?? 0}
        onChangePanel={onChangePanel}
        onSelectConversation={onSelectConversation}
        onDeleteConversation={onDeleteConversation}
        onClearConversations={onClearConversations}
        onShowHistory={onShowHistory}
        onLoadAdminData={onLoadAdminData}
        onLoadSupportData={onLoadSupportData}
        onLogout={onLogout}
        onHideSidebar={() => setIsSidebarHidden(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
      />

      <main className={`flex-1 overflow-y-auto p-6 bg-white relative z-0 ${isSidebarHidden ? 'pl-16' : ''}`}>
        {isOffline && (
          <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 text-yellow-700 text-sm px-3 py-2">
            You are offline. Some actions may fail until the connection is restored.
          </div>
        )}
        {isSidebarHidden && (
          <button
            onClick={() => setIsSidebarHidden(false)}
            className="absolute left-4 top-4 h-8 w-8 rounded-full bg-slate-300 text-slate-700 hover:text-slate-900 shadow flex items-center justify-center text-lg"
            title="Show sidebar"
          >
            ›
          </button>
        )}
        {showOnboarding && (
          <div className="mb-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Getting started</h3>
                <p className="text-sm text-slate-500">Complete the basics to start using the app.</p>
              </div>
              <button
                onClick={handleDismissOnboarding}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Dismiss
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {onboardingSteps.map((step) => (
                <div
                  key={step.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                >
                  <div className="flex items-center gap-2 text-sm">
                    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                      step.done ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                    }`}>
                      {step.done ? '✓' : '•'}
                    </span>
                    <span className={step.done ? 'text-slate-500 line-through' : 'text-slate-800'}>
                      {step.label}
                    </span>
                  </div>
                  {!step.done && (
                    <button
                      onClick={step.action}
                      className="text-xs font-semibold text-yellow-700 hover:text-yellow-800"
                    >
                      Go →
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {!isSupportOnly && activePanel === 'knowledge' && (
          <KnowledgePanel
            documents={documents}
            documentsLoading={documentsLoading}
            knowledgeSearch={knowledgeSearch}
            onKnowledgeSearch={setKnowledgeSearch}
            knowledgeTagFilter={knowledgeTagFilter}
            onKnowledgeTagFilter={setKnowledgeTagFilter}
            knowledgeSort={knowledgeSort}
            onKnowledgeSort={setKnowledgeSort}
            showUpload={showUpload}
            onShowUpload={setShowUpload}
            onUploadComplete={onUploadComplete}
            onSelectDocument={onSelectDocument}
            onOpenEditDocument={openEditDocument}
            onConfirmDelete={(doc) =>
              openConfirmDialog({
                title: 'Delete knowledge',
                message: `Delete "${doc.displayName}"? This cannot be undone.`,
                confirmLabel: 'Delete',
                onConfirm: () => onDeleteDocument(doc.id),
              })
            }
            hasApiKey={hasApiKey}
            currentUserId={user.id}
          />
        )}
        {!isSupportOnly && activePanel === 'bots' && (
          <BotsPanel
            bots={bots}
            isCreateBotView={isCreateBotView}
            botAvatarUrl={botAvatarUrl}
            botName={botName}
            botModel={botModel}
            botModelOptions={botModelOptions}
            botDescription={botDescription}
            botPrompt={botPrompt}
            botError={botError}
            isCreatingBot={isCreatingBot}
            createBotDocIds={createBotDocIds}
            botSearch={botSearch}
            onSetBotName={setBotName}
            onSetBotModel={setBotModel}
            onSetBotDescription={setBotDescription}
            onSetBotPrompt={setBotPrompt}
            onSetBotSearch={setBotSearch}
            onBackFromCreate={() => setIsCreateBotView(false)}
            onOpenCreate={openCreateBotView}
            onOpenAvatarPopup={openAvatarPopup}
            onOpenSelectKnowledge={() => setIsSelectKnowledgeOpen(true)}
            onCreateBot={handleCreateBot}
            onSelectBot={onSelectBot}
            onEditBot={openEditBot}
            onDeleteBot={onDeleteBot}
          />
        )}
        {!isSupportOnly && activePanel === 'integration' && <IntegrationPanel />}
        {!isSupportOnly && activePanel === 'chat' && (
          <ChatPanel
            bots={bots}
            selectedBot={selectedBot}
            selectedDocument={selectedDocument}
            activeDocName={activeDocName}
            chatHistory={chatHistory}
            isQueryLoading={isQueryLoading}
            chatError={chatError}
            onSetChatError={setChatError}
            onSendMessage={onSendMessage}
            onNewChat={onNewChat}
            onFeedback={onFeedback}
            retryPrompt={retryPrompt}
            onRetryPrompt={onRetryPrompt}
            onSelectBotForChat={onSelectBotForChat}
            onEnsureBotsLoaded={onEnsureBotsLoaded}
            onChangePanel={onChangePanel}
          />
        )}
        {activePanel === 'admin' && ['admin', 'support', 'admin_metrics'].includes(user.role ?? 'user') && (
          <AdminPanel
            user={user}
            adminMetrics={adminMetrics}
            healthStatus={healthStatus}
            adminUsers={adminUsers}
            adminDocuments={adminDocuments}
            adminBots={adminBots}
            adminUploadBatches={adminUploadBatches}
            adminLoading={adminLoading}
            adminError={adminError}
            supportPendingUsers={supportPendingUsers}
            supportLogs={supportLogs}
            onLoadAdminData={onLoadAdminData}
            onLoadSupportData={onLoadSupportData}
            onSupportApproval={onSupportApproval}
            onDownloadSupportReport={onDownloadSupportReport}
            onAdminUpdateUser={onAdminUpdateUser}
            onAdminDeleteUser={onAdminDeleteUser}
            onAdminDeleteDocument={onAdminDeleteDocument}
            onAdminDeleteBot={onAdminDeleteBot}
            onAdminBackup={onAdminBackup}
            onAdminRestore={onAdminRestore}
            openConfirmDialog={openConfirmDialog}
          />
        )}
      </main>

      <EditBotModal
        isOpen={isEditBotOpen && Boolean(selectedBot)}
        botModelOptions={botModelOptions}
        editBotName={editBotName}
        editBotModel={editBotModel}
        editBotDescription={editBotDescription}
        editBotPrompt={editBotPrompt}
        editBotDocIds={editBotDocIds}
        documents={documents}
        editBotError={editBotError}
        isSavingBot={isSavingBot}
        onChangeName={setEditBotName}
        onChangeModel={setEditBotModel}
        onChangeDescription={setEditBotDescription}
        onChangePrompt={setEditBotPrompt}
        onToggleDoc={(docId) => toggleDocId(docId, editBotDocIds, setEditBotDocIds)}
        onOpenAvatarPopup={() => openAvatarPopup('edit')}
        onClose={() => {
          setIsEditBotOpen(false);
          setEditBotError(null);
        }}
        onSave={handleUpdateBot}
      />
      <EditDocumentModal
        isOpen={isEditDocOpen}
        isLoading={isEditDocLoading}
        editingDoc={editingDoc}
        editDocName={editDocName}
        editDocTagsInput={editDocTagsInput}
        shareEmail={shareEmail}
        shareRole={shareRole}
        editDocShares={editDocShares}
        editDocFiles={editDocFiles}
        shareError={shareError}
        editDocError={editDocError}
        isSharing={isSharing}
        isSavingDoc={isSavingDoc}
        isRemovingShare={isRemovingShare}
        canManageShares={Boolean(editingDoc?.ownerId && editingDoc.ownerId === user.id)}
        onChangeName={setEditDocName}
        onChangeTags={setEditDocTagsInput}
        onChangeShareEmail={setShareEmail}
        onChangeShareRole={setShareRole}
        onAddShare={handleAddShare}
        onRemoveShare={handleRemoveShare}
        onUpdateShareRole={handleUpdateShareRole}
        onLoadFileText={handleLoadFileText}
        onRemoveFile={removeEditDocFile}
        onUpdateFiles={setEditDocFiles}
        onSave={handleUpdateDocument}
        onClose={() => {
          setIsEditDocOpen(false);
          setEditingDoc(null);
          setEditDocError(null);
          setIsEditDocLoading(false);
        }}
        openConfirmDialog={openConfirmDialog}
      />
      <SelectKnowledgeModal
        isOpen={isSelectKnowledgeOpen}
        documents={documents}
        selectedIds={createBotDocIds}
        onToggle={(docId) => toggleDocId(docId, createBotDocIds, setCreateBotDocIds)}
        onClose={() => setIsSelectKnowledgeOpen(false)}
      />
      <BotAvatarModal
        isOpen={isBotAvatarOpen}
        avatarSourceType={avatarSourceType}
        avatarUrlInput={avatarUrlInput}
        onChangeSourceType={setAvatarSourceType}
        onChangeUrlInput={setAvatarUrlInput}
        onPickFile={handleAvatarFile}
        onApplyUrl={applyAvatarUrl}
        onClose={() => setIsBotAvatarOpen(false)}
      />
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onChangePassword={onChangePassword}
      />
      <ConfirmDialogModal
        dialog={confirmDialog}
        onClose={() => setConfirmDialog(null)}
      />
    </div>
  );
};

export default DashboardPage;
