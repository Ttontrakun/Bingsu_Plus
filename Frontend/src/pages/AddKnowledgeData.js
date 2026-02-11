import { useNavigate, useParams } from 'react-router-dom';
import { HiArrowLeft } from 'react-icons/hi';
import Sidebar from '../components/Sidebar';
import { useEffect, useState } from 'react';
import { documentsAPI, getErrorMessage } from '../services/api';

function AddKnowledgeData() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [doc, setDoc] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setError('');
      try {
        const data = await documentsAPI.get(id);
        setDoc(data);
      } catch (err) {
        console.error('Failed to load document', err);
        setError(getErrorMessage(err));
        setDoc(null);
      }
    };
    if (id) load();
  }, [id]);

  return (
    <div className='flex h-screen bg-white relative'>
      <Sidebar onCollapseChange={setIsSidebarCollapsed} />

      <main className={`flex-1 bg-white px-8 py-6 overflow-auto flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'pl-16' : ''}`}>
        <button
          onClick={() => navigate('/knowledge')}
          className='flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors mb-6 self-start'
        >
          <HiArrowLeft className='text-lg' />
          <span>Back</span>
        </button>

        <div className='flex-1 max-w-4xl'>
          <h1 className='text-3xl font-bold text-gray-800 mb-2'>Knowledge details</h1>
          <p className='text-gray-600 mb-6'>
            ตอนนี้ระบบยังไม่รองรับการ “เพิ่มไฟล์เข้า Knowledge เดิม” แบบ append (ต้อง re-index และจัดการไฟล์เดิม/ใหม่)
          </p>

          {error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">
              {error}
            </div>
          )}

          <div className='bg-white border border-gray-200 rounded-lg p-6 shadow-sm'>
            <div className='mb-4'>
              <div className='text-sm text-gray-500'>Knowledge ID</div>
              <div className='font-mono text-sm text-gray-800 break-all'>{id}</div>
            </div>

            {doc && (
              <>
                <div className='mb-4'>
                  <div className='text-sm text-gray-500'>Name</div>
                  <div className='text-lg font-semibold text-gray-800'>{doc.displayName}</div>
                </div>

                <div className='mb-6'>
                  <div className='text-sm text-gray-500 mb-2'>Files</div>
                  {Array.isArray(doc.sourceFiles) && doc.sourceFiles.length > 0 ? (
                    <div className='space-y-2'>
                      {doc.sourceFiles.map((f, idx) => (
                        <div key={`${f.name}-${idx}`} className='flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2'>
                          <div className='min-w-0'>
                            <div className='text-sm font-medium text-gray-800 truncate'>{f.name}</div>
                            <div className='text-xs text-gray-500'>
                              {f.type || 'unknown'}
                              {f.size ? ` • ${Math.round((f.size / (1024 * 1024)) * 100) / 100} MB` : ''}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className='text-sm text-gray-500'>No files</div>
                  )}
                </div>
              </>
            )}

            <div className='flex gap-3 pt-4 border-t border-gray-200'>
              <button
                type='button'
                onClick={() => navigate('/create-knowledge')}
                className='px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-800 font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95'
              >
                Upload new knowledge
              </button>
              <button
                type='button'
                onClick={() => navigate('/knowledge')}
                className='px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors'
              >
                Back to list
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default AddKnowledgeData;

