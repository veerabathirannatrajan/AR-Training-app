import { createPortal, useFrame, useThree } from '@react-three/fiber';
import { useRef, type ReactNode } from 'react';
import type { Group } from 'three';

/**
 * Keeps its children fixed in view (like an item held in the worker's hand), in both AR and
 * 3D mode. Rendered at the scene root so the training area's placement does not affect it.
 * `offset` is in camera space: +x right, +y up, -z forward (metres).
 */
export function CameraAttached({
  offset,
  children,
}: {
  offset: readonly [number, number, number];
  children: ReactNode;
}) {
  const scene = useThree((state) => state.scene);
  const groupRef = useRef<Group>(null);

  // Runs before the other frame callbacks so everything that reads the held object's pose
  // (spray origin, raycasts) sees this frame's position.
  useFrame(({ camera, gl }) => {
    const group = groupRef.current;
    if (group == null) return;
    // In AR, three.js only copies the headset pose into the camera during render; pull it in
    // now so the held object does not trail one frame behind the phone.
    if (gl.xr.isPresenting) gl.xr.updateCamera(camera as never);
    camera.updateMatrixWorld();
    camera.matrixWorld.decompose(group.position, group.quaternion, group.scale);
    group.scale.setScalar(1);
    group.translateX(offset[0]);
    group.translateY(offset[1]);
    group.translateZ(offset[2]);
  }, -1);

  return createPortal(<group ref={groupRef}>{children}</group>, scene);
}
