/**
 * Crouch detection from phone height above the detected floor.
 *
 * Heights are relative to how the worker actually holds the phone, so the threshold scales
 * with their standing height: a worker holding the phone at 1.40 m must drop below 1.05 m;
 * someone seated at 1.05 m must drop below 0.75 m.
 */

/** Minimum drop below standing height that counts as crouching, in metres. */
export const MIN_CROUCH_DROP_M = 0.3;
/** Proportional drop, for taller holding heights. */
export const CROUCH_DROP_RATIO = 0.25;
/** Extra rise needed to leave the crouch, so the state does not flicker at the edge. */
export const CROUCH_HYSTERESIS_M = 0.06;
/** Plausible phone heights while standing; values outside are treated as tracking noise. */
export const STANDING_RANGE_M = { min: 0.8, max: 2.0 } as const;

export function crouchThreshold(standingHeight: number): number {
  return standingHeight - Math.max(MIN_CROUCH_DROP_M, standingHeight * CROUCH_DROP_RATIO);
}

export function nextCrouchState(
  height: number,
  standingHeight: number,
  wasCrouching: boolean,
): boolean {
  const threshold = crouchThreshold(standingHeight);
  return wasCrouching ? height < threshold + CROUCH_HYSTERESIS_M : height < threshold;
}

/** 0 when standing, 1 when at (or below) the crouch threshold. Drives the crouch meter. */
export function crouchDepth(height: number, standingHeight: number): number {
  const threshold = crouchThreshold(standingHeight);
  const range = standingHeight - threshold;
  if (range <= 0) return 0;
  return Math.min(1, Math.max(0, (standingHeight - height) / range));
}

export function clampStandingHeight(height: number): number {
  return Math.min(STANDING_RANGE_M.max, Math.max(STANDING_RANGE_M.min, height));
}
