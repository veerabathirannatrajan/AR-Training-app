import { createXRStore } from '@react-three/xr';
import { overlayRoot } from '../lib/overlayRoot';

/**
 * Single XR store for the app. Tuned for handheld AR on Android Chrome:
 * - never emulate a headset (desktop/unsupported phones must get the real 3D fallback),
 * - no controller/hand models (they would be fetched from a CDN, which breaks offline),
 * - hit-test is required; dom-overlay uses our own UI root so React context is preserved.
 */
export const xrStore = createXRStore({
  emulate: false,
  offerSession: false,
  enterGrantedSession: false,
  domOverlay: overlayRoot,
  hitTest: 'required',
  anchors: true,
  handTracking: false,
  bodyTracking: false,
  layers: false,
  meshDetection: false,
  planeDetection: false,
  depthSensing: false,
  hand: false,
  controller: false,
  gaze: false,
});
