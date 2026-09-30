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

/** Turns a requestSession() rejection into a message a worker (or tester) can act on. */
export function describeARStartError(error: unknown): string {
  if (error instanceof DOMException) {
    switch (error.name) {
      case 'NotAllowedError':
        return 'Camera access was denied. Allow camera permission for this site in Chrome settings and try again.';
      case 'NotSupportedError':
        return 'This phone cannot start an AR session with floor tracking. Use 3D mode instead.';
      case 'SecurityError':
        return 'AR needs a secure page (http://localhost or HTTPS) and must be started by a tap.';
      case 'InvalidStateError':
        return 'An AR session is already running. Close it and try again.';
    }
  }
  return error instanceof Error ? error.message : 'AR could not start for an unknown reason.';
}
