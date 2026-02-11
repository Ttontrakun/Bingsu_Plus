// In dev, use '' so requests go to same origin and setupProxy.js forwards /api to backend (no CORS).
const API_CONFIG = {
    baseURL: process.env.REACT_APP_API_BASE_URL || '',
    timeout: parseInt(process.env.REACT_APP_API_TIMEOUT || '30000', 10)
};

export default API_CONFIG;