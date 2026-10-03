import { createPortal, useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import {
  DynamicDrawUsage,
  IcosahedronGeometry,
  Object3D,
  Quaternion,
  Vector3,
  type InstancedMesh,
  type Mesh,
} from 'three';
import { mulberry32 } from '../../engine/effects/random';
import { flatMaterial } from '../../engine/materials';
import { LEAK, MANHOLE } from './layout';
import type { Segment } from './segment';

type Point = readonly [number, number];

const puffGeometry = new IcosahedronGeometry(1, 0);
const dummy = new Object3D();
const GAS_COLOUR = '#cbdc6e';

/** Seconds a puff takes to drift from the leak to where it fades out. */
const CLOUD_LIFE = 4.2;
/** How the heavy gas creeps along the ground into the manhole. */
const DRAIN_PATH: readonly Point[] = [
  [LEAK[0] + 0.05, LEAK[2] + 0.05],
  [0.15, -0.95],
  [0.6, -0.66],
  [MANHOLE[0], MANHOLE[2]],
];
const DRAIN_SHARE = 0.72;

function along(points: readonly Point[], k: number): Point {
  const lengths: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const [ax, az] = points[i]!;
    const [bx, bz] = points[i + 1]!;
    const length = Math.hypot(bx - ax, bz - az);
    lengths.push(length);
    total += length;
  }
  let remaining = Math.min(1, Math.max(0, k)) * total;
  for (let i = 0; i < lengths.length; i += 1) {
    const length = lengths[i]!;
    if (remaining <= length || i === lengths.length - 1) {
      const [ax, az] = points[i]!;
      const [bx, bz] = points[i + 1]!;
      const f = length === 0 ? 0 : Math.min(1, remaining / length);
      return [ax + (bx - ax) * f, az + (bz - az) * f];
    }
    remaining -= length;
  }
  return points[0]!;
}

/**
 * The leaking LPG as low-poly puffs: they hug the ground (it is heavier than air), drift
 * downwind (+x) and spread, and a share of them creep into the manhole and sink. `level`
 * 0..1 is read every frame (0 once the line is shut off).
 */
export function GasCloud({
  level,
  count = 54,
  seed = 41,
}: {
  level: { current: number };
  count?: number;
  seed?: number;
}) {
  const ref = useRef<InstancedMesh>(null);
  const puffs = useMemo(() => {
    const random = mulberry32(seed);
    return Array.from({ length: count }, (_, index) => ({
      offset: random(),
      drain: index % 4 === 0,
      spread: random() * 2 - 1,
      lift: random(),
      size: 0.8 + random() * 0.5,
      spin: random() * 3,
      speed: 0.85 + random() * 0.3,
    }));
  }, [count, seed]);

  useLayoutEffect(() => {
    ref.current?.instanceMatrix.setUsage(DynamicDrawUsage);
  }, []);

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (mesh == null) return;
    const k = Math.max(0, Math.min(1, level.current));
    mesh.visible = k > 0.02;
    if (!mesh.visible) return;
    const t = clock.elapsedTime;
    puffs.forEach((puff, index) => {
      const life = ((t * puff.speed) / CLOUD_LIFE + puff.offset) % 1;
      let scale = (0.04 + life * 0.15) * puff.size * Math.sin(Math.PI * Math.min(1, life * 1.15));
      if (puff.drain) {
        if (life < DRAIN_SHARE) {
          const [x, z] = along(DRAIN_PATH, life / DRAIN_SHARE);
          dummy.position.set(x, 0.24 - (life / DRAIN_SHARE) * 0.16, z + puff.spread * 0.05);
        } else {
          // Sinking into the pit, shrinking as it goes down the shaft.
          const sink = (life - DRAIN_SHARE) / (1 - DRAIN_SHARE);
          dummy.position.set(
            MANHOLE[0] + puff.spread * 0.08 * (1 - sink),
            0.08 - sink * 0.3,
            MANHOLE[2] + puff.lift * 0.08 * (1 - sink),
          );
          scale = 0.09 * puff.size * (1 - sink);
        }
      } else {
        dummy.position.set(
          LEAK[0] + 0.05 + life * 1.3,
          Math.max(0.05, 0.28 - life * 0.2 + puff.lift * 0.08 * (1 - life)),
          LEAK[2] + 0.1 + puff.spread * (0.08 + life * 0.42),
        );
      }
      dummy.rotation.set(puff.spin + t * 0.3, puff.spin * 2, 0);
      dummy.scale.setScalar(Math.max(0.0001, scale * k));
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={ref}
      args={[puffGeometry, flatMaterial(GAS_COLOUR, { opacity: 0.42 }), count]}
      frustumCulled={false}
      renderOrder={3}
    />
  );
}

/**
 * Gas trapped in the pit, swirling at the opening. `amount` 0..1 thins it out; while
 * `venting` is above 0 the blower's air pushes the puffs up and out.
 */
export function PitGas({
  amount,
  venting,
  count = 12,
  seed = 57,
}: {
  amount: { current: number };
  venting: { current: number };
  count?: number;
  seed?: number;
}) {
  const ref = useRef<InstancedMesh>(null);
  const puffs = useMemo(() => {
    const random = mulberry32(seed);
    return Array.from({ length: count }, () => ({
      angle: random() * Math.PI * 2,
      radius: Math.sqrt(random()) * 0.2,
      phase: random() * Math.PI * 2,
      offset: random(),
      size: 0.06 + random() * 0.04,
    }));
  }, [count, seed]);

  useLayoutEffect(() => {
    ref.current?.instanceMatrix.setUsage(DynamicDrawUsage);
  }, []);

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (mesh == null) return;
    const k = Math.max(0, Math.min(1, amount.current));
    mesh.visible = k > 0.02;
    if (!mesh.visible) return;
    const t = clock.elapsedTime;
    const vent = venting.current;
    puffs.forEach((puff, index) => {
      const angle = puff.angle + t * 0.35;
      const rise = (t * 0.45 + puff.offset) % 1;
      dummy.position.set(
        MANHOLE[0] + Math.cos(angle) * puff.radius * (1 + vent * rise),
        0.03 + Math.sin(t * 0.9 + puff.phase) * 0.04 + vent * rise * 0.9,
        MANHOLE[2] + Math.sin(angle) * puff.radius * (1 + vent * rise),
      );
      dummy.rotation.set(puff.phase + t * 0.2, puff.phase, 0);
      const fade = vent > 0 ? Math.sin(Math.PI * rise) : 1;
      dummy.scale.setScalar(
        Math.max(0.0001, puff.size * (1 + Math.sin(t + puff.phase) * 0.1) * fade * k),
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={ref}
      args={[puffGeometry, flatMaterial(GAS_COLOUR, { opacity: 0.5 }), count]}
      frustumCulled={false}
      renderOrder={3}
    />
  );
}

const yAxis = new Vector3(0, 1, 0);
const direction = new Vector3();
const rotation = new Quaternion();

function placeBetween(mesh: Mesh, a: Vector3, b: Vector3) {
  direction.subVectors(b, a);
  const length = direction.length();
  mesh.position.addVectors(a, b).multiplyScalar(0.5);
  rotation.setFromUnitVectors(yAxis, length > 1e-6 ? direction.normalize() : yAxis);
  mesh.quaternion.copy(rotation);
  mesh.scale.set(1, Math.max(1e-4, length), 1);
}

/**
 * A rope or hose drawn between `segment.a` and `segment.b`. Local coordinates by default
 * (inside the training area); `world` renders at the scene root for ends taken from objects
 * outside the area, such as a held instrument.
 */
export function SegmentLine({
  segment,
  radius,
  color,
  world = false,
}: {
  segment: { current: Segment };
  radius: number;
  color: string;
  world?: boolean;
}) {
  const scene = useThree((state) => state.scene);
  const ref = useRef<Mesh>(null);
  useFrame(() => {
    const mesh = ref.current;
    if (mesh == null) return;
    const { a, b, visible } = segment.current;
    mesh.visible = visible;
    if (visible) placeBetween(mesh, a, b);
  });
  const line = (
    <mesh ref={ref} visible={false} material={flatMaterial(color)} frustumCulled={false}>
      <cylinderGeometry args={[radius, radius, 1, 5]} />
    </mesh>
  );
  return world ? createPortal(line, scene) : line;
}
