const API_CONFIG = {
    baseURL: process.env.REACT_APP_API_BASE_URL || 'http://192.168.1.7:8000',
    timeout: parseInt(process.env.REACT_APP_API_TIMEOUT || '30000', 10)
};

export default API_CONFIG;