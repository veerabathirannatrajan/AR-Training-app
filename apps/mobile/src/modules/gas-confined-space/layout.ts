/**
 * Training-area layout for the Gas Leak & Confined Space module, in metres (local coordinates:
 * y = 0 is the floor, the worker stands on the +z side looking towards -z).
 *
 * The wind blows towards +x, so -x is upwind: the gas drifts right, past the pump panel, and
 * flows into the manhole on the right; gathering point 1 (left) is upwind, point 2 downwind.
 */
type Vec3 = readonly [number, number, number];
type Point = readonly [number, number];

export const AREA = { minX: -1.7, maxX: 1.75, minZ: -1.7, maxZ: 0.95 } as const;

// ---- Pipeline and leak ----
export const PIPE_Z = -1.35;
export const PIPE_Y = 0.3;
export const PIPE_RADIUS = 0.06;
export const PIPE_FROM_X = -1.65;
export const PIPE_TO_X = 1.7;
export const PIPE_SUPPORTS = [-1.3, -0.25, 0.75, 1.5] as const;
/** Flange joints along the pipe; the first one leaks. */
export const FLANGES = [-0.75, 0.25, 1.2] as const;
export const LEAK: Vec3 = [-0.75, PIPE_Y, PIPE_Z + 0.05];

// ---- Hazard zones (floor discs, drawn downwind of the leak) ----
export interface Zone {
  x: number;
  z: number;
  radius: number;
}
export const RED_ZONE: Zone = { x: -0.6, z: -1.1, radius: 0.4 };
export const AMBER_ZONE: Zone = { x: -0.35, z: -0.95, radius: 0.75 };

// ---- Valve pit ----
export const MANHOLE: Vec3 = [0.95, 0, -0.55];
export const MANHOLE_OPENING = 0.3;
export const MANHOLE_COLLAR = 0.42;
export const COLLAR_HEIGHT = 0.12;
/** Depth of the visible shaft (AR); the entrant climbs further down, out of sight. */
export const SHAFT_DEPTH = 0.6;
export const PIT_FLOOR_Y = -1.7;
export const MANHOLE_COVER: Vec3 = [1.5, 0, -0.95];

// ---- Evacuation ----
export const PUMP_PANEL: Vec3 = [0.1, 0, -0.95];
/** The pit-fan start button, relative to the panel's position. */
export const FAN_BUTTON: Vec3 = [-0.07, 1.14, 0.12];
export const WINDSOCK: Vec3 = [-1.42, 0, -0.55];
/** Upwind gathering point (safe). */
export const POINT_1: Vec3 = [-1.05, 0, 0.6];
/** Downwind gathering point (in the gas's path). */
export const POINT_2: Vec3 = [1.12, 0, 0.6];
export const PHONE_POST: Vec3 = [-0.62, 0, 0.75];

// ---- Entry kit (arrives once the line is shut off) ----
export const TRIPOD_HEIGHT = 1.7;
export const TRIPOD_SPREAD = 0.58;
/** Tripod feet around the manhole: back, front-left, front-right (with the winch). */
export const TRIPOD_FEET: readonly Vec3[] = [-Math.PI / 2, (5 * Math.PI) / 6, Math.PI / 6].map(
  (angle) =>
    [
      MANHOLE[0] + Math.cos(angle) * TRIPOD_SPREAD,
      0,
      MANHOLE[2] + Math.sin(angle) * TRIPOD_SPREAD,
    ] as const,
);
export const TRIPOD_APEX: Vec3 = [MANHOLE[0], TRIPOD_HEIGHT, MANHOLE[2]];
/** Where the lifeline leaves the tripod head. */
export const PULLEY_POINT: Vec3 = [MANHOLE[0], TRIPOD_HEIGHT - 0.1, MANHOLE[2]];
/** The leg the winch is mounted on (front-right), and how far up it is, from the foot. */
export const WINCH_LEG = 2;
export const WINCH_AT = 0.45;
export const BLOWER: Vec3 = [0.1, 0, -0.25];
/** Where the air hose leaves the blower, relative to the blower's position. */
export const BLOWER_OUTLET: Vec3 = [0.21, 0.17, 0];
/** Where the blower's air hose lies until it is dragged into the manhole. */
export const HOSE_REST: Vec3 = [0.5, 0.05, -0.02];
export const PERMIT_BOARD: Vec3 = [1.55, 0, -1.0];

/** Where the lifeline clips on, in WorkerAvatar body coordinates (hips at y = 0). */
export const D_RING: Vec3 = [0, 0.56, -0.155];

// ---- Crew positions (x, z) and facing (rotation.y) ----
export interface Spot {
  at: Point;
  facing: number;
}
// Spots keep the crew beside things rather than in front of them, so the panel, the manhole
// and Ravi himself (during the PPE step) stay in view from the worker's side (+z).

/** Beside the pump panel, reaching for it. */
export const RAVI_AT_PANEL: Spot = { at: [0.34, -0.78], facing: -2.19 };
/** Detour so the walk out of the gas stays clear of the red zone. */
export const RAVI_EXIT_VIA: Point = [-0.25, 0.05];
export const RAVI_AT_POINT_1: Spot = { at: [-0.82, 0.36], facing: 0.6 };
/** Where he suits up: upwind of the blower, facing the worker. */
export const RAVI_STAGING: Spot = { at: [-0.35, -0.3], facing: 0.3 };
/** Round the back of the blower on the way to the manhole. */
export const RAVI_TO_MANHOLE_VIA: Point = [0.05, -0.6];
/** At the manhole's upwind side, facing the opening. */
export const RAVI_AT_MANHOLE: Spot = { at: [0.48, -0.62], facing: Math.PI / 2 };
/** Laid down in fresh air in front of the manhole (feet here, head towards -x). */
export const RAVI_RESCUED: Spot = { at: [1.35, 0.3], facing: Math.PI / 2 };
export const SUNITA_ARRIVES_FROM: Point = [1.85, 0.85];
export const SUNITA_STANDBY: Spot = { at: [1.32, 0.12], facing: -Math.PI / 2 };
/** Beside the winch on the front-right tripod leg. */
export const SUNITA_AT_WINCH: Spot = { at: [1.65, 0.05], facing: -2.28 };
