import React from 'react';
import { Document } from '../../../types';

interface EditDocumentModalProps {
  isOpen: boolean;
  editingDoc: Document | null;
  editDocName: string;
  editDocTagsInput: string;
  shareEmail: string;
  shareRole: 'viewer' | 'editor';
  editDocShares: Array<{ id: string; role?: 'viewer' | 'editor'; user: { id: string; email: string; name: string } }>;
  editDocFiles: Array<{ name: string; size: number; type: string; text?: string; blocks?: { label: string; text: string }[]; source?: 'text' | 'pdf' }>;
  shareError: string | null;
  editDocError: string | null;
  isSharing: boolean;
  isLoading: boolean;
  isSavingDoc: boolean;
  isRemovingShare: string | null;
  canManageShares: boolean;
  onChangeName: (value: string) => void;
  onChangeTags: (value: string) => void;
  onChangeShareEmail: (value: string) => void;
  onChangeShareRole: (value: 'viewer' | 'editor') => void;
  onAddShare: () => void;
  onRemoveShare: (email: string, shareId: string) => void;
  onUpdateShareRole: (email: string, role: 'viewer' | 'editor') => void;
  onLoadFileText: (index: number, file: File) => void;
  onRemoveFile: (index: number) => void;
  onUpdateFiles: (next: Array<{ name: string; size: number; type: string; text?: string; blocks?: { label: string; text: string }[]; source?: 'text' | 'pdf' }>) => void;
  onSave: () => void;
  onClose: () => void;
  openConfirmDialog: (dialog: { title: string; message: string; confirmLabel?: string; onConfirm: () => void }) => void;
}

const EditDocumentModal: React.FC<EditDocumentModalProps> = ({
  isOpen,
  editingDoc,
  editDocName,
  editDocTagsInput,
  shareEmail,
  shareRole,
  editDocShares,
  editDocFiles,
  shareError,
  editDocError,
  isSharing,
  isLoading,
  isSavingDoc,
  isRemovingShare,
  canManageShares,
  onChangeName,
  onChangeTags,
  onChangeShareEmail,
  onChangeShareRole,
  onAddShare,
  onRemoveShare,
  onUpdateShareRole,
  onLoadFileText,
  onRemoveFile,
  onUpdateFiles,
  onSave,
  onClose,
  openConfirmDialog,
}) => {
  if (!isOpen || !editingDoc) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-gem-slate p-6 rounded-xl w-full max-w-4xl border border-gem-mist/40">
        <h3 className="text-xl font-semibold mb-4">Edit document</h3>
        {isLoading ? (
          <p className="text-sm text-gem-offwhite/70">Loading document details...</p>
        ) : (
          <div className="space-y-4">
          <div>
            <label className="block text-sm text-gem-offwhite/70 mb-1">Document name</label>
            <input
              value={editDocName}
              onChange={(e) => onChangeName(e.target.value)}
              className="w-full bg-gem-mist border border-gem-mist/50 rounded-lg py-2 px-3 text-gem-offwhite focus:outline-none focus:ring-2 focus:ring-gem-blue"
            />
          </div>
          <div>
            <label className="block text-sm text-gem-offwhite/70 mb-1">Tags (comma-separated)</label>
            <input
              value={editDocTagsInput}
              onChange={(e) => onChangeTags(e.target.value)}
              placeholder="e.g. onboarding, policy, product"
              className="w-full bg-gem-mist border border-gem-mist/50 rounded-lg py-2 px-3 text-gem-offwhite focus:outline-none focus:ring-2 focus:ring-gem-blue"
            />
            <p className="text-xs text-gem-offwhite/50 mt-1">Separate tags with commas.</p>
          </div>
          {canManageShares ? (
            <div>
              <label className="block text-sm text-gem-offwhite/70 mb-1">Share with email</label>
              <div className="flex gap-2">
                <input
                  value={shareEmail}
                  onChange={(e) => onChangeShareEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="flex-1 bg-gem-mist border border-gem-mist/50 rounded-lg py-2 px-3 text-gem-offwhite focus:outline-none focus:ring-2 focus:ring-gem-blue"
                />
                <select
                  value={shareRole}
                  onChange={(e) => onChangeShareRole(e.target.value as 'viewer' | 'editor')}
                  className="bg-gem-mist border border-gem-mist/50 rounded-lg py-2 px-3 text-gem-offwhite focus:outline-none focus:ring-2 focus:ring-gem-blue"
                >
                  <option value="viewer">Viewer</option>
                  <option value="editor">Editor</option>
                </select>
                <button
                  onClick={onAddShare}
                  className="px-4 py-2 rounded-md bg-gem-blue hover:bg-blue-500 text-white font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
                  disabled={isSharing}
                >
                  {isSharing ? 'Sharing...' : 'Share'}
                </button>
              </div>
              {editDocShares.length > 0 && (
                <div className="mt-3 space-y-2">
                  {editDocShares.map((share) => (
                    <div key={share.id} className="flex items-center justify-between text-sm text-gem-offwhite/80">
                      <div className="flex items-center gap-2">
                        <span>{share.user.email}</span>
                        <select
                          value={share.role ?? 'viewer'}
                          onChange={(e) => onUpdateShareRole(share.user.email, e.target.value as 'viewer' | 'editor')}
                          className="bg-gem-mist border border-gem-mist/50 rounded-md px-2 py-1 text-xs text-gem-offwhite"
                          disabled={isSharing}
                        >
                          <option value="viewer">Viewer</option>
                          <option value="editor">Editor</option>
                        </select>
                      </div>
                      <button
                        onClick={() => onRemoveShare(share.user.email, share.id)}
                        className="text-red-400 hover:text-red-300"
                        disabled={isRemovingShare === share.id}
                      >
                        {isRemovingShare === share.id ? 'Removing...' : 'Remove'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-gem-offwhite/60">
              Sharing is only available to the document owner.
            </p>
          )}
          <div>
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-gem-offwhite/80">Files & content</h4>
              <span className="text-xs text-gem-offwhite/50">Edit file names or text below</span>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-2 mt-2">
              {editDocFiles.length === 0 ? (
                <p className="text-sm text-gem-offwhite/60">No files found.</p>
              ) : (
                editDocFiles.map((file, index) => (
                  <div
                    key={`${editingDoc.id}-${index}`}
                    className="space-y-2 rounded-lg border border-gem-mist/40 bg-gem-mist/20 p-3"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gem-offwhite/60 uppercase tracking-wider">File</p>
                        <input
                          value={file.name}
                          onChange={(e) => {
                            const next = [...editDocFiles];
                            next[index] = { ...next[index], name: e.target.value };
                            onUpdateFiles(next);
                          }}
                          className="mt-1 w-full bg-gem-mist border border-gem-mist/50 rounded-lg py-1.5 px-2 text-sm text-gem-offwhite focus:outline-none focus:ring-2 focus:ring-gem-blue"
                        />
                        {file.source && (
                          <p className="text-xs text-gem-offwhite/50 uppercase tracking-wider mt-1">
                            {file.source.toUpperCase()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-gem-blue hover:text-blue-400 cursor-pointer">
                          Load text
                          <input
                            type="file"
                            accept=".pdf,.txt,.md"
                            className="hidden"
                            onChange={(e) => {
                              const picked = e.target.files?.[0];
                              if (picked) {
                                onLoadFileText(index, picked);
                              }
                            }}
                          />
                        </label>
                        <button
                          onClick={() =>
                            openConfirmDialog({
                              title: 'Delete file',
                              message: `Remove file "${file.name}" from this knowledge?`,
                              confirmLabel: 'Remove',
                              onConfirm: () => onRemoveFile(index),
                            })
                          }
                          className="text-xs text-red-400 hover:text-red-300"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-gem-offwhite/60 uppercase tracking-wider">
                      Text content
                    </p>
                    {file.blocks && file.blocks.length > 0 ? (
                      <div className="space-y-3">
                        {file.blocks.map((block, blockIndex) => (
                          <div key={`${editingDoc.id}-${index}-${blockIndex}`} className="space-y-1">
                            <p className="text-xs text-gem-offwhite/60 uppercase tracking-wider">
                              {block.label}
                            </p>
                            <textarea
                              value={block.text}
                              onChange={(e) => {
                                const next = [...editDocFiles];
                                const nextBlocks = [...(next[index].blocks ?? [])];
                                nextBlocks[blockIndex] = { ...nextBlocks[blockIndex], text: e.target.value };
                                next[index] = {
                                  ...next[index],
                                  blocks: nextBlocks,
                                  text: nextBlocks.map((item) => item.text).join('\n\n'),
                                };
                                onUpdateFiles(next);
                              }}
                              className="w-full bg-gem-mist border border-gem-mist/50 rounded-lg py-2 px-3 text-sm text-gem-offwhite focus:outline-none focus:ring-2 focus:ring-gem-blue min-h-[200px]"
                            />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <textarea
                        value={file.text ?? ''}
                        onChange={(e) => {
                          const next = [...editDocFiles];
                          next[index] = { ...next[index], text: e.target.value };
                          onUpdateFiles(next);
                        }}
                        className="w-full bg-gem-mist border border-gem-mist/50 rounded-lg py-2 px-3 text-sm text-gem-offwhite focus:outline-none focus:ring-2 focus:ring-gem-blue min-h-[140px]"
                        placeholder="Paste or edit extracted text here"
                      />
                    )}
                    {!file.text && (
                      <p className="text-xs text-gem-offwhite/50">
                        No text extracted. Paste text manually if needed.
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
          {shareError && <p className="text-red-400 text-sm">{shareError}</p>}
          {editDocError && <p className="text-red-400 text-sm">{editDocError}</p>}
          </div>
        )}
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
            disabled={isSavingDoc || isLoading}
          >
            {isSavingDoc ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EditDocumentModal;
