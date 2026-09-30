import { createPortal, useFrame, useThree } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import {
  DynamicDrawUsage,
  IcosahedronGeometry,
  MeshBasicMaterial,
  Object3D,
  Shape,
  ShapeGeometry,
  TetrahedronGeometry,
  Color,
  Vector3,
  type InstancedMesh,
} from 'three';
import { flatMaterial } from '../materials';
import { mulberry32 } from './random';

const dummy = new Object3D();

// ---------------------------------------------------------------------------
// Smoke plume rising from a fire.

const puffGeometry = new IcosahedronGeometry(1, 0);

/** Grey low-poly puffs that rise, grow and shrink away. `strength` 0..1 is read every frame. */
export function SmokePlume({
  strength,
  height = 1.4,
  spread = 0.25,
  count = 16,
  seed = 5,
}: {
  strength: { current: number };
  height?: number;
  spread?: number;
  count?: number;
  seed?: number;
}) {
  const ref = useRef<InstancedMesh>(null);
  const puffs = useMemo(() => {
    const random = mulberry32(seed);
    return Array.from({ length: count }, () => ({
      offset: random(),
      speed: 0.12 + random() * 0.1,
      x: (random() - 0.5) * spread,
      z: (random() - 0.5) * spread,
      drift: (random() - 0.5) * 0.4,
      size: 0.08 + random() * 0.08,
      spin: random() * 3,
    }));
  }, [count, spread, seed]);

  useLayoutEffect(() => {
    ref.current?.instanceMatrix.setUsage(DynamicDrawUsage);
  }, []);

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (mesh == null) return;
    const level = Math.max(0, Math.min(1, strength.current));
    mesh.visible = level > 0.02;
    const t = clock.elapsedTime;
    puffs.forEach((puff, index) => {
      const life = (t * puff.speed + puff.offset) % 1;
      dummy.position.set(
        puff.x + puff.drift * life,
        life * height,
        puff.z + puff.drift * 0.5 * life,
      );
      dummy.rotation.set(puff.spin * t * 0.2, puff.spin, 0);
      dummy.scale.setScalar(
        puff.size * (0.6 + life * 1.8) * Math.sin(Math.PI * Math.min(1, life * 1.15)) * level,
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={ref}
      args={[puffGeometry, flatMaterial('#6f767d', { opacity: 0.8 }), count]}
      frustumCulled={false}
    />
  );
}

// ---------------------------------------------------------------------------
// Electrical sparks: short bursts of bright triangles.

const sparkGeometry = new TetrahedronGeometry(0.01, 0);
const sparkMaterial = new MeshBasicMaterial({ color: '#fff3a3', toneMapped: false });

export function Sparks({
  active,
  count = 18,
  seed = 9,
}: {
  active: { current: boolean };
  count?: number;
  seed?: number;
}) {
  const ref = useRef<InstancedMesh>(null);
  const sparks = useMemo(() => {
    const random = mulberry32(seed);
    return Array.from({ length: count }, () => ({
      direction: new Vector3(random() - 0.5, 0.6 + random(), random() - 0.5).normalize(),
      speed: 0.6 + random() * 0.9,
      offset: random(),
    }));
  }, [count, seed]);

  useLayoutEffect(() => {
    ref.current?.instanceMatrix.setUsage(DynamicDrawUsage);
  }, []);

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (mesh == null) return;
    mesh.visible = active.current;
    if (!active.current) return;
    const t = clock.elapsedTime;
    // A burst every ~0.9 s.
    sparks.forEach((spark, index) => {
      const life = (t * 1.1 + spark.offset * 0.25) % 0.9;
      const k = life / 0.35;
      const alive = k < 1;
      dummy.position.copy(spark.direction).multiplyScalar(spark.speed * life * 0.45);
      dummy.position.y -= 2.5 * life * life;
      dummy.rotation.set(t * 20, t * 13, 0);
      dummy.scale.setScalar(alive ? 1 - k : 0.0001);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[sparkGeometry, sparkMaterial, count]} frustumCulled={false} />
  );
}

// ---------------------------------------------------------------------------
// Extinguisher discharge: a cone of particles from the nozzle to the aim point.

const sprayMaterial = new MeshBasicMaterial({
  color: '#eef5ff',
  transparent: true,
  opacity: 0.85,
  toneMapped: false,
});
const from = new Vector3();
const to = new Vector3();
const direction = new Vector3();
const side = new Vector3();
const up = new Vector3();

/**
 * Discharge jet in world space. `origin` and `target` are read every frame (e.g. the nozzle of
 * a held extinguisher and the point the crosshair is on).
 */
export function SprayJet({
  active,
  origin,
  target,
  color = '#eef5ff',
  count = 70,
  seed = 13,
}: {
  active: { current: boolean };
  origin: { current: Object3D | null };
  target: { current: Vector3 };
  color?: string;
  count?: number;
  seed?: number;
}) {
  const scene = useThree((state) => state.scene);
  const ref = useRef<InstancedMesh>(null);
  const material = useMemo(() => {
    const clone = sprayMaterial.clone();
    clone.color = new Color(color);
    return clone;
  }, [color]);
  const particles = useMemo(() => {
    const random = mulberry32(seed);
    return Array.from({ length: count }, () => ({
      offset: random(),
      angle: random() * Math.PI * 2,
      spread: random(),
      size: 0.012 + random() * 0.02,
    }));
  }, [count, seed]);
  const strength = useRef(0);

  useLayoutEffect(() => {
    ref.current?.instanceMatrix.setUsage(DynamicDrawUsage);
  }, []);

  useFrame(({ clock }, delta) => {
    const mesh = ref.current;
    const nozzle = origin.current;
    if (mesh == null) return;
    strength.current += ((active.current ? 1 : 0) - strength.current) * Math.min(1, delta * 10);
    mesh.visible = strength.current > 0.02 && nozzle != null;
    if (!mesh.visible || nozzle == null) return;

    nozzle.getWorldPosition(from);
    to.copy(target.current);
    direction.subVectors(to, from);
    const length = direction.length();
    direction.normalize();
    side.set(0, 1, 0).cross(direction).normalize();
    up.crossVectors(direction, side).normalize();
    const t = clock.elapsedTime;

    particles.forEach((particle, index) => {
      const life = (t * 2.2 + particle.offset) % 1;
      const radius = life * length * 0.22 * particle.spread;
      dummy.position
        .copy(from)
        .addScaledVector(direction, life * length)
        .addScaledVector(side, Math.cos(particle.angle + t) * radius)
        .addScaledVector(up, Math.sin(particle.angle + t) * radius);
      dummy.rotation.set(t * 3 + particle.angle, particle.angle, 0);
      dummy.scale.setScalar(particle.size * (0.6 + life * 3.5) * strength.current);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  return createPortal(
    <instancedMesh
      ref={ref}
      args={[puffGeometry, material, count]}
      frustumCulled={false}
      renderOrder={4}
    />,
    scene,
  );
}

// ---------------------------------------------------------------------------
// Evacuation route: glowing chevrons on the floor with a pulse flowing along the path.

function chevronGeometry() {
  const shape = new Shape();
  shape.moveTo(-0.5, 0);
  shape.lineTo(0, 0.42);
  shape.lineTo(0.5, 0);
  shape.lineTo(0.5, -0.22);
  shape.lineTo(0, 0.2);
  shape.lineTo(-0.5, -0.22);
  shape.closePath();
  const geometry = new ShapeGeometry(shape);
  // Lie flat on the floor, pointing along -z (forward) before per-instance rotation.
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

const arrowGeometry = chevronGeometry();
const arrowMaterial = new MeshBasicMaterial({
  toneMapped: false,
  transparent: true,
  opacity: 0.95,
});
const dim = new Color('#0f5e2c');
const bright = new Color('#3dff7a');
const arrowColor = new Color();

/** Samples chevrons along a polyline (x, z pairs on the floor, local coordinates). */
function samplePath(points: ReadonlyArray<readonly [number, number]>, spacing: number) {
  const samples: Array<{ x: number; z: number; heading: number; distance: number }> = [];
  let travelled = 0;
  let nextAt = spacing * 0.5;
  for (let i = 0; i < points.length - 1; i += 1) {
    const [ax, az] = points[i]!;
    const [bx, bz] = points[i + 1]!;
    const segment = Math.hypot(bx - ax, bz - az);
    const heading = Math.atan2(bx - ax, bz - az);
    while (nextAt <= travelled + segment) {
      const k = (nextAt - travelled) / segment;
      samples.push({ x: ax + (bx - ax) * k, z: az + (bz - az) * k, heading, distance: nextAt });
      nextAt += spacing;
    }
    travelled += segment;
  }
  return { samples, length: travelled };
}

export function FloorArrows({
  path,
  visible = true,
  spacing = 0.28,
  size = 0.22,
  y = 0.03,
}: {
  path: ReadonlyArray<readonly [number, number]>;
  visible?: boolean;
  spacing?: number;
  size?: number;
  y?: number;
}) {
  const ref = useRef<InstancedMesh>(null);
  const { samples, length } = useMemo(() => samplePath(path, spacing), [path, spacing]);

  useLayoutEffect(() => {
    const mesh = ref.current;
    if (mesh == null) return;
    samples.forEach((sample, index) => {
      dummy.position.set(sample.x, y, sample.z);
      // Chevron points along -z; heading is measured from +z, so turn it around.
      dummy.rotation.set(0, sample.heading + Math.PI, 0);
      dummy.scale.setScalar(size);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, dim);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor != null) mesh.instanceColor.needsUpdate = true;
  }, [samples, size, y]);

  useFrame(({ clock }) => {
    const mesh = ref.current;
    if (mesh == null || !visible || mesh.instanceColor == null) return;
    const wave = (clock.elapsedTime * 1.4) % 1;
    samples.forEach((sample, index) => {
      const phase = sample.distance / Math.max(length, 0.01);
      const distanceToWave = Math.abs(phase - wave);
      const glow = Math.max(0, 1 - Math.min(distanceToWave, 1 - distanceToWave) * 6);
      mesh.setColorAt(index, arrowColor.copy(dim).lerp(bright, 0.35 + glow * 0.65));
    });
    mesh.instanceColor.needsUpdate = true;
  });

  if (samples.length === 0) return null;
  return (
    <instancedMesh
      key={samples.length}
      ref={ref}
      args={[arrowGeometry, arrowMaterial, samples.length]}
      visible={visible}
      renderOrder={1}
    />
  );
}
