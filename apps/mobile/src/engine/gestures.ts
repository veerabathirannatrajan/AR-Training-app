/**
 * Gesture maths shared by AR and 3D mode. Pointers are world-space rays, so the same code
 * works for WebXR screen touches and for mouse/touch events on the 3D canvas.
 */

export interface Vec3Like {
  x: number;
  y: number;
  z: number;
}

/** A one-finger horizontal drag across the full screen turns the area about half a circle. */
export const DRAG_ROTATE_GAIN = 3;

/** A press whose ray swings more than this is a drag, not a tap (about 25px on a phone). */
export const TAP_MAX_ANGLE_RAD = (1.5 * Math.PI) / 180;
export const TAP_MAX_MS = 600;

/** Heading of a direction around the vertical axis, matching three.js rotation.y. */
export function headingOf(direction: Vec3Like): number {
  return Math.atan2(direction.x, direction.z);
}

/** Smallest signed difference b - a, in (-π, π]. */
export function angleDelta(a: number, b: number): number {
  let delta = (b - a) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta <= -Math.PI) delta += Math.PI * 2;
  return delta;
}

/**
 * Scene yaw change for a one-finger drag. Moving the finger right swings the ray clockwise
 * (seen from above), and the front of the area should follow the finger to the right,
 * which is a counter-clockwise (positive) rotation of the scene.
 */
export function dragRotateDelta(previous: Vec3Like, current: Vec3Like): number {
  return -angleDelta(headingOf(previous), headingOf(current)) * DRAG_ROTATE_GAIN;
}

/** Scene yaw change for a two-finger twist, from where each finger's ray meets the floor. */
export function twistDelta(
  previousA: Vec3Like,
  previousB: Vec3Like,
  currentA: Vec3Like,
  currentB: Vec3Like,
): number {
  const before = Math.atan2(previousB.x - previousA.x, previousB.z - previousA.z);
  const after = Math.atan2(currentB.x - currentA.x, currentB.z - currentA.z);
  return angleDelta(before, after);
}

/** Angle between two unit vectors. */
export function angleBetween(a: Vec3Like, b: Vec3Like): number {
  const dot = a.x * b.x + a.y * b.y + a.z * b.z;
  return Math.acos(Math.min(1, Math.max(-1, dot)));
}

/**
 * Where a ray meets the horizontal plane y = planeY, or null if it points away from it
 * (or runs almost parallel, which would throw the point far away).
 */
export function intersectHorizontalPlane(
  origin: Vec3Like,
  direction: Vec3Like,
  planeY: number,
): Vec3Like | null {
  if (Math.abs(direction.y) < 1e-3) return null;
  const t = (planeY - origin.y) / direction.y;
  if (t <= 0) return null;
  return { x: origin.x + direction.x * t, y: planeY, z: origin.z + direction.z * t };
}
