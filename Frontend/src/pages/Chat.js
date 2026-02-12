import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import { 
  HiArrowLeft, 
  HiOutlinePaperAirplane, 
  HiOutlineUser,
  HiRefresh,
  HiClipboardCopy,
  HiCheck,
  HiX
} from 'react-icons/hi';
import { HiChatBubbleLeftRight } from 'react-icons/hi2';
import bingsuLogo from '../assets/images/หน่องบิงไม่มีพื้นละ.png';
import { chatMessageAPI, chatAPI } from '../services/api';

function Chat() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [chatName, setChatName] = useState('');
  const [copiedMessageId, setCopiedMessageId] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [hoveredMessageId, setHoveredMessageId] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({});
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const timeoutRefs = useRef({});

  // ดึงชื่อ chat จาก API
  useEffect(() => {
    const loadChatName = async () => {
      try {
        const chat = await chatAPI.getChat(chatId);
        if (chat && chat.name) {
          setChatName(chat.name);
        } else {
          setChatName('New Chat');
        }
      } catch (error) {
        console.error('Error loading chat name:', error);
        setChatName('New Chat');
      }
    };

    loadChatName();
    
    // Listen for custom event (when chat is updated in Sidebar)
    const handleChatUpdate = () => {
      loadChatName();
    };
    window.addEventListener('chatsUpdated', handleChatUpdate);

    return () => {
      window.removeEventListener('chatsUpdated', handleChatUpdate);
    };
  }, [chatId]);
  
  const [messages, setMessages] = useState([]);
  const [hasInitialized, setHasInitialized] = useState(false);

  // เก็บ timeout reference เพื่อ cleanup เมื่อ component unmount
  const typingTimeoutRef = useRef(null);
  // เก็บ firstMessage ที่ถูกส่งไปแล้วเพื่อป้องกันการส่งซ้ำ
  const firstMessageSentRef = useRef(false);
  // เก็บ firstMessage ที่ถูกส่งไปแล้ว (เก็บข้อความจริงๆ เพื่อตรวจสอบ)
  const sentFirstMessageRef = useRef(null);
  // เก็บ flag เพื่อป้องกันการโหลด messages ซ้ำ
  const isLoadingMessagesRef = useRef(false);

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
    firstMessageSentRef.current = false; // Reset firstMessage flag
    sentFirstMessageRef.current = null; // Reset sent firstMessage
    isLoadingMessagesRef.current = false; // Reset loading flag
    setHoveredMessageId(null); // Reset hovered message
    setTooltipPosition({}); // Reset tooltip positions
    setErrorMessage(null); // Reset error message
    
    // Cleanup all timeouts
    Object.values(timeoutRefs.current).forEach(timeout => {
      if (timeout) clearTimeout(timeout);
    });
    timeoutRefs.current = {};
  }, [chatId]);

  // โหลด messages จาก API
  const loadMessages = useCallback(async () => {
    // ป้องกันการโหลดซ้ำ
    if (isLoadingMessagesRef.current) {
      return;
    }
    
    isLoadingMessagesRef.current = true;
    try {
      const chatIdInt = parseInt(chatId, 10);
      if (isNaN(chatIdInt)) {
        console.error('Invalid chat ID');
        return;
      }
      const messagesData = await chatMessageAPI.getMessages(chatIdInt);
      
      // ดึง current user ID จาก localStorage
      const userData = localStorage.getItem('user');
      let currentUserId = null;
      if (userData) {
        try {
          const user = JSON.parse(userData);
          currentUserId = user.id;
        } catch (e) {
          console.error('Error parsing user data:', e);
        }
      }
      
      // แปลง messages จาก API ให้เข้ากับ format ที่ใช้ใน component
      // ใช้ Map เพื่อป้องกันข้อความซ้ำ (กรณีมีข้อความ id เดียวกัน)
      const messageMap = new Map();
      // ใช้ Set เพื่อเก็บ key ของข้อความที่เห็นแล้ว (message + timestamp) เพื่อป้องกันข้อความซ้ำ
      const seenMessages = new Set();
      
      messagesData.forEach(msg => {
        // ตรวจสอบว่าเป็น AI generated message หรือไม่
        const isBot = msg.isAiGenerated === true;
        const timestamp = new Date(msg.createdAt);
        
        // สร้าง key จากข้อความและ timestamp (ภายใน 1 วินาที) เพื่อป้องกันข้อความซ้ำ
        const messageKey = `${msg.message}|${Math.floor(timestamp.getTime() / 1000)}`;
        
        // ถ้ายังไม่เคยเห็นข้อความนี้ ให้เพิ่มเข้าไป
        if (!seenMessages.has(messageKey)) {
          seenMessages.add(messageKey);
          messageMap.set(msg.id, {
            id: msg.id,
            text: msg.message,
            sender: isBot ? 'bot' : (msg.userId === currentUserId ? 'user' : 'user'),
            timestamp: timestamp
          });
        }
      });
      
      // แปลง Map เป็น Array และเรียงลำดับตามเวลา (เก่าที่สุดก่อน)
      const formattedMessages = Array.from(messageMap.values()).sort((a, b) => a.timestamp - b.timestamp);
      setMessages(formattedMessages);
      setHasInitialized(true);
    } catch (error) {
      console.error('Error loading messages:', error);
      setMessages([]);
      setHasInitialized(true);
    } finally {
      isLoadingMessagesRef.current = false;
    }
  }, [chatId]);

  // จัดการ firstMessage จาก homepage และโหลด messages
  useEffect(() => {
    // ป้องกันการทำงานซ้ำ (React StrictMode)
    if (hasInitialized || firstMessageSentRef.current) return;
    
    const firstMessage = location.state?.firstMessage;
    
    if (firstMessage) {
      // ตรวจสอบว่า firstMessage นี้ถูกส่งไปแล้วหรือยัง (ป้องกันการส่งซ้ำ)
      if (sentFirstMessageRef.current === firstMessage) {
        return; // ถ้าถูกส่งไปแล้ว ให้ข้าม
      }
      
      // Mark firstMessage as sent IMMEDIATELY (ก่อน async) เพื่อป้องกันการทำงานซ้ำ
      firstMessageSentRef.current = true;
      sentFirstMessageRef.current = firstMessage; // เก็บ firstMessage ที่ถูกส่งไปแล้ว
      
      // Clear location.state ทันทีเพื่อป้องกันการทำงานซ้ำ
      window.history.replaceState({}, document.title);
      
      // ส่งข้อความแรกและ bot response
      const sendFirstMessage = async () => {
        const chatIdInt = parseInt(chatId, 10);
        if (isNaN(chatIdInt)) {
          console.error('Invalid chat ID');
          return;
        }
        
        setIsTyping(true);
        try {
          // ส่งข้อความแรก
          await chatMessageAPI.createMessage(chatIdInt, firstMessage);
          
          // โหลด messages ใหม่จาก API
          await loadMessages();
          
          // สร้าง bot response (จะใช้เวลา 3 วินาที)
          try {
            const botResponseText = `ฉันได้รับข้อความของคุณแล้ว: "${firstMessage}"\n\nโปรดรอการอัพเดทระบบ AI เพื่อให้ได้คำตอบที่สมบูรณ์`;
            await chatMessageAPI.createBotResponse(chatIdInt, botResponseText);
            
            // โหลด messages ใหม่จาก API (จะรวม bot response ด้วย)
            await loadMessages();
          } catch (botError) {
            console.error('Error creating bot response:', botError);
            const errorMsg = botError.response?.data?.detail || botError.message || 'ไม่สามารถสร้าง bot response ได้';
            setErrorMessage(errorMsg);
            const timeoutId = setTimeout(() => {
              setErrorMessage(null);
            }, 5000);
            timeoutRefs.current['botError'] = timeoutId;
          }
        } catch (error) {
          console.error('Error sending first message:', error);
          const errorMsg = error.response?.data?.detail || error.message || 'ไม่สามารถส่งข้อความได้ กรุณาลองอีกครั้ง';
          setErrorMessage(errorMsg);
          const timeoutId = setTimeout(() => {
            setErrorMessage(null);
          }, 5000);
          timeoutRefs.current['firstMessageError'] = timeoutId;
        } finally {
          setIsTyping(false);
        }
      };
      
      sendFirstMessage();
    } else {
      // ถ้าไม่มี firstMessage ให้โหลด messages จาก API
      loadMessages();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId, hasInitialized]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Format timestamp (สำหรับแสดงใน timestamp badge)
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

  // Format timestamp แบบละเอียด (สำหรับแสดงใน tooltip)
  const formatDetailedTime = (date) => {
    return date.toLocaleString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const handleSendMessage = async (e) => {
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
    
    const chatIdInt = parseInt(chatId, 10);
    if (isNaN(chatIdInt)) {
      console.error('Invalid chat ID');
      return;
    }
    
    // ส่งข้อความไปยัง API (ไม่ใช้ optimistic update เพื่อป้องกันข้อความซ้ำ)
    setIsTyping(true);
    try {
      await chatMessageAPI.createMessage(chatIdInt, messageText);
      
      // โหลด messages ใหม่จาก API (จะรวมข้อความที่เพิ่งส่งไปด้วย)
      await loadMessages();
      
      // สร้าง bot response
      try {
        // สร้างข้อความตอบกลับจาก bot (ตอนนี้เป็น placeholder)
        // TODO: เรียกใช้ AI service เพื่อสร้าง bot response ที่แท้จริง
        const botResponseText = `ฉันได้รับข้อความของคุณแล้ว: "${messageText}"\n\nโปรดรอการอัพเดทระบบ AI เพื่อให้ได้คำตอบที่สมบูรณ์`;
        await chatMessageAPI.createBotResponse(chatIdInt, botResponseText);
        
        // โหลด messages ใหม่จาก API (จะรวม bot response ด้วย)
        await loadMessages();
      } catch (botError) {
        console.error('Error creating bot response:', botError);
        const errorMsg = botError.response?.data?.detail || botError.message || 'ไม่สามารถสร้าง bot response ได้';
        setErrorMessage(errorMsg);
        const timeoutId = setTimeout(() => {
          setErrorMessage(null);
        }, 5000);
        timeoutRefs.current['botError'] = timeoutId;
      }
      
      setIsTyping(false);
    } catch (error) {
      console.error('Error sending message:', error);
      setIsTyping(false);
      
      // Better error handling
      const errorMsg = error.response?.data?.detail || error.message || 'ไม่สามารถส่งข้อความได้ กรุณาลองอีกครั้ง';
      setErrorMessage(errorMsg);
      
      // Auto hide error after 5 seconds
      const timeoutId = setTimeout(() => {
        setErrorMessage(null);
      }, 5000);
      timeoutRefs.current['error'] = timeoutId;
    }
  };

  // Cleanup timeout เมื่อ component unmount หรือ chatId เปลี่ยน
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = null;
      }
      // Cleanup all timeouts
      Object.values(timeoutRefs.current).forEach(timeout => {
        if (timeout) clearTimeout(timeout);
      });
      timeoutRefs.current = {};
    };
  }, [chatId]);

  const adjustTextareaHeight = () => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  };

  // ฟังก์ชันสำหรับคัดลอกข้อความ
  const handleCopyMessage = async (messageText, messageId) => {
    try {
      await navigator.clipboard.writeText(messageText);
      setCopiedMessageId(messageId);
      // Reset copied state after 2 seconds
      const timeoutId = setTimeout(() => {
        setCopiedMessageId(null);
      }, 2000);
      timeoutRefs.current[`copy-${messageId}`] = timeoutId;
    } catch (error) {
      console.error('Failed to copy message:', error);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = messageText;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand('copy');
        setCopiedMessageId(messageId);
        const timeoutId = setTimeout(() => {
          setCopiedMessageId(null);
        }, 2000);
        timeoutRefs.current[`copy-fallback-${messageId}`] = timeoutId;
      } catch (err) {
        console.error('Fallback copy failed:', err);
      }
      document.body.removeChild(textArea);
    }
  };

  return (
    <div className='flex h-screen bg-[#f7f7f8] relative'>
      {/* Sidebar Component */}
      <Sidebar onCollapseChange={setIsSidebarCollapsed} />

      {/* Main Content */}
      <main className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'pl-16' : ''}`}>
        {/* Error Message Toast */}
        {errorMessage && (
          <div className='fixed top-4 right-4 z-50 animate-slide-in-right'>
            <div className='bg-red-500 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 max-w-md'>
              <div className='flex-1'>
                <p className='text-sm font-medium'>{errorMessage}</p>
              </div>
              <button
                onClick={() => setErrorMessage(null)}
                className='text-white hover:text-gray-200 transition-colors'
              >
                <HiX className='text-lg' />
              </button>
            </div>
          </div>
        )}
        
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
        <div className='flex-1 overflow-y-auto bg-[#f7f7f8]'>
          <div className='max-w-3xl mx-auto px-4 sm:px-6 py-6'>
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
              <div className='space-y-4'>
                {messages.map((message, index) => {
                  const showTimestamp = index === 0 || 
                    new Date(message.timestamp) - new Date(messages[index - 1].timestamp) > 300000;
                  
                  const isUser = message.sender === 'user';
                  
                  return (
                    <div key={message.id} className='group'>
                      {showTimestamp && (
                        <div className='flex justify-center my-4'>
                          <span className='text-xs text-gray-400 bg-white px-3 py-1.5 rounded-full shadow-sm'>
                            {formatTime(message.timestamp)}
                          </span>
                        </div>
                      )}
                      
                      <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                        {/* Avatar */}
                        <div className='flex-shrink-0 w-8 h-8 mt-1'>
                          {isUser ? (
                            <div className='w-8 h-8 bg-gradient-to-br from-gray-400 to-gray-500 rounded-full flex items-center justify-center shadow-sm'>
                              <HiOutlineUser className='text-white text-sm' />
                            </div>
                          ) : (
                            <div className='w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center shadow-sm'>
                              <HiChatBubbleLeftRight className='text-white text-sm' />
                            </div>
                          )}
                        </div>
                        
                        {/* Message Content */}
                        <div className={`flex-1 ${isUser ? 'flex justify-end' : 'flex justify-start'}`}>
                          <div className={`max-w-[80%] ${isUser ? 'text-right' : 'text-left'} relative group/message`}>
                            <div
                              className={`inline-block px-4 py-2.5 rounded-2xl relative group/timestamp ${
                                isUser
                                  ? 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-gray-900 shadow-sm'
                                  : 'bg-white text-gray-900 border border-gray-200 shadow-sm'
                              }`}
                              style={{ 
                                maxWidth: '100%',
                                wordWrap: 'break-word',
                                overflowWrap: 'break-word',
                                wordBreak: 'break-word'
                              }}
                              onMouseMove={(e) => {
                                if (hoveredMessageId !== message.id) {
                                  setHoveredMessageId(message.id);
                                }
                                const rect = e.currentTarget.getBoundingClientRect();
                                const mouseY = e.clientY - rect.top;
                                setTooltipPosition(prev => ({
                                  ...prev,
                                  [message.id]: mouseY
                                }));
                              }}
                              onMouseLeave={() => {
                                setHoveredMessageId(null);
                                setTooltipPosition(prev => {
                                  const newPos = { ...prev };
                                  delete newPos[message.id];
                                  return newPos;
                                });
                              }}
                            >
                              <p 
                                className='text-[15px] leading-relaxed whitespace-pre-wrap break-words'
                                style={{
                                  wordWrap: 'break-word',
                                  overflowWrap: 'break-word',
                                  wordBreak: 'break-word',
                                  hyphens: 'auto',
                                  maxWidth: '100%',
                                  overflow: 'hidden'
                                }}
                              >
                                {message.text}
                              </p>
                              
                              {/* Timestamp Tooltip - แสดงเมื่อ hover ติดตาม cursor */}
                              {hoveredMessageId === message.id && tooltipPosition[message.id] !== undefined && (
                                <div className={`absolute ${
                                  isUser ? 'right-full mr-2' : 'left-full ml-2'
                                } opacity-100 transition-opacity duration-150 pointer-events-none z-50 whitespace-nowrap`}
                                style={{ 
                                  top: `${tooltipPosition[message.id]}px`, 
                                  transform: 'translateY(-50%)' 
                                }}
                                >
                                  <div className="bg-gray-900 text-white text-xs rounded-lg px-2 py-1.5 shadow-lg relative">
                                    {formatDetailedTime(message.timestamp)}
                                    <div className={`absolute ${
                                      isUser ? 'right-0' : 'left-0'
                                    } top-1/2 -translate-y-1/2 ${
                                      isUser ? '-mr-1' : '-ml-1'
                                    } w-0 h-0 border-t-4 border-b-4 ${
                                      isUser ? 'border-r-4 border-r-gray-900 border-l-0' : 'border-l-4 border-l-gray-900 border-r-0'
                                    } border-transparent`}></div>
                                  </div>
                                </div>
                              )}
                            </div>
                            
                            {/* Copy Button - แสดงตลอดเวลา ใต้กรอบข้อความ */}
                            <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mt-1`}>
                              <div className="relative group/copy inline-block">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCopyMessage(message.text, message.id);
                                  }}
                                  className={`opacity-70 hover:opacity-100 transition-all duration-150 border border-transparent ${
                                    isUser
                                      ? 'text-yellow-800 hover:text-yellow-900'
                                      : 'text-gray-700 hover:text-gray-900'
                                  } rounded p-1.5 hover:bg-gray-100 hover:border-gray-300 flex items-center gap-1`}
                                >
                                  {copiedMessageId === message.id ? (
                                    <HiCheck className='text-base' />
                                  ) : (
                                    <HiClipboardCopy className='text-base' />
                                  )}
                                </button>
                                
                                {/* Tooltip - ใช้ absolute positioning และ pointer-events-none เพื่อไม่กระทบ layout */}
                                <div className={`absolute ${
                                  isUser ? 'right-0' : 'left-0'
                                } top-full mt-2 opacity-0 group-hover/copy:opacity-100 transition-opacity duration-150 pointer-events-none z-50 whitespace-nowrap`}>
                                  <div className="bg-gray-900 text-white text-xs rounded-lg px-2 py-1.5 shadow-lg relative">
                                    {copiedMessageId === message.id ? 'คัดลอกแล้ว' : 'คัดลอกข้อความ'}
                                    <div className={`absolute ${
                                      isUser ? 'right-2' : 'left-2'
                                    } bottom-full w-0 h-0 border-l-4 border-r-4 border-b-4 border-transparent border-b-gray-900`}></div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {/* Typing Indicator */}
                {isTyping && (
                  <div className='flex gap-3 justify-start'>
                    <div className='flex-shrink-0 w-8 h-8 mt-1'>
                      <div className='w-8 h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center shadow-sm'>
                        <HiChatBubbleLeftRight className='text-white text-sm' />
                      </div>
                    </div>
                    <div className='flex-1'>
                      <div className='inline-block px-4 py-2.5 rounded-2xl bg-white border border-gray-200 shadow-sm'>
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
              <div className='flex items-end gap-2 bg-white border-2 border-gray-300 rounded-2xl shadow-sm hover:border-yellow-400 focus-within:border-yellow-400 transition-colors'>
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
                  className='flex-1 outline-none text-gray-700 text-[15px] placeholder-gray-400 bg-transparent resize-none overflow-hidden min-h-[52px] max-h-[200px] px-4 py-3.5'
                />
                
                <div className='pr-2 pb-2 flex items-center justify-center'>
                  <button
                    type='submit'
                    disabled={!chatInput.trim()}
                    className={`rounded-lg p-2.5 transition-all flex items-center justify-center ${
                      chatInput.trim()
                        ? 'bg-gradient-to-br from-yellow-400 to-yellow-500 text-gray-900 hover:from-yellow-500 hover:to-yellow-600 shadow-sm hover:shadow-md'
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
