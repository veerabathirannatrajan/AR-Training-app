/**
 * How a training scene is rendered.
 * - `ar`: WebXR immersive-ar session over the camera feed.
 * - `fallback3d`: the same scene in a simple 3D room (touch orbit + gyro look)
 *   for phones without WebXR AR support. Steps and scoring are identical.
 */
export type RenderMode = 'ar' | 'fallback3d';

/** Why immersive AR is unavailable. The UI maps these codes to localised text. */
export type XRUnsupportedReason =
  'insecure-context' | 'no-webxr' | 'no-immersive-ar' | 'check-failed' | 'forced-fallback';

export interface XRCapabilities {
  secureContext: boolean;
  webxrAvailable: boolean;
  immersiveAr: boolean;
  unsupportedReason: XRUnsupportedReason | null;
}
