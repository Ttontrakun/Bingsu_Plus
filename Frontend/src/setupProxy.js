const { createProxyMiddleware } = require('http-proxy-middleware');

// Backend ค่าเริ่มต้นรันที่ 5050 (จาก server/config.js)
// In Docker, use service name 'api', otherwise use localhost
const BACKEND_PORT = process.env.REACT_APP_BACKEND_PORT || '5050';

// Always use Docker service name 'api' when running in Docker Compose
// The service name 'api' is defined in docker-compose.yml
const target = `http://api:${BACKEND_PORT}`;

console.log(`[Proxy] Configuring proxy: ${target}`);

module.exports = function (app) {
  const proxyOptions = {
    target,
    changeOrigin: true,
    secure: false,
    logLevel: 'debug',
    onError: (err, req, res) => {
      console.error(`[Proxy] Backend ที่ ${target} ไม่ตอบ:`, err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Proxy error: Cannot connect to backend' });
      }
    },
  };
  app.use('/api', createProxyMiddleware(proxyOptions));
  app.use('/uploads', createProxyMiddleware(proxyOptions));
};
