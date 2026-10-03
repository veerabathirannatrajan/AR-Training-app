import { useEffect } from 'react';

/** Screen orientation a screen or module is designed for. */
export type OrientationNeed = 'portrait' | 'landscape' | 'any';

// `lock()` is missing from TypeScript's DOM types (it is not available everywhere).
type LockableOrientation = ScreenOrientation & { lock?: (orientation: string) => Promise<void> };

/**
 * Keeps the screen in the orientation the current screen needs. The Android app leaves the
 * orientation to the page, and the installed PWA allows it too; in a normal browser tab the
 * request is refused and the page simply rotates with the phone.
 */
export function useOrientationLock(need: OrientationNeed): void {
  useEffect(() => {
    const orientation = window.screen.orientation as LockableOrientation | undefined;
    orientation?.lock?.(need).catch(() => {
      // Not allowed here (browser tab); the page follows the phone.
    });
  }, [need]);
}
