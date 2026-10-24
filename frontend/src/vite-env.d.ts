/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Адрес API без префикса /api/v1, например http://localhost:8000/api/v1 */
  readonly VITE_API_BASE_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
