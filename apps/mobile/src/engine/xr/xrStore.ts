import { createXRStore } from '@react-three/xr';
import { overlayRoot } from '../../lib/overlayRoot';

/**
 * Single XR store for the app, tuned for handheld AR on Android Chrome:
 * - never emulate a headset (unsupported phones must get the real 3D fallback),
 * - no controller/hand models (they are fetched from a CDN, which breaks offline),
 * - no library pointers: the engine's InputRouter handles screen touches itself so
 *   AR and 3D mode share one interaction path,
 * - hit-test required; dom-overlay uses our own UI root so React context is preserved.
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
  screenInput: false,
  transientPointer: false,
});
