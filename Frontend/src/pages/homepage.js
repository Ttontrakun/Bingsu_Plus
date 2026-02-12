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
import { chatAPI } from '../services/api';

function Homepage() {
  const navigate = useNavigate();
  const [selectedBot, setSelectedBot] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [chatInput, setChatInput] = useState('');

  // ฟังก์ชันสำหรับสร้างแชทใหม่
  const createNewChat = async (firstMessage) => {
    try {
      // Sanitize ชื่อแชท - ลบ special characters และจำกัดความยาว
      let chatName = null; // null = auto-generate name
      if (firstMessage && typeof firstMessage === 'string' && firstMessage.trim()) {
        const sanitizedName = firstMessage
          .trim()
          .replace(/[<>]/g, '') // ลบ < และ >
          .replace(/javascript:/gi, '') // ลบ javascript: protocol
          .replace(/on\w+=/gi, '') // ลบ event handlers
          .substring(0, 50); // จำกัดความยาว
        if (sanitizedName) {
          chatName = sanitizedName;
          if (firstMessage.length > 50) {
            chatName += '...';
          }
        }
      }
      
      // สร้างแชทใหม่ผ่าน API
      const newChat = await chatAPI.createChat(chatName, []);
      
      // ส่ง custom event เพื่อให้ Sidebar อัพเดท
      window.dispatchEvent(new CustomEvent('chatsUpdated'));
      
      // Navigate ไปที่แชทใหม่ทันที (ให้ Chat.js จัดการส่งข้อความและ bot response)
      navigate(`/chat/${newChat.id}`, { state: { firstMessage: firstMessage?.trim() } });
    } catch (error) {
      console.error('Error creating chat:', error);
      alert('ไม่สามารถสร้างแชทใหม่ได้ กรุณาลองอีกครั้ง');
    }
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
