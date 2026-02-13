// ให้ API ไปที่ origin ของหน้าปัจจุบันเสมอ (เปิดจาก http://192.168.1.8 ก็จะเรียก http://192.168.1.8/api)
// ไม่ติด cache หรือ localhost จาก build เก่า
function getBaseURL() {
  if (process.env.REACT_APP_API_BASE_URL) return process.env.REACT_APP_API_BASE_URL;
  if (typeof window !== 'undefined' && window.location && window.location.origin) return window.location.origin;
  return '';
}
const API_CONFIG = {
  get baseURL() { return getBaseURL(); },
  timeout: parseInt(process.env.REACT_APP_API_TIMEOUT || '30000', 10)
};

export default API_CONFIG;