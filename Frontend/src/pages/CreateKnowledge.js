import { useNavigate, useLocation } from 'react-router-dom';
import { HiArrowLeft, HiChevronDown, HiCheck, HiX } from 'react-icons/hi';
import Sidebar from '../components/Sidebar';
import { useState, useEffect, useRef } from 'react';

function CreateKnowledge() {
  const navigate = useNavigate();
  const location = useLocation();
  const editingKnowledge = location.state?.knowledge;
  const isEditMode = !!editingKnowledge;
  
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [knowledgeName, setKnowledgeName] = useState(editingKnowledge?.name || '');
  const [description, setDescription] = useState(editingKnowledge?.description || '');
  const [isGroupDropdownOpen, setIsGroupDropdownOpen] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState(editingKnowledge?.groups || []);
  const groupDropdownRef = useRef(null);
  const [groupList] = useState([
    { id: 1, name: 'กลุ่มพัฒนา', description: 'Development Team' },
    { id: 2, name: 'กลุ่มการตลาด', description: 'Marketing Team' },
    { id: 3, name: 'กลุ่มฝ่ายขาย', description: 'Sales Team' },
    { id: 4, name: 'กลุ่มสนับสนุน', description: 'Support Team' },
  ]);

  const handleGroupToggle = (group) => {
    setSelectedGroups((prev) => {
      const exists = prev.find((g) => g.id === group.id);
      return exists ? prev.filter((g) => g.id !== group.id) : [...prev, group];
    });
  };

  const handleRemoveGroup = (groupId) => {
    setSelectedGroups((prev) => prev.filter((g) => g.id !== groupId));
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (groupDropdownRef.current && !groupDropdownRef.current.contains(event.target)) {
        setIsGroupDropdownOpen(false);
      }
    };

    if (isGroupDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isGroupDropdownOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (isEditMode) {
      // Update existing knowledge in localStorage
      const knowledgeListStr = localStorage.getItem('knowledgeList');
      if (knowledgeListStr) {
        try {
          const knowledgeList = JSON.parse(knowledgeListStr);
          const updatedList = knowledgeList.map(k => {
            if (k.id === editingKnowledge.id) {
              return { ...k, name: knowledgeName, description, groups: selectedGroups };
            }
            return k;
          });
          localStorage.setItem('knowledgeList', JSON.stringify(updatedList));
        } catch (e) {
          console.error('Error updating knowledge:', e);
        }
      }
    } else {
      // Create new knowledge logic here
    }
    
    // After creation/update, navigate back to knowledge page
    navigate('/knowledge');
  };

  return (
    <div className='flex h-screen bg-white relative'>
      {/* Sidebar Component */}
      <Sidebar onCollapseChange={setIsSidebarCollapsed} />

      {/* Main Content */}
      <main className={`flex-1 bg-white px-8 py-6 overflow-auto flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'pl-16' : ''}`}>
        {/* Back Button */}
        <button
          onClick={() => navigate('/knowledge')}
          className='flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors mb-6 self-start'
        >
          <HiArrowLeft className='text-lg' />
          <span>Back</span>
        </button>

        <form onSubmit={handleSubmit} className='flex-1 max-w-4xl'>
          {/* Header */}
          <div className='mb-8'>
            <h1 className='text-3xl font-bold text-gray-800 mb-4'>{isEditMode ? 'Edit Knowledge' : 'Create Knowledge'}</h1>
          </div>

          {/* Knowledge Name Section */}
          <div className='mb-8'>
            <label htmlFor='knowledge-name' className='block text-sm font-medium text-gray-700 mb-3'>
              ชื่อฐานความรู้ (Knowledge Base Name)
            </label>
            <input
              id='knowledge-name'
              type='text'
              value={knowledgeName}
              onChange={(e) => setKnowledgeName(e.target.value)}
              placeholder='Enter knowledge base name'
              required
              className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all text-gray-700 placeholder-gray-400'
            />
          </div>

          {/* Description Section */}
          <div className='mb-8'>
            <label htmlFor='knowledge-description' className='block text-sm font-medium text-gray-700 mb-3'>
              คำอธิบาย
            </label>
            <textarea
              id='knowledge-description'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder='เพิ่มคำอธิบายสำหรับฐานความรู้'
              rows={4}
              className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all resize-none text-gray-700 placeholder-gray-400'
            />
          </div>

          {/* Grouping Section */}
          <div className='mb-8'>
            <label className='block text-md font-medium text-gray-700 mb-3'>
              การจัดกลุ่ม
            </label>
            <p className='text-sm text-gray-600 mb-4'>
              หากต้องการเชื่อมต่อฐานความรู้กับกลุ่มผู้ใช้ ให้เพิ่มกลุ่มผู้ใช้ที่นี่
            </p>
            <div className='relative' ref={groupDropdownRef}>
              <button
                type='button'
                onClick={() => setIsGroupDropdownOpen(!isGroupDropdownOpen)}
                className='w-full max-w-md px-4 py-3 bg-white border border-gray-300 rounded-lg text-left flex items-center justify-between hover:border-gray-400 transition-colors'
              >
                <span className={selectedGroups.length > 0 ? 'text-gray-800' : 'text-gray-400'}>
                  {selectedGroups.length > 0 ? `เลือกแล้ว ${selectedGroups.length} กลุ่ม` : 'เลือกกลุ่ม'}
                </span>
                <HiChevronDown className={`text-gray-500 transition-transform ${isGroupDropdownOpen ? 'rotate-180' : ''}`} />
              </button>
              
              {isGroupDropdownOpen && (
                <div className='absolute z-50 w-full max-w-md mt-2 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto'>
                  {groupList.map((group) => (
                    <button
                      key={group.id}
                      type='button'
                      onClick={() => handleGroupToggle(group)}
                      className={`w-full text-left px-4 py-3 transition-colors border-b border-gray-200 last:border-b-0 flex items-start justify-between gap-3 ${
                        selectedGroups.find((g) => g.id === group.id) ? 'bg-yellow-50 hover:bg-yellow-100' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div>
                        <p className='font-medium text-gray-800'>{group.name}</p>
                        <p className='text-sm text-gray-600'>{group.description}</p>
                      </div>
                      {selectedGroups.find((g) => g.id === group.id) && (
                        <HiCheck className='text-yellow-500 text-lg flex-shrink-0 mt-1' />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selectedGroups.length > 0 && (
              <div className='mt-4 space-y-2'>
                <p className='text-sm font-medium text-gray-700'>กลุ่มที่เลือก:</p>
                <div className='flex flex-wrap gap-2'>
                  {selectedGroups.map((group) => (
                    <div
                      key={group.id}
                      className='flex items-center gap-2 px-3 py-2 bg-yellow-100 border border-yellow-300 rounded-lg'
                    >
                      <span className='text-sm font-medium text-gray-800'>{group.name}</span>
                      <button
                        type='button'
                        onClick={() => handleRemoveGroup(group.id)}
                        className='flex items-center justify-center text-gray-600 hover:text-red-600 transition-colors'
                        title='Remove group'
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
              onClick={() => navigate('/knowledge')}
              className='px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors'
            >
              Cancel
            </button>
            <button
              type='submit'
              className='px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-800 font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95'
            >
              Submit
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

export default CreateKnowledge;
