import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import { Vector3 } from 'three';
import { nextCrouchState } from './crouch';
import { engine } from './engineStore';
import { useSceneRoot } from './sceneRootContext';

const SMOOTHING = 0.2;
const PUBLISH_INTERVAL_S = 0.125;

const cameraPosition = new Vector3();
const rootPosition = new Vector3();

/**
 * Phone height above the detected floor (AR: camera y minus the placed area's y, which sits
 * on the hit-tested floor). Drives crouch detection. In 3D mode, crouching is the Crouch button.
 */
export function HeightTracker() {
  const camera = useThree((state) => state.camera);
  const rootRef = useSceneRoot();
  const smoothed = useRef<number | null>(null);
  const lastPublished = useRef(0);

  useFrame(({ clock }) => {
    const state = engine();

    if (state.mode === 'ar') {
      if (state.placement !== 'placed' || rootRef.current == null) {
        smoothed.current = null;
        return;
      }
      camera.getWorldPosition(cameraPosition);
      rootRef.current.getWorldPosition(rootPosition);
      const height = cameraPosition.y - rootPosition.y;
      smoothed.current =
        smoothed.current == null
          ? height
          : smoothed.current + (height - smoothed.current) * SMOOTHING;

      if (state.standingHeight != null) {
        const crouching = nextCrouchState(smoothed.current, state.standingHeight, state.crouching);
        if (crouching !== state.crouching) state.setCrouching(crouching);
      }
    } else {
      camera.getWorldPosition(cameraPosition);
      smoothed.current = cameraPosition.y;
      if (state.crouching !== state.crouchHeld) state.setCrouching(state.crouchHeld);
    }

    const now = clock.elapsedTime;
    if (now - lastPublished.current >= PUBLISH_INTERVAL_S) {
      lastPublished.current = now;
      const value = Math.round(smoothed.current * 100) / 100;
      if (state.deviceHeight !== value) state.setDeviceHeight(value);
    }
  });

  return null;
}
