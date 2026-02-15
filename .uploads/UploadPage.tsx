import React, { useCallback, useState } from 'react';
import UploadCloudIcon from './icons/UploadCloudIcon';
import TrashIcon from './icons/TrashIcon';
import ProgressBar from './ProgressBar';
import {
  completeUploadBatch,
  completeUploadFile,
  createUploadBatch,
  createUploadFileSession,
  getUploadBatchStatus,
  uploadFilePart,
} from '../services/api';
import { Document } from '../types';
import type { PDFDocumentProxy } from 'pdfjs-dist';

interface UploadPageProps {
  onBack?: () => void;
  onUploadComplete: (doc: Document) => void;
  hasApiKey: boolean;
  embedded?: boolean;
}

let pdfjsPromise: Promise<typeof import('pdfjs-dist')> | null = null;
const loadPdfjs = async () => {
  if (!pdfjsPromise) {
    pdfjsPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker?url'),
    ]).then(([pdfjs, worker]) => {
      pdfjs.GlobalWorkerOptions.workerSrc = (worker as { default?: string }).default ?? (worker as any);
      return pdfjs;
    });
  }
  return pdfjsPromise;
};

const parseCsvEnv = (value: string | undefined, fallback: string[]) => {
  if (!value) return fallback;
  const parsed = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  return parsed.length ? parsed : fallback;
};

const DEFAULT_ALLOWED_EXTENSIONS = ['.pdf', '.txt', '.md'];
const DEFAULT_ALLOWED_TYPES = ['application/pdf', 'text/plain', 'text/markdown'];
const ALLOWED_UPLOAD_EXTENSIONS = parseCsvEnv(
  import.meta.env.VITE_ALLOWED_UPLOAD_EXTENSIONS,
  DEFAULT_ALLOWED_EXTENSIONS,
);
const ALLOWED_UPLOAD_MIME_TYPES = parseCsvEnv(
  import.meta.env.VITE_ALLOWED_UPLOAD_MIME_TYPES,
  DEFAULT_ALLOWED_TYPES,
);
const rawMaxMb = Number(import.meta.env.VITE_MAX_UPLOAD_FILE_MB || 200);
const MAX_UPLOAD_FILE_BYTES = Number.isFinite(rawMaxMb) ? rawMaxMb * 1024 * 1024 : 200 * 1024 * 1024;
const isAllowedFile = (file: File) => {
  const name = file.name || '';
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')).toLowerCase() : '';
  const hasAllowedExt = ext ? ALLOWED_UPLOAD_EXTENSIONS.includes(ext) : false;
  const hasAllowedType = file.type ? ALLOWED_UPLOAD_MIME_TYPES.includes(file.type) : false;
  if (!(hasAllowedExt || hasAllowedType)) return false;
  if (Number.isFinite(MAX_UPLOAD_FILE_BYTES) && file.size > MAX_UPLOAD_FILE_BYTES) return false;
  return true;
};

type FileEntry = {
  file: File;
  text: string;
  blocks: { label: string; text: string }[];
  isExtracting: boolean;
  source?: 'text' | 'pdf';
  error?: string;
};

const UploadPage: React.FC<UploadPageProps> = ({
  onBack,
  onUploadComplete,
  hasApiKey,
  embedded = false,
}) => {
  const [fileEntries, setFileEntries] = useState<FileEntry[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    current: number;
    total: number;
    message?: string;
    fileName?: string;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const UPLOAD_PART_SIZE = 20 * 1024 * 1024;
  const UPLOAD_CONCURRENCY = 4;
  const isLight = embedded;

  const buildBlocksFromText = (text: string, labelPrefix?: string) => {
    const normalized = text.replace(/\r\n/g, '\n').trim();
    if (!normalized) return [];

    const chunkSize = 1800;
    const overlap = 100;
    const chunks: string[] = [];
    let start = 0;
    while (start < normalized.length) {
      const end = Math.min(start + chunkSize, normalized.length);
      const slice = normalized.slice(start, end).trim();
      if (slice) {
        chunks.push(slice);
      }
      if (end === normalized.length) break;
      start = Math.max(0, end - overlap);
    }

    return chunks.map((chunk, index) => ({
      label: labelPrefix ? `${labelPrefix} • Chunk ${index + 1}` : `Chunk ${index + 1}`,
      text: chunk,
    }));
  };

  const addFiles = (incoming: File[]) => {
    if (incoming.length === 0) return;
    const invalidFiles = incoming.filter((file) => !isAllowedFile(file));
    if (invalidFiles.length > 0) {
      const names = invalidFiles.map((file) => file.name).join(', ');
      setError(`Unsupported or too large files: ${names}`);
    } else {
      setError(null);
    }
    const validFiles = incoming.filter((file) => isAllowedFile(file));
    if (validFiles.length === 0) return;
    setFileEntries((prev) => [
      ...prev,
      ...validFiles.map((file) => ({ file, text: '', blocks: [], isExtracting: true })),
    ]);

    validFiles.forEach(async (file) => {
      try {
        const { text, blocks, source } = await extractTextFromFile(file);
        setFileEntries((prev) =>
          prev.map((entry) =>
            entry.file === file
              ? {
                  ...entry,
                  text,
                  blocks,
                  source,
                  isExtracting: false,
                  error: text ? undefined : 'No text extracted',
                }
              : entry,
          ),
        );
      } catch (err) {
        console.warn(`Failed to extract text for ${file.name}`, err);
        setFileEntries((prev) =>
          prev.map((entry) =>
            entry.file === file
              ? { ...entry, isExtracting: false, error: 'Failed to extract text' }
              : entry,
          ),
        );
      }
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      addFiles(Array.from(event.target.files));
    }
  };

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if (event.dataTransfer.files) {
      addFiles(Array.from(event.dataTransfer.files));
    }
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isDragging) setIsDragging(true);
  }, [isDragging]);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleRemoveFile = (indexToRemove: number) => {
    setFileEntries((prevFiles) => prevFiles.filter((_, index) => index !== indexToRemove));
  };

  type ExtractResult = { text: string; blocks: { label: string; text: string }[]; source: 'text' | 'pdf' };

  const isPdfFile = (file: File) =>
    file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

  const extractPdfPageText = async (page: { getTextContent: () => Promise<any> }) => {
    const content = await page.getTextContent();
    return content.items
      .map((item: any) => {
        if (!('str' in item)) return '';
        const text = item.str ?? '';
        const hasEol = 'hasEOL' in item && item.hasEOL;
        return text + (hasEol ? '\n' : ' ');
      })
      .join('')
      .trim();
  };


  const extractTextFromPdf = async (pdf: PDFDocumentProxy): Promise<ExtractResult> => {
    const blocks: { label: string; text: string }[] = [];
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const pageText = await extractPdfPageText(page);
      if (pageText) {
        blocks.push(...buildBlocksFromText(pageText, `Page ${pageNumber}`));
      }
    }
    const text = blocks.map((block) => block.text).join('\n\n');
    return { text, blocks, source: 'pdf' };
  };

  async function extractTextFromFile(file: File): Promise<ExtractResult> {
    const isText =
      file.type.startsWith('text/') || /\.(txt|md)$/i.test(file.name);
    if (isText) {
      const text = await file.text();
      return { text, blocks: buildBlocksFromText(text), source: 'text' };
    }
    if (isPdfFile(file)) {
      const buffer = await file.arrayBuffer();
      const pdfjs = await loadPdfjs();
      const pdf = await pdfjs.getDocument({ data: buffer }).promise;
      return await extractTextFromPdf(pdf);
    }
    return { text: '', blocks: [], source: 'text' };
  }


  const handleLoadText = async (index: number) => {
    setFileEntries((prev) =>
      prev.map((entry, idx) =>
        idx === index ? { ...entry, isExtracting: true, error: undefined } : entry,
      ),
    );
    try {
      const entry = fileEntries[index];
      if (!entry) return;
      const { text, blocks, source } = await extractTextFromFile(entry.file);
      setFileEntries((prev) =>
        prev.map((item, idx) =>
          idx === index
            ? {
                ...item,
                text,
                blocks,
                source,
                isExtracting: false,
                error: text ? undefined : 'No text extracted. Paste text manually if needed.',
              }
            : item,
        ),
      );
    } catch (err) {
      console.warn('Failed to extract text', err);
      setFileEntries((prev) =>
        prev.map((item, idx) =>
          idx === index
            ? {
                ...item,
                isExtracting: false,
                error: 'Failed to extract text from PDF.',
              }
            : item,
        ),
      );
    }
  };

  const handleUpload = async () => {
    if (!hasApiKey) {
      setError("Missing GEMINI_API_KEY in .env.local or .env.");
      return;
    }
    if (fileEntries.length === 0 || isUploading) return;

    setError(null);
    setIsUploading(true);

    try {
      const displayName =
        fileEntries.length === 1 ? fileEntries[0].file.name : `${fileEntries.length} documents`;
      const batch = await createUploadBatch(displayName);

      const totalParts = fileEntries.reduce(
        (sum, entry) => sum + Math.max(1, Math.ceil(entry.file.size / UPLOAD_PART_SIZE)),
        0,
      );
      let uploadedParts = 0;
      setUploadProgress({ current: 0, total: totalParts, message: "Uploading files..." });

      for (const entry of fileEntries) {
        const totalFileParts = Math.max(1, Math.ceil(entry.file.size / UPLOAD_PART_SIZE));
        const session = await createUploadFileSession(batch.id, {
          name: entry.file.name,
          size: entry.file.size,
          type: entry.file.type,
          totalParts: totalFileParts,
        });

        const partIndexes = Array.from({ length: totalFileParts }, (_, index) => index);
        let hasError = false;
        await new Promise<void>((resolve, reject) => {
          let cursor = 0;
          let inFlight = 0;

          const launchNext = () => {
            if (hasError) return;
            if (cursor >= partIndexes.length && inFlight === 0) {
              resolve();
              return;
            }
            while (inFlight < UPLOAD_CONCURRENCY && cursor < partIndexes.length) {
              const partIndex = partIndexes[cursor];
              cursor += 1;
              inFlight += 1;

              (async () => {
                const start = partIndex * UPLOAD_PART_SIZE;
                const end = Math.min(start + UPLOAD_PART_SIZE, entry.file.size);
                const part = entry.file.slice(start, end);
                let attempt = 0;
                while (attempt < 3) {
                  try {
                    await uploadFilePart(session.uploadId, partIndex + 1, part);
                    break;
                  } catch (partError) {
                    attempt += 1;
                    if (attempt >= 3) {
                      throw partError;
                    }
                    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500 * attempt));
                  }
                }
              })()
                .then(() => {
                  uploadedParts += 1;
                  setUploadProgress({
                    current: uploadedParts,
                    total: totalParts,
                    message: "Uploading files...",
                    fileName: `${entry.file.name} (${partIndex + 1}/${totalFileParts})`,
                  });
                })
                .catch((partError) => {
                  hasError = true;
                  reject(partError);
                })
                .finally(() => {
                  inFlight -= 1;
                  launchNext();
                });
            }
          };

          launchNext();
        });

        await completeUploadFile(session.uploadId);
      }

      await completeUploadBatch(batch.id);

      const document = await new Promise<Document>((resolve, reject) => {
        const intervalId = setInterval(async () => {
          try {
            const status = await getUploadBatchStatus(batch.id);
            if (status.progress) {
              setUploadProgress({
                current: status.progress.current ?? 0,
                total: status.progress.total ?? 1,
                message: status.progress.message ?? "Processing...",
                fileName: status.progress.fileName,
              });
            }
            if (status.status === 'done' && status.document) {
              clearInterval(intervalId);
              resolve(status.document);
            } else if (status.status === 'error') {
              clearInterval(intervalId);
              reject(new Error(status.error || "Upload failed."));
            }
          } catch (pollError) {
            clearInterval(intervalId);
            reject(pollError);
          }
        }, 2000);
      });

      setFileEntries([]);
      onUploadComplete(document);
    } catch (uploadError) {
      console.error("Upload failed:", uploadError);
      const message = uploadError instanceof Error ? uploadError.message : 'Upload failed.';
      if (message.toLowerCase().includes('unauthorized')) {
        setError("Session expired. Please log in again.");
      } else if (message.toLowerCase().includes('gemini_api_key')) {
        setError("Missing GEMINI_API_KEY in .env.local or .env.");
      } else {
        setError(message || "Upload failed. Please try again.");
      }
    } finally {
      setUploadProgress(null);
      setIsUploading(false);
    }
  };

  const containerClass = embedded ? "w-full text-slate-800" : "min-h-screen bg-gem-onyx text-gem-offwhite p-6";
  const contentClass = embedded ? "max-w-3xl mx-auto text-left" : "max-w-3xl mx-auto";

  return (
    <div className={containerClass}>
      <div className={contentClass}>
        {onBack && (
          <button
            onClick={onBack}
            className="text-gem-blue hover:text-blue-400 font-semibold mb-6"
          >
            ← Back to dashboard
          </button>
        )}

        <h1 className="text-3xl font-bold mb-2 text-left">Upload documents</h1>
        <p className={`${isLight ? 'text-slate-500' : 'text-gem-offwhite/70'} mb-6 text-left`}>
          Upload PDF, TXT, or Markdown files to start chatting with them.
        </p>
        {!hasApiKey && (
          <div className="w-full max-w-xl mx-auto mb-8">
            <div className="w-full bg-gem-slate border border-red-400/50 rounded-lg py-3 px-5 text-center text-red-400 font-semibold">
              Missing GEMINI_API_KEY in .env.local or .env
            </div>
          </div>
        )}

        <div
          className={`relative border-2 border-dashed rounded-lg p-10 text-center transition-colors mb-6 ${
            isDragging
              ? isLight
                ? 'border-yellow-400 bg-yellow-50'
                : 'border-gem-blue bg-gem-mist/10'
              : isLight
                ? 'border-slate-200'
                : 'border-gem-mist/50'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <div className="flex flex-col items-center justify-center">
            <UploadCloudIcon />
            <p className={`mt-4 text-lg ${isLight ? 'text-slate-500' : 'text-gem-offwhite/80'}`}>
              Drag & drop your file here.
            </p>
            <p className={`mt-1 text-xs ${isLight ? 'text-slate-400' : 'text-gem-offwhite/50'}`}>
              Allowed: {ALLOWED_UPLOAD_EXTENSIONS.join(', ')} • Max {Math.round(MAX_UPLOAD_FILE_BYTES / (1024 * 1024))} MB
            </p>
            <input
              id="file-upload"
              type="file"
              multiple
              className="hidden"
              onChange={handleFileChange}
              accept={[...ALLOWED_UPLOAD_EXTENSIONS, ...ALLOWED_UPLOAD_MIME_TYPES].join(',')}
            />
            <label
              htmlFor="file-upload"
              className={`mt-4 cursor-pointer px-6 py-2 rounded-full font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                isLight
                  ? 'bg-yellow-400 text-slate-900 hover:bg-yellow-500 focus:ring-yellow-400 focus:ring-offset-white'
                  : 'bg-gem-blue text-white hover:bg-blue-500 focus:ring-gem-blue focus:ring-offset-gem-onyx'
              }`}
              title="Select files from your device"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  (document.getElementById('file-upload') as HTMLInputElement)?.click();
                }
              }}
            >
              Or Browse Files
            </label>
          </div>
        </div>

        {fileEntries.length > 0 && (
          <div className="w-full max-w-xl mx-auto mb-6 text-left space-y-3">
            <h4 className="font-semibold">Selected Files ({fileEntries.length}):</h4>
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2">
              {fileEntries.map((entry, index) => (
                <div key={`${entry.file.name}-${index}`} className={`p-3 rounded-md space-y-2 ${isLight ? 'bg-slate-50 border border-slate-200' : 'bg-gem-mist/50'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate" title={entry.file.name}>
                        {entry.file.name}
                      </p>
                      <p className={`text-xs ${isLight ? 'text-slate-500' : 'text-gem-offwhite/50'}`}>
                        {entry.file.size ? `${(entry.file.size / 1024).toFixed(2)} KB` : 'File'} {entry.file.type ? `• ${entry.file.type}` : ''}
                        {entry.source ? ` • ${entry.source.toUpperCase()}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleLoadText(index)}
                        className="text-xs text-gem-blue hover:text-blue-400"
                        disabled={entry.isExtracting}
                      >
                        {entry.isExtracting ? 'Loading...' : 'Load text'}
                      </button>
                      <button
                        onClick={() => handleRemoveFile(index)}
                        className="p-1 text-red-400 hover:text-red-300 rounded-full"
                        aria-label={`Remove ${entry.file.name}`}
                        title="Remove this file"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                  {entry.blocks.length > 0 ? (
                    <div className="space-y-3">
                      {entry.blocks.map((block, blockIndex) => (
                        <div key={`${entry.file.name}-block-${blockIndex}`} className="space-y-1">
                          <p className={`text-xs uppercase tracking-wider ${isLight ? 'text-slate-400' : 'text-gem-offwhite/60'}`}>
                            {block.label}
                          </p>
                          <textarea
                            value={block.text}
                            onChange={(e) => {
                              const next = [...fileEntries];
                              const nextBlocks = [...next[index].blocks];
                              nextBlocks[blockIndex] = { ...nextBlocks[blockIndex], text: e.target.value };
                              next[index] = {
                                ...next[index],
                                blocks: nextBlocks,
                                text: nextBlocks.map((item) => item.text).join('\n\n'),
                                error: undefined,
                              };
                              setFileEntries(next);
                            }}
                            className={`w-full rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 min-h-[200px] ${
                              isLight
                                ? 'bg-white border border-slate-200 text-slate-700 focus:ring-yellow-400'
                                : 'bg-gem-mist border border-gem-mist/50 text-gem-offwhite focus:ring-gem-blue'
                            }`}
                            placeholder="Edit text before upload"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <textarea
                      value={entry.text}
                      onChange={(e) => {
                        const next = [...fileEntries];
                        next[index] = { ...next[index], text: e.target.value, error: undefined };
                        setFileEntries(next);
                      }}
                      className={`w-full rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-2 min-h-[200px] ${
                        isLight
                          ? 'bg-white border border-slate-200 text-slate-700 focus:ring-yellow-400'
                          : 'bg-gem-mist border border-gem-mist/50 text-gem-offwhite focus:ring-gem-blue'
                      }`}
                      placeholder="Text preview (you can edit before upload)"
                    />
                  )}
                  {entry.error && (
                    <p className="text-xs text-red-400">{entry.error}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {uploadProgress && (
          <ProgressBar
            progress={uploadProgress.current}
            total={uploadProgress.total}
            message={uploadProgress.message || "Preparing upload..."}
            fileName={uploadProgress.fileName}
          />
        )}

        {error && <p className="text-red-400 text-sm text-center mt-4">{error}</p>}

        <div className="w-full max-w-xl mx-auto mt-6">
          <button
            onClick={handleUpload}
            disabled={!fileEntries.length || isUploading}
            className={`w-full px-6 py-3 rounded-md font-bold transition-colors disabled:cursor-not-allowed ${
              isLight
                ? 'bg-yellow-400 hover:bg-yellow-500 text-slate-900 disabled:bg-slate-200'
                : 'bg-gem-blue hover:bg-blue-500 text-white disabled:bg-gem-mist/50'
            }`}
            title="Upload selected files"
          >
            {isUploading ? 'Uploading...' : 'Upload and Chat'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UploadPage;
