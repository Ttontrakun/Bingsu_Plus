import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  HiLightningBolt,
  HiPencilAlt,
  HiOutlinePaperAirplane
} from 'react-icons/hi';
import bingsuLogo from '../assets/images/หน่องบิงไม่มีพื้นละ.png';
import Sidebar from '../components/Sidebar';
import Dropdown from '../components/Dropdown';

function Homepage() {
  const navigate = useNavigate();
  const [selectedBot, setSelectedBot] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [chatInput, setChatInput] = useState('');

  // ฟังก์ชันสำหรับสร้างแชทใหม่
  const createNewChat = (firstMessage) => {
    // ดึงแชทที่มีอยู่จาก localStorage
    const storedChats = localStorage.getItem('chats');
    let existingChats = [];
    
    if (storedChats) {
      try {
        const parsed = JSON.parse(storedChats);
        // ตรวจสอบว่าเป็น array และมีข้อมูล
        if (Array.isArray(parsed) && parsed.length > 0) {
          // ตรวจสอบว่าแต่ละ chat มี id และ name ที่ valid
          existingChats = parsed.filter(chat => 
            chat && 
            typeof chat === 'object' && 
            chat.id && 
            typeof chat.id === 'string' &&
            chat.name &&
            typeof chat.name === 'string'
          );
          
          // ถ้า filter แล้วไม่มี chat ที่ valid ให้ใช้ default
          if (existingChats.length === 0) {
            existingChats = [
              { id: 'chat-1', name: 'Chat 1' },
              { id: 'chat-2', name: 'Chat 2' },
              { id: 'chat-3', name: 'Chat 3' },
            ];
            try {
              localStorage.setItem('chats', JSON.stringify(existingChats));
            } catch (storageError) {
              console.error('Error saving default chats:', storageError);
            }
          }
        } else {
          // ถ้าไม่ใช่ array หรือว่างเปล่า ให้ใช้ default chats
          existingChats = [
            { id: 'chat-1', name: 'Chat 1' },
            { id: 'chat-2', name: 'Chat 2' },
            { id: 'chat-3', name: 'Chat 3' },
          ];
          // บันทึก default chats ลง localStorage
          try {
            localStorage.setItem('chats', JSON.stringify(existingChats));
          } catch (storageError) {
            console.error('Error saving default chats:', storageError);
          }
        }
      } catch (error) {
        console.error('Error parsing chats:', error);
        // ถ้า parse ไม่ได้ ให้ใช้ default chats
        existingChats = [
          { id: 'chat-1', name: 'Chat 1' },
          { id: 'chat-2', name: 'Chat 2' },
          { id: 'chat-3', name: 'Chat 3' },
        ];
        // บันทึก default chats ลง localStorage
        try {
          localStorage.setItem('chats', JSON.stringify(existingChats));
        } catch (storageError) {
          console.error('Error saving default chats:', storageError);
        }
      }
    } else {
      // ถ้ายังไม่มีแชทใน localStorage ให้ใช้ default chats
      existingChats = [
        { id: 'chat-1', name: 'Chat 1' },
        { id: 'chat-2', name: 'Chat 2' },
        { id: 'chat-3', name: 'Chat 3' },
      ];
      // บันทึก default chats ลง localStorage
      try {
        localStorage.setItem('chats', JSON.stringify(existingChats));
      } catch (error) {
        console.error('Error saving default chats:', error);
      }
    }

    // หา chat number ที่ใหญ่ที่สุดเพื่อป้องกันการซ้ำ
    let maxChatNumber = 0;
    existingChats.forEach(chat => {
      const match = chat.id.match(/^chat-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxChatNumber) {
          maxChatNumber = num;
        }
      }
    });

    // สร้างแชทใหม่ด้วย number ที่ไม่ซ้ำ
    const newChatNumber = maxChatNumber + 1;
    // Sanitize ชื่อแชท - ลบ special characters และจำกัดความยาว
    let chatName = `Chat ${newChatNumber}`;
    if (firstMessage && typeof firstMessage === 'string' && firstMessage.trim()) {
      const sanitizedName = firstMessage
        .trim()
        .replace(/[<>]/g, '') // ลบ < และ >
        .replace(/javascript:/gi, '') // ลบ javascript: protocol
        .replace(/on\w+=/gi, '') // ลบ event handlers
        .substring(0, 20);
      chatName = sanitizedName || `Chat ${newChatNumber}`;
      if (firstMessage.length > 20) {
        chatName += '...';
      }
    }
    
    const newChat = {
      id: `chat-${newChatNumber}`,
      name: chatName
    };

    // เพิ่มแชทใหม่เข้าไปในรายการ (ไม่ลบแชทเก่า)
    const updatedChats = [...existingChats, newChat];
    
    // บันทึกลง localStorage
    try {
      localStorage.setItem('chats', JSON.stringify(updatedChats));
    } catch (error) {
      console.error('Error saving chat to localStorage:', error);
      // ถ้าบันทึกไม่สำเร็จ ให้แสดง error แต่ยัง navigate ต่อไป
    }
    
    // ส่ง custom event เพื่อให้ Sidebar อัพเดท
    window.dispatchEvent(new CustomEvent('chatsUpdated'));
    
    // Navigate ไปที่แชทใหม่พร้อมข้อความแรก
    navigate(`/chat/${newChat.id}`, { 
      state: { 
        firstMessage: firstMessage 
      } 
    });
  };

  // ฟังก์ชันสำหรับจัดการการส่งข้อความ
  const handleSendMessage = (e) => {
    e.preventDefault();
    const trimmedInput = chatInput.trim();
    if (trimmedInput) {
      // Sanitize และจำกัดความยาวข้อความ
      const sanitizedMessage = trimmedInput.substring(0, 1000);
      setChatInput('');
      createNewChat(sanitizedMessage);
    }
  };


  const botOptions = [
    { value: 'bot1', label: 'Bot 1' },
    { value: 'bot2', label: 'Bot 2' },
    { value: 'bot3', label: 'Bot 3' },
  ];

  return (
    <div className='flex h-screen bg-white relative'>
    {/* Sidebar Component */}
    <Sidebar onCollapseChange={setIsSidebarCollapsed} />

    {/* Main Content */}
    <main className={`flex-1 bg-white px-8 py-6 overflow-auto flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'pl-16' : ''}`}>
      {/* Top Bar */}
      <div className='flex justify-between items-center mb-8'>
        <Dropdown
          options={botOptions}
          selectedValue={selectedBot}
          onSelect={setSelectedBot}
          placeholder="Select Bots"
        />
        <button className='text-gray-600 text-xl cursor-pointer hover:text-gray-800 transition'>
          <HiPencilAlt />
        </button>
      </div>

      {/* Welcome Section - Centered */}
      <div className='flex flex-col items-center justify-center flex-1'>
        {/* Mascot */}
        <div className='mb-6'>
          <img src={bingsuLogo} alt="mascot" className='w-32 h-32 object-cover' />
        </div>

        {/* Title */}
        <h1 className='text-2xl font-semibold text-gray-800 mb-4'>Welcome to BingSu LLM</h1>

        {/* Description */}
        <p className='text-gray-600 text-center max-w-2xl leading-relaxed mb-10'>
          บิงซูบอท (Bingsu Bot) ผู้ช่วยอัจฉริยะดิจิทัล<br />
          ที่พร้อมให้บริการข้อมูลและความช่วยเหลือ<br />
          แก่ประชาชนด้วยความเป็นมิตร มีประสิทธิภาพ และโปร่งใส
        </p>

        {/* Chat Input */}
        <div className='w-full max-w-4xl flex justify-center'>
          <div className='flex items-center gap-2 border-4 border-yellow-400 rounded-3xl px-6 py-4 bg-white shadow-lg w-full'>
            <textarea
              value={chatInput}
              onChange={(e) => {
                setChatInput(e.target.value);
                // Auto resize textarea with max height limit
                const textarea = e.target;
                textarea.style.height = 'auto';
                const maxHeight = 128; // 8rem = 128px
                textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
              }}
              onKeyDown={(e) => {
                // Auto resize on key down with max height limit
                const textarea = e.target;
                textarea.style.height = 'auto';
                const maxHeight = 128; // 8rem = 128px
                textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`;
                
                // ส่งข้อความเมื่อกด Enter (ไม่ใช่ Shift+Enter)
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage(e);
                }
              }}
              placeholder='How can I help today?...'
              rows={1}
              className='flex-1 outline-none text-gray-700 text-base placeholder-gray-400 bg-transparent resize-none overflow-hidden min-h-[1.5rem] max-h-32'
            />
            <button
              type='button'
              onClick={handleSendMessage}
              className={`text-xl cursor-pointer transition ${chatInput.trim() ? 'text-gray-600 hover:scale-110 hover:text-gray-800' : 'text-gray-300 cursor-not-allowed'}`}
              disabled={!chatInput.trim()}
            >
              <HiOutlinePaperAirplane className='transform rotate-90' />
            </button>
          </div>
        </div>

        {/* Suggested */}
        <div className='w-full max-w-2xl mt-8'>
          <div className='text-gray-500 text-sm mb-4 flex items-center gap-2'>
            <HiLightningBolt className='text-lg' />
            <span>How To</span>
          </div>
          <div className='flex gap-4'>
            <div className='flex-1 h-16 bg-gray-200 rounded-xl'></div>
            <div className='flex-1 h-16 bg-gray-200 rounded-xl'></div>
            <div className='flex-1 h-16 bg-gray-200 rounded-xl'></div>
          </div>
        </div>
      </div>
    </main>
    </div>
  );
}

export default Homepage;
