interface ImportMetaEnv {
  /** Base URL of the FastAPI service. Defaults to http://localhost:8000 (reachable on the phone via adb reverse). */
  readonly VITE_API_BASE_URL?: string;
  /** Set to "false" to hide the demo login hint. */
  readonly VITE_DEMO_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** The API's certificate public key(s) at build time (vite.config.ts), for offline verification. */
declare const __ARMT_CERT_KEYS__: import('@ar-training/shared').SigningKey[];
/** App version reported to the API on sync. */
declare const __APP_VERSION__: string;
