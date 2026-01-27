import React from 'react';

interface BotAvatarModalProps {
  isOpen: boolean;
  avatarSourceType: 'url' | 'file';
  avatarUrlInput: string;
  onChangeSourceType: (value: 'url' | 'file') => void;
  onChangeUrlInput: (value: string) => void;
  onPickFile: (file: File) => void;
  onApplyUrl: (url: string | null) => void;
  onClose: () => void;
}

const BotAvatarModal: React.FC<BotAvatarModalProps> = ({
  isOpen,
  avatarSourceType,
  avatarUrlInput,
  onChangeSourceType,
  onChangeUrlInput,
  onPickFile,
  onApplyUrl,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-xl w-full max-w-md border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">โปรไฟล์บอท</h3>
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => onChangeSourceType('url')}
            className={`px-3 py-1.5 rounded-md text-sm ${
              avatarSourceType === 'url'
                ? 'bg-yellow-400 text-slate-900'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            URL
          </button>
          <button
            onClick={() => onChangeSourceType('file')}
            className={`px-3 py-1.5 rounded-md text-sm ${
              avatarSourceType === 'file'
                ? 'bg-yellow-400 text-slate-900'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            Upload File
          </button>
        </div>
        {avatarSourceType === 'url' ? (
          <div className="space-y-2">
            <input
              value={avatarUrlInput}
              onChange={(e) => onChangeUrlInput(e.target.value)}
              placeholder="https://example.com/avatar.png"
              className="w-full border border-slate-200 rounded-lg py-2 px-3 text-slate-700 focus:outline-none focus:ring-2 focus:ring-yellow-400"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  onPickFile(file);
                }
              }}
            />
          </div>
        )}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-slate-200 text-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onApplyUrl(avatarUrlInput.trim() || null);
              onClose();
            }}
            className="px-4 py-2 rounded-md bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-semibold"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
};

export default BotAvatarModal;
