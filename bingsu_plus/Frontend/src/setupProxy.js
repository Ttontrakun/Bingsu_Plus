const { createProxyMiddleware } = require('http-proxy-middleware');

// Backend ค่าเริ่มต้นรันที่ 5050 (จาก server/config.js)
const BACKEND_PORT = process.env.REACT_APP_BACKEND_PORT || '5050';
const target = `http://localhost:${BACKEND_PORT}`;

module.exports = function (app) {
  const proxyOptions = {
    target,
    changeOrigin: true,
    secure: false,
    onError: (err, req, res) => {
      console.error(`[Proxy] Backend ที่ ${BACKEND_PORT} ไม่ตอบ:`, err.message);
    },
  };
  app.use('/api', createProxyMiddleware(proxyOptions));
  app.use('/uploads', createProxyMiddleware(proxyOptions));
};
