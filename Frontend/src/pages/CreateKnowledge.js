import { useLocation, useNavigate } from 'react-router-dom';
import { HiArrowLeft, HiPlus, HiX } from 'react-icons/hi';
import Sidebar from '../components/Sidebar';
import { useCallback, useState } from 'react';
import { documentsAPI, getErrorMessage, uploadAPI } from '../services/api';

function CreateKnowledge() {
  const navigate = useNavigate();
  const location = useLocation();
  const editingKnowledge = location?.state?.knowledge || null;
  const isEditing = Boolean(editingKnowledge?.id);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [knowledgeName, setKnowledgeName] = useState(editingKnowledge?.name || '');
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');

  const handleAddFiles = (incoming) => {
    const next = Array.from(incoming || []);
    if (!next.length) return;
    setFiles((prev) => [...prev, ...next]);
  };

  const removeFile = (idx) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const uploadKnowledge = useCallback(async () => {
    if (!knowledgeName.trim()) {
      setError('กรุณากรอกชื่อ Knowledge');
      return;
    }
    if (isEditing) {
      setError('');
      setIsUploading(true);
      try {
        await documentsAPI.update(editingKnowledge.id, { displayName: knowledgeName.trim() });
        navigate('/knowledge');
      } catch (err) {
        console.error('Rename knowledge failed', err);
        setError(getErrorMessage(err));
      } finally {
        setIsUploading(false);
      }
      return;
    }
    if (!files.length) {
      setError('กรุณาเลือกไฟล์อย่างน้อย 1 ไฟล์');
      return;
    }
    setError('');
    setIsUploading(true);
    setProgress({ current: 0, total: 1, message: 'Preparing...' });

    const UPLOAD_PART_SIZE = 20 * 1024 * 1024;

    try {
      const batch = await uploadAPI.createBatch(knowledgeName.trim());

      const totalParts = files.reduce((sum, f) => sum + Math.max(1, Math.ceil(f.size / UPLOAD_PART_SIZE)), 0);
      let uploadedParts = 0;
      setProgress({ current: 0, total: totalParts, message: 'Uploading files...' });

      for (const file of files) {
        const totalFileParts = Math.max(1, Math.ceil(file.size / UPLOAD_PART_SIZE));
        const session = await uploadAPI.createFileSession(batch.id, {
          name: file.name,
          size: file.size,
          type: file.type,
          totalParts: totalFileParts,
        });

        for (let partIndex = 0; partIndex < totalFileParts; partIndex += 1) {
          const start = partIndex * UPLOAD_PART_SIZE;
          const end = Math.min(start + UPLOAD_PART_SIZE, file.size);
          const part = file.slice(start, end);
          await uploadAPI.uploadPart(session.uploadId, partIndex + 1, part);
          uploadedParts += 1;
          setProgress({
            current: uploadedParts,
            total: totalParts,
            message: `Uploading ${file.name} (${partIndex + 1}/${totalFileParts})`,
          });
        }

        await uploadAPI.completeFile(session.uploadId);
      }

      await uploadAPI.completeBatch(batch.id);

      // Poll until processing done
      await new Promise((resolve, reject) => {
        const intervalId = setInterval(async () => {
          try {
            const status = await uploadAPI.getBatchStatus(batch.id);
            if (status.progress) {
              setProgress({
                current: status.progress.current ?? 0,
                total: status.progress.total ?? 1,
                message: status.progress.message ?? 'Processing...',
              });
            }
            if (status.status === 'done') {
              clearInterval(intervalId);
              resolve();
            } else if (status.status === 'error') {
              clearInterval(intervalId);
              reject(new Error(status.error || 'Upload failed'));
            }
          } catch (pollErr) {
            clearInterval(intervalId);
            reject(pollErr);
          }
        }, 1500);
      });

      navigate('/knowledge');
    } catch (err) {
      console.error('Upload failed', err);
      setError(getErrorMessage(err));
    } finally {
      setIsUploading(false);
      setProgress(null);
    }
  }, [editingKnowledge?.id, files, getErrorMessage, isEditing, knowledgeName, navigate]);

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

        <div className='flex-1 max-w-4xl'>
          {/* Header */}
          <div className='mb-8'>
            <h1 className='text-3xl font-bold text-gray-800 mb-2'>{isEditing ? 'Edit Knowledge' : 'Create Knowledge'}</h1>
            <p className="text-gray-600">
              {isEditing ? 'แก้ไขชื่อ Knowledge' : 'อัปโหลดไฟล์เพื่อสร้าง Knowledge และเริ่มแชทได้ทันที'}
            </p>
          </div>

          {error && (
            <div className="mb-6 rounded-lg border border-red-200 bg-red-50 text-red-700 text-sm px-3 py-2">
              {error}
            </div>
          )}

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

          {!isEditing && (
            <div className="mb-8">
              <label className='block text-sm font-medium text-gray-700 mb-3'>
                Files
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  multiple
                  onChange={(e) => handleAddFiles(e.target.files)}
                />
                <button
                  type="button"
                  onClick={() => document.querySelector('input[type="file"]')?.click()}
                  className="px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium"
                >
                  <HiPlus className="inline-block mr-2" />
                  Add files
                </button>
              </div>
              {files.length > 0 && (
                <div className="mt-4 space-y-2">
                  {files.map((f, idx) => (
                    <div key={`${f.name}-${idx}`} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-800 truncate">{f.name}</div>
                        <div className="text-xs text-gray-500">{Math.round((f.size / (1024 * 1024)) * 100) / 100} MB</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeFile(idx)}
                        className="p-1 text-red-600 hover:text-red-700"
                        title="Remove"
                      >
                        <HiX className="text-lg" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {progress && (
            <div className="mb-6 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
              <div className="font-medium">{progress.message}</div>
              <div className="text-xs text-gray-500 mt-1">
                {progress.current} / {progress.total}
              </div>
            </div>
          )}

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
              type='button'
              onClick={uploadKnowledge}
              disabled={isUploading}
              className={`px-6 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-800 font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200 hover:scale-105 active:scale-95 ${isUploading ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {isUploading ? (isEditing ? 'Saving…' : 'Uploading…') : (isEditing ? 'Save' : 'Upload')}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default CreateKnowledge;
