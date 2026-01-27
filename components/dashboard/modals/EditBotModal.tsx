import React from 'react';
import { Document } from '../../../types';

interface EditBotModalProps {
  isOpen: boolean;
  botModelOptions: string[];
  editBotName: string;
  editBotModel: string;
  editBotDescription: string;
  editBotPrompt: string;
  editBotDocIds: string[];
  documents: Document[];
  editBotError: string | null;
  isSavingBot: boolean;
  onChangeName: (value: string) => void;
  onChangeModel: (value: string) => void;
  onChangeDescription: (value: string) => void;
  onChangePrompt: (value: string) => void;
  onToggleDoc: (docId: string) => void;
  onOpenAvatarPopup: () => void;
  onClose: () => void;
  onSave: () => void;
}

const EditBotModal: React.FC<EditBotModalProps> = ({
  isOpen,
  botModelOptions,
  editBotName,
  editBotModel,
  editBotDescription,
  editBotPrompt,
  editBotDocIds,
  documents,
  editBotError,
  isSavingBot,
  onChangeName,
  onChangeModel,
  onChangeDescription,
  onChangePrompt,
  onToggleDoc,
  onOpenAvatarPopup,
  onClose,
  onSave,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gem-slate p-6 rounded-xl w-full max-w-lg border border-gem-mist/40">
        <h3 className="text-xl font-semibold mb-4">Edit bot</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gem-offwhite/70 mb-1">Bot name</label>
            <input
              value={editBotName}
              onChange={(e) => onChangeName(e.target.value)}
              className="w-full bg-gem-mist border border-gem-mist/50 rounded-lg py-2 px-3 text-gem-offwhite focus:outline-none focus:ring-2 focus:ring-gem-blue"
            />
          </div>
          <div>
            <button
              onClick={onOpenAvatarPopup}
              className="px-3 py-1.5 rounded-md bg-gem-mist hover:bg-gem-mist/70 text-gem-offwhite text-sm font-semibold"
            >
              เปลี่ยนโปรไฟล์บอท
            </button>
          </div>
          <div>
            <label className="block text-sm text-gem-offwhite/70 mb-1">Base model</label>
            <select
              value={editBotModel}
              onChange={(e) => onChangeModel(e.target.value)}
              className="w-full bg-gem-mist border border-gem-mist/50 rounded-lg py-2 px-3 text-gem-offwhite focus:outline-none focus:ring-2 focus:ring-gem-blue"
            >
              {botModelOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gem-offwhite/70 mb-1">Description</label>
            <textarea
              value={editBotDescription}
              onChange={(e) => onChangeDescription(e.target.value)}
              className="w-full bg-gem-mist border border-gem-mist/50 rounded-lg py-2 px-3 text-gem-offwhite focus:outline-none focus:ring-2 focus:ring-gem-blue min-h-[200px]"
            />
          </div>
          <div>
            <label className="block text-sm text-gem-offwhite/70 mb-1">Prompt</label>
            <textarea
              value={editBotPrompt}
              onChange={(e) => onChangePrompt(e.target.value)}
              className="w-full bg-gem-mist border border-gem-mist/50 rounded-lg py-2 px-3 text-gem-offwhite focus:outline-none focus:ring-2 focus:ring-gem-blue min-h-[140px]"
            />
          </div>
          <div>
            <label className="block text-sm text-gem-offwhite/70 mb-2">Linked knowledge</label>
            {documents.length === 0 ? (
              <p className="text-sm text-gem-offwhite/60">No documents available.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                {documents.map((doc) => (
                  <label key={doc.id} className="flex items-center gap-2 text-sm text-gem-offwhite/80">
                    <input
                      type="checkbox"
                      checked={editBotDocIds.includes(doc.id)}
                      onChange={() => onToggleDoc(doc.id)}
                    />
                    <span className="truncate" title={doc.displayName}>{doc.displayName}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          {editBotError && <p className="text-red-400 text-sm">{editBotError}</p>}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-gem-mist hover:bg-gem-mist/70 text-gem-offwhite font-semibold"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="px-4 py-2 rounded-md bg-gem-blue hover:bg-blue-500 text-white font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={isSavingBot}
          >
            {isSavingBot ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditBotModal;
