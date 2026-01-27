import React from 'react';
import { Document } from '../../../types';

interface SelectKnowledgeModalProps {
  isOpen: boolean;
  documents: Document[];
  selectedIds: string[];
  onToggle: (docId: string) => void;
  onClose: () => void;
}

const SelectKnowledgeModal: React.FC<SelectKnowledgeModalProps> = ({
  isOpen,
  documents,
  selectedIds,
  onToggle,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white p-6 rounded-xl w-full max-w-lg border border-slate-200">
        <h3 className="text-xl font-semibold mb-4 text-slate-900">เลือกความรู้</h3>
        <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
          {documents.length === 0 ? (
            <p className="text-sm text-slate-500">ยังไม่มีความรู้ให้เลือก</p>
          ) : (
            documents.map((doc) => (
              <label key={doc.id} className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(doc.id)}
                  onChange={() => onToggle(doc.id)}
                />
                <span className="truncate">{doc.displayName}</span>
              </label>
            ))
          )}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md border border-slate-200 text-slate-700"
          >
            Cancel
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-semibold"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default SelectKnowledgeModal;
