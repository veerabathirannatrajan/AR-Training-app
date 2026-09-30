import { useFrame, useThree } from '@react-three/fiber';
import { Vector3, type Object3D } from 'three';
import { engine } from './engineStore';
import { useInteractionRegistry } from './interaction';

const cameraPosition = new Vector3();
const forward = new Vector3();
const center = new Vector3();
const toTarget = new Vector3();

function visibleInWorld(object: Object3D): boolean {
  for (let node: Object3D | null = object; node != null; node = node.parent) {
    if (!node.visible) return false;
  }
  return true;
}

/**
 * Aiming with the phone itself: a ray from the centre of the screen (the crosshair) along the
 * camera's forward direction. A target counts as aimed at when the crosshair is within its
 * radius, so aiming gets stricter the further away the worker stands.
 */
export function AimSystem() {
  const registry = useInteractionRegistry();
  const camera = useThree((state) => state.camera);

  useFrame(() => {
    camera.getWorldPosition(cameraPosition);
    camera.getWorldDirection(forward);

    let bestId: string | null = null;
    let bestScore = 1;
    let anyEnabled = false;
    for (const target of registry.aimTargets) {
      const config = target.config.current;
      if (!config.enabled || !visibleInWorld(target.object)) continue;
      anyEnabled = true;
      target.object.getWorldPosition(center);
      toTarget.subVectors(center, cameraPosition);
      const distance = toTarget.length();
      if (distance < 0.05) continue;
      const score = forward.angleTo(toTarget) / Math.atan(config.radius / distance);
      if (score < bestScore) {
        bestScore = score;
        bestId = config.id;
      }
    }

    const state = engine();
    if (state.aimedTargetId !== bestId) state.setAimedTarget(bestId);
    if (state.aimActive !== anyEnabled) state.setAimActive(anyEnabled);
  });

  return null;
}
