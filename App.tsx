/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bot, ChatMessage, ConversationSummary, Document, User } from './types';
import * as api from './services/api';
import AuthScreen from './components/AuthScreen';
import DashboardPage from './components/DashboardPage';

type View = 'auth' | 'dashboard';
type Panel = 'chat' | 'knowledge' | 'bots' | 'admin' | 'integration';

const readJson = <T,>(key: string): T | null => {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        return JSON.parse(raw) as T;
    } catch {
        return null;
    }
};

const writeJson = (key: string, value: unknown) => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Ignore storage failures (quota/private mode)
    }
};

const cacheKey = (userId: string, type: string) => `cache:${userId}:${type}`;
const selectionKey = (userId: string) => `cache:${userId}:selection`;
const messagesCacheKey = (userId: string, conversationId: string) =>
    `cache:${userId}:messages:${conversationId}`;
const clampMessages = (history: ChatMessage[], limit = 50) =>
    history.length > limit ? history.slice(-limit) : history;
const stripSourceFiles = (sourceFiles?: Document['sourceFiles']) => {
    if (!Array.isArray(sourceFiles)) return sourceFiles;
    return sourceFiles.map((file) => {
        if (!file || typeof file !== 'object') return file;
        const { text, blocks, ...rest } = file;
        return rest;
    });
};
const toDocumentSummary = (doc: Document): Document => ({
    ...doc,
    sourceFiles: stripSourceFiles(doc.sourceFiles),
});

const App: React.FC = () => {
    const [view, setView] = useState<View>('auth');
    const [user, setUser] = useState<User | null>(null);
    const [authError, setAuthError] = useState<string | null>(null);
    const [authLoading, setAuthLoading] = useState(false);
    const [pendingApproval, setPendingApproval] = useState(false);
    const [pendingEmail, setPendingEmail] = useState<string | null>(null);

    const [documents, setDocuments] = useState<Document[]>([]);
    const [documentsLoading, setDocumentsLoading] = useState(false);
    const [documentsLoaded, setDocumentsLoaded] = useState(false);
    const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const [conversationsLoading, setConversationsLoading] = useState(false);
    const [conversationsLoaded, setConversationsLoaded] = useState(false);
    const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
    const [lastFailedMessage, setLastFailedMessage] = useState<string | null>(null);
    const [lastFailedConversationId, setLastFailedConversationId] = useState<string | null>(null);

    const [bots, setBots] = useState<Bot[]>([]);
    const [selectedBot, setSelectedBot] = useState<Bot | null>(null);
    const [botsLoaded, setBotsLoaded] = useState(false);
    const lastConversationRefreshRef = useRef(0);
    const [activePanel, setActivePanel] = useState<Panel>('chat');

    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [isQueryLoading, setIsQueryLoading] = useState(false);
    const hasApiKey = Boolean(process.env.GEMINI_API_KEY);

    const [adminMetrics, setAdminMetrics] = useState<{
        usersCount: number;
        documentsCount: number;
        conversationsCount: number;
        messagesCount: number;
        uploadBatchesCount: number;
        pendingUsersCount: number;
        botsCount: number;
        timestamp: string;
    } | null>(null);
    const [adminUsers, setAdminUsers] = useState<Array<{
        id: string;
        name: string;
        email: string;
        role: string;
        isActive: boolean;
        createdAt: string;
        counts: { documents: number; conversations: number; messages: number; bots: number };
    }>>([]);
    const [adminDocuments, setAdminDocuments] = useState<Document[]>([]);
    const [adminBots, setAdminBots] = useState<Array<{
        id: string;
        name: string;
        prompt: string;
        createdAt: string;
        updatedAt: string;
        owner: { id: string; name: string; email: string };
        documents: { id: string; displayName: string }[];
    }>>([]);
    const [adminUploadBatches, setAdminUploadBatches] = useState<Array<{
        id: string;
        displayName: string;
        status: string;
        progressCurrent: number;
        progressTotal: number;
        progressMessage?: string;
        progressFileName?: string;
        createdAt: string;
        user: { id: string; name: string };
    }>>([]);
    const [adminLoading, setAdminLoading] = useState(false);
    const [adminError, setAdminError] = useState<string | null>(null);
    const [healthStatus, setHealthStatus] = useState<{
        ok: boolean;
        database?: { ok: boolean; error?: string };
        redis?: { ok: boolean; enabled?: boolean; error?: string };
        qdrant?: { ok: boolean; error?: string };
    } | null>(null);
    const [supportPendingUsers, setSupportPendingUsers] = useState<Array<{ id: string; name: string; email: string; createdAt: string }>>([]);
    const [supportLogs, setSupportLogs] = useState<Array<{ id: string; level: string; message: string; meta?: unknown; createdAt: string }>>([]);
    const pendingBotIdRef = useRef<string | null>(null);
    const messagesCacheRef = useRef(new Map<string, ChatMessage[]>());
    const activeConversationRef = useRef<string | null>(null);
    
    const loadDocuments = useCallback(async () => {
        if (!user) return;
        setDocumentsLoading(true);
        try {
            const data = await api.getDocuments();
            const summaries = data.map(toDocumentSummary);
            setDocuments(summaries);
            setDocumentsLoaded(true);
            writeJson(cacheKey(user.id, 'docs'), summaries);
        } catch (err) {
            console.error("Failed to load documents:", err);
        } finally {
            setDocumentsLoading(false);
        }
    }, [user]);

    const loadConversations = useCallback(async () => {
        if (!user) return;
        setConversationsLoading(true);
        try {
            const data = await api.getConversations();
            setConversations(data);
            setConversationsLoaded(true);
            writeJson(cacheKey(user.id, 'conversations'), data);
        } catch (err) {
            console.error("Failed to load conversations:", err);
        } finally {
            setConversationsLoading(false);
        }
    }, [user]);

    const refreshConversations = useCallback(() => {
        const now = Date.now();
        if (now - lastConversationRefreshRef.current < 8000) {
            return;
        }
        lastConversationRefreshRef.current = now;
        loadConversations().catch((error) =>
            console.error("Failed to refresh conversations:", error),
        );
    }, [loadConversations]);

    const loadBots = useCallback(async () => {
        if (!user) return;
        try {
            const data = await api.getBots();
            setBots(data);
            setBotsLoaded(true);
            writeJson(cacheKey(user.id, 'bots'), data);
            if (pendingBotIdRef.current) {
                const match = data.find((bot) => bot.id === pendingBotIdRef.current) || null;
                if (match) {
                    setSelectedBot(match);
                }
                pendingBotIdRef.current = null;
            }
        } catch (err) {
            console.error("Failed to load bots:", err);
        }
    }, [user]);

    const ensureBotsLoaded = useCallback(() => {
        if (!botsLoaded) {
            loadBots().catch((error) => console.error("Failed to load bots:", error));
            return;
        }
        loadBots().catch((error) => console.error("Failed to refresh bots:", error));
    }, [botsLoaded, loadBots]);

    const ensureConversationsLoaded = useCallback(() => {
        if (!conversationsLoaded && !conversationsLoading) {
            loadConversations().catch((error) =>
                console.error("Failed to load conversations:", error),
            );
            return;
        }
        if (conversationsLoaded) {
            refreshConversations();
        }
    }, [conversationsLoaded, conversationsLoading, loadConversations, refreshConversations]);

    const hydrateCachedData = useCallback((userId: string) => {
        const cachedDocs = readJson<Document[]>(cacheKey(userId, 'docs'));
        if (cachedDocs) {
            const summaries = cachedDocs.map(toDocumentSummary);
            setDocuments(summaries);
            setDocumentsLoaded(true);
        }
        const cachedBots = readJson<Bot[]>(cacheKey(userId, 'bots'));
        if (cachedBots) {
            setBots(cachedBots);
            setBotsLoaded(true);
        }
        const cachedConversations = readJson<ConversationSummary[]>(cacheKey(userId, 'conversations'));
        if (cachedConversations) {
            setConversations(cachedConversations);
            setConversationsLoaded(true);
        }
        const cachedSelection = readJson<{
            document?: { id: string; displayName: string } | null;
            botId?: string | null;
            conversationId?: string | null;
        }>(selectionKey(userId));
        if (cachedSelection?.document) {
            setSelectedDocument(cachedSelection.document);
        }
        if (cachedSelection?.botId) {
            const match = cachedBots?.find((bot) => bot.id === cachedSelection.botId) || null;
            if (match) {
                setSelectedBot(match);
            } else {
                pendingBotIdRef.current = cachedSelection.botId;
            }
        }
        if (cachedSelection?.conversationId) {
            setConversationId(cachedSelection.conversationId);
            setSelectedConversationId(cachedSelection.conversationId);
            const cachedMessages = readJson<ChatMessage[]>(
                messagesCacheKey(userId, cachedSelection.conversationId),
            );
            if (cachedMessages) {
                messagesCacheRef.current.set(cachedSelection.conversationId, cachedMessages);
                setChatHistory(cachedMessages);
            }
        }
    }, []);

    useEffect(() => {
        const bootstrap = async () => {
            try {
                const result = await api.getMe();
                setUser(result.user);
                hydrateCachedData(result.user.id);
                setView('dashboard');
            } catch {
                api.setSessionToken(null);
                setPendingApproval(false);
                setPendingEmail(null);
                setView('auth');
            }
        };

        bootstrap();
    }, [hydrateCachedData]);

    useEffect(() => {
        if (!user) return;
        if (user.role === 'support' || user.role === 'admin_metrics') {
            setActivePanel('admin');
        }
    }, [user]);

    useEffect(() => {
        activeConversationRef.current = conversationId;
    }, [conversationId]);

    useEffect(() => {
        if (!user) return;
        writeJson(selectionKey(user.id), {
            document: selectedDocument ? { id: selectedDocument.id, displayName: selectedDocument.displayName } : null,
            botId: selectedBot?.id ?? null,
            conversationId: conversationId ?? null,
        });
    }, [user, selectedDocument, selectedBot, conversationId]);

    useEffect(() => {
        if (!user || !conversationId) return;
        const trimmed = clampMessages(chatHistory);
        messagesCacheRef.current.set(conversationId, trimmed);
        writeJson(messagesCacheKey(user.id, conversationId), trimmed);
    }, [user, conversationId, chatHistory]);

    useEffect(() => {
        if (!user) return;
        if (activePanel === 'knowledge' && !documentsLoaded && !documentsLoading) {
            loadDocuments();
        }
        if (activePanel === 'bots' && !botsLoaded) {
            loadBots();
        }
    }, [
        activePanel,
        user,
        documentsLoaded,
        documentsLoading,
        conversationsLoaded,
        conversationsLoading,
        botsLoaded,
        loadDocuments,
        loadConversations,
        loadBots,
    ]);

    const handleLogin = async (email: string, password: string) => {
        setAuthLoading(true);
        setAuthError(null);
        try {
            const result = await api.login(email, password);
            api.setSessionToken(result.token);
            setUser(result.user);
            setPendingApproval(false);
            setPendingEmail(null);
            hydrateCachedData(result.user.id);
            setView('dashboard');
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Login failed';
            if (message.toLowerCase().includes('pending approval')) {
                setPendingApproval(true);
                setPendingEmail(email);
                setAuthError(null);
            } else {
                setAuthError(message);
            }
        } finally {
            setAuthLoading(false);
        }
    };

    const handleSignup = async (name: string, email: string, password: string) => {
        setAuthLoading(true);
        setAuthError(null);
        try {
            const result = await api.signup(name, email, password);
            if (result.pending || !result.token) {
                if (result.verificationRequired) {
                    setAuthError('Email not verified');
                } else {
                    setAuthError('Account pending approval. Please wait for approval.');
                    setPendingApproval(true);
                    setPendingEmail(email);
                }
                setView('auth');
                return;
            }
            api.setSessionToken(result.token);
            setUser(result.user);
            setPendingApproval(false);
            setPendingEmail(null);
            hydrateCachedData(result.user.id);
            setView('dashboard');
        } catch (err) {
            setAuthError(err instanceof Error ? err.message : 'Signup failed');
        } finally {
            setAuthLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await api.logout();
        } catch (err) {
            console.error("Logout failed:", err);
        } finally {
            api.setSessionToken(null);
            setUser(null);
            setPendingApproval(false);
            setPendingEmail(null);
            setSelectedDocument(null);
            setConversationId(null);
            setChatHistory([]);
            setSelectedConversationId(null);
            setConversations([]);
            setConversationsLoaded(false);
            setBots([]);
            setSelectedBot(null);
            setBotsLoaded(false);
            setDocumentsLoaded(false);
            setActivePanel('chat');
            setView('auth');
        }
    };

    const handleChangePassword = async (currentPassword: string, newPassword: string) => {
        await api.changePassword(currentPassword, newPassword);
    };

    const handleRequestPasswordReset = async (email: string) => {
        return api.requestPasswordReset(email);
    };

    const handleResetPassword = async (token: string, newPassword: string) => {
        await api.resetPassword(token, newPassword);
    };

    const handleVerifyEmail = async (token: string) => {
        await api.verifyEmail(token);
    };

    const handleResendVerification = async (email: string) => {
        return api.resendVerification(email);
    };

    const handleBackToLogin = () => {
        setPendingApproval(false);
        setPendingEmail(null);
        setAuthError(null);
    };

    const startConversation = useCallback(async (doc: Document, bot: Bot | null) => {
        setSelectedDocument(doc);
        setChatHistory([]);
        setActivePanel('chat');
        setLastFailedMessage(null);
        setLastFailedConversationId(null);

        try {
            const conversation = await api.createConversation(doc.id, bot?.id ?? null);
            setConversationId(conversation.id);
            setSelectedConversationId(conversation.id);
            refreshConversations();
        } catch (err) {
            console.error("Failed to create conversation:", err);
        }
    }, [loadConversations]);

    const handleSelectDocument = async (doc: Document) => {
        await startConversation(doc, selectedBot);
    };

    const handleNewChat = async () => {
        if (!selectedDocument) return;
        await startConversation(selectedDocument, selectedBot);
    };

    const handleUploadComplete = async (doc: Document) => {
        const summary = toDocumentSummary(doc);
        setDocuments((prev) => [summary, ...prev]);
        setActivePanel('knowledge');
    };

    const handleSelectConversation = async (conversation: ConversationSummary) => {
        setSelectedConversationId(conversation.id);
        setConversationId(conversation.id);
        setLastFailedMessage(null);
        setLastFailedConversationId(null);
        const docMatch = documents.find((doc) => doc.id === conversation.document.id);
        setSelectedDocument(
            docMatch ?? {
                id: conversation.document.id,
                displayName: conversation.document.displayName,
            },
        );

        const desiredBotId = conversation.bot?.id ?? null;
        const botFromList = desiredBotId
            ? bots.find((bot) => bot.id === desiredBotId) || null
            : null;
        setSelectedBot(botFromList);
        if (desiredBotId && !botFromList) {
            pendingBotIdRef.current = desiredBotId;
            ensureBotsLoaded();
        }
        setActivePanel('chat');
        if (user) {
            const cached = messagesCacheRef.current.get(conversation.id)
                ?? readJson<ChatMessage[]>(messagesCacheKey(user.id, conversation.id));
            if (cached) {
                messagesCacheRef.current.set(conversation.id, cached);
                setChatHistory(cached);
            } else {
                setChatHistory([]);
            }
        } else {
            setChatHistory([]);
        }

        const targetId = conversation.id;
        try {
            const messages = await api.getConversationMessages(targetId, 50);
            if (activeConversationRef.current !== targetId) return;
            const formatted = messages.map((msg) => {
                const role: 'user' | 'model' = msg.role === 'user' ? 'user' : 'model';
                return {
                    id: msg.id,
                    role,
                    parts: [{ text: msg.content }],
                    groundingChunks: msg.groundingChunks as any,
                    feedback: (msg as any).feedback ?? null,
                    createdAt: msg.createdAt,
                };
            });
            setChatHistory(formatted);
            if (user) {
                const trimmed = clampMessages(formatted);
                messagesCacheRef.current.set(targetId, trimmed);
                writeJson(messagesCacheKey(user.id, targetId), trimmed);
            }
        } catch (err) {
            console.error("Failed to load conversation messages:", err);
        }
    };

    const handleCreateBot = async (
        name: string,
        prompt: string,
        documentIds: string[],
        description?: string | null,
        model?: string | null,
        avatarUrl?: string | null,
    ) => {
        const bot = await api.createBot({ name, prompt, documentIds, description, model, avatarUrl });
        setBots((prev) => [bot, ...prev]);
        setSelectedBot(bot);
        setActivePanel('bots');
    };

    const handleUpdateBot = async (
        botId: string,
        data: { name?: string; prompt?: string; description?: string | null; model?: string | null; avatarUrl?: string | null; documentIds?: string[] },
    ) => {
        const updated = await api.updateBot(botId, data);
        setBots((prev) => prev.map((bot) => (bot.id === botId ? updated : bot)));
        if (selectedBot?.id === botId) {
            setSelectedBot(updated);
        }
        setConversations((prev) =>
            prev.map((conversation) =>
                conversation.bot?.id === botId
                    ? { ...conversation, bot: { id: botId, name: updated.name } }
                    : conversation,
            ),
        );
    };

    const handleDeleteBot = async (botId: string) => {
        await api.deleteBot(botId);
        setBots((prev) => prev.filter((bot) => bot.id !== botId));
        if (selectedBot?.id === botId) {
            setSelectedBot(null);
        }
    };

    const handleSelectBotForChat = async (bot: Bot) => {
        setSelectedBot(bot);
        setActivePanel('chat');

        const existingConversation = conversations.find((conversation) => conversation.bot?.id === bot.id);
        if (existingConversation) {
            await handleSelectConversation(existingConversation);
            return;
        }

        if (bot.documents && bot.documents.length > 0) {
            const docId = bot.documents[0].id;
            const docMatch = documents.find((doc) => doc.id === docId);
            setSelectedDocument(
                docMatch ?? {
                    id: docId,
                    displayName: bot.documents[0].displayName,
                },
            );
        }

        setSelectedConversationId(null);
        setConversationId(null);
        setChatHistory([]);
    };

    const handleDeleteConversation = async (conversationIdToDelete: string) => {
        await api.deleteConversation(conversationIdToDelete);
        setConversations((prev) => prev.filter((conversation) => conversation.id !== conversationIdToDelete));
        if (selectedConversationId === conversationIdToDelete) {
            setSelectedConversationId(null);
            setConversationId(null);
            setChatHistory([]);
        }
    };

    const handleClearConversations = async () => {
        await api.clearConversations();
        setConversations([]);
        setSelectedConversationId(null);
        setConversationId(null);
        setChatHistory([]);
        setLastFailedMessage(null);
        setLastFailedConversationId(null);
    };

    const handleLoadDocument = async (documentId: string) => {
        return api.getDocument(documentId);
    };

    const handleUpdateDocument = async (
        documentId: string,
        data: { displayName?: string; sourceFiles?: { name: string; size: number; type: string; text?: string; blocks?: { label: string; text: string }[] }[]; tags?: string[] },
    ) => {
        const updated = await api.updateDocument(documentId, data);
        const summary = toDocumentSummary(updated);
        setDocuments((prev) =>
            prev.map((doc) =>
                doc.id === documentId ? summary : doc,
            ),
        );
        if (selectedDocument?.id === documentId) {
            setSelectedDocument(summary);
        }
        setConversations((prev) =>
            prev.map((conversation) =>
                conversation.document.id === documentId
                    ? { ...conversation, document: { id: documentId, displayName: summary.displayName } }
                    : conversation,
            ),
        );
    };

    const handleShareDocument = async (documentId: string, email: string, role?: 'viewer' | 'editor') => {
        const shares = await api.addDocumentShare(documentId, email, role);
        setDocuments((prev) =>
            prev.map((doc) => (doc.id === documentId ? { ...doc, shares } : doc)),
        );
        if (selectedDocument?.id === documentId) {
            setSelectedDocument({ ...selectedDocument, shares });
        }
        return shares;
    };

    const handleRemoveDocumentShare = async (documentId: string, email: string) => {
        const shares = await api.removeDocumentShare(documentId, email);
        setDocuments((prev) =>
            prev.map((doc) => (doc.id === documentId ? { ...doc, shares } : doc)),
        );
        if (selectedDocument?.id === documentId) {
            setSelectedDocument({ ...selectedDocument, shares });
        }
        return shares;
    };

    const handleDeleteDocument = async (documentId: string) => {
        await api.deleteDocument(documentId);
        setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
        setConversations((prev) => prev.filter((conversation) => conversation.document.id !== documentId));
        if (selectedDocument?.id === documentId) {
            setSelectedDocument(null);
            setConversationId(null);
            setSelectedConversationId(null);
            setChatHistory([]);
        }
    };

    const loadAdminData = useCallback(async () => {
        if (!user) return;
        setAdminLoading(true);
        setAdminError(null);
        try {
            const [metrics, health] = await Promise.all([
                api.getAdminMetrics(),
                api.getHealth().catch(() => null),
            ]);
            setAdminMetrics(metrics);
            if (health) {
                setHealthStatus(health);
            }

            if (user.role === 'admin') {
                const [users, docs, bots, batches] = await Promise.all([
                    api.getAdminUsers(),
                    api.getAdminDocuments(),
                    api.getAdminBots(),
                    api.getAdminUploadBatches(),
                ]);
                setAdminUsers(users);
                setAdminDocuments(docs);
                setAdminBots(bots);
                setAdminUploadBatches(batches);
            } else {
                setAdminUsers([]);
                setAdminDocuments([]);
                setAdminBots([]);
                setAdminUploadBatches([]);
            }
        } catch (err) {
            setAdminError(err instanceof Error ? err.message : 'Failed to load admin data');
        } finally {
            setAdminLoading(false);
        }
    }, [user]);

    const loadSupportData = useCallback(async () => {
        if (!user || (user.role !== 'support' && user.role !== 'admin')) return;
        try {
            const [pending, logs] = await Promise.all([
                api.getSupportPendingUsers(),
                api.getSupportLogs(),
            ]);
            setSupportPendingUsers(pending);
            setSupportLogs(logs);
        } catch (err) {
            console.error('Failed to load support data', err);
        }
    }, [user]);

    const handleSupportApproval = async (userId: string, status: 'approved' | 'rejected') => {
        setSupportPendingUsers((prev) => prev.filter((item) => item.id !== userId));
        setAdminMetrics((prev) =>
            prev
                ? {
                    ...prev,
                    pendingUsersCount: Math.max(0, prev.pendingUsersCount - 1),
                }
                : prev,
        );
        try {
            await api.updateSupportPendingUser(userId, status);
            loadSupportData();
        } catch (error) {
            await loadSupportData();
            throw error;
        }
    };

    const handleDownloadSupportReport = async () => {
        return api.getSupportReport();
    };

    useEffect(() => {
        if (!user) return;
        if (user.role === 'support' || user.role === 'admin_metrics') {
            setActivePanel('admin');
        }
    }, [user]);

    useEffect(() => {
        if (!user) return;
        if (activePanel !== 'admin') return;
        if (user.role !== 'support' && user.role !== 'admin') return;
        const intervalId = setInterval(() => {
            loadSupportData();
        }, 15_000);
        return () => clearInterval(intervalId);
    }, [activePanel, loadSupportData, user]);

    const handleAdminUpdateUser = async (userId: string, data: { role?: string; isActive?: boolean }) => {
        const updated = await api.updateAdminUser(userId, data);
        setAdminUsers((prev) => prev.map((item) => (item.id === userId ? { ...item, ...updated } : item)));
        if (user?.id === userId) {
            setUser(updated);
        }
    };

    const handleAdminDeleteUser = async (userId: string) => {
        await api.deleteAdminUser(userId);
        setAdminUsers((prev) => prev.filter((item) => item.id !== userId));
    };

    const handleAdminDeleteDocument = async (documentId: string) => {
        await api.deleteAdminDocument(documentId);
        setAdminDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
        setDocuments((prev) => prev.filter((doc) => doc.id !== documentId));
    };

    const handleAdminDeleteBot = async (botId: string) => {
        await api.deleteAdminBot(botId);
        setAdminBots((prev) => prev.filter((bot) => bot.id !== botId));
        setBots((prev) => prev.filter((bot) => bot.id !== botId));
        if (selectedBot?.id === botId) {
            setSelectedBot(null);
        }
    };

    const handleAdminBackup = async () => {
        return api.getAdminBackup();
    };

    const handleAdminRestore = async (payload: any) => {
        await api.restoreAdminBackup(payload);
        await loadAdminData();
    };

    const handleSendMessage = async (message: string) => {
        if (!selectedDocument) {
            console.error("No document selected for chat.");
            return;
        }

        let activeConversationId = conversationId;
        if (!activeConversationId) {
            try {
                const conversation = await api.createConversation(selectedDocument.id, selectedBot?.id ?? null);
                activeConversationId = conversation.id;
                setConversationId(conversation.id);
                setSelectedConversationId(conversation.id);
                refreshConversations();
            } catch (err) {
                console.error("Failed to create conversation before sending message:", err);
                return;
            }
        }

        const userMessage: ChatMessage = { role: 'user', parts: [{ text: message }] };
        setChatHistory((prev) => [...prev, userMessage]);
        setIsQueryLoading(true);

        try {
            const result = await api.chat({ conversationId: activeConversationId, message });
            const modelMessage: ChatMessage = {
                role: 'model',
                parts: [{ text: result.reply }],
                groundingChunks: result.groundingChunks as any,
                id: result.messageId,
                feedback: null,
            };
            setChatHistory((prev) => [...prev, modelMessage]);
            setLastFailedMessage(null);
            setLastFailedConversationId(null);
            refreshConversations();
        } catch (err) {
            const errorMessage: ChatMessage = {
                role: 'model',
                parts: [{ text: "Sorry, I encountered an error. Please try again." }]
            };
            setChatHistory((prev) => [...prev, errorMessage]);
            setLastFailedMessage(message);
            setLastFailedConversationId(activeConversationId);
            console.error("Failed to get response", err);
        } finally {
            setIsQueryLoading(false);
        }
    };

    const handleRetryLastMessage = async () => {
        if (!lastFailedMessage || !lastFailedConversationId) return;
        if (conversationId !== lastFailedConversationId) return;
        await handleSendMessage(lastFailedMessage);
    };

    const handleMessageFeedback = async (messageId: string, rating: 'up' | 'down') => {
        if (!messageId) return;
        try {
            await api.sendMessageFeedback(messageId, rating);
            setChatHistory((prev) =>
                prev.map((msg) => (msg.id === messageId ? { ...msg, feedback: rating } : msg)),
            );
        } catch (err) {
            console.error('Failed to send feedback', err);
        }
    };

    const renderContent = () => {
        if (view === 'auth') {
            return (
                <AuthScreen
                    onLogin={handleLogin}
                    onSignup={handleSignup}
                    onRequestPasswordReset={handleRequestPasswordReset}
                    onResetPassword={handleResetPassword}
                    onVerifyEmail={handleVerifyEmail}
                    onResendVerification={handleResendVerification}
                    isLoading={authLoading}
                    error={authError}
                    pendingApproval={pendingApproval}
                    pendingEmail={pendingEmail}
                    onBackToLogin={handleBackToLogin}
                />
            );
        }

        if (!user) {
            return null;
        }

        if (view === 'dashboard') {
            return (
                <DashboardPage
                    user={user}
                    bots={bots}
                    selectedBot={selectedBot}
                    documents={documents}
                    documentsLoading={documentsLoading}
                    conversations={conversations}
                    conversationsLoading={conversationsLoading}
                    selectedConversationId={selectedConversationId}
                    selectedDocument={selectedDocument}
                    activePanel={activePanel}
                    hasApiKey={hasApiKey}
                    chatHistory={chatHistory}
                    isQueryLoading={isQueryLoading}
                    onFeedback={handleMessageFeedback}
                    retryPrompt={lastFailedConversationId === conversationId ? lastFailedMessage : null}
                    onRetryPrompt={handleRetryLastMessage}
                    onSelectBot={setSelectedBot}
                    onSelectBotForChat={handleSelectBotForChat}
                    onCreateBot={handleCreateBot}
                    onUpdateBot={handleUpdateBot}
                    onDeleteBot={handleDeleteBot}
                    onSelectDocument={handleSelectDocument}
                    onLoadDocument={handleLoadDocument}
                    onChangePassword={handleChangePassword}
                    onSelectConversation={handleSelectConversation}
                    onDeleteConversation={handleDeleteConversation}
                    onClearConversations={handleClearConversations}
                    onShowHistory={ensureConversationsLoaded}
                    onEnsureBotsLoaded={ensureBotsLoaded}
                    onUpdateDocument={handleUpdateDocument}
                    onDeleteDocument={handleDeleteDocument}
                    onShareDocument={handleShareDocument}
                    onRemoveDocumentShare={handleRemoveDocumentShare}
                    onUploadComplete={handleUploadComplete}
                    onSendMessage={handleSendMessage}
                    onNewChat={handleNewChat}
                    onChangePanel={setActivePanel}
                    onLogout={handleLogout}
                    adminMetrics={adminMetrics}
                    healthStatus={healthStatus}
                    adminUsers={adminUsers}
                    adminDocuments={adminDocuments}
                    adminBots={adminBots}
                    adminUploadBatches={adminUploadBatches}
                    adminLoading={adminLoading}
                    adminError={adminError}
                    onLoadAdminData={loadAdminData}
                    onLoadSupportData={loadSupportData}
                    supportPendingUsers={supportPendingUsers}
                    supportLogs={supportLogs}
                    onSupportApproval={handleSupportApproval}
                    onDownloadSupportReport={handleDownloadSupportReport}
                    onAdminUpdateUser={handleAdminUpdateUser}
                    onAdminDeleteUser={handleAdminDeleteUser}
                    onAdminDeleteDocument={handleAdminDeleteDocument}
                    onAdminDeleteBot={handleAdminDeleteBot}
                    onAdminBackup={handleAdminBackup}
                    onAdminRestore={handleAdminRestore}
                />
            );
        }

        return null;
    };

    return <>{renderContent()}</>;
};

export default App;
