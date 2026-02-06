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

function Chat() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chatName, setChatName] = useState(`Chat ${chatId}`);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);

  // ดึงชื่อ chat จาก localStorage หรือใช้ default
  useEffect(() => {
    const loadChatName = () => {
      const storedChats = localStorage.getItem('chats');
      if (storedChats) {
        try {
          const chats = JSON.parse(storedChats);
          const currentChat = chats.find(chat => chat.id === chatId);
          if (currentChat) {
            setChatName(currentChat.name);
          } else {
            setChatName(`Chat ${chatId}`);
          }
        } catch (error) {
          console.error('Error parsing chats:', error);
          setChatName(`Chat ${chatId}`);
        }
      } else {
        setChatName(`Chat ${chatId}`);
      }
    };

    loadChatName();

    // Listen for storage changes (when chat name is updated in Sidebar)
    const handleStorageChange = (e) => {
      if (e.key === 'chats') {
        loadChatName();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also listen for custom event (for same-window updates)
    const handleChatUpdate = () => {
      loadChatName();
    };
    window.addEventListener('chatUpdated', handleChatUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('chatUpdated', handleChatUpdate);
    };
  }, [chatId]);
  
  const [messages, setMessages] = useState([]);
  const [hasInitialized, setHasInitialized] = useState(false);

  // เก็บ timeout reference เพื่อ cleanup เมื่อ component unmount
  const typingTimeoutRef = useRef(null);

  // Reset messages และ initialization เมื่อเปลี่ยน chatId
  useEffect(() => {
    // Clear any pending timeouts
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    setMessages([]);
    setHasInitialized(false);
    setIsTyping(false);
  }, [chatId]);

  // ตรวจสอบว่ามี firstMessage จาก homepage หรือไม่
  useEffect(() => {
    if (hasInitialized) return; // ป้องกันการทำงานซ้ำ
    
    const firstMessage = location.state?.firstMessage;
    if (firstMessage) {
      // เพิ่มข้อความแรกจากผู้ใช้
      const userMessage = {
        id: 1,
        text: firstMessage,
        sender: 'user',
        timestamp: new Date()
      };
      setMessages([userMessage]);
      setHasInitialized(true);
      
      // Simulate bot typing และตอบกลับ
      setIsTyping(true);
      const timeoutId = setTimeout(() => {
        setIsTyping(false);
        setMessages([userMessage, {
          id: 2,
          text: 'ขอบคุณสำหรับข้อความครับ ฉันจะช่วยคุณในเร็วๆ นี้',
          sender: 'bot',
          timestamp: new Date()
        }]);
      }, 1500);
      
      // Clear location.state เพื่อไม่ให้แสดงข้อความซ้ำเมื่อ refresh
      window.history.replaceState({}, document.title);
      
      return () => clearTimeout(timeoutId);
    } else {
      // ถ้าไม่มี firstMessage ให้แสดง welcome message
      setMessages([
    { 
      id: 1, 
      text: 'สวัสดีครับ! มีอะไรให้ช่วยไหมคะ?', 
      sender: 'bot',
      timestamp: new Date(Date.now() - 300000)
        }
      ]);
      setHasInitialized(true);
    }
  }, [chatId, location.state, hasInitialized]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

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

  const handleSendMessage = (e) => {
    e.preventDefault();
    const messageText = chatInput.trim();
    
    if (!messageText) return;
    
    // Clear input immediately
      setChatInput('');
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    
    // Clear previous timeout if exists
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    
    // ใช้ timestamp สำหรับ id เพื่อป้องกันการซ้ำ
    const messageId = Date.now();
    const newMessage = {
      id: messageId,
      text: messageText,
      sender: 'user',
      timestamp: new Date()
    };
    
    // เพิ่มข้อความผู้ใช้ทันที
    setMessages(prev => [...prev, newMessage]);
      
      // Simulate bot typing
      setIsTyping(true);
    
    // สร้างข้อความตอบกลับหลังจาก 1.5 วินาที
    typingTimeoutRef.current = setTimeout(() => {
      const botMessageId = Date.now() + Math.random(); // ใช้ timestamp + random เพื่อป้องกันการซ้ำ
      const botMessage = {
        id: botMessageId,
          text: 'ขอบคุณสำหรับข้อความครับ ฉันจะช่วยคุณในเร็วๆ นี้',
          sender: 'bot',
          timestamp: new Date()
      };
      
      setIsTyping(false);
      setMessages(prev => [...prev, botMessage]);
      typingTimeoutRef.current = null;
      }, 1500);
  };

  // Cleanup timeout เมื่อ component unmount หรือ chatId เปลี่ยน
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
    }
  };
  }, [chatId]);

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
          <button className='text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg p-2 transition-all'>
            <HiRefresh className='text-xl' />
          </button>
        </div>

        {/* Messages Area - Centered like ChatGPT/Gemini */}
        <div className='flex-1 overflow-y-auto'>
          <div className='max-w-3xl mx-auto px-4 sm:px-6 py-8'>
            {messages.length === 0 ? (
              // Empty state - Welcome message
              <div className='flex flex-col items-center justify-center h-full min-h-[60vh]'>
                <div className='mb-6'>
                  <img src={bingsuLogo} alt="BingSu" className='w-20 h-20 rounded-full object-cover shadow-lg' />
                </div>
                <h2 className='text-2xl font-semibold text-gray-800 mb-2'>BingSu Chat</h2>
                <p className='text-gray-500 text-center mb-8'>เริ่มสนทนากับบอตของคุณ</p>
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
