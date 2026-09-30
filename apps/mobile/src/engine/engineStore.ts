import type { RenderMode } from '@ar-training/shared';
import { create } from 'zustand';
import { clampStandingHeight } from './crouch';

export type PlacementPhase = 'searching' | 'surface-found' | 'placed';

/**
 * What a one-finger drag on empty space does in AR:
 * - `rotate`: turns the training area (default),
 * - `swipe`: feeds `signals.swipe` (e.g. sweeping an extinguisher) and leaves the area still.
 */
export type GestureMode = 'rotate' | 'swipe';

/**
 * High-frequency input that scenes consume every frame (not React state):
 * `swipe` accumulates signed horizontal swipe, in radians of ray heading, until read.
 */
export const signals = { swipe: 0 };

/** Reads and clears the accumulated swipe. */
export function takeSwipe(): number {
  const value = signals.swipe;
  signals.swipe = 0;
  return value;
}

/**
 * Engine state shared between the 3D world (inside the Canvas) and the HUD (DOM overlay).
 * Per-frame values are published at a low rate by the systems that own them, so the HUD
 * never re-renders every frame.
 */
interface EngineState {
  mode: RenderMode;
  placement: PlacementPhase;
  /** Set by a tap; the AR placement system consumes it on the next hit-test frame. */
  placeRequested: boolean;
  /** Extra user rotation of the training area, radians (AR drag / twist). */
  sceneYaw: number;
  /** Total turning (radians, absolute) since the meter was reset; drives "turn the area" steps. */
  turnMeter: number;
  /** Phone height above the detected floor in metres (AR), or camera height (3D mode). */
  deviceHeight: number | null;
  standingHeight: number | null;
  crouching: boolean;
  /** 3D mode: the Crouch button is held. */
  crouchHeld: boolean;
  /** HUD Hold button (press-and-hold actions such as squeezing an extinguisher). */
  holdPressed: boolean;
  /** HUD Move button (walking an avatar along a route). */
  movePressed: boolean;
  gestureMode: GestureMode;
  /** 3D mode: a module is steering the camera (e.g. following an avatar); orbit and crouch-eye stay off. */
  cameraDirected: boolean;
  aimedTargetId: string | null;
  /** Some aim target is enabled, so the crosshair is in use (3D mode switches to look-around). */
  aimActive: boolean;
  draggingId: string | null;
  gyroEnabled: boolean;
  gyroAvailable: boolean;

  reset: (mode: RenderMode) => void;
  requestPlace: () => void;
  confirmPlaced: () => void;
  requestReposition: () => void;
  setSurfaceFound: (found: boolean) => void;
  rotateScene: (delta: number) => void;
  addTurn: (radians: number) => void;
  resetTurnMeter: () => void;
  setDeviceHeight: (height: number | null) => void;
  /** Standing baseline for crouch detection; null clears it (recalibration). */
  setStandingHeight: (height: number | null) => void;
  setCrouching: (crouching: boolean) => void;
  setCrouchHeld: (held: boolean) => void;
  setHoldPressed: (pressed: boolean) => void;
  setMovePressed: (pressed: boolean) => void;
  setGestureMode: (mode: GestureMode) => void;
  setCameraDirected: (directed: boolean) => void;
  setAimedTarget: (id: string | null) => void;
  setAimActive: (active: boolean) => void;
  setDragging: (id: string | null) => void;
  setGyroEnabled: (enabled: boolean) => void;
  setGyroAvailable: (available: boolean) => void;
}

const initial = (mode: RenderMode) => ({
  mode,
  placement: (mode === 'ar' ? 'searching' : 'placed') as PlacementPhase,
  placeRequested: false,
  sceneYaw: 0,
  turnMeter: 0,
  deviceHeight: null,
  standingHeight: null,
  crouching: false,
  crouchHeld: false,
  holdPressed: false,
  movePressed: false,
  gestureMode: 'rotate' as GestureMode,
  cameraDirected: false,
  aimedTargetId: null,
  aimActive: false,
  draggingId: null,
  gyroEnabled: false,
});

export const useEngineStore = create<EngineState>()((set) => ({
  ...initial('fallback3d'),
  gyroAvailable: false,

  reset: (mode) => {
    signals.swipe = 0;
    set(initial(mode));
  },
  requestPlace: () => set({ placeRequested: true }),
  // A fresh placement faces the worker, so any earlier user rotation is dropped.
  confirmPlaced: () => set({ placement: 'placed', placeRequested: false, sceneYaw: 0 }),
  requestReposition: () => set({ placement: 'searching', placeRequested: false }),
  setSurfaceFound: (found) =>
    set((state) =>
      state.placement === 'placed' ? {} : { placement: found ? 'surface-found' : 'searching' },
    ),
  rotateScene: (delta) => set((state) => ({ sceneYaw: state.sceneYaw + delta })),
  addTurn: (radians) => set((state) => ({ turnMeter: state.turnMeter + Math.abs(radians) })),
  resetTurnMeter: () => set({ turnMeter: 0 }),
  setDeviceHeight: (deviceHeight) => set({ deviceHeight }),
  setStandingHeight: (height) =>
    set({ standingHeight: height == null ? null : clampStandingHeight(height), crouching: false }),
  setCrouching: (crouching) => set({ crouching }),
  setCrouchHeld: (crouchHeld) => set({ crouchHeld }),
  setHoldPressed: (holdPressed) => set({ holdPressed }),
  setMovePressed: (movePressed) => set({ movePressed }),
  setGestureMode: (gestureMode) => set({ gestureMode }),
  setCameraDirected: (cameraDirected) => set({ cameraDirected }),
  setAimedTarget: (aimedTargetId) => set({ aimedTargetId }),
  setAimActive: (aimActive) => set({ aimActive }),
  setDragging: (draggingId) => set({ draggingId }),
  setGyroEnabled: (gyroEnabled) => set({ gyroEnabled }),
  setGyroAvailable: (gyroAvailable) => set({ gyroAvailable }),
}));

/** Non-reactive access for per-frame code. */
export const engine = () => useEngineStore.getState();
