import { useFrame } from '@react-three/fiber';
import { useLayoutEffect, useMemo, useRef } from 'react';
import {
  AdditiveBlending,
  BufferAttribute,
  Color,
  ConeGeometry,
  DynamicDrawUsage,
  IcosahedronGeometry,
  MeshBasicMaterial,
  Object3D,
  TetrahedronGeometry,
  type InstancedMesh,
  type Mesh,
  type PointLight,
} from 'three';
import { flicker, mulberry32 } from './random';

/** Faceted flame shard: a 5-sided cone with its base at y = 0 and a tint per face. */
function createShardGeometry() {
  const geometry = new ConeGeometry(0.5, 1, 5, 1, true).toNonIndexed();
  geometry.translate(0, 0.5, 0);
  const random = mulberry32(11);
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let face = 0; face < count / 3; face += 1) {
    const shade = 0.78 + random() * 0.4;
    for (let v = 0; v < 3; v += 1) colors.set([shade, shade, shade], (face * 3 + v) * 3);
  }
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  return geometry;
}

const shardGeometry = createShardGeometry();
const shardMaterial = new MeshBasicMaterial({ vertexColors: true, toneMapped: false });
const emberGeometry = new TetrahedronGeometry(0.014, 0);
const emberMaterial = new MeshBasicMaterial({ color: '#ffd166', toneMapped: false });
const glowGeometry = new IcosahedronGeometry(1, 1);
const glowMaterial = new MeshBasicMaterial({
  color: '#ff7a1a',
  transparent: true,
  opacity: 0.1,
  blending: AdditiveBlending,
  depthWrite: false,
  toneMapped: false,
});

const LAYERS = [
  { color: '#e0301e', scale: 1, share: 0.4 },
  { color: '#ff7a1a', scale: 0.78, share: 0.35 },
  { color: '#ffd23f', scale: 0.52, share: 0.25 },
] as const;

interface Shard {
  x: number;
  z: number;
  height: number;
  width: number;
  phase: number;
  speed: number;
  tilt: number;
}

const dummy = new Object3D();
const tint = new Color();

/**
 * Low-poly fire: stacked faceted flame shards (red → orange → yellow core) that flicker,
 * a soft additive glow, rising triangular embers and a flickering light. `intensity` 0..1
 * scales everything (0 = out).
 */
export function LowPolyFire({
  intensity,
  radius = 0.3,
  height = 0.6,
  shards = 26,
  embers = 36,
  light = true,
  seed = 3,
}: {
  /** Read every frame, so a ref can animate it without re-rendering. */
  intensity: { current: number };
  radius?: number;
  height?: number;
  shards?: number;
  embers?: number;
  light?: boolean;
  seed?: number;
}) {
  const shardRef = useRef<InstancedMesh>(null);
  const emberRef = useRef<InstancedMesh>(null);
  const glowRef = useRef<Mesh>(null);
  const lightRef = useRef<PointLight>(null);

  const shardData = useMemo<Shard[]>(() => {
    const random = mulberry32(seed);
    return Array.from({ length: shards }, (_, index) => {
      const layer =
        index / shards < LAYERS[0].share
          ? 0
          : index / shards < LAYERS[0].share + LAYERS[1].share
            ? 1
            : 2;
      const spread = radius * (layer === 0 ? 1 : layer === 1 ? 0.7 : 0.4);
      const angle = random() * Math.PI * 2;
      const distance = Math.sqrt(random()) * spread;
      return {
        x: Math.cos(angle) * distance,
        z: Math.sin(angle) * distance,
        height:
          height * LAYERS[layer]!.scale * (0.55 + random() * 0.6) * (1 - distance / (radius * 1.6)),
        width: radius * (0.35 + random() * 0.3) * (layer === 2 ? 0.7 : 1),
        phase: random() * 100,
        speed: 0.8 + random() * 0.8,
        tilt: (random() - 0.5) * 0.35,
      };
    });
  }, [shards, radius, height, seed]);

  const emberData = useMemo(() => {
    const random = mulberry32(seed + 7);
    return Array.from({ length: embers }, () => ({
      angle: random() * Math.PI * 2,
      distance: Math.sqrt(random()) * radius,
      speed: 0.25 + random() * 0.45,
      offset: random(),
      sway: 0.03 + random() * 0.07,
      spin: random() * 6,
    }));
  }, [embers, radius, seed]);

  useLayoutEffect(() => {
    const mesh = shardRef.current;
    if (mesh == null) return;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    shardData.forEach((_, index) => {
      const layer =
        index / shards < LAYERS[0].share
          ? 0
          : index / shards < LAYERS[0].share + LAYERS[1].share
            ? 1
            : 2;
      mesh.setColorAt(index, tint.set(LAYERS[layer]!.color));
    });
    if (mesh.instanceColor != null) mesh.instanceColor.needsUpdate = true;
    emberRef.current?.instanceMatrix.setUsage(DynamicDrawUsage);
  }, [shardData, shards]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const level = Math.max(0, Math.min(1, intensity.current));
    const shardMesh = shardRef.current;
    const emberMesh = emberRef.current;
    if (shardMesh == null || emberMesh == null) return;

    shardMesh.visible = level > 0.01;
    emberMesh.visible = level > 0.05;
    shardData.forEach((shard, index) => {
      const f = flicker(t * shard.speed, shard.phase);
      const h = Math.max(0.001, shard.height * level * (0.8 + 0.25 * f));
      const w = Math.max(0.001, shard.width * (0.45 + 0.55 * level) * (0.9 + 0.12 * f));
      dummy.position.set(shard.x * (0.5 + 0.5 * level), 0, shard.z * (0.5 + 0.5 * level));
      dummy.rotation.set(shard.tilt + f * 0.08, t * 0.4 + shard.phase, shard.tilt * 0.5);
      dummy.scale.set(w, h, w);
      dummy.updateMatrix();
      shardMesh.setMatrixAt(index, dummy.matrix);
    });
    shardMesh.instanceMatrix.needsUpdate = true;

    const emberHeight = height * 1.8;
    emberData.forEach((ember, index) => {
      const life = (t * ember.speed + ember.offset) % 1;
      const y = life * emberHeight;
      dummy.position.set(
        Math.cos(ember.angle) * ember.distance * (1 - life * 0.5) +
          Math.sin(t * 2 + ember.spin) * ember.sway * life,
        y,
        Math.sin(ember.angle) * ember.distance * (1 - life * 0.5) +
          Math.cos(t * 1.7 + ember.spin) * ember.sway * life,
      );
      dummy.rotation.set(t * ember.spin, t * ember.spin * 0.7, 0);
      dummy.scale.setScalar(level * (1 - life) * 1.4);
      dummy.updateMatrix();
      emberMesh.setMatrixAt(index, dummy.matrix);
    });
    emberMesh.instanceMatrix.needsUpdate = true;

    const glow = glowRef.current;
    if (glow != null) {
      glow.visible = level > 0.01;
      glow.scale.set(radius * 1.5 * level, height * 0.7 * level + 0.001, radius * 1.5 * level);
      glow.position.y = height * 0.3 * level;
    }
    const pointLight = lightRef.current;
    if (pointLight != null) pointLight.intensity = level * (2.2 + flicker(t, 1) * 0.6);
  });

  return (
    <group>
      <instancedMesh
        ref={shardRef}
        args={[shardGeometry, shardMaterial, shards]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={emberRef}
        args={[emberGeometry, emberMaterial, embers]}
        frustumCulled={false}
      />
      <mesh ref={glowRef} geometry={glowGeometry} material={glowMaterial} renderOrder={3} />
      {light && (
        <pointLight
          ref={lightRef}
          color="#ff8a3d"
          distance={3.5}
          decay={1.6}
          position={[0, height * 0.5, 0]}
        />
      )}
    </group>
  );
}
