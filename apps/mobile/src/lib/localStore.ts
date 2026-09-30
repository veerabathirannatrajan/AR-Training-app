/**
 * localStorage for small per-device preferences (language, voice on/off). It can be
 * unavailable (private mode, blocked storage), so every access is guarded.
 */
export function readLocal(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Preference is simply not remembered.
  }
}
