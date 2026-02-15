// ให้ API ไปที่ origin ของหน้าปัจจุบันเสมอ (เปิดจาก http://192.168.1.8 ก็จะเรียก http://192.168.1.8/api)
// ไม่ติด cache หรือ localhost จาก build เก่า
function getBaseURL() {
  // Always use empty string to trigger proxy in development
  // The proxy (setupProxy.js) will handle routing to the correct backend
  // This works both in Docker (using service name 'api') and localhost
  return '';
}
const API_CONFIG = {
  get baseURL() { return getBaseURL(); },
  timeout: parseInt(process.env.REACT_APP_API_TIMEOUT || '30000', 10)
};

export default API_CONFIG;