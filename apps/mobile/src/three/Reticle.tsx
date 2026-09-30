import { useFrame } from '@react-three/fiber';
import { forwardRef, useRef } from 'react';
import type { Group, Mesh } from 'three';
import { PALETTE } from './palette';

/**
 * Floor reticle: a flat ring with a centre dot. The parent positions it from hit-test
 * results; it starts hidden until a surface is found.
 */
export const Reticle = forwardRef<Group>(function Reticle(_props, ref) {
  const ringRef = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    const ring = ringRef.current;
    if (ring == null) return;
    const pulse = 1 + Math.sin(clock.elapsedTime * 4) * 0.06;
    ring.scale.setScalar(pulse);
  });

  return (
    <group ref={ref} visible={false}>
      <mesh ref={ringRef} rotation-x={-Math.PI / 2} renderOrder={2}>
        <ringGeometry args={[0.075, 0.095, 24]} />
        <meshBasicMaterial color={PALETTE.reticle} transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position-y={0.001} renderOrder={2}>
        <circleGeometry args={[0.02, 12]} />
        <meshBasicMaterial color={PALETTE.safetyOrange} depthWrite={false} />
      </mesh>
    </group>
  );
});
