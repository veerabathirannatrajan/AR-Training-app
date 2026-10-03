/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API base URL. Default http://localhost:8000 (on the phone: adb reverse to the laptop). */
  readonly VITE_API_BASE_URL?: string;
}

declare const __APP_VERSION__: string;
