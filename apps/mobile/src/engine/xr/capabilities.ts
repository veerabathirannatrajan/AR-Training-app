import type { XRCapabilities } from '@ar-training/shared';

/** Checks whether this browser/device can run an immersive-ar WebXR session. */
export async function detectXRCapabilities(): Promise<XRCapabilities> {
  const secureContext = window.isSecureContext;
  const xr = navigator.xr;
  const webxrAvailable = xr != null;

  if (!secureContext) {
    return {
      secureContext,
      webxrAvailable,
      immersiveAr: false,
      unsupportedReason: 'insecure-context',
    };
  }
  if (xr == null) {
    return { secureContext, webxrAvailable, immersiveAr: false, unsupportedReason: 'no-webxr' };
  }
  if (isFallbackForced()) {
    return {
      secureContext,
      webxrAvailable,
      immersiveAr: false,
      unsupportedReason: 'forced-fallback',
    };
  }

  try {
    const immersiveAr = await xr.isSessionSupported('immersive-ar');
    return {
      secureContext,
      webxrAvailable,
      immersiveAr,
      unsupportedReason: immersiveAr ? null : 'no-immersive-ar',
    };
  } catch (error) {
    console.warn('[xr] isSessionSupported(immersive-ar) failed', error);
    return { secureContext, webxrAvailable, immersiveAr: false, unsupportedReason: 'check-failed' };
  }
}

/** `?mode=3d` forces the 3D fallback so it can be tested on AR-capable phones. */
export function isFallbackForced(): boolean {
  return new URLSearchParams(window.location.search).get('mode') === '3d';
}

export type ARStartError = 'camera-denied' | 'not-supported' | 'unknown';

/** Classifies a requestSession() rejection so the UI can show an actionable message. */
export function classifyARStartError(error: unknown): ARStartError {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'SecurityError') return 'camera-denied';
    if (error.name === 'NotSupportedError') return 'not-supported';
  }
  return 'unknown';
}
