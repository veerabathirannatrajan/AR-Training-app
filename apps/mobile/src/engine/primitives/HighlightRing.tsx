import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Mesh, MeshBasicMaterial } from 'three';
import { PALETTE } from '../palette';

/** Pulsing floor ring that tells the worker which object the current step is about. */
export function HighlightRing({
  position,
  radius = 0.2,
  color = PALETTE.safetyOrange,
  visible = true,
}: {
  position: readonly [number, number, number];
  radius?: number;
  color?: string;
  visible?: boolean;
}) {
  const ref = useRef<Mesh>(null);

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (mesh == null || !visible) return;
    const pulse = (Math.sin(clock.elapsedTime * 3) + 1) / 2;
    mesh.scale.setScalar(1 + pulse * 0.15);
    (mesh.material as MeshBasicMaterial).opacity = 0.45 + pulse * 0.45;
  });

  return (
    <mesh
      ref={ref}
      visible={visible}
      position={[position[0], position[1] + 0.012, position[2]]}
      rotation-x={-Math.PI / 2}
      renderOrder={1}
    >
      <ringGeometry args={[radius * 0.82, radius, 24]} />
      <meshBasicMaterial color={color} transparent depthWrite={false} />
    </mesh>
  );
}
