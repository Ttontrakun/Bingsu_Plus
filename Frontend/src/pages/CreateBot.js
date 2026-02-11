import { useLocation, useNavigate } from 'react-router-dom';
import { HiArrowLeft, HiChatAlt2, HiX, HiSearch, HiCheck } from 'react-icons/hi';
import Sidebar from '../components/Sidebar';
import { useEffect, useMemo, useRef, useState } from 'react';
import { botsAPI, documentsAPI, getErrorMessage } from '../services/api';

function CreateBot() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const botState = location?.state?.bot || null;
  const isEditing = Boolean(botState?.id);

  const [botName, setBotName] = useState(botState?.name || '');
  const [modelId, setModelId] = useState(botState?.model || '');
  const [description, setDescription] = useState(botState?.description || '');
  const [systemPrompt, setSystemPrompt] = useState(botState?.prompt || '');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Knowledge states
  const [selectedKnowledge, setSelectedKnowledge] = useState([]);
  const [tempSelectedKnowledge, setTempSelectedKnowledge] = useState([]);
  const [isKnowledgeModalOpen, setIsKnowledgeModalOpen] = useState(false);
  const [isConfirmCloseModalOpen, setIsConfirmCloseModalOpen] = useState(false);
  const [knowledgeSearchQuery, setKnowledgeSearchQuery] = useState('');
  const knowledgeModalRef = useRef(null);

  const [knowledgeList, setKnowledgeList] = useState([]);

  const handleAddKnowledge = (knowledge) => {
    // Toggle selection - if already selected, remove it; if not, add it
    const isAlreadySelected = tempSelectedKnowledge.find(k => k.id === knowledge.id);
    if (isAlreadySelected) {
      setTempSelectedKnowledge(tempSelectedKnowledge.filter(k => k.id !== knowledge.id));
    } else {
      setTempSelectedKnowledge([...tempSelectedKnowledge, knowledge]);
    }
  };

  const handleRemoveSelectedKnowledge = (knowledgeId) => {
    setSelectedKnowledge(selectedKnowledge.filter(k => k.id !== knowledgeId));
  };

  const handleSaveKnowledge = () => {
    setSelectedKnowledge(tempSelectedKnowledge);
    setIsKnowledgeModalOpen(false);
  };

  const handleCloseKnowledgeModal = () => {
    if (tempSelectedKnowledge.length > 0 && JSON.stringify(tempSelectedKnowledge) !== JSON.stringify(selectedKnowledge)) {
      setIsKnowledgeModalOpen(false);
      setIsConfirmCloseModalOpen(true);
    } else {
      setIsKnowledgeModalOpen(false);
      setTempSelectedKnowledge(selectedKnowledge);
    }
  };

  const handleConfirmClose = (save) => {
    if (save) {
      setSelectedKnowledge(tempSelectedKnowledge);
    } else {
      setTempSelectedKnowledge(selectedKnowledge);
    }
    setIsConfirmCloseModalOpen(false);
  };

  // Open modal and initialize temp selection
  const openKnowledgeModal = () => {
    setTempSelectedKnowledge(selectedKnowledge);
    setIsKnowledgeModalOpen(true);
  };

  // Close modal when clicking outside
  useEffect(() => {
    if (!isKnowledgeModalOpen) return;

    const handleClickOutside = (event) => {
      if (knowledgeModalRef.current && !knowledgeModalRef.current.contains(event.target)) {
        setIsKnowledgeModalOpen(false);
      }
    };

      document.addEventListener('mousedown', handleClickOutside);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isKnowledgeModalOpen]);

  useEffect(() => {
    // Load knowledge list from backend
    const loadKnowledge = async () => {
      setError('');
      try {
        const docs = await documentsAPI.list();
        const mapped = (docs || []).map((d) => ({
          id: d.id,
          name: d.displayName,
          description: d.sourceFiles?.length ? `${d.sourceFiles.length} file(s)` : 'No files',
        }));
        setKnowledgeList(mapped);

        // Initialize selected knowledge when editing
        const initialSelected = (botState?.documents || []).map((d) => ({
          id: d.id,
          name: d.displayName,
          description: '',
        }));
        setSelectedKnowledge(initialSelected);
        setTempSelectedKnowledge(initialSelected);
      } catch (err) {
        console.error('Failed to load knowledge list', err);
        setError(getErrorMessage(err));
        setKnowledgeList([]);
      }
    };

    loadKnowledge();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredKnowledgeList = useMemo(() => {
    const q = knowledgeSearchQuery.trim().toLowerCase();
    if (!q) return knowledgeList;
    return knowledgeList.filter((knowledge) =>
      knowledge.name.toLowerCase().includes(q) ||
      (knowledge.description || '').toLowerCase().includes(q)
    );
  }, [knowledgeList, knowledgeSearchQuery]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const name = botName.trim();
    const prompt = systemPrompt.trim();
    if (!name) {
      setError('กรุณากรอกชื่อบอต');
      return;
    }
    if (!prompt) {
      setError('กรุณากรอกระบบพรอมต์');
      return;
    }

    const payload = {
      name,
      prompt,
      description: description?.trim() || null,
      model: modelId?.trim() || null,
      documentIds: selectedKnowledge.map((k) => k.id),
    };

    setIsSubmitting(true);
    try {
      if (isEditing) {
        await botsAPI.update(botState.id, payload);
      } else {
        await botsAPI.create(payload);
      }
      navigate('/bots');
    } catch (err) {
      console.error('Failed to save bot', err);
      setError(getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className='flex h-screen bg-white relative'>
      {/* Sidebar Component */}
      <Sidebar onCollapseChange={setIsSidebarCollapsed} />

      {/* Main Content */}
      <main className={`flex-1 bg-white px-8 py-6 overflow-auto flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'pl-16' : ''}`}>
        {/* Back Button */}
        <button
          onClick={() => navigate('/bots')}
          className='flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors mb-6 self-start'
        >
          <HiArrowLeft className='text-lg' />
          <span>Back</span>
        </button>

        <form onSubmit={handleSubmit} className='flex-1 max-w-4xl'>
          {error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">
              {error}
            </div>
          )}
          {/* Bot Profile Section */}
          <div className='mb-8'>
            <div className='flex items-start gap-4 mb-4'>
              <div className='flex flex-col items-center gap-2 flex-shrink-0'>
                <div className='w-20 h-20 bg-gray-500 rounded-lg flex items-center justify-center'>
                  <HiChatAlt2 className='text-white text-4xl' />
                </div>
                <button
                  type='button'
                  className='px-3 py-1.5 text-xs bg-yellow-400 hover:bg-yellow-500 text-gray-800 font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 whitespace-nowrap'
                >
                  Add Profile
                </button>
              </div>
              <div className='flex-1'>
                <div className='mb-2'>
                  <input
                    type='text'
                    value={botName}
                    onChange={(e) => setBotName(e.target.value)}
                    placeholder='ชื่อบอต'
                    className='text-2xl font-bold text-gray-800 border-none outline-none bg-transparent w-full placeholder-gray-400'
                  />
                </div>
                <div className='mb-4'>
                  <input
                    type='text'
                    value={modelId}
                    onChange={(e) => setModelId(e.target.value)}
                    placeholder='รหัสโมเดล'
                    className='text-sm text-gray-600 border-none outline-none bg-transparent w-full placeholder-gray-400'
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Description Section */}
          <div className='mb-8'>
            <label htmlFor='description' className='block text-sm font-medium text-gray-700 mb-3'>
              คำอธิบาย
            </label>
            <textarea
              id='description'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder='เพิ่มคำอธิบายสั้น ๆ สำหรับโมเดลที่ทำ'
              rows={4}
              className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all resize-none text-gray-700 placeholder-gray-400'
            />
          </div>

          {/* Model Parameters Section */}
          <div className='mb-8'>
            <label className='block text-sm font-medium text-gray-700 mb-3'>
              พารามิเตอร์ของบอท
            </label>
            <div className='mb-3'>
              <label className='block text-sm text-gray-600 mb-2'>
                ระบบพรอมต์
              </label>
              <textarea
                value={systemPrompt}
                onChange={(e) => setSystemPrompt(e.target.value)}
                placeholder='เพิ่มคำอธิบายสั้น ๆ สำหรับโมเดลที่ทำ'
                rows={6}
                className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all resize-none text-gray-700 placeholder-gray-400'
              />
            </div>
          </div>

          {/* Knowledge Section */}
          <div className='mb-8'>
            <label className='block text-sm font-medium text-gray-700 mb-3'>
              Knowledge
            </label>
            <p className='text-sm text-gray-600 mb-4'>
              หากต้องการเชื่อมต่อฐานความรู้ที่นี่ ให้เพิ่มข้อมูลลงในพื้นที่ทำงาน "Knowledge" ก่อน
            </p>
            <button
              type='button'
              onClick={openKnowledgeModal}
              className='px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-800 font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95'
            >
              เลือก Knowledge
            </button>

            {selectedKnowledge.length > 0 && (
              <div className='mt-4 space-y-2'>
                <p className='text-sm font-medium text-gray-700'>Knowledge ที่เลือก:</p>
                <div className='flex flex-wrap gap-2'>
                  {selectedKnowledge.map((knowledge) => (
                    <div
                      key={knowledge.id}
                      className='flex items-center gap-2 px-3 py-2 bg-yellow-100 border border-yellow-300 rounded-lg'
                    >
                      <span className='text-sm font-medium text-gray-800'>{knowledge.name}</span>
                      <button
                        type='button'
                        onClick={() => handleRemoveSelectedKnowledge(knowledge.id)}
                        className='flex items-center justify-center text-gray-600 hover:text-red-600 transition-colors'
                        title='Remove knowledge'
                      >
                        <HiX className='text-lg' />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Submit Buttons */}
          <div className='flex gap-4 pt-4 border-t border-gray-200'>
            <button
              type='button'
              onClick={() => navigate('/bots')}
              className='px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors'
            >
              Cancel
            </button>
            <button
              type='submit'
              disabled={isSubmitting}
              className={`px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-800 font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 ${isSubmitting ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {isSubmitting ? 'Saving…' : (isEditing ? 'Save' : 'Create')}
            </button>
          </div>
        </form>
      </main>

      {/* Knowledge Modal */}
      {isKnowledgeModalOpen && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
          <div ref={knowledgeModalRef} className='bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col'>
            <div className='px-6 py-4 border-b border-gray-200 flex items-center justify-between'>
              <h2 className='text-xl font-semibold text-gray-800'>เลือก Knowledge</h2>
              <button
                onClick={handleCloseKnowledgeModal}
                className='text-gray-400 hover:text-gray-600 transition-colors'
              >
                <HiX className='text-2xl' />
              </button>
            </div>
            <div className='px-6 py-4 border-b border-gray-200'>
              <div className='relative'>
                <HiSearch className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400' />
                <input
                  type='text'
                  value={knowledgeSearchQuery}
                  onChange={(e) => setKnowledgeSearchQuery(e.target.value)}
                  placeholder='Search knowledge...'
                  className='w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent'
                />
              </div>
            </div>
            <div className='flex-1 overflow-y-auto px-6 py-4'>
              {filteredKnowledgeList.length > 0 ? (
                <div className='space-y-2'>
                  {filteredKnowledgeList.map((knowledge) => {
                    const isSelected = tempSelectedKnowledge.find(k => k.id === knowledge.id);
                    return (
                      <button
                        key={knowledge.id}
                        type='button'
                        onClick={() => handleAddKnowledge(knowledge)}
                        className={`w-full text-left px-4 py-3 rounded-lg border transition-colors ${
                          isSelected
                            ? 'bg-yellow-50 border-yellow-300 hover:bg-yellow-100'
                            : 'bg-white border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className='flex items-start justify-between'>
                          <div>
                            <p className='font-medium text-gray-800'>{knowledge.name}</p>
                            <p className='text-sm text-gray-600 mt-1'>{knowledge.description}</p>
                          </div>
                          {isSelected && (
                            <HiCheck className='text-yellow-500 text-lg flex-shrink-0 mt-1' />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className='text-center text-gray-500 py-8'>No knowledge found</p>
              )}
            </div>
            <div className='px-6 py-4 border-t border-gray-200 flex justify-end gap-3'>
              <button
                type='button'
                onClick={handleCloseKnowledgeModal}
                className='px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors'
              >
                Cancel
              </button>
              <button
                type='button'
                onClick={handleSaveKnowledge}
                className='px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-800 font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200'
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Close Modal */}
      {isConfirmCloseModalOpen && (
        <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
          <div className='bg-white rounded-lg shadow-xl w-full max-w-md p-6'>
            <h2 className='text-xl font-semibold text-gray-800 mb-4'>Unsaved Changes</h2>
            <p className='text-gray-600 mb-6'>
              You have unsaved changes. Do you want to save them before closing?
            </p>
            <div className='flex justify-end gap-3'>
              <button
                type='button'
                onClick={() => handleConfirmClose(false)}
                className='px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors'
              >
                Discard
              </button>
              <button
                type='button'
                onClick={() => handleConfirmClose(true)}
                className='px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-800 font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200'
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default CreateBot;
