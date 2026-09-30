import { create } from 'zustand';

export const MAX_CUBES = 12;

export interface PlacedCube {
  id: number;
  /** Point on the detected surface where the cube rests. */
  position: [number, number, number];
  rotationY: number;
}

export interface FrameTelemetry {
  fps: number;
  /** Camera height above the surface the first cube was placed on, in metres. */
  heightAboveFloor: number | null;
  /** Camera Y in the XR reference space (local-floor), for comparing floor estimates. */
  referenceSpaceY: number;
}

interface PlacementState {
  cubes: PlacedCube[];
  surfaceFound: boolean;
  /** Y of the surface where the first cube was placed; used as the floor for height tracking. */
  floorY: number | null;
  telemetry: FrameTelemetry;
  placeCube: (position: [number, number, number], rotationY: number) => void;
  clear: () => void;
  setSurfaceFound: (found: boolean) => void;
  setTelemetry: (telemetry: FrameTelemetry) => void;
}

let nextId = 1;

export const usePlacementStore = create<PlacementState>()((set) => ({
  cubes: [],
  surfaceFound: false,
  floorY: null,
  telemetry: { fps: 0, heightAboveFloor: null, referenceSpaceY: 0 },
  placeCube: (position, rotationY) =>
    set((state) => ({
      cubes: [...state.cubes, { id: nextId++, position, rotationY }].slice(-MAX_CUBES),
      floorY: state.floorY ?? position[1],
    })),
  clear: () => set({ cubes: [], floorY: null, surfaceFound: false }),
  setSurfaceFound: (surfaceFound) => set({ surfaceFound }),
  setTelemetry: (telemetry) => set({ telemetry }),
}));
