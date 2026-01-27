/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MAX_UPLOAD_FILE_MB?: string;
  readonly VITE_ALLOWED_UPLOAD_MIME_TYPES?: string;
  readonly VITE_ALLOWED_UPLOAD_EXTENSIONS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
