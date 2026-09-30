import { forwardRef, type ReactNode } from 'react';
import type { Group } from 'three';
import { flatMaterial } from '../../engine/materials';
import { PALETTE } from '../../engine/palette';

/*
 * Low-poly props for the AR Basics training area, built from primitives (no downloaded
 * models). Each prop is modelled with its base on y = 0 so it can be placed on the mat.
 */

export const MAT_RADIUS = 1.0;
export const MAT_HEIGHT = 0.02;

export function TrainingMat() {
  return (
    <group>
      <mesh position-y={MAT_HEIGHT / 2} material={flatMaterial(PALETTE.matte)}>
        <cylinderGeometry args={[MAT_RADIUS, MAT_RADIUS, MAT_HEIGHT, 8]} />
      </mesh>
      <mesh position-y={MAT_HEIGHT / 2 - 0.002} material={flatMaterial(PALETTE.safetyOrange)}>
        <cylinderGeometry args={[MAT_RADIUS + 0.04, MAT_RADIUS + 0.04, MAT_HEIGHT, 8]} />
      </mesh>
    </group>
  );
}

interface PropProps {
  position: readonly [number, number, number];
  children?: ReactNode;
}

export const SafetyCone = forwardRef<Group, PropProps>(function SafetyCone({ position }, ref) {
  return (
    <group ref={ref} position={[position[0], position[1], position[2]]}>
      <mesh position-y={0.015} material={flatMaterial(PALETTE.safetyOrangeDark)}>
        <boxGeometry args={[0.28, 0.03, 0.28]} />
      </mesh>
      <mesh position-y={0.21} material={flatMaterial(PALETTE.safetyOrange)}>
        <coneGeometry args={[0.11, 0.36, 8]} />
      </mesh>
      <mesh position-y={0.17} material={flatMaterial(PALETTE.white)}>
        <cylinderGeometry args={[0.078, 0.086, 0.04, 8]} />
      </mesh>
      <mesh position-y={0.26} material={flatMaterial(PALETTE.white)}>
        <cylinderGeometry args={[0.05, 0.058, 0.035, 8]} />
      </mesh>
    </group>
  );
});

export const Crate = forwardRef<Group, PropProps>(function Crate({ position }, ref) {
  return (
    <group ref={ref} position={[position[0], position[1], position[2]]}>
      <mesh position-y={0.16} material={flatMaterial(PALETTE.wood)}>
        <boxGeometry args={[0.34, 0.32, 0.34]} />
      </mesh>
      {[-0.1, 0.1].map((y) => (
        <mesh key={y} position={[0, 0.16 + y, 0.172]} material={flatMaterial(PALETTE.woodDark)}>
          <boxGeometry args={[0.34, 0.04, 0.01]} />
        </mesh>
      ))}
      <mesh
        position={[0, 0.16, 0.172]}
        rotation-z={Math.PI / 4}
        material={flatMaterial(PALETTE.woodDark)}
      >
        <boxGeometry args={[0.4, 0.035, 0.01]} />
      </mesh>
    </group>
  );
});

export const Barrel = forwardRef<Group, PropProps>(function Barrel({ position }, ref) {
  return (
    <group ref={ref} position={[position[0], position[1], position[2]]}>
      <mesh position-y={0.21} material={flatMaterial('#2f6fb3')}>
        <cylinderGeometry args={[0.14, 0.14, 0.42, 8]} />
      </mesh>
      {[0.1, 0.32].map((y) => (
        <mesh key={y} position-y={y} material={flatMaterial('#1f4f82')}>
          <cylinderGeometry args={[0.147, 0.147, 0.025, 8]} />
        </mesh>
      ))}
    </group>
  );
});

/** Safety helmet; origin at the underside of the brim. */
export const Helmet = forwardRef<Group, PropProps>(function Helmet({ position }, ref) {
  return (
    <group ref={ref} position={[position[0], position[1], position[2]]}>
      <mesh position-y={0.008} material={flatMaterial(PALETTE.safetyYellow)}>
        <cylinderGeometry args={[0.165, 0.165, 0.016, 10]} />
      </mesh>
      <mesh position-y={0.012} material={flatMaterial(PALETTE.safetyYellow)}>
        <sphereGeometry args={[0.125, 10, 5, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      {/* Raised ridge along the crown, kept inside the dome's outline. */}
      <mesh position-y={0.118} material={flatMaterial('#f2b21f')}>
        <boxGeometry args={[0.028, 0.03, 0.14]} />
      </mesh>
    </group>
  );
});

export const STAND_TOP = 0.78;

export function HelmetStand({ position }: PropProps) {
  return (
    <group position={[position[0], position[1], position[2]]}>
      <mesh position-y={0.015} material={flatMaterial(PALETTE.steelDark)}>
        <cylinderGeometry args={[0.14, 0.16, 0.03, 8]} />
      </mesh>
      <mesh position-y={STAND_TOP / 2} material={flatMaterial(PALETTE.steel)}>
        <cylinderGeometry args={[0.025, 0.025, STAND_TOP, 6]} />
      </mesh>
      <mesh position-y={STAND_TOP - 0.01} material={flatMaterial(PALETTE.steelDark)}>
        <cylinderGeometry args={[0.1, 0.1, 0.02, 8]} />
      </mesh>
    </group>
  );
}

export const TARGET_HEIGHT = 1.15;

/** Round target board on a post, facing the worker (+z). The ref marks the bullseye. */
export const TargetBoard = forwardRef<Group, PropProps>(function TargetBoard({ position }, ref) {
  return (
    <group position={[position[0], position[1], position[2]]}>
      <mesh position-y={TARGET_HEIGHT / 2} material={flatMaterial(PALETTE.steel)}>
        <boxGeometry args={[0.05, TARGET_HEIGHT, 0.05]} />
      </mesh>
      <group ref={ref} position={[0, TARGET_HEIGHT, 0.04]} rotation-x={Math.PI / 2}>
        <mesh material={flatMaterial(PALETTE.critical)}>
          <cylinderGeometry args={[0.22, 0.22, 0.03, 12]} />
        </mesh>
        <mesh position-y={0.01} material={flatMaterial(PALETTE.white)}>
          <cylinderGeometry args={[0.15, 0.15, 0.03, 12]} />
        </mesh>
        <mesh position-y={0.02} material={flatMaterial(PALETTE.critical)}>
          <cylinderGeometry args={[0.075, 0.075, 0.03, 12]} />
        </mesh>
      </group>
    </group>
  );
});
