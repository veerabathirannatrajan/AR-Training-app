/**
 * Skeleton measurements and leg IK for the worker avatar (metres, avatar facing +z).
 * The rig's origin is the hip joint; standing, it sits THIGH + SHIN + ANKLE above the floor.
 */
export const RIG = {
  thigh: 0.42,
  shin: 0.39,
  /** Ankle joint above the bottom of the boot sole. */
  ankle: 0.09,
  /** Hip joints either side of the centre line. */
  hipX: 0.095,
  shoulderY: 0.49,
  upperArm: 0.28,
  forearm: 0.25,
  /** Top of the neck, where the head pivots. */
  neckTop: 0.6,
} as const;

export const HIP_HEIGHT = RIG.thigh + RIG.shin + RIG.ankle;

export interface LegAngles {
  /** Thigh rotation about x at the hip (negative swings the knee forward). */
  hip: number;
  /** Knee bend about x (positive folds the shin back). */
  knee: number;
  /** Ankle rotation that keeps the foot level. */
  ankle: number;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Two-bone IK in the leg's vertical plane: the angles that put the ankle `forward` metres in
 * front of the hip and `down` metres below it (out-of-reach targets give a straight leg).
 */
export function legAngles(forward: number, down: number): LegAngles {
  const a = RIG.thigh;
  const b = RIG.shin;
  const reach = clamp(Math.hypot(forward, down), Math.abs(a - b) + 1e-4, a + b - 1e-4);
  // Angle of the hip→ankle line from straight down, towards +z.
  const lineAngle = Math.atan2(forward, down);
  const hipBend = Math.acos(clamp((a * a + reach * reach - b * b) / (2 * a * reach), -1, 1));
  const kneeInside = Math.acos(clamp((a * a + b * b - reach * reach) / (2 * a * b), -1, 1));
  const hip = -(lineAngle + hipBend);
  const knee = Math.PI - kneeInside;
  return { hip, knee, ankle: -(hip + knee) };
}
