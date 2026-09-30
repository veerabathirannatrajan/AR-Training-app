import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { BoxGeometry, MeshStandardMaterial, type Mesh } from 'three';
import { PALETTE } from './palette';

export const CUBE_SIZE = 0.2;

// Shared by every cube: one geometry + one material keeps GPU uploads and draw state minimal.
const cubeGeometry = new BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
const cubeMaterial = new MeshStandardMaterial({
  color: PALETTE.safetyOrange,
  flatShading: true,
  roughness: 0.85,
  metalness: 0,
});

const POP_IN_SECONDS = 0.35;

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

interface LowPolyCubeProps {
  /** Point on the surface the cube rests on. */
  position: readonly [number, number, number];
  rotationY: number;
  /** When false the cube just spins in place (used on the start screen preview). */
  popIn?: boolean;
  spin?: boolean;
  scale?: number;
}

export function LowPolyCube({
  position,
  rotationY,
  popIn = true,
  spin = false,
  scale = 1,
}: LowPolyCubeProps) {
  const meshRef = useRef<Mesh>(null);
  const age = useRef(popIn ? 0 : POP_IN_SECONDS);

  useFrame((_state, delta) => {
    const mesh = meshRef.current;
    if (mesh == null) return;
    if (age.current < POP_IN_SECONDS) {
      age.current = Math.min(age.current + delta, POP_IN_SECONDS);
      mesh.scale.setScalar(scale * easeOutBack(age.current / POP_IN_SECONDS));
    }
    if (spin) {
      mesh.rotation.y += delta * 0.6;
      mesh.rotation.x += delta * 0.25;
    }
  });

  return (
    <mesh
      ref={meshRef}
      geometry={cubeGeometry}
      material={cubeMaterial}
      position={[position[0], position[1] + (CUBE_SIZE * scale) / 2, position[2]]}
      rotation-y={rotationY}
      scale={popIn ? 0.001 : scale}
    />
  );
}
