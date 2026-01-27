import React from 'react';
import { Document } from '../../types';
import UploadPage from '../UploadPage';

interface KnowledgePanelProps {
  documents: Document[];
  documentsLoading: boolean;
  knowledgeSearch: string;
  onKnowledgeSearch: (value: string) => void;
  knowledgeTagFilter: string;
  onKnowledgeTagFilter: (value: string) => void;
  knowledgeSort: 'created_desc' | 'created_asc' | 'name_asc' | 'name_desc';
  onKnowledgeSort: (value: 'created_desc' | 'created_asc' | 'name_asc' | 'name_desc') => void;
  showUpload: boolean;
  onShowUpload: (value: boolean) => void;
  onUploadComplete: (doc: Document) => void;
  onSelectDocument: (doc: Document) => void;
  onOpenEditDocument: (doc: Document) => void;
  onConfirmDelete: (doc: Document) => void;
  hasApiKey: boolean;
  currentUserId: string;
}

const KnowledgePanel: React.FC<KnowledgePanelProps> = ({
  documents,
  documentsLoading,
  knowledgeSearch,
  onKnowledgeSearch,
  knowledgeTagFilter,
  onKnowledgeTagFilter,
  knowledgeSort,
  onKnowledgeSort,
  showUpload,
  onShowUpload,
  onUploadComplete,
  onSelectDocument,
  onOpenEditDocument,
  onConfirmDelete,
  hasApiKey,
  currentUserId,
}) => {
  const normalizedSearch = knowledgeSearch.trim().toLowerCase();
  const availableTags = Array.from(
    new Set(
      documents
        .flatMap((doc) => doc.tags ?? [])
        .map((tag) => tag.trim())
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));

  const filteredDocs = documents.filter((doc) => {
    const tags = (doc.tags ?? []).map((tag) => tag.toLowerCase());
    const matchesSearch = normalizedSearch
      ? doc.displayName.toLowerCase().includes(normalizedSearch) || tags.some((tag) => tag.includes(normalizedSearch))
      : true;
    if (knowledgeTagFilter === 'all') return matchesSearch;
    if (knowledgeTagFilter === 'untagged') {
      return matchesSearch && (!doc.tags || doc.tags.length === 0);
    }
    const tagSet = new Set(tags);
    return matchesSearch && tagSet.has(knowledgeTagFilter.toLowerCase());
  }).slice().sort((a, b) => {
    const nameCompare = a.displayName.localeCompare(b.displayName, 'th', { sensitivity: 'base' });
    const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    switch (knowledgeSort) {
      case 'created_asc':
        return createdA - createdB;
      case 'created_desc':
        return createdB - createdA;
      case 'name_desc':
        return -nameCompare;
      case 'name_asc':
        return nameCompare;
      default:
        return 0;
    }
  });

  const getAccess = (doc: Document) => {
    const isOwner = Boolean(doc.ownerId && doc.ownerId === currentUserId);
    const share = doc.shares?.find((item) => item.user.id === currentUserId);
    const role = share?.role ?? 'viewer';
    return {
      isOwner,
      role,
      canEdit: isOwner || role === 'editor',
      canDelete: isOwner,
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-semibold text-slate-900">Knowledge</h2>
        <button
          onClick={() => onShowUpload(true)}
          className="px-4 py-2 rounded-lg bg-yellow-400 hover:bg-yellow-500 text-slate-900 text-sm font-semibold shadow-sm"
        >
          Create Knowledge +
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          value={knowledgeSearch}
          onChange={(event) => onKnowledgeSearch(event.target.value)}
          className="w-full max-w-md h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
          placeholder="Search Knowledge"
        />
        <select
          value={knowledgeTagFilter}
          onChange={(event) => onKnowledgeTagFilter(event.target.value)}
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
        >
          <option value="all">All tags</option>
          <option value="untagged">Untagged</option>
          {availableTags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
        <select
          value={knowledgeSort}
          onChange={(event) =>
            onKnowledgeSort(event.target.value as 'created_desc' | 'created_asc' | 'name_asc' | 'name_desc')
          }
          className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
        >
          <option value="created_desc">Newest first</option>
          <option value="created_asc">Oldest first</option>
          <option value="name_asc">Name A-Z / ก-ฮ</option>
          <option value="name_desc">Name Z-A / ฮ-ก</option>
        </select>
      </div>

      {showUpload && (
        <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-4">
          <button
            onClick={() => onShowUpload(false)}
            className="text-sm text-slate-600 hover:text-slate-800 font-semibold"
          >
            ← Back to Knowledge
          </button>
          <UploadPage
            onUploadComplete={(doc) => {
              onUploadComplete(doc);
              onShowUpload(false);
            }}
            hasApiKey={hasApiKey}
            embedded
          />
        </div>
      )}

      {documentsLoading ? (
        <p className="text-slate-500">Loading documents...</p>
      ) : filteredDocs.length === 0 ? (
        <p className="text-slate-500">No knowledge created yet.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filteredDocs.map((doc) => {
            const access = getAccess(doc);
            return (
            <div key={doc.id} className="border border-slate-200 rounded-xl p-4 bg-white">
              <h3 className="text-base font-semibold text-slate-900">{doc.displayName}</h3>
              <p className="text-sm text-slate-500 mt-1">
                {doc.sourceFiles?.length ? `${doc.sourceFiles.length} file(s)` : 'Description'}
              </p>
              <div className="mt-3">
                <p className="text-xs uppercase tracking-wider text-slate-400">Tags</p>
                {doc.tags && doc.tags.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {doc.tags.map((tag) => (
                      <button
                        key={`${doc.id}-${tag}`}
                        onClick={() => onKnowledgeTagFilter(tag)}
                        className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-600 hover:bg-slate-100"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-400">No tags</p>
                )}
              </div>
              <button
                onClick={() => {
                  if (!access.canEdit) return;
                  onShowUpload(true);
                  onSelectDocument(doc);
                }}
                disabled={!access.canEdit}
                className={`text-sm font-medium mt-3 ${access.canEdit ? 'text-yellow-600 hover:text-yellow-700' : 'text-slate-400 cursor-not-allowed'}`}
              >
                Add Data →
              </button>
              {!access.canEdit && (
                <p className="text-xs text-slate-400 mt-1">Read-only access</p>
              )}
              <div className="mt-4 flex items-center gap-2">
                <button
                  onClick={() => access.canEdit && onOpenEditDocument(doc)}
                  disabled={!access.canEdit}
                  className={`px-3 py-1.5 rounded-md border text-xs ${
                    access.canEdit ? 'border-slate-200 text-slate-600 hover:bg-slate-50' : 'border-slate-100 text-slate-300 cursor-not-allowed'
                  }`}
                >
                  Edit
                </button>
                <button
                  onClick={() => access.canDelete && onConfirmDelete(doc)}
                  disabled={!access.canDelete}
                  className={`px-3 py-1.5 rounded-md border text-xs ${
                    access.canDelete ? 'border-red-200 text-red-500 hover:bg-red-50' : 'border-slate-100 text-slate-300 cursor-not-allowed'
                  }`}
                >
                  Delete
                </button>
              </div>
            </div>
          )})}
        </div>
      )}
    </div>
  );
};

export default KnowledgePanel;
