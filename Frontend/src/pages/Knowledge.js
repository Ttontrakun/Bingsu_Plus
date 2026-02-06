import { useNavigate } from 'react-router-dom';
import { HiPlus, HiSearch, HiDotsHorizontal } from 'react-icons/hi';
import Sidebar from '../components/Sidebar';
import { useState, useRef, useEffect } from 'react';

function Knowledge() {
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [knowledgeList, setKnowledgeList] = useState([
    { id: 1, name: 'Knowledge Base 1', description: 'Description 1', groups: [] },
    { id: 2, name: 'Knowledge Base 2', description: 'Description 2', groups: [] },
  ]);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [openGroupDropdownId, setOpenGroupDropdownId] = useState(null);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [knowledgeToDelete, setKnowledgeToDelete] = useState(null);
  const [isGroupConfirmOpen, setIsGroupConfirmOpen] = useState(false);
  const [groupConfirmAction, setGroupConfirmAction] = useState(null);
  const [pendingGroup, setPendingGroup] = useState(null);
  const [pendingKnowledgeId, setPendingKnowledgeId] = useState(null);
  const menuRefs = useRef({});
  const dropdownRefs = useRef({});

  const handleMenuToggle = (e, knowledgeId) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === knowledgeId ? null : knowledgeId);
    setOpenGroupDropdownId(null);
  };

  const handleConfirmGroupChange = () => {
    if (!pendingGroup || !pendingKnowledgeId || !groupConfirmAction) {
      setIsGroupConfirmOpen(false);
      return;
    }

    const updatedList = knowledgeList.map((k) => {
      if (k.id !== pendingKnowledgeId) return k;
      const exists = k.groups.find((g) => g.id === pendingGroup.id);

      if (groupConfirmAction === 'remove' && exists) {
        return { ...k, groups: k.groups.filter((g) => g.id !== pendingGroup.id) };
      }

      if (groupConfirmAction === 'add' && !exists) {
        return { ...k, groups: [...k.groups, pendingGroup] };
      }

      return k;
    });

    setKnowledgeList(updatedList);
    setIsGroupConfirmOpen(false);
    setPendingGroup(null);
    setPendingKnowledgeId(null);
    setGroupConfirmAction(null);
  };

  const handleCancelGroupChange = () => {
    setIsGroupConfirmOpen(false);
    setPendingGroup(null);
    setPendingKnowledgeId(null);
    setGroupConfirmAction(null);
  };

  const handleDeleteClick = (e, knowledgeId) => {
    e.stopPropagation();
    setKnowledgeToDelete(knowledgeId);
    setIsDeleteConfirmOpen(true);
    setOpenMenuId(null);
  };

  const handleConfirmDelete = () => {
    if (knowledgeToDelete) {
      setKnowledgeList(knowledgeList.filter(k => k.id !== knowledgeToDelete));
    }
    setIsDeleteConfirmOpen(false);
    setKnowledgeToDelete(null);
  };

  const handleCancelDelete = () => {
    setIsDeleteConfirmOpen(false);
    setKnowledgeToDelete(null);
  };

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      let isClickedInside = false;
      
      Object.values(menuRefs.current).forEach(ref => {
        if (ref && ref.contains(event.target)) {
          isClickedInside = true;
        }
      });

      Object.values(dropdownRefs.current).forEach(ref => {
        if (ref && ref.contains(event.target)) {
          isClickedInside = true;
        }
      });

      if (!isClickedInside) {
        setOpenMenuId(null);
        setOpenGroupDropdownId(null);
      }
    };

    if (openMenuId || openGroupDropdownId) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [openMenuId, openGroupDropdownId]);

  return (
    <div className='flex h-screen bg-white relative'>
      {/* Sidebar Component */}
      <Sidebar onCollapseChange={setIsSidebarCollapsed} />

      {/* Main Content */}
      <main className={`flex-1 bg-white px-8 py-6 overflow-auto flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'pl-16' : ''}`}>
        {/* Create Button - Top Right */}
        <button
          onClick={() => navigate('/create-knowledge')}
          className='absolute top-6 right-6 flex items-center gap-2 px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-800 font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 z-10'
        >
          <span>Create Knowledge</span>
          <HiPlus className='text-lg' />
        </button>

        {/* Header */}
        <div className='mb-6'>
          <h1 className='text-3xl font-bold text-gray-800 mb-4'>Knowledge</h1>
          
          {/* Search Input */}
          <div className='relative max-w-md'>
            <HiSearch className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg' />
            <input
              type='text'
              placeholder='Search Knowledge'
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className='w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent text-gray-700 placeholder-gray-400'
            />
          </div>
        </div>

        {/* Knowledge List */}
        <div className='flex-1'>
          {knowledgeList.length > 0 ? (
            <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
              {knowledgeList.map((knowledge) => (
                <div
                  key={knowledge.id}
                  onClick={() => navigate(`/knowledge/${knowledge.id}/add-data`)}
                  className='bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow cursor-pointer hover:border-yellow-400 relative'
                >
                  {/* Menu Button */}
                  <div 
                    className='absolute top-4 right-4'
                    ref={(el) => menuRefs.current[knowledge.id] = el}
                  >
                    <button
                      type='button'
                      onClick={(e) => handleMenuToggle(e, knowledge.id)}
                      className='p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors'
                    >
                      <HiDotsHorizontal className='text-xl' />
                    </button>

                    {/* Dropdown Menu */}
                    {openMenuId === knowledge.id && (
                      <div className='absolute right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-48'>
                        {/* Edit Option */}
                        <button
                          type='button'
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(null);
                            navigate('/create-knowledge', { state: { knowledge } });
                          }}
                          className='w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-200 first:rounded-t-lg text-gray-700'
                        >
                          แก้ไข
                        </button>

                        {/* Delete Option */}
                        <button
                          type='button'
                          onClick={(e) => handleDeleteClick(e, knowledge.id)}
                          className='w-full text-left px-4 py-3 hover:bg-red-50 text-red-600 transition-colors last:rounded-b-lg'
                        >
                          ลบ Knowledge
                        </button>
                      </div>
                    )}
                  </div>

                  <h3 className='text-lg font-semibold text-gray-800 mb-2 pr-8'>{knowledge.name}</h3>
                  <p className='text-sm text-gray-600 mb-4'>{knowledge.description}</p>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/knowledge/${knowledge.id}/add-data`);
                    }}
                    className='inline-flex items-center gap-2 px-2 py-1 bg-yellow-400 hover:bg-yellow-500 text-gray-800 font-medium rounded-md shadow hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95 text-sm'
                  >
                    <span>Add Data</span>
                    <span>→</span>
                  </button>

                  {/* Groups Display */}
                  {knowledge.groups.length > 0 && (
                    <div className='mt-4 pt-4 border-t border-gray-200'>
                      <p className='text-xs font-medium text-gray-700 mb-2'>กลุ่มที่เป็นสมาชิก:</p>
                      <div className='flex flex-wrap gap-2'>
                        {knowledge.groups.map((group) => (
                          <span key={group.id} className='inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800'>
                            {group.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className='text-center py-16'>
              <p className='text-gray-500 text-lg mb-4'>No knowledge bases created yet</p>
              <p className='text-gray-400 text-sm mb-8'>Click "Create Knowledge" to get started</p>
              <button
                onClick={() => navigate('/create-knowledge')}
                className='px-6 py-3 bg-yellow-400 hover:bg-yellow-500 text-gray-800 font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95'
              >
                Create Your First Knowledge Base
              </button>
            </div>
          )}
        </div>

        {/* Group Confirm Modal */}
        {isGroupConfirmOpen && (
          <>
            <div className='fixed inset-0 bg-black bg-opacity-50 z-40' onClick={handleCancelGroupChange} />
            <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
              <div className='bg-white rounded-lg shadow-2xl w-full max-w-sm p-6'>
                <h3 className='text-lg font-semibold text-gray-800 mb-4'>
                  {groupConfirmAction === 'remove' ? 'ต้องการนำกลุ่มนี้ออกจาก Knowledge นี้หรือไม่?' : 'ต้องการเพิ่ม Knowledge นี้ลงกลุ่มความรู้นี้หรือไม่?'}
                </h3>
                <p className='text-sm text-gray-600 mb-6'>
                  {pendingGroup ? `กลุ่ม: ${pendingGroup.name}` : ''}
                </p>
                <div className='flex gap-3 justify-end'>
                  <button
                    type='button'
                    onClick={handleCancelGroupChange}
                    className='px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors'
                  >
                    Cancel
                  </button>
                  <button
                    type='button'
                    onClick={handleConfirmGroupChange}
                    className={`px-4 py-2 font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 ${groupConfirmAction === 'remove' ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-yellow-400 hover:bg-yellow-500 text-gray-800'}`}
                  >
                    {groupConfirmAction === 'remove' ? 'Remove' : 'Add'}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Delete Confirmation Modal */}
        {isDeleteConfirmOpen && (
          <>
            {/* Backdrop */}
            <div className='fixed inset-0 bg-black bg-opacity-50 z-40' onClick={handleCancelDelete} />
            
            {/* Confirmation Dialog */}
            <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
              <div className='bg-white rounded-lg shadow-2xl w-full max-w-sm p-6'>
                <h3 className='text-lg font-semibold text-gray-800 mb-4'>
                  ลบ Knowledge นี้หรือไม่?
                </h3>
                <p className='text-sm text-gray-600 mb-6'>
                  คุณแน่ใจหรือไม่ว่าต้องการลบ Knowledge นี้ การดำเนินการนี้ไม่สามารถเรียกคืนได้
                </p>
                <div className='flex gap-3 justify-end'>
                  <button
                    type='button'
                    onClick={handleCancelDelete}
                    className='px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors'
                  >
                    Cancel
                  </button>
                  <button
                    type='button'
                    onClick={handleConfirmDelete}
                    className='px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200'
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

export default Knowledge;
