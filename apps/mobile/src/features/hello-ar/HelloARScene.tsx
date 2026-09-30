import { useThree } from '@react-three/fiber';
import { useXRHitTest, useXRInputSourceEvent } from '@react-three/xr';
import { useEffect, useRef } from 'react';
import { Matrix4, Quaternion, Vector3, type Group } from 'three';
import { Reticle } from '../../three/Reticle';
import { SceneLights } from '../../three/SceneLights';
import { FrameTelemetrySampler } from './FrameTelemetrySampler';
import { PlacedCubes } from './PlacedCubes';
import { usePlacementStore } from './placementStore';

/** Surfaces whose normal is within 25 degrees of straight up count as floor-like. */
const MIN_UP_DOT = Math.cos((25 * Math.PI) / 180);

const hitMatrix = new Matrix4();
const hitPosition = new Vector3();
const hitRotation = new Quaternion();
const hitScale = new Vector3();
const surfaceNormal = new Vector3();
const cameraPosition = new Vector3();

/** Phase 0 "Hello AR": hit-test reticle on the floor, tap anywhere to drop a low-poly cube. */
export function HelloARScene() {
  const reticleRef = useRef<Group>(null);
  const surfaceFound = useRef(false);
  const camera = useThree((state) => state.camera);

  useXRHitTest(
    (results, getWorldMatrix) => {
      const reticle = reticleRef.current;
      if (reticle == null) return;

      let found = false;
      // Results are ordered nearest first; take the first upward-facing surface.
      for (const result of results) {
        if (!getWorldMatrix(hitMatrix, result)) continue;
        hitMatrix.decompose(hitPosition, hitRotation, hitScale);
        surfaceNormal.set(0, 1, 0).applyQuaternion(hitRotation);
        if (surfaceNormal.y < MIN_UP_DOT) continue;
        reticle.position.copy(hitPosition);
        found = true;
        break;
      }

      reticle.visible = found;
      if (found !== surfaceFound.current) {
        surfaceFound.current = found;
        usePlacementStore.getState().setSurfaceFound(found);
      }
    },
    'viewer',
    'plane',
  );

  // A screen tap in handheld AR arrives as an XR "select" (taps on UI panels are filtered out).
  useXRInputSourceEvent(
    'all',
    'select',
    () => {
      const reticle = reticleRef.current;
      if (reticle == null || !reticle.visible) return;
      camera.getWorldPosition(cameraPosition);
      const { x, y, z } = reticle.position;
      const faceCamera = Math.atan2(cameraPosition.x - x, cameraPosition.z - z);
      usePlacementStore.getState().placeCube([x, y, z], faceCamera);
    },
    [camera],
  );

  // AR coordinates only mean something inside this session.
  useEffect(() => () => usePlacementStore.getState().clear(), []);

  return (
    <>
      <SceneLights />
      <Reticle ref={reticleRef} />
      <PlacedCubes />
      <FrameTelemetrySampler />
    </>
  );
}
