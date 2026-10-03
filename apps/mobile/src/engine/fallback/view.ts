/** Where the 3D-mode camera starts and what it orbits around (training-area coordinates). */
export interface FallbackView {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
}

export const DEFAULT_FALLBACK_VIEW: FallbackView = {
  position: [0, 1.6, 2.4],
  target: [0, 0.6, 0],
};

/** Vertical field of view in 3D mode, degrees: wider than the AR camera. */
export const FALLBACK_FOV = 72;
/** On portrait screens the view widens so at least this much is visible side to side. */
export const MIN_HORIZONTAL_FOV = 52;

/** Vertical field of view for a screen aspect (width / height), degrees. */
export function fallbackFov(aspect: number): number {
  const halfWidth = Math.tan((MIN_HORIZONTAL_FOV * Math.PI) / 360);
  const forWidth = (Math.atan(halfWidth / Math.max(aspect, 0.1)) * 360) / Math.PI;
  return Math.max(FALLBACK_FOV, forWidth);
}
