import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  HiLightningBolt,
  HiPencilAlt,
  HiOutlinePaperAirplane,
} from 'react-icons/hi';
import bingsuLogo from '../assets/images/หน่องบิงไม่มีพื้นละ.png';
import Sidebar from '../components/Sidebar';
import Dropdown from '../components/Dropdown';
import { botsAPI, conversationsAPI, documentsAPI } from '../services/api';
import { listCache } from '../utils/listCache';

const STORAGE_KNOWLEDGE = 'homepage_selected_knowledge_id';
const STORAGE_BOT = 'homepage_selected_bot_id';
const DEFAULT_DESCRIPTION = 'บิงซูบอท (Bingsu Bot) ผู้ช่วยอัจฉริยะดิจิทัล ที่พร้อมให้บริการข้อมูลและความช่วยเหลือ แก่ประชาชนด้วยความเป็นมิตร มีประสิทธิภาพ และโปร่งใส';

const HELP_KNOWLEDGE_LABEL = 'คู่มือการใช้งาน';
const HELP_BOT_LABEL = 'บอทช่วยสอน';

const HOW_TO_ITEMS = [
  { label: 'วิธีเริ่มแชท', message: 'วิธีเริ่มแชทกับบอททำยังไง?' },
  { label: 'การเลือก Knowledge', message: 'การเลือก Knowledge ทำยังไง?' },
  { label: 'การสร้างบอท', message: 'การสร้างบอททำยังไง?' },
];

function Homepage() {
  const navigate = useNavigate();
  const [selectedBot, setSelectedBot] = useState(null);
  const [selectedKnowledge, setSelectedKnowledge] = useState(null);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [bots, setBots] = useState(() => listCache.getBots() || []);
  const [knowledgeOptions, setKnowledgeOptions] = useState(() => {
    const docs = listCache.getDocuments();
    return (docs || []).map((d) => ({ value: d.id, label: d.displayName }));
  });
  const [loading, setLoading] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(
    () => !(listCache.getBots()?.length && listCache.getDocuments()?.length)
  );

  const botOptions = bots.map((b) => ({ value: b.id, label: b.name }));
  const selectedBotDetails = bots.find((b) => b.id === selectedBot) || null;
  const homepageDescription = selectedBotDetails?.description?.trim() || DEFAULT_DESCRIPTION;
  const helpKnowledgeId = knowledgeOptions.find((o) => o.label === HELP_KNOWLEDGE_LABEL)?.value ?? null;
  const helpBotId = botOptions.find((o) => o.label === HELP_BOT_LABEL)?.value ?? null;
  const canUseHowTo = Boolean(helpKnowledgeId && helpBotId);

  const persistKnowledge = useCallback((id) => {
    if (id != null) localStorage.setItem(STORAGE_KNOWLEDGE, String(id));
    else localStorage.removeItem(STORAGE_KNOWLEDGE);
  }, []);
  const persistBot = useCallback((id) => {
    if (id != null) localStorage.setItem(STORAGE_BOT, String(id));
    else localStorage.removeItem(STORAGE_BOT);
  }, []);

  useEffect(() => {
    const cachedDocs = listCache.getDocuments();
    const cachedBots = listCache.getBots();
    if (cachedBots?.length && cachedDocs?.length) {
      const savedKnowledge = localStorage.getItem(STORAGE_KNOWLEDGE);
      const savedBot = localStorage.getItem(STORAGE_BOT);
      if (savedKnowledge && cachedDocs.some((d) => d.id === savedKnowledge)) setSelectedKnowledge(savedKnowledge);
      if (savedBot && cachedBots.some((b) => b.id === savedBot)) setSelectedBot(savedBot);
    }

    const bootstrap = async () => {
      const hasCache = cachedBots?.length && cachedDocs?.length;
      if (!hasCache) setLoadingOptions(true);
      try {
        const [botsRes, docs] = await Promise.all([
          botsAPI.list(),
          documentsAPI.list(),
        ]);
        const botsList = botsRes || [];
        const docsList = docs || [];
        setBots(botsList);
        setKnowledgeOptions(docsList.map((d) => ({ value: d.id, label: d.displayName })));
        listCache.setBots(botsList);
        listCache.setDocuments(docsList);

        const savedKnowledge = localStorage.getItem(STORAGE_KNOWLEDGE);
        const savedBot = localStorage.getItem(STORAGE_BOT);
        if (savedKnowledge && docsList.some((d) => d.id === savedKnowledge)) {
          setSelectedKnowledge(savedKnowledge);
        }
        if (savedBot && botsList.some((b) => b.id === savedBot)) {
          setSelectedBot(savedBot);
        }
      } catch (err) {
        console.error('Failed to load bots/documents', err);
      } finally {
        setLoadingOptions(false);
      }
    };
    bootstrap();
  }, []);

  const createNewChat = async (firstMessage) => {
    const message = (firstMessage || '').trim().slice(0, 1000);
    if (!message) return;
    if (!selectedKnowledge) {
      alert('กรุณาเลือก Knowledge ก่อนเริ่มแชท');
      return;
    }
    setLoading(true);
    try {
      const conversation = await conversationsAPI.create(selectedKnowledge, selectedBot);
      navigate(`/chat/${conversation.id}`, {
        state: { firstMessage: message },
      });
    } catch (err) {
      console.error('Failed to create conversation', err);
      alert('สร้างแชทไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setLoading(false);
    }
  };

  const startHelpChat = async (firstMessage) => {
    if (!canUseHowTo) {
      alert('ยังไม่มีบอทช่วยสอนในระบบ กรุณารัน seed:help-bot ที่ backend');
      return;
    }
    setLoading(true);
    try {
      const conversation = await conversationsAPI.create(helpKnowledgeId, helpBotId);
      navigate(`/chat/${conversation.id}`, {
        state: { firstMessage: (firstMessage || '').trim().slice(0, 1000) },
      });
    } catch (err) {
      console.error('Failed to start help chat', err);
      alert('สร้างแชทไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      setLoading(false);
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


  return (
    <div className='flex h-screen bg-white relative'>
    {/* Sidebar Component */}
    <Sidebar onCollapseChange={setIsSidebarCollapsed} />

    {/* Main Content */}
    <main className={`flex-1 bg-white px-8 py-6 overflow-auto flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'pl-16' : ''}`}>
      {/* Top Bar */}
      <div className='flex justify-between items-center mb-8'>
        <div className="flex items-center gap-3">
          <Dropdown
            options={knowledgeOptions}
            selectedValue={selectedKnowledge}
            onSelect={(id) => {
              setSelectedKnowledge(id);
              persistKnowledge(id);
              const isHelpKnowledge = id === helpKnowledgeId;
              if (isHelpKnowledge && helpBotId) {
                setSelectedBot(helpBotId);
                persistBot(helpBotId);
              }
            }}
            placeholder={loadingOptions ? 'กำลังโหลด Knowledge...' : 'Select Knowledge'}
            disabled={loadingOptions}
          />
          <Dropdown
            options={botOptions}
            selectedValue={selectedBot}
            onSelect={(id) => {
              setSelectedBot(id);
              persistBot(id);
              const isHelpBot = id === helpBotId;
              if (isHelpBot && helpKnowledgeId) {
                setSelectedKnowledge(helpKnowledgeId);
                persistKnowledge(helpKnowledgeId);
              }
            }}
            placeholder={loadingOptions ? 'กำลังโหลด Bot...' : 'Select Bots (optional)'}
            disabled={loadingOptions}
          />
        </div>
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

        {/* กำลังโหลดรายการ — แสดงเมื่อดึง Knowledge/Bot ยังไม่เสร็จ */}
        {loadingOptions && (
          <p className='text-amber-600 text-sm mb-2'>กำลังโหลดรายการ Knowledge และ Bot...</p>
        )}

        {/* Description — ใช้คำอธิบายของบอทที่เลือก (ตั้งใน CreateBot) */}
        <p className='text-gray-600 text-center max-w-2xl leading-relaxed mb-10 whitespace-pre-line'>
          {homepageDescription}
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
              className={`text-xl cursor-pointer transition ${chatInput.trim() && !loading && !loadingOptions ? 'text-gray-600 hover:scale-110 hover:text-gray-800' : 'text-gray-300 cursor-not-allowed'}`}
              disabled={!chatInput.trim() || loading || loadingOptions}
            >
              <HiOutlinePaperAirplane className='transform rotate-90' />
            </button>
          </div>
        </div>

        {/* How To — คลิกเพื่อเปิดแชทกับบอทช่วยสอน หรือพิมพ์ถามในช่องด้านบน */}
        <div className='w-full max-w-2xl mt-8'>
          <div className='text-gray-500 text-sm mb-4 flex items-center gap-2'>
            <HiLightningBolt className='text-lg' />
            <span>How To</span>
          </div>
          <div className='flex gap-4'>
            {HOW_TO_ITEMS.map((item) => (
              <button
                key={item.label}
                type='button'
                onClick={() => startHelpChat(item.message)}
                disabled={!canUseHowTo || loading || loadingOptions}
                className='flex-1 h-16 rounded-xl border border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-yellow-400 transition-colors text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed'
              >
                {item.label}
              </button>
            ))}
          </div>
          {!canUseHowTo && (
            <p className='text-gray-400 text-xs mt-2 text-center'>เลือก Knowledge &quot;คู่มือการใช้งาน&quot; และ Bot &quot;บอทช่วยสอน&quot; แล้วพิมพ์ถามด้านบนก็ได้</p>
          )}
        </div>
      </div>
    </main>
    </div>
  );
}

export default Homepage;
