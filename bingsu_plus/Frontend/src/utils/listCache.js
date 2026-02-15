/**
 * แคชรายการสำหรับแสดงทันทีเมื่อสลับหน้า (Knowledge, Bots, ประวัติแชท)
 * กดแล้วเห็นเลยแบบ Gemini — ไม่โหลดหน้าทุกครั้ง
 */
const cache = {
  documents: null,
  bots: null,
  conversations: null,
};

export const listCache = {
  getDocuments: () => (Array.isArray(cache.documents) ? cache.documents : null),
  setDocuments: (list) => {
    cache.documents = Array.isArray(list) ? list : null;
  },

  getBots: () => (Array.isArray(cache.bots) ? cache.bots : null),
  setBots: (list) => {
    cache.bots = Array.isArray(list) ? list : null;
  },

  getConversations: () => (Array.isArray(cache.conversations) ? cache.conversations : null),
  setConversations: (list) => {
    cache.conversations = Array.isArray(list) ? list : null;
  },
};
