import axios from 'axios';
import API_CONFIG from '../config/api';

const AVATAR_VERSION_KEY = 'userAvatarVersion';

export function getAvatarUrl(avatarUrl) {
    if (!avatarUrl) return null;
    if (avatarUrl.startsWith('http')) return avatarUrl;
    let url;
    if (avatarUrl.includes('/uploads/avatars/')) {
        const filename = avatarUrl.replace(/^.*\/uploads\/avatars\//, '').split('?')[0];
        if (filename) url = `/api/avatars/${filename}`;
        else url = avatarUrl.startsWith('/') ? avatarUrl : '/' + avatarUrl;
    } else {
        url = avatarUrl.startsWith('/') ? avatarUrl : '/' + avatarUrl;
    }
    const version = typeof localStorage !== 'undefined' ? localStorage.getItem(AVATAR_VERSION_KEY) : null;
    if (url && url.includes('/api/avatars/')) return `${url}?t=${version || 0}`;
    return url;
}

export function setAvatarVersion() {
    try {
        localStorage.setItem(AVATAR_VERSION_KEY, String(Date.now()));
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('avatarUpdated'));
    } catch (_) {}
}

const api = axios.create({
    baseURL: API_CONFIG.baseURL,
    timeout: API_CONFIG.timeout,
    headers: {
        'Content-Type': 'application/json',
    },
});

// ให้ทุก request ใช้ origin ของหน้าปัจจุบัน (เปิดจาก 192.168.1.8 ก็เรียก 192.168.1.8/api)
api.interceptors.request.use((config) => {
    config.baseURL = API_CONFIG.baseURL;
    return config;
});

const SESSION_KEY = 'sessionToken';

export const setSessionToken = (token) => {
    if (token) {
        localStorage.setItem(SESSION_KEY, token);
    } else {
        localStorage.removeItem(SESSION_KEY);
    }
};

const getSessionToken = () => localStorage.getItem(SESSION_KEY);

// Request interceptor - add auth token to requests
api.interceptors.request.use(
    (config) => {
        const token = getSessionToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        config.headers['x-client-platform'] = 'website';
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Helper function to extract error message from error response
export const getErrorMessage = (error) => {
    if (!error) {
        return 'เกิดข้อผิดพลาด';
    }

    // Server responded but with error status (e.g. 502 Bad Gateway, 503)
    const status = error.response?.status;
    if (error.response != null && status >= 500) {
        const body = error.response.data;
        const text = typeof body === 'string' ? body.slice(0, 80) : (body?.message || body?.detail || body?.error);
        if (text && typeof text === 'string' && !text.startsWith('<')) {
            return `เซิร์ฟเวอร์ตอบ ${status}: ${text}`;
        }
        return `เซิร์ฟเวอร์ตอบ ${status} — backend อาจยังไม่พร้อม ลองรีเฟรชหรือตรวจสอบ Docker (api/legacy)`;
    }

    // If error has response data (4xx etc.)
    if (error.response?.data) {
        const data = error.response.data;
        
        // Handle FastAPI validation errors (array of objects)
        if (Array.isArray(data.detail)) {
            return data.detail.map(err => {
                // Handle validation error object with type, loc, msg fields
                if (typeof err === 'object' && err.msg) {
                    const field = Array.isArray(err.loc) ? err.loc.slice(1).join('.') : '';
                    return field ? `${field}: ${err.msg}` : err.msg;
                }
                return typeof err === 'string' ? err : JSON.stringify(err);
            }).join(', ');
        }
        
        // ask_AA style: { error: "..." }
        if (typeof data.error === 'string') {
            // Some upstream providers return JSON stringified errors.
            // Example: {"error":{"code":429,"message":"...","status":"RESOURCE_EXHAUSTED"}}
            try {
                const parsed = JSON.parse(data.error);
                const msg = parsed?.error?.message || parsed?.message;
                if (typeof msg === 'string' && msg.trim()) {
                    return msg;
                }
            } catch {
                // ignore
            }
            return data.error;
        }

        // Handle string detail
        if (typeof data.detail === 'string') {
            return data.detail;
        }
        
        // Handle object detail
        if (typeof data.detail === 'object') {
            return data.detail.msg || data.detail.message || JSON.stringify(data.detail);
        }
        
        // Handle message field
        if (data.message) {
            return data.message;
        }
    }
    
    // Handle request error (no response) = backend ไม่ตอบหรือ CORS/proxy ผิด
    if (error.request) {
        const code = error.code || '';
        const base = API_CONFIG.baseURL || (typeof window !== 'undefined' ? window.location.origin : '');
        const tryUrl = base ? `${base.replace(/\/$/, '')}/api/health` : '/api/health';
        const msg = code ? `(${code}) ` : '';
        return msg + 'เชื่อมต่อ backend ไม่ได้ — ลองเปิด ' + tryUrl + ' ในเบราว์เซอร์ว่าตอบหรือไม่ แล้วรีเฟรชหน้านี้';
    }
    
    // Handle other errors
    return error.message || 'เกิดข้อผิดพลาด';
};

// Response interceptor - handle errors globally
api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        // Handle 401 Unauthorized - clear token and redirect to login
        if (error.response?.status === 401) {
            setSessionToken(null);
            // Optionally redirect to login page
            if (window.location.pathname !== '/auth') {
                window.location.href = '/auth';
            }
        }
        return Promise.reject(error);
    }
);

// ใช้ตรวจว่า backend ตอบหรือไม่ (หน้า Login)
export const healthCheck = () => api.get('/api/health').then(() => true).catch(() => false);

// Auth API functions (ask_AA backend)
export const authAPI = {
    // Login
    login: async (email, password) => {
        const response = await api.post('/api/auth/login', {
            email,
            password,
        });
        // Store token in localStorage
        if (response.data.token) {
            setSessionToken(response.data.token);
        }
        return response.data;
    },

    // Get current user
    getCurrentUser: async () => {
        const response = await api.get('/api/auth/me');
        return response.data;
    },

    // Sign up (note: backend may require login after signup)
    signup: async (name, email, password) => {
        const response = await api.post('/api/auth/signup', {
            name,
            email,
            password,
        });
        return response.data;
    },

    // Forgot password - request password reset
    forgotPassword: async (email) => {
        const response = await api.post('/api/auth/request-password-reset', {
            email,
        });
        return response.data;
    },

    // Reset password with token
    resetPassword: async (token, newPassword) => {
        const response = await api.post('/api/auth/reset-password', {
            token,
            newPassword,
        });
        return response.data;
    },

    // Logout
    logout: async () => {
        try {
            await api.post('/api/auth/logout');
        } catch (e) {
            // ignore
        }
        setSessionToken(null);
        localStorage.removeItem('user');
    },
};

// Credential API functions
export const credentialAPI = {
    // Change password
    changePassword: async (oldPassword, newPassword) => {
        const response = await api.post('/api/auth/change-password', {
            currentPassword: oldPassword,
            newPassword,
        });
        return response.data;
    },
};

// User API functions
export const userAPI = {
    getCurrentUser: async () => {
        const response = await api.get('/api/auth/me');
        return response.data;
    },
    updateProfile: async (payload) => {
        const timeout = payload.avatarBase64 ? 60000 : undefined;
        const response = await api.patch('/api/auth/me', payload, timeout ? { timeout } : {});
        return response.data;
    },
};

// Documents / Bots / Conversations / Chat / Uploads (ask_AA backend)
export const documentsAPI = {
    list: async () => {
        const response = await api.get('/api/documents?summary=1');
        return response.data;
    },
    get: async (documentId) => {
        const response = await api.get(`/api/documents/${documentId}`);
        return response.data;
    },
    update: async (documentId, payload) => {
        const response = await api.patch(`/api/documents/${documentId}`, payload);
        return response.data;
    },
    remove: async (documentId) => {
        const response = await api.delete(`/api/documents/${documentId}`);
        return response.data;
    },
};

export const botsAPI = {
    list: async () => {
        const response = await api.get('/api/bots');
        return response.data;
    },
    create: async (payload) => {
        const response = await api.post('/api/bots', payload);
        return response.data;
    },
    update: async (botId, payload) => {
        const response = await api.patch(`/api/bots/${botId}`, payload);
        return response.data;
    },
    remove: async (botId) => {
        const response = await api.delete(`/api/bots/${botId}`);
        return response.data;
    },
};

export const conversationsAPI = {
    list: async () => {
        const response = await api.get('/api/conversations');
        return response.data;
    },
    create: async (documentId, botId) => {
        const response = await api.post('/api/conversations', { documentId, botId: botId || null });
        return response.data;
    },
    remove: async (conversationId) => {
        const response = await api.delete(`/api/conversations/${conversationId}`);
        return response.data;
    },
};

export const messagesAPI = {
    list: async (conversationId, limit = 50) => {
        const response = await api.get(`/api/conversations/${conversationId}/messages?limit=${limit}`);
        return response.data;
    },
    feedback: async (messageId, rating) => {
        const response = await api.post(`/api/messages/${messageId}/feedback`, { rating });
        return response.data;
    },
};

export const chatAPI = {
    chat: async (conversationId, message) => {
        const response = await api.post('/api/chat', { conversationId, message });
        return response.data;
    },
};

export const subscriptionAPI = {
    get: async () => {
        const response = await api.get('/api/subscription');
        return response.data;
    },
};

export const uploadAPI = {
    createBatch: async (displayName) => {
        const response = await api.post('/api/upload-batches', { displayName });
        return response.data;
    },
    createFileSession: async (batchId, data) => {
        const response = await api.post(`/api/upload-batches/${batchId}/files`, data);
        return response.data;
    },
    uploadPart: async (uploadId, partNumber, blob) => {
        const response = await api.put(`/api/uploads/${uploadId}/parts/${partNumber}`, blob, {
            headers: { 'Content-Type': 'application/octet-stream' },
            // Uploading large parts can take longer than the default 30s timeout on slow networks.
            timeout: 0,
        });
        return response.data;
    },
    completeFile: async (uploadId) => {
        const response = await api.post(`/api/uploads/${uploadId}/complete`, undefined, { timeout: 120000 });
        return response.data;
    },
    completeBatch: async (batchId) => {
        const response = await api.post(`/api/upload-batches/${batchId}/complete`, undefined, { timeout: 120000 });
        return response.data;
    },
    getBatchStatus: async (batchId) => {
        const response = await api.get(`/api/upload-batches/${batchId}`);
        return response.data;
    },
};

export default api;