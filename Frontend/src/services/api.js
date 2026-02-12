import axios from 'axios';
import API_CONFIG from '../config/api';

const api = axios.create({
    baseURL: API_CONFIG.baseURL,
    timeout: API_CONFIG.timeout,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor - add auth token to requests
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
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

    // Handle 429 Too Many Requests (Rate Limiting)
    if (error.response?.status === 429) {
        const retryAfter = error.response.headers['retry-after'];
        if (retryAfter) {
            const seconds = parseInt(retryAfter, 10);
            const minutes = Math.ceil(seconds / 60);
            return `คุณพยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอ ${minutes} นาที แล้วลองอีกครั้ง`;
        }
        return 'คุณพยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองอีกครั้ง';
    }

    // If error has response data
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
    
    // Handle request error (no response)
    if (error.request) {
        return 'Network error. Please check your connection and try again.';
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
            const publicPaths = ['/auth', '/verifying', '/forgot-password', '/reset-password', '/create-password'];
            const currentPath = window.location.pathname;
            
            // Clear token and user data
            localStorage.removeItem('authToken');
            localStorage.removeItem('user');
            
            // Only redirect if not on a public page
            if (!publicPaths.some(path => currentPath.startsWith(path))) {
                // Use setTimeout to avoid redirect during render
                setTimeout(() => {
                    const newPath = window.location.pathname;
                    // Double check we're not on a public path before redirecting
                    if (!publicPaths.some(path => newPath.startsWith(path)) && newPath !== '/auth') {
                        window.location.href = '/auth';
                    }
                }, 100);
            }
        }
        
        // Handle 429 Too Many Requests (Rate Limiting)
        // Don't reject immediately - let the component handle the error message
        // This allows us to show user-friendly messages
        if (error.response?.status === 429) {
            // The error will be handled by getErrorMessage() in the component
            // We just ensure it's properly formatted
            if (!error.response.data || !error.response.data.detail) {
                error.response.data = {
                    detail: 'คุณพยายามเข้าสู่ระบบบ่อยเกินไป กรุณารอสักครู่แล้วลองอีกครั้ง'
                };
            }
        }
        
        return Promise.reject(error);
    }
);

// Auth API functions
export const authAPI = {
    // Login
    login: async (email, password) => {
        const response = await api.post('/auth/login', {
            email,
            password,
        });
        // Store token in localStorage
        if (response.data.access_token) {
            localStorage.setItem('authToken', response.data.access_token);
        }
        return response.data;
    },

    // Register
    register: async (email, fullName) => {
        const response = await api.post('/users/register', {
            email,
            fullName,
        });
        return response.data;
    },

    // Verify email
    verifyEmail: async (token) => {
        const response = await api.post('/auth/verify-email', {
            token,
        });
        return response.data;
    },

    // Set password
    setPassword: async (token, password) => {
        const response = await api.post('/auth/set-password', {
            token,
            password,
        });
        return response.data;
    },

    // Resend verification email
    resendVerification: async (email) => {
        const response = await api.post('/auth/resend-verification', {
            email,
        });
        return response.data;
    },

    // Forgot password - request password reset
    forgotPassword: async (email) => {
        const response = await api.post('/auth/forgot-password', {
            email,
        });
        return response.data;
    },

    // Reset password with token
    resetPassword: async (token, password) => {
        const response = await api.post('/auth/reset-password', {
            token,
            password,
        });
        return response.data;
    },

    // Get current user
    getCurrentUser: async () => {
        const response = await api.get('/auth/me');
        return response.data;
    },

    // Logout
    logout: () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
    },
};

// Credential API functions
export const credentialAPI = {
    // Change password
    changePassword: async (oldPassword, newPassword) => {
        const response = await api.post('/credentials/change-password', {
            old_password: oldPassword,
            new_password: newPassword,
        });
        return response.data;
    },
};

// User API functions
export const userAPI = {
    // Get current user profile
    getCurrentUser: async () => {
        const response = await api.get('/auth/me');
        return response.data;
    },

    // Update current user profile (convenience method)
    // Uses /users/me endpoint - no user_id needed, uses current user from token
    updateProfile: async (profileData) => {
        // Build payload - backend expects Optional[str] which can be None (null) or string
        const payload = {};
        
        // Always include firstName (can be string or null)
        if (profileData.firstName !== undefined) {
            payload.firstName = profileData.firstName === '' || profileData.firstName === null ? null : profileData.firstName;
        }
        
        // Include lastName (can be string or null)
        if (profileData.lastName !== undefined) {
            payload.lastName = profileData.lastName === '' || profileData.lastName === null ? null : profileData.lastName;
        }
        
        // Include email if provided and not null (optional)
        if (profileData.email !== undefined && profileData.email !== null && profileData.email !== '') {
            payload.email = profileData.email;
        }
        
        // Ensure at least one field is provided
        if (Object.keys(payload).length === 0) {
            throw new Error('At least one field (firstName, lastName, or email) must be provided');
        }
        
        console.log('Sending update profile request:', payload);
        const response = await api.put('/users/me', payload);
        return response.data;
    },

    // Update user profile by ID (admin only)
    updateProfileById: async (userId, profileData) => {
        // Ensure userId is an integer
        const userIdInt = typeof userId === 'string' ? parseInt(userId, 10) : userId;
        if (isNaN(userIdInt)) {
            throw new Error('Invalid user ID');
        }
        const response = await api.put(`/users/${userIdInt}`, {
            firstName: profileData.firstName,
            lastName: profileData.lastName,
            email: profileData.email,
        });
        return response.data;
    },

    // Get user by ID
    getUserById: async (userId) => {
        // Ensure userId is an integer
        const userIdInt = typeof userId === 'string' ? parseInt(userId, 10) : userId;
        if (isNaN(userIdInt)) {
            throw new Error('Invalid user ID');
        }
        const response = await api.get(`/users/${userIdInt}`);
        return response.data;
    },

    // Admin functions for approval
    // Get pending approval users (admin only)
    getPendingUsers: async () => {
        const response = await api.get('/users/pending');
        return response.data;
    },

    // Approve a user (admin only)
    approveUser: async (userId) => {
        const userIdInt = typeof userId === 'string' ? parseInt(userId, 10) : userId;
        if (isNaN(userIdInt)) {
            throw new Error('Invalid user ID');
        }
        const response = await api.put(`/users/${userIdInt}/approve`);
        return response.data;
    },

    // Reject/unapprove a user (admin only)
    rejectUser: async (userId) => {
        const userIdInt = typeof userId === 'string' ? parseInt(userId, 10) : userId;
        if (isNaN(userIdInt)) {
            throw new Error('Invalid user ID');
        }
        const response = await api.put(`/users/${userIdInt}/reject`);
        return response.data;
    },
};

// Chat API functions
export const chatAPI = {
    // Get all chats for current user
    getChats: async (skip = 0, limit = 100) => {
        const response = await api.get('/chats', {
            params: { skip, limit }
        });
        return response.data;
    },

    // Get chat by ID
    getChat: async (chatId) => {
        const chatIdInt = typeof chatId === 'string' ? parseInt(chatId, 10) : chatId;
        if (isNaN(chatIdInt)) {
            throw new Error('Invalid chat ID');
        }
        const response = await api.get(`/chats/${chatIdInt}`);
        return response.data;
    },

    // Create a new chat
    createChat: async (name, user_ids = []) => {
        const response = await api.post('/chats', {
            name: name || null,
            user_ids: user_ids
        });
        return response.data;
    },

    // Update chat
    updateChat: async (chatId, name) => {
        const chatIdInt = typeof chatId === 'string' ? parseInt(chatId, 10) : chatId;
        if (isNaN(chatIdInt)) {
            throw new Error('Invalid chat ID');
        }
        const response = await api.put(`/chats/${chatIdInt}`, {
            name: name || null
        });
        return response.data;
    },

    // Delete chat
    deleteChat: async (chatId) => {
        const chatIdInt = typeof chatId === 'string' ? parseInt(chatId, 10) : chatId;
        if (isNaN(chatIdInt)) {
            throw new Error('Invalid chat ID');
        }
        const response = await api.delete(`/chats/${chatIdInt}`);
        return response.data;
    },
};

// Chat Message API functions
export const chatMessageAPI = {
    // Get all messages in a chat
    getMessages: async (chatId, skip = 0, limit = 100) => {
        const chatIdInt = typeof chatId === 'string' ? parseInt(chatId, 10) : chatId;
        if (isNaN(chatIdInt)) {
            throw new Error('Invalid chat ID');
        }
        const response = await api.get(`/chats/${chatIdInt}/messages`, {
            params: { skip, limit }
        });
        return response.data;
    },

    // Get message by ID
    getMessage: async (chatId, messageId) => {
        const chatIdInt = typeof chatId === 'string' ? parseInt(chatId, 10) : chatId;
        const messageIdInt = typeof messageId === 'string' ? parseInt(messageId, 10) : messageId;
        if (isNaN(chatIdInt) || isNaN(messageIdInt)) {
            throw new Error('Invalid chat ID or message ID');
        }
        const response = await api.get(`/chats/${chatIdInt}/messages/${messageIdInt}`);
        return response.data;
    },

    // Create a new message
    createMessage: async (chatId, message) => {
        const chatIdInt = typeof chatId === 'string' ? parseInt(chatId, 10) : chatId;
        if (isNaN(chatIdInt)) {
            throw new Error('Invalid chat ID');
        }
        const response = await api.post(`/chats/${chatIdInt}/messages`, {
            message: message
        });
        return response.data;
    },

    // Update message
    updateMessage: async (chatId, messageId, message) => {
        const chatIdInt = typeof chatId === 'string' ? parseInt(chatId, 10) : chatId;
        const messageIdInt = typeof messageId === 'string' ? parseInt(messageId, 10) : messageId;
        if (isNaN(chatIdInt) || isNaN(messageIdInt)) {
            throw new Error('Invalid chat ID or message ID');
        }
        const response = await api.put(`/chats/${chatIdInt}/messages/${messageIdInt}`, {
            message: message
        });
        return response.data;
    },

    // Delete message
    deleteMessage: async (chatId, messageId) => {
        const chatIdInt = typeof chatId === 'string' ? parseInt(chatId, 10) : chatId;
        const messageIdInt = typeof messageId === 'string' ? parseInt(messageId, 10) : messageId;
        if (isNaN(chatIdInt) || isNaN(messageIdInt)) {
            throw new Error('Invalid chat ID or message ID');
        }
        const response = await api.delete(`/chats/${chatIdInt}/messages/${messageIdInt}`);
        return response.data;
    },

    // Create bot response
    createBotResponse: async (chatId, message) => {
        const chatIdInt = typeof chatId === 'string' ? parseInt(chatId, 10) : chatId;
        if (isNaN(chatIdInt)) {
            throw new Error('Invalid chat ID');
        }
        const response = await api.post(`/chats/${chatIdInt}/messages/bot-response`, {
            message: message
        });
        return response.data;
    },
};

export default api;