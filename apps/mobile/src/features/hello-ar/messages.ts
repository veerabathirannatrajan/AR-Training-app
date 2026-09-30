import type { XRUnsupportedReason } from '@ar-training/shared';

export const UNSUPPORTED_REASON_TEXT: Record<XRUnsupportedReason, string> = {
  'insecure-context':
    'This page is not a secure context. Open it as http://localhost:5173 through adb reverse, or over HTTPS.',
  'no-webxr': 'This browser has no WebXR support. Use Chrome on Android.',
  'no-immersive-ar':
    'This phone does not support WebXR AR (it needs ARCore / Google Play Services for AR).',
  'check-failed': 'The AR support check failed. See the console (chrome://inspect) for details.',
  'forced-fallback': '3D mode was forced with ?mode=3d in the address.',
};
