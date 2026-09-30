interface ImportMetaEnv {
  /** Base URL of the FastAPI service. Defaults to http://localhost:8000 (reachable on the phone via adb reverse). */
  readonly VITE_API_BASE_URL?: string;
  /** Set to "false" to hide the demo login hint. */
  readonly VITE_DEMO_MODE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
