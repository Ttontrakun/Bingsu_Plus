import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { 
  HiArrowLeft, 
  HiOutlinePaperAirplane, 
  HiOutlineUser,
  HiRefresh
} from 'react-icons/hi';
import { HiChatBubbleLeftRight } from 'react-icons/hi2';
import bingsuLogo from '../assets/images/หน่องบิงไม่มีพื้นละ.png';
import { chatAPI, getErrorMessage, messagesAPI, subscriptionAPI } from '../services/api';

function getSourcesFromGrounding(groundingChunks) {
  if (!Array.isArray(groundingChunks)) return [];
  const names = groundingChunks
    .map((g) => g?.retrievedContext?.title ?? g?.payload?.fileName)
    .filter(Boolean);
  return [...new Set(names)];
}

/** แคชข้อความต่อ conversation — เปิดแชทเดิมจะแสดงทันทีโดยไม่รอ API */
const messagesCache = new Map();

function Chat() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isRevealing, setIsRevealing] = useState(false);
  const [chatName] = useState(`Chat`);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const firstMessageSentRef = useRef(false);
  const [error, setError] = useState('');
  const revealTimerRef = useRef(null);
  const [usage, setUsage] = useState(null);
  const [messages, setMessagesState] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);

  const setMessages = (updater) => {
    setMessagesState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (chatId && Array.isArray(next)) messagesCache.set(chatId, next);
      return next;
    });
  };

  const clearRevealTimer = () => {
    if (revealTimerRef.current) {
      clearInterval(revealTimerRef.current);
      revealTimerRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      clearRevealTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load usage (tokens) for display
  const fetchUsage = async () => {
    try {
      const data = await subscriptionAPI.get();
      setUsage({
        used: data?.usage?.totalTokens ?? 0,
        limit: data?.plan?.dailyTokenLimit ?? 0,
      });
    } catch {
      setUsage(null);
    }
  };

  useEffect(() => {
    fetchUsage();
  }, [chatId]);

  // โหลดข้อความ: แสดงจากแคชทันที (ถ้ามี) แล้วดึงจาก API ในพื้นหลัง
  useEffect(() => {
    if (!chatId) return;
    setError('');
    const cached = messagesCache.get(chatId);
    if (cached && cached.length > 0) {
      setMessagesState(cached);
    } else {
      setMessagesState([]);
    }

    const load = async () => {
      setMessagesLoading(true);
      try {
        const msgs = await messagesAPI.list(chatId, 50);
        const formatted = (msgs || []).map((m) => ({
          id: m.id,
          text: m.content,
          sender: m.role === 'user' ? 'user' : 'bot',
          timestamp: new Date(m.createdAt || Date.now()),
          sources: m.role === 'model' ? getSourcesFromGrounding(m.groundingChunks) : undefined,
        }));
        const toSet = formatted.length ? formatted : [
          { id: 'welcome', text: 'สวัสดีครับ! มีอะไรให้ช่วยไหมครับ?', sender: 'bot', timestamp: new Date() },
        ];
        setMessagesState(toSet);
        messagesCache.set(chatId, toSet);
      } catch (err) {
        console.error('Failed to load messages', err);
        setError(getErrorMessage(err));
        const fallback = [
          { id: 'welcome', text: 'สวัสดีครับ! มีอะไรให้ช่วยไหมครับ?', sender: 'bot', timestamp: new Date() },
        ];
        setMessagesState(fallback);
        messagesCache.set(chatId, fallback);
      } finally {
        setMessagesLoading(false);
      }
    };
    load();
  }, [chatId]);
  // Auto-send first message once (when navigating from homepage)
  useEffect(() => {
    const firstMessage = location.state?.firstMessage;
    if (!chatId || !firstMessage || firstMessageSentRef.current) return;
    firstMessageSentRef.current = true;
    // Clear state to avoid re-sending on refresh
    window.history.replaceState({}, document.title);
    void handleSendMessageInternal(firstMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const behavior = isTyping || isRevealing ? 'auto' : 'smooth';
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, [messages, isTyping, isRevealing]);

  // Format timestamp
  const formatTime = (date) => {
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return 'เมื่อสักครู่';
    if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
    
    return date.toLocaleDateString('th-TH', { 
      day: 'numeric', 
      month: 'short',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleSendMessageInternal = async (text) => {
    const messageText = String(text || '').trim();
    if (!messageText || !chatId) return;
    setError('');

    // Clear input UI
    setChatInput('');
    if (textareaRef.current) textareaRef.current.style.height = 'auto';

    const newMessage = {
      id: `local-${Date.now()}`,
      text: messageText,
      sender: 'user',
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, newMessage]);
    setIsTyping(true);
    clearRevealTimer();

    try {
      const result = await chatAPI.chat(chatId, messageText);
      fetchUsage();
      const fullReply = result.reply || 'ขออภัยครับ ระบบตอบกลับไม่ได้ในตอนนี้';
      const botId = result.messageId || `bot-${Date.now()}`;
      const sources = getSourcesFromGrounding(result.groundingChunks || []);

      // Add an empty bot message first, then reveal it gradually (typewriter effect)
      setMessages((prev) => [
        ...prev,
        { id: botId, text: '', sender: 'bot', timestamp: new Date(), sources },
      ]);

      // Small "thinking" pause to feel natural
      await new Promise((r) => setTimeout(r, 150));

      setIsRevealing(true);
      await new Promise((resolve) => {
        const textToReveal = String(fullReply);
        if (!textToReveal) {
          setIsRevealing(false);
          resolve();
          return;
        }

        // Tune speed by length to avoid taking too long on big replies
        const total = textToReveal.length;
        const step = total > 1200 ? 12 : total > 400 ? 6 : 2; // chars per tick
        const intervalMs = total > 1200 ? 12 : 18;
        let idx = 0;

        revealTimerRef.current = setInterval(() => {
          idx = Math.min(total, idx + step);
          const partial = textToReveal.slice(0, idx);
          setMessages((prev) =>
            prev.map((m) => (m.id === botId ? { ...m, text: partial, sources: m.sources } : m))
          );
          if (idx >= total) {
            clearRevealTimer();
            setIsRevealing(false);
            resolve();
          }
        }, intervalMs);
      });
    } catch (err) {
      console.error('Chat failed', err);
      setError(getErrorMessage(err));
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, text: 'ขออภัยครับ เกิดข้อผิดพลาด กรุณาลองใหม่', sender: 'bot', timestamp: new Date() },
      ]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    return handleSendMessageInternal(chatInput);
  };

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  return (
    <div className='flex h-screen bg-[#f7f7f8] relative'>
      {/* Sidebar Component */}
      <Sidebar onCollapseChange={setIsSidebarCollapsed} />

      {/* Main Content */}
      <main className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'pl-16' : ''}`}>
        {/* Header - Minimalist like ChatGPT */}
        <div className='border-b border-gray-200 bg-white px-4 sm:px-6 py-3 flex items-center justify-between'>
          <div className='flex items-center gap-3'>
            <button
              onClick={() => navigate('/homepage')}
              className='text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg p-2 transition-all'
            >
              <HiArrowLeft className='text-xl' />
            </button>
            <div className='flex items-center gap-2'>
              <img src={bingsuLogo} alt="BingSu" className='w-7 h-7 rounded-full object-cover' />
              <h1 className='text-base font-medium text-gray-800'>{chatName}</h1>
            </div>
          </div>
          <div className='flex items-center gap-2'>
            {usage != null && (
              <span
                className='text-xs text-gray-500 bg-gray-100 px-2.5 py-1.5 rounded-lg'
                title='Token ที่ใช้วันนี้ (รายวัน)'
              >
                {usage.limit > 0
                  ? `Token: ${usage.used.toLocaleString()} / ${usage.limit.toLocaleString()}`
                  : `Token: ${usage.used.toLocaleString()} (วันนี้)`}
              </span>
            )}
            <button className='text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg p-2 transition-all'>
              <HiRefresh className='text-xl' />
            </button>
          </div>
        </div>

        {/* Messages Area - Centered like ChatGPT/Gemini */}
        <div className='flex-1 overflow-y-auto'>
          <div className='max-w-3xl mx-auto px-4 sm:px-6 py-8'>
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">
                {error}
              </div>
            )}
            {messages.length === 0 ? (
              // Empty state หรือกำลังโหลด (ครั้งแรกที่เปิดแชท)
              <div className='flex flex-col items-center justify-center h-full min-h-[60vh]'>
                <div className='mb-6'>
                  <img src={bingsuLogo} alt="BingSu" className='w-20 h-20 rounded-full object-cover shadow-lg' />
                </div>
                <h2 className='text-2xl font-semibold text-gray-800 mb-2'>BingSu Chat</h2>
                {messagesLoading ? (
                  <p className='text-gray-500 text-center mb-8'>กำลังโหลดประวัติสนทนา...</p>
                ) : (
                  <p className='text-gray-500 text-center mb-8'>เริ่มสนทนากับบอตของคุณ</p>
                )}
              </div>
            ) : (
              <div className='space-y-6'>
                {messages.map((message, index) => {
                  const showTimestamp = index === 0 || 
                    new Date(message.timestamp) - new Date(messages[index - 1].timestamp) > 300000;
                  
                  return (
                    <div key={message.id}>
                      {showTimestamp && (
                        <div className='flex justify-center my-6'>
                          <span className='text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-full'>
                            {formatTime(message.timestamp)}
                          </span>
                        </div>
                      )}
                      
                      <div className={`flex gap-4 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {message.sender === 'bot' && (
                          <div className='flex-shrink-0 w-8 h-8 mt-1'>
                            <div className='w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center shadow-sm'>
                              <HiChatBubbleLeftRight className='text-white text-sm' />
                            </div>
                          </div>
                        )}
                        
                        <div className={`flex-1 ${message.sender === 'user' ? 'flex justify-end' : ''}`}>
                          <div className={`max-w-[85%] ${message.sender === 'user' ? 'text-right' : ''}`}>
                            <div
                              className={`inline-block px-4 py-3 rounded-2xl ${
                                message.sender === 'user'
                                  ? 'bg-gradient-to-br from-gray-200 to-gray-300 text-gray-900 shadow-sm'
                                  : 'bg-white text-gray-900 border border-gray-200 shadow-sm'
                              }`}
                            >
                              <p className='text-[15px] leading-relaxed whitespace-pre-wrap break-words'>
                                {message.text}
                              </p>
                              {message.sender === 'bot' && message.sources?.length > 0 && (
                                <p className='mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500'>
                                  อ้างอิงจาก: {message.sources.join(', ')}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {message.sender === 'user' && (
                          <div className='flex-shrink-0 w-8 h-8 mt-1'>
                            <div className='w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center shadow-sm'>
                              <HiOutlineUser className='text-white text-sm' />
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                
                {/* Typing Indicator */}
                {isTyping && (
                  <div className='flex gap-4 justify-start'>
                    <div className='flex-shrink-0 w-8 h-8 mt-1'>
                      <div className='w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center shadow-sm'>
                        <HiChatBubbleLeftRight className='text-white text-sm' />
                      </div>
                    </div>
                    <div className='flex-1'>
                      <div className='inline-block px-4 py-3 rounded-2xl bg-white border border-gray-200 shadow-sm'>
                        <div className='flex gap-1.5'>
                          <div className='w-2 h-2 bg-gray-400 rounded-full animate-bounce' style={{ animationDelay: '0ms' }}></div>
                          <div className='w-2 h-2 bg-gray-400 rounded-full animate-bounce' style={{ animationDelay: '150ms' }}></div>
                          <div className='w-2 h-2 bg-gray-400 rounded-full animate-bounce' style={{ animationDelay: '300ms' }}></div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </div>

        {/* Chat Input - ChatGPT/Gemini style */}
        <div className='border-t border-gray-200 bg-white'>
          <div className='max-w-3xl mx-auto px-4 sm:px-6 py-4'>
            <form onSubmit={handleSendMessage} className='relative'>
              <div className='flex items-center gap-2 bg-white border-2 border-gray-300 rounded-2xl shadow-sm hover:border-yellow-400 focus-within:border-yellow-400 transition-colors'>
                {/* Plus and photograph icons removed as requested */}
                
                <textarea
                  ref={textareaRef}
                  value={chatInput}
                  onChange={(e) => {
                    setChatInput(e.target.value);
                    adjustTextareaHeight();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendMessage(e);
                    } else {
                      adjustTextareaHeight();
                    }
                  }}
                  placeholder='พิมพ์ข้อความ...'
                  rows={1}
                  className='flex-1 outline-none text-gray-700 text-[15px] placeholder-gray-400 bg-transparent resize-none overflow-hidden min-h-[52px] max-h-[200px] px-3 py-3.5'
                />
                
                <div className='pr-2 flex items-center justify-center self-center'>
                  <button
                    type='submit'
                    disabled={!chatInput.trim()}
                    className={`rounded-lg p-2.5 transition-all flex items-center justify-center ${
                      chatInput.trim()
                        ? 'bg-gradient-to-br from-gray-200 to-gray-300 text-gray-900 hover:from-gray-300 hover:to-gray-400 shadow-sm hover:shadow-md'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <HiOutlinePaperAirplane className='text-lg transform rotate-90' />
                  </button>
                </div>
              </div>
            </form>
            <p className='text-xs text-gray-400 text-center mt-2'>
              BingSu อาจทำผิดพลาดได้ กรุณาตรวจสอบข้อมูลสำคัญ
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Chat;
