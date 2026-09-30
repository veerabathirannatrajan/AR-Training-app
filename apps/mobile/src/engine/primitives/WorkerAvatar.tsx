import { useFrame } from '@react-three/fiber';
import { forwardRef, useRef } from 'react';
import type { Group } from 'three';
import { flatMaterial } from '../materials';
import { PALETTE } from '../palette';

const SKIN = '#b9825a';
const TROUSERS = '#2f3a4a';
const VEST = '#ff7a1a';
const STRIPE = '#e8eef2';
const BOOTS = '#1f2328';

/** Pose inputs read every frame, so the avatar animates without React re-renders. */
export interface AvatarPose {
  /** Metres per second along the route (drives the walk cycle). */
  speed: number;
  /** 0 = standing, 1 = fully crouched. */
  crouch: number;
  /** 0..1 coughing shake when standing in smoke. */
  distress: number;
}

/**
 * Low-poly site worker (hard hat, hi-vis vest), about 1.7 m tall, facing +z. Walks, crouches
 * and coughs from a mutable pose.
 */
export const WorkerAvatar = forwardRef<
  Group,
  { pose: { current: AvatarPose }; helmetColor?: string }
>(function WorkerAvatar({ pose, helmetColor = PALETTE.safetyYellow }, ref) {
  const body = useRef<Group>(null);
  const leftLeg = useRef<Group>(null);
  const rightLeg = useRef<Group>(null);
  const leftArm = useRef<Group>(null);
  const rightArm = useRef<Group>(null);
  const phase = useRef(0);
  const crouch = useRef(0);

  useFrame(({ clock }, delta) => {
    const { speed, crouch: targetCrouch, distress } = pose.current;
    phase.current += delta * speed * 9;
    crouch.current += (targetCrouch - crouch.current) * Math.min(1, delta * 6);
    const c = crouch.current;
    const swing = Math.sin(phase.current) * Math.min(1, speed * 3) * 0.6;

    if (body.current != null) {
      // Crouching lowers the hips (legs fold to half height) and leans the torso forward.
      body.current.position.y =
        0.9 - c * 0.45 + Math.abs(Math.sin(phase.current)) * 0.02 * Math.min(1, speed * 3);
      body.current.rotation.x = c * 0.5 + Math.sin(clock.elapsedTime * 18) * distress * 0.06;
    }
    for (const [leg, direction] of [
      [leftLeg.current, 1],
      [rightLeg.current, -1],
    ] as const) {
      if (leg == null) continue;
      leg.rotation.x = direction * swing * (1 - c * 0.5) - c * 0.5;
      leg.scale.y = 1 - c * 0.5;
    }
    if (leftArm.current != null)
      leftArm.current.rotation.x = -swing * 0.8 - c * 0.3 - distress * 1.2;
    if (rightArm.current != null) rightArm.current.rotation.x = swing * 0.8 - c * 0.3;
  });

  return (
    <group ref={ref}>
      <group ref={body} position-y={0.9}>
        {/* Legs hang from the hips. */}
        <group ref={leftLeg} position={[-0.09, 0, 0]}>
          <mesh position-y={-0.42} material={flatMaterial(TROUSERS)}>
            <boxGeometry args={[0.13, 0.8, 0.15]} />
          </mesh>
          <mesh position={[0, -0.85, 0.04]} material={flatMaterial(BOOTS)}>
            <boxGeometry args={[0.14, 0.1, 0.24]} />
          </mesh>
        </group>
        <group ref={rightLeg} position={[0.09, 0, 0]}>
          <mesh position-y={-0.42} material={flatMaterial(TROUSERS)}>
            <boxGeometry args={[0.13, 0.8, 0.15]} />
          </mesh>
          <mesh position={[0, -0.85, 0.04]} material={flatMaterial(BOOTS)}>
            <boxGeometry args={[0.14, 0.1, 0.24]} />
          </mesh>
        </group>
        {/* Torso with hi-vis vest. */}
        <mesh position-y={0.28} material={flatMaterial(VEST)}>
          <boxGeometry args={[0.36, 0.56, 0.22]} />
        </mesh>
        <mesh position={[0, 0.2, 0.112]} material={flatMaterial(STRIPE)}>
          <boxGeometry args={[0.37, 0.05, 0.01]} />
        </mesh>
        <mesh position={[0, 0.36, 0.112]} material={flatMaterial(STRIPE)}>
          <boxGeometry args={[0.37, 0.05, 0.01]} />
        </mesh>
        <group ref={leftArm} position={[-0.23, 0.52, 0]}>
          <mesh position-y={-0.26} material={flatMaterial(VEST)}>
            <boxGeometry args={[0.1, 0.52, 0.12]} />
          </mesh>
        </group>
        <group ref={rightArm} position={[0.23, 0.52, 0]}>
          <mesh position-y={-0.26} material={flatMaterial(VEST)}>
            <boxGeometry args={[0.1, 0.52, 0.12]} />
          </mesh>
        </group>
        {/* Head and hard hat. */}
        <mesh position-y={0.7} material={flatMaterial(SKIN)}>
          <icosahedronGeometry args={[0.12, 0]} />
        </mesh>
        <mesh position-y={0.76} material={flatMaterial(helmetColor)}>
          <sphereGeometry args={[0.135, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <mesh position={[0, 0.765, 0.02]} material={flatMaterial(helmetColor)}>
          <cylinderGeometry args={[0.16, 0.16, 0.012, 8]} />
        </mesh>
      </group>
    </group>
  );
});
