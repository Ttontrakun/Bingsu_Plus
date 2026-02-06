import { useNavigate, useParams } from 'react-router-dom';
import { HiArrowLeft, HiPlus, HiX, HiOutlinePencil } from 'react-icons/hi';
import Sidebar from '../components/Sidebar';
import Dropdown from '../components/Dropdown';
import { useState, useEffect } from 'react';
import { showToast } from '../components/ToastNotification';

function AddKnowledgeData() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [dataContent, setDataContent] = useState('');
  const [dataType, setDataType] = useState('text');
  const [textFileName, setTextFileName] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingFile, setEditingFile] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [fileError, setFileError] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const dataTypeOptions = [
    { value: 'text', label: 'Text' },
    { value: 'file', label: 'File' },
  ];

  // ตรวจสอบไฟล์ก่อนเพิ่ม
  const validateFile = (file) => {
    const maxSize = 5 * 1024 * 1024; // 5 MB in bytes
    
    if (!file) {
      return { valid: false, message: 'กรุณาเลือกไฟล์' };
    }

    if (file.size > maxSize) {
      return { 
        valid: false, 
        message: `ขนาดไฟล์เกิน 5 MB (ขนาดไฟล์: ${(file.size / 1024 / 1024).toFixed(2)} MB)` 
      };
    }

    return { valid: true, message: '' };
  };

  const handleFileAdd = (file) => {
    // ตรวจสอบว่าเป็น File object หรือไม่
    if (file instanceof File) {
      const validation = validateFile(file);
      if (!validation.valid) {
        setFileError(validation.message);
        return;
      }
    }

    setFileError(''); // Clear error if valid
    const fileSize = file instanceof File ? file.size : null;
    const fileSizeMB = fileSize ? (fileSize / 1024 / 1024).toFixed(2) : null;
    
    const newFile = { 
      id: Date.now(), 
      name: file.name || file, 
      type: dataType,
      content: dataContent || '', // เก็บเนื้อหาสำหรับไฟล์ text
      size: fileSize, // เก็บขนาดไฟล์
      sizeMB: fileSizeMB // เก็บขนาดไฟล์เป็น MB
    };
    setUploadedFiles([...uploadedFiles, newFile]);
    setDataContent('');
  };

  const handleDeleteClick = (fileId) => {
    setFileToDelete(fileId);
    setIsDeleteConfirmOpen(true);
  };

  const handleConfirmDelete = () => {
    if (fileToDelete) {
      setUploadedFiles(uploadedFiles.filter(f => f.id !== fileToDelete));
    }
    setIsDeleteConfirmOpen(false);
    setFileToDelete(null);
  };

  const handleCancelDelete = () => {
    setIsDeleteConfirmOpen(false);
    setFileToDelete(null);
  };

  const handleEditFile = (file) => {
    setEditingFile(file);
    setEditContent(file.content || '');
    setIsEditModalOpen(true);
  };

  const handleSaveEdit = () => {
    setUploadedFiles(uploadedFiles.map(f => 
      f.id === editingFile.id ? { ...f, content: editContent } : f
    ));
    setIsEditModalOpen(false);
    setEditingFile(null);
    setEditContent('');
  };

  const handleCancelEdit = () => {
    setIsEditModalOpen(false);
    setEditingFile(null);
    setEditContent('');
  };

  const addMockFiles = () => {
    const mockFiles = [
      { id: Date.now(), name: 'document_sample.pdf', type: 'file' },
      { id: Date.now() + 1, name: 'Sample text content.txt', type: 'text' },
      { id: Date.now() + 2, name: 'image_preview.jpg', type: 'file' },
    ];
    setUploadedFiles([...uploadedFiles, ...mockFiles]);
  };

  useEffect(() => {
    // Optional: Add mock files on component mount for demo
    // Uncomment the line below if you want mock files to appear by default
    // addMockFiles();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    // Handle adding data to knowledge logic here
    // After adding, navigate back to knowledge page
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
          <span>Back to Knowledge</span>
        </button>

        <form onSubmit={handleSubmit} className='flex-1 max-w-6xl'>
          {/* Header */}
          <div className='mb-8'>
            <h1 className='text-3xl font-bold text-gray-800 mb-2'>Add Data to Knowledge</h1>
            <p className='text-gray-600'>Knowledge ID: {id}</p>
          </div>

          {/* Data Type and Content Section */}
          <div className='mb-8'>
            <div className='flex gap-6'>
              <div className='flex-1'>
                <label className='block text-sm font-medium text-gray-700 mb-3'>
                  ประเภทข้อมูล (Data Type)
                </label>
                <Dropdown
                  options={dataTypeOptions}
                  selectedValue={dataType}
                  onSelect={(value) => {
                    setDataType(value);
                    setFileError(''); // Clear error when changing data type
                  }}
                  placeholder="Select Data Type"
                />
                
                {/* Text File Name Input - shown only when text type is selected */}
                {dataType === 'text' && (
                  <div className='mt-4'>
                    <label htmlFor='text-file-name' className='block text-sm font-medium text-gray-700 mb-2'>
                      ชื่อไฟล์ (File Name)
                    </label>
                    <input
                      type='text'
                      id='text-file-name'
                      value={textFileName}
                      onChange={(e) => setTextFileName(e.target.value)}
                      placeholder='ตั้งชื่อไฟล์สำหรับข้อความที่นี่...'
                      className='w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent text-gray-700 placeholder-gray-400'
                    />
                  </div>
                )}

                {/* Data Content */}
                <div className='mt-4'>
                  <label htmlFor='data-content' className='block text-sm font-medium text-gray-700 mb-3'>
                    เนื้อหาข้อมูล (Data Content)
                  </label>
                  {dataType === 'text' ? (
                    <>
                      <textarea
                        id='data-content'
                        value={dataContent}
                        onChange={(e) => setDataContent(e.target.value)}
                        placeholder='เพิ่มเนื้อหาข้อมูลที่นี่...'
                        rows={10}
                        required
                        className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all resize-none text-gray-700 placeholder-gray-400'
                      />
                      {/* Upload Button for Text Type */}
                      <div className='flex justify-end mt-2'>
                        <button
                          type='button'
                          onClick={() => {
                            if (dataContent.trim() && textFileName.trim()) {
                              handleFileAdd({ name: textFileName + '.txt' });
                              setDataContent('');
                              setTextFileName('');
                            } else {
                              showToast('กรุณากรอกชื่อไฟล์และเนื้อหาข้อมูลก่อนอัปโหลด', 'warning');
                            }
                          }}
                          className='px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-800 font-medium rounded-lg shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105 active:scale-95'
                        >
                          Upload
                        </button>
                      </div>
                    </>
                  ) : dataType === 'file' ? (
                    <div>
                      <div 
                        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                          isDragging 
                            ? 'border-yellow-400 bg-yellow-50' 
                            : 'border-gray-300 hover:border-yellow-400'
                        }`}
                        onDragEnter={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsDragging(true);
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsDragging(false);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsDragging(false);
                          
                          const files = e.dataTransfer.files;
                          if (files.length > 1) {
                            setFileError('กรุณาอัปโหลดไฟล์ครั้งละ 1 ไฟล์เท่านั้น');
                            return;
                          }
                          
                          if (files.length === 1) {
                            handleFileAdd(files[0]);
                          }
                        }}
                      >
                      <input
                        type='file'
                        onChange={(e) => {
                            const files = e.target.files;
                            if (files.length > 1) {
                              setFileError('กรุณาอัปโหลดไฟล์ครั้งละ 1 ไฟล์เท่านั้น');
                              e.target.value = '';
                              return;
                            }
                            
                            if (files.length === 1) {
                              handleFileAdd(files[0]);
                            // Reset the input
                            e.target.value = '';
                          }
                        }}
                        className='hidden'
                        id='file-upload'
                          accept='*/*'
                      />
                      <label
                        htmlFor='file-upload'
                        className='cursor-pointer flex flex-col items-center gap-2'
                      >
                        <HiPlus className='text-3xl text-gray-400' />
                        <span className='text-gray-600'>Click to upload file</span>
                        <span className='text-sm text-gray-400'>or drag and drop</span>
                        <span className='text-xs text-red-500 font-semibold mt-2'>**แนบไฟล์ได้ครั้งละ 1 ไฟล์ และขนาดไม่เกิน 5 MB**</span>
                      </label>
                      </div>
                      {fileError && (
                        <div className='mt-2 p-2 bg-red-50 border border-red-200 rounded-lg'>
                          <p className='text-xs text-red-600'>{fileError}</p>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
              
              {/* Right Column - Uploaded Files */}
              <div className='w-80 self-start' style={{ marginTop: '71px' }}>
                <div className='flex items-center justify-between gap-2 mb-3'>
                  <label className='block text-sm font-medium text-gray-700'>
                    ไฟล์ที่อัปโหลด ({uploadedFiles.length})
                  </label>
                  <button
                    type='button'
                    onClick={addMockFiles}
                    className='text-xs px-2 py-1 text-gray-600 hover:text-gray-800 border border-gray-300 rounded hover:bg-gray-50 transition-colors'
                    title='Add mock files for demo'
                  >
                    Mock
                  </button>
                </div>
                <div className='space-y-2 h-[352px] overflow-y-auto bg-gray-50 rounded-lg p-4 border border-gray-200'>
                  {uploadedFiles.length > 0 ? (
                    uploadedFiles.map((file) => {
                      const isTxtFile = file.name.toLowerCase().endsWith('.txt');
                      return (
                        <div
                          key={file.id}
                          className='flex items-center justify-between gap-2 p-3 bg-white rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors'
                        >
                          <div className='flex-1 min-w-0'>
                            <p className='text-sm font-medium text-gray-800 truncate' title={file.name}>
                              {file.name}
                            </p>
                            <div className='flex items-center gap-2'>
                            <p className='text-xs text-gray-500'>{file.type}</p>
                              {file.sizeMB && (
                                <span className='text-xs text-gray-400'>
                                  ({file.sizeMB} MB)
                                </span>
                              )}
                            </div>
                          </div>
                          <div className='flex items-center gap-1'>
                            {isTxtFile && (
                              <button
                                type='button'
                                onClick={() => handleEditFile(file)}
                                className='flex-shrink-0 p-1 text-gray-500 hover:text-gray-700 transition-colors'
                                title='Edit'
                              >
                                <HiOutlinePencil className='text-lg' />
                              </button>
                            )}
                            <button
                              type='button'
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(file.id);
                              }}
                              className='flex-shrink-0 p-1 text-red-600 hover:text-red-700 transition-colors'
                              title='Delete'
                            >
                              <HiX className='text-lg' />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className='text-center py-8 text-gray-400'>
                      <p className='text-sm'>ยังไม่มีไฟล์ที่อัปโหลด</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
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

        {/* Delete Confirmation Modal */}
        {isDeleteConfirmOpen && (
          <>
            {/* Backdrop */}
            <div className='fixed inset-0 bg-black bg-opacity-50 z-40' onClick={handleCancelDelete} />
            
            {/* Confirmation Dialog */}
            <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
              <div className='bg-white rounded-lg shadow-2xl w-full max-w-sm p-6'>
                <h3 className='text-lg font-semibold text-gray-800 mb-4'>
                  ลบไฟล์นี้หรือไม่?
                </h3>
                <p className='text-sm text-gray-600 mb-6'>
                  คุณแน่ใจหรือไม่ว่าต้องการลบไฟล์นี้ การดำเนินการนี้ไม่สามารถเรียกคืนได้
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

        {/* Edit File Modal */}
        {isEditModalOpen && editingFile && (
          <>
            {/* Backdrop */}
            <div className='fixed inset-0 bg-black bg-opacity-50 z-40' onClick={handleCancelEdit} />
            
            {/* Edit Dialog */}
            <div className='fixed inset-0 z-50 flex items-center justify-center p-4'>
              <div className='bg-white rounded-lg shadow-2xl w-full max-w-2xl' onClick={(e) => e.stopPropagation()}>
                <div className='px-6 py-4 border-b border-gray-200'>
                  <h3 className='text-lg font-semibold text-gray-800'>
                    แก้ไขไฟล์: {editingFile.name}
                  </h3>
                </div>
                <div className='p-6'>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder='แก้ไขเนื้อหาไฟล์ที่นี่...'
                    rows={15}
                    className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent transition-all resize-none text-gray-700 placeholder-gray-400'
                  />
                </div>
                <div className='px-6 py-4 border-t border-gray-200 flex gap-3 justify-end'>
                  <button
                    type='button'
                    onClick={handleCancelEdit}
                    className='px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors'
                  >
                    Cancel
                  </button>
                  <button
                    type='button'
                    onClick={handleSaveEdit}
                    className='px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-gray-800 font-semibold rounded-lg shadow-md hover:shadow-lg transition-all duration-200'
                  >
                    Save
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

export default AddKnowledgeData;
