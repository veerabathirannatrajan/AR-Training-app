/** Where the 3D-mode camera starts and what it orbits around (training-area coordinates). */
export interface FallbackView {
  position: readonly [number, number, number];
  target: readonly [number, number, number];
}

export const DEFAULT_FALLBACK_VIEW: FallbackView = {
  position: [0, 1.6, 2.4],
  target: [0, 0.6, 0],
};
