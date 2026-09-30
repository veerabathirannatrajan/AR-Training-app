import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { IcosahedronGeometry, Object3D, type InstancedMesh } from 'three';
import { flatMaterial } from '../materials';
import { PALETTE } from '../palette';

const puffGeometry = new IcosahedronGeometry(1, 0);
const dummy = new Object3D();

interface Puff {
  x: number;
  y: number;
  z: number;
  scale: number;
  phase: number;
}

/** Deterministic pseudo-random numbers so the layout is the same on every run. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A layer of low-poly grey smoke puffs, drawn as one instanced mesh (a single draw call).
 * `height` is the underside of the layer above the floor.
 */
export function SmokePuffs({
  count = 36,
  radius = 1.1,
  height = 1.1,
  thickness = 0.5,
  visible = true,
  seed = 7,
  opacity = 0.85,
}: {
  count?: number;
  radius?: number;
  height?: number;
  thickness?: number;
  visible?: boolean;
  seed?: number;
  opacity?: number;
}) {
  const ref = useRef<InstancedMesh>(null);
  const puffs = useMemo<Puff[]>(() => {
    const random = mulberry32(seed);
    return Array.from({ length: count }, () => {
      const angle = random() * Math.PI * 2;
      const distance = Math.sqrt(random()) * radius;
      return {
        x: Math.cos(angle) * distance,
        y: height + random() * thickness,
        z: Math.sin(angle) * distance,
        scale: 0.14 + random() * 0.16,
        phase: random() * Math.PI * 2,
      };
    });
  }, [count, radius, height, thickness, seed]);

  useLayoutEffect(() => {
    ref.current?.instanceMatrix.setUsage(35048); // DynamicDrawUsage
  }, []);

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (mesh == null || !visible) return;
    const time = clock.elapsedTime;
    puffs.forEach((puff, index) => {
      const bob = Math.sin(time * 0.8 + puff.phase) * 0.04;
      dummy.position.set(puff.x, puff.y + bob, puff.z);
      dummy.rotation.set(puff.phase, time * 0.2 + puff.phase, 0);
      dummy.scale.setScalar(puff.scale * (1 + Math.sin(time * 0.6 + puff.phase) * 0.08));
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={ref}
      args={[puffGeometry, flatMaterial(PALETTE.smoke, { opacity }), count]}
      visible={visible}
      frustumCulled={false}
    />
  );
}
