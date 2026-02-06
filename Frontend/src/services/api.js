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
            localStorage.removeItem('authToken');
            // Optionally redirect to login page
            if (window.location.pathname !== '/auth') {
                window.location.href = '/auth';
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

export default api;