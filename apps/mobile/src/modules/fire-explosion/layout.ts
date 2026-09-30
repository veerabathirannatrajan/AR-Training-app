/**
 * Training-area layout for the Fire module, in metres (local coordinates: y = 0 is the floor,
 * the worker stands on the +z side looking towards -z).
 */
type Vec3 = readonly [number, number, number];
type Point = readonly [number, number];

export const WORKSTATION: Vec3 = [0, 0, -0.55];
export const DESK_HEIGHT = 0.76;
export const FIRE_BASE: Vec3 = [0, DESK_HEIGHT + 0.02, -0.55];
export const POWER_STRIP: Vec3 = [-0.32, 0, -0.32];
export const CALL_POINT: Vec3 = [0.85, 0, 0.0];
export const RACK: Vec3 = [-0.8, 0, 0.15];
export const RACK_SLOTS = [-0.25, -0.083, 0.083, 0.25] as const;
export const EXIT_A: Vec3 = [-1.25, 0, -1.45];
export const LIFT: Vec3 = [0.3, 0, -1.5];
export const EXIT_B: Vec3 = [1.3, 0, -1.45];
export const ASSEMBLY: Vec3 = [2.05, 0, -2.25];

/** Where the avatar (the worker) starts evacuating from. */
export const AVATAR_START: Point = [0.05, 0.55];

/** First route: towards Exit A (it becomes blocked part-way). */
export const ROUTE_TO_EXIT_A: readonly Point[] = [
  AVATAR_START,
  [-0.6, 0.35],
  [-1.05, -0.35],
  [-1.25, -1.2],
];
/** Share of the first route walked when the fire blocks Exit A. */
export const BLOCK_AT = 0.62;

/** Second route: from wherever the avatar stopped, via Exit B to the assembly point. */
export const ROUTE_TO_EXIT_B_TAIL: readonly Point[] = [
  [-0.35, 0.3],
  [0.75, 0.3],
  [1.2, -0.45],
  [1.3, -1.3],
  [1.7, -1.95],
  [ASSEMBLY[0] - 0.25, ASSEMBLY[2] + 0.2],
];
/** Beyond this z the avatar is outside, clear of the smoke. */
export const OUTSIDE_Z = -1.5;

export const AREA = { minX: -1.7, maxX: 1.75, minZ: -1.7, maxZ: 0.95 } as const;
