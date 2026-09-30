import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { Vector3 } from 'three';
import { usePlacementStore } from './placementStore';

const SAMPLE_SECONDS = 0.5;
const cameraPosition = new Vector3();

/** Samples FPS and phone height twice per second (not per frame, to avoid re-rendering the UI). */
export function FrameTelemetrySampler() {
  const frames = useRef(0);
  const elapsed = useRef(0);

  useFrame((state, delta) => {
    frames.current += 1;
    elapsed.current += delta;
    if (elapsed.current < SAMPLE_SECONDS) return;

    const fps = Math.round(frames.current / elapsed.current);
    frames.current = 0;
    elapsed.current = 0;

    const { floorY, setTelemetry } = usePlacementStore.getState();
    state.camera.getWorldPosition(cameraPosition);
    setTelemetry({
      fps,
      heightAboveFloor: floorY == null ? null : cameraPosition.y - floorY,
      referenceSpaceY: cameraPosition.y,
    });
  });

  return null;
}
