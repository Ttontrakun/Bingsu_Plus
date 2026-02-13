import { useState, useEffect } from 'react';
import { HiX, HiOutlineUser, HiTrash, HiOutlineMail } from 'react-icons/hi';
import bingsuLogo from '../assets/images/หน่องบิงไม่มีพื้นละ.png';
import ChangePasswordModal from './ChangePasswordModal';
import { userAPI, getErrorMessage, getAvatarUrl, setAvatarVersion } from '../services/api';

function AccountModal({ isOpen, onClose }) {
  const [isEditMode, setIsEditMode] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [profileImage, setProfileImage] = useState(bingsuLogo);
  const [avatarUrlInput, setAvatarUrlInput] = useState('');
  const [pendingAvatarFile, setPendingAvatarFile] = useState(null);
  const [originalData, setOriginalData] = useState({ name: '', email: '', profileImage: bingsuLogo });
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // โหลดข้อมูล user จาก API เมื่อเปิด modal
  useEffect(() => {
    if (isOpen) {
      loadUserData();
      setIsEditMode(false);
    }
  }, [isOpen]);

  const loadUserData = async () => {
    setIsLoading(true);
    setError('');
    setPendingAvatarFile(null);
    setAvatarUrlInput('');
    try {
      const data = await userAPI.getCurrentUser();
      const user = data.user || data;
      const avatarUrl = user.avatarUrl ? getAvatarUrl(user.avatarUrl) : null;
      const profileImageSrc = avatarUrl || bingsuLogo;

      const userData = {
        name: user.name || '',
        email: user.email || '',
        profileImage: profileImageSrc,
      };
      
      setName(userData.name);
      setEmail(userData.email);
      setProfileImage(profileImageSrc);
      setOriginalData(userData);

      try {
        const userDataForStorage = {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          avatarUrl: user.avatarUrl || null,
        };
        localStorage.setItem('user', JSON.stringify(userDataForStorage));
      } catch (storageError) {
        console.error('Error updating localStorage:', storageError);
      }
    } catch (err) {
      console.error('Error loading user data:', err);
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const user = JSON.parse(storedUser);
          const profileImageSrc = user.avatarUrl ? getAvatarUrl(user.avatarUrl) : bingsuLogo;
          const userData = {
            name: user.fullName || user.name || '',
            email: user.email || '',
            profileImage: profileImageSrc,
          };
          setName(userData.name);
          setEmail(userData.email);
          setProfileImage(profileImageSrc);
          setOriginalData(userData);
          setError('');
        } catch (parseError) {
          console.error('Error parsing stored user data:', parseError);
          setError(getErrorMessage(err) || 'ไม่สามารถโหลดข้อมูลผู้ใช้ได้');
        }
      } else {
        setError(getErrorMessage(err) || 'ไม่สามารถโหลดข้อมูลผู้ใช้ได้');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPendingAvatarFile(file);
      setAvatarUrlInput('');
      const reader = new FileReader();
      reader.onloadend = () => setProfileImage(reader.result);
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarUrlChange = (e) => {
    const url = e.target.value.trim();
    setAvatarUrlInput(url);
    if (url) {
      setPendingAvatarFile(null);
      setProfileImage(url);
    } else {
      setProfileImage(originalData.profileImage);
    }
  };

  const handleEditProfile = () => {
    setIsEditMode(true);
  };

  const handleCancel = () => {
    setName(originalData.name);
    setEmail(originalData.email);
    setProfileImage(originalData.profileImage);
    setPendingAvatarFile(null);
    setAvatarUrlInput('');
    setIsEditMode(false);
    setError('');
    setSuccess('');
  };

  const handleSave = async () => {
    setError('');
    setSuccess('');
    setIsSaving(true);
    try {
      const payload = {};
      const trimmedName = name.trim();
      if (trimmedName) payload.name = trimmedName;
      if (pendingAvatarFile) {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(pendingAvatarFile);
        });
        if (dataUrl && typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
          payload.avatarBase64 = dataUrl;
        }
      } else if (avatarUrlInput.trim()) {
        payload.avatarUrl = avatarUrlInput.trim();
      }
      if (Object.keys(payload).length === 0) {
        setSuccess('ไม่มีการเปลี่ยนแปลง');
        setIsSaving(false);
        return;
      }
      const data = await userAPI.updateProfile(payload);
      const user = data.user || data;
      if (payload.avatarBase64 || payload.avatarUrl) setAvatarVersion();
      const avatarUrl = user.avatarUrl ? getAvatarUrl(user.avatarUrl) : null;
      setProfileImage(avatarUrl || bingsuLogo);
      setOriginalData({ ...originalData, name: user.name || name, profileImage: avatarUrl || bingsuLogo });
      const forStorage = JSON.parse(localStorage.getItem('user') || '{}');
      forStorage.name = user.name;
      forStorage.avatarUrl = user.avatarUrl || null;
      localStorage.setItem('user', JSON.stringify(forStorage));
      setSuccess('บันทึกการเปลี่ยนแปลงแล้ว');
      setPendingAvatarFile(null);
      setAvatarUrlInput('');
      setIsEditMode(false);
    } catch (err) {
      setError(getErrorMessage(err) || 'บันทึกไม่สำเร็จ');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4' onClick={onClose}>
      <div 
        className='bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto'
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className='flex items-center justify-between p-6 border-b border-gray-200'>
          <h2 className='text-2xl font-bold text-gray-800'>ตั้งค่าบัญชี</h2>
          <button
            onClick={onClose}
            className='text-gray-400 hover:text-gray-600 transition-colors'
          >
            <HiX className='text-2xl' />
          </button>
        </div>

        {/* Content */}
        <div className='p-6'>
          {error && (
            <div className='mb-4 p-3 bg-red-50 border border-red-200 rounded-lg'>
              <p className='text-sm text-red-600'>{error}</p>
            </div>
          )}
          {success && (
            <div className='mb-4 p-3 bg-green-50 border border-green-200 rounded-lg'>
              <p className='text-sm text-green-600'>{success}</p>
            </div>
          )}
          {isLoading ? (
            <div className='flex items-center justify-center py-12'>
              <p className='text-gray-500'>กำลังโหลดข้อมูล...</p>
            </div>
          ) : (
          <div className='flex gap-6'>
            {/* Left Sidebar */}
            <aside className='w-64 bg-gray-50 rounded-lg p-6 flex-shrink-0'>
              <div className='flex items-center gap-3'>
                <div className='w-10 h-10 bg-white rounded-full flex items-center justify-center flex-shrink-0 shadow-sm'>
                  <HiOutlineUser className='text-gray-600 text-xl' />
                </div>
                <span className='text-gray-800 font-semibold'>บัญชี</span>
              </div>
            </aside>

            {/* Right Content Area */}
            <div className='flex-1 bg-white border border-gray-200 rounded-lg p-8'>
              {/* Profile Section */}
              <div className='mb-8 pb-8 border-b border-gray-200'>
                <div className='flex items-center gap-6'>
                  <div className='w-28 h-28 bg-gray-100 rounded-full flex items-center justify-center overflow-hidden flex-shrink-0 shadow-lg ring-2 ring-gray-200'>
                    <img 
                      src={profileImage} 
                      alt="Profile" 
                      className='w-full h-full object-cover'
                    />
                  </div>
                  <div className='flex-1'>
                    <h3 className='text-lg font-semibold text-gray-800 mb-3'>รูปโปรไฟล์</h3>
                    {isEditMode ? (
                      <>
                        <div className='flex flex-wrap items-center gap-2'>
                          <label className='inline-block'>
                            <input
                              type='file'
                              accept='image/*'
                              onChange={handleImageChange}
                              className='hidden'
                              id='profile-upload'
                            />
                            <span className='px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium rounded-lg cursor-pointer transition-all inline-block shadow-sm hover:shadow-md active:scale-95'>
                              เลือกไฟล์
                            </span>
                          </label>
                          <span className='text-gray-400'>หรือ</span>
                          <input
                            type='url'
                            value={avatarUrlInput}
                            onChange={handleAvatarUrlChange}
                            placeholder='วาง URL รูปภาพ'
                            className='flex-1 min-w-[200px] max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-yellow-400'
                          />
                        </div>
                        <p className='text-xs text-gray-500 mt-2'>รองรับไฟล์ JPG, PNG, GIF หรือ URL รูปภาพ</p>
                      </>
                    ) : (
                      <button
                        type='button'
                        onClick={handleEditProfile}
                        className='px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-800 text-sm font-medium rounded-lg cursor-pointer transition-all inline-block shadow-sm hover:shadow-md active:scale-95'
                      >
                        แก้ไขโปรไฟล์
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Form Fields */}
              <div className='space-y-6 mb-8'>
                {/* Name Display/Input */}
                <div>
                <label htmlFor='name' className='block text-sm font-medium text-gray-700 mb-2'>
                    ชื่อ
                </label>
                  {isEditMode ? (
                <input
                  id='name'
                  type='text'
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                      placeholder='กรุณากรอกชื่อ'
                      className='w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent text-gray-700 placeholder-gray-400 transition-all hover:border-gray-400'
                />
                  ) : (
                    <div className='w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700'>
                      {name || 'ไม่ระบุชื่อ'}
                    </div>
                  )}
                </div>

                {/* Email Display - Read Only - แสดงเฉพาะเมื่อไม่ใช่ edit mode */}
                {!isEditMode && (
                  <div>
                    <label htmlFor='email' className='block text-sm font-medium text-gray-700 mb-2'>
                      อีเมล
                    </label>
                    <div className='relative'>
                      <HiOutlineMail className='absolute left-3 top-1/2 -translate-y-1/2 text-gray-400' />
                      <div className='w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700'>
                        {email || 'ไม่ระบุอีเมล'}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Account Actions */}
              <div className='space-y-4 pt-6 border-t border-gray-200'>
                {/* Change Password - แสดงเฉพาะเมื่ออยู่ใน edit mode */}
                {isEditMode && (
                <button
                  type='button'
                  onClick={() => setIsChangePasswordModalOpen(true)}
                    className='w-full text-left px-4 py-3 text-gray-800 hover:bg-gray-50 hover:text-gray-900 font-medium transition-colors rounded-lg border border-gray-200 hover:border-gray-300'
                >
                    เปลี่ยนรหัสผ่าน
                </button>
                )}

                {/* Delete Account - แสดงเฉพาะเมื่อไม่ใช่ edit mode */}
                {!isEditMode && (
                  <div className='flex items-center gap-2 px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg border border-red-200 hover:border-red-300 transition-colors cursor-pointer'>
                  <HiTrash className='text-red-600 text-lg' />
                  <button
                      type='button'
                    className='text-red-600 hover:text-red-700 font-medium transition-colors'
                  >
                      ลบบัญชี
                  </button>
                </div>
                )}
              </div>

              {/* Save/Cancel Buttons - แสดงเฉพาะเมื่ออยู่ใน edit mode */}
              {isEditMode && (
                <div className='mt-8 pt-6 border-t border-gray-200'>
                  <div className='flex justify-end gap-4'>
                    <button
                      type='button'
                      onClick={handleCancel}
                      className='px-6 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 font-medium transition-colors'
                    >
                      ยกเลิก
                    </button>
                    <button
                      type='button'
                      onClick={handleSave}
                      disabled={isSaving}
                      className={`px-6 py-2.5 bg-yellow-400 hover:bg-yellow-500 text-gray-800 font-semibold rounded-lg transition-colors shadow-sm hover:shadow-md ${
                        isSaving ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    >
                      {isSaving ? 'กำลังบันทึก...' : 'บันทึกการเปลี่ยนแปลง'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
          )}
        </div>

        {/* Change Password Modal */}
        <ChangePasswordModal
          isOpen={isChangePasswordModalOpen}
          onClose={() => setIsChangePasswordModalOpen(false)}
        />
      </div>
    </div>
  );
}

export default AccountModal;
