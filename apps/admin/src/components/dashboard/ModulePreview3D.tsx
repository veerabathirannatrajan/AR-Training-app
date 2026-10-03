import { OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import type { Group, Mesh } from 'three';

/** Flat-shaded, solid-colour material: the low-poly look of the AR modules. */
function Flat({ color, opacity = 1 }: { color: string; opacity?: number }) {
  return (
    <meshStandardMaterial
      color={color}
      flatShading
      roughness={0.85}
      metalness={0}
      transparent={opacity < 1}
      opacity={opacity}
    />
  );
}

function Flame({
  position,
  scale = 1,
  phase = 0,
}: {
  position: [number, number, number];
  scale?: number;
  phase?: number;
}) {
  const outer = useRef<Mesh>(null);
  const inner = useRef<Mesh>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 7 + phase;
    const flicker = 1 + Math.sin(t) * 0.08 + Math.sin(t * 2.3) * 0.05;
    outer.current?.scale.set(scale, scale * flicker, scale);
    inner.current?.scale.set(scale * 0.6, scale * 0.75 * (2 - flicker), scale * 0.6);
  });
  return (
    <group position={position}>
      <mesh ref={outer} position={[0, 0.22, 0]}>
        <coneGeometry args={[0.16, 0.48, 5]} />
        <Flat color="#f97316" />
      </mesh>
      <mesh ref={inner} position={[0, 0.16, 0]}>
        <coneGeometry args={[0.1, 0.32, 5]} />
        <Flat color="#fde047" />
      </mesh>
    </group>
  );
}

function FireScene() {
  return (
    <group>
      {/* Workstation with an electrical panel on fire */}
      <mesh position={[-0.35, 0.33, -0.25]}>
        <boxGeometry args={[0.9, 0.5, 0.5]} />
        <Flat color="#71717a" />
      </mesh>
      <mesh position={[-0.35, 0.62, -0.25]}>
        <boxGeometry args={[0.96, 0.06, 0.56]} />
        <Flat color="#52525b" />
      </mesh>
      <mesh position={[-0.55, 0.78, -0.35]}>
        <boxGeometry args={[0.32, 0.26, 0.04]} />
        <Flat color="#27272a" />
      </mesh>
      <Flame position={[-0.2, 0.65, -0.2]} scale={1.1} />
      <Flame position={[-0.42, 0.65, -0.1]} scale={0.8} phase={2} />
      {/* CO₂ extinguisher (black band, horn) */}
      <group position={[0.55, 0.08, 0.25]}>
        <mesh position={[0, 0.34, 0]}>
          <cylinderGeometry args={[0.13, 0.13, 0.62, 8]} />
          <Flat color="#dc2626" />
        </mesh>
        <mesh position={[0, 0.52, 0]}>
          <cylinderGeometry args={[0.135, 0.135, 0.07, 8]} />
          <Flat color="#18181b" />
        </mesh>
        <mesh position={[0, 0.7, 0]}>
          <cylinderGeometry args={[0.05, 0.09, 0.12, 6]} />
          <Flat color="#3f3f46" />
        </mesh>
        <mesh position={[0.12, 0.62, 0]} rotation={[0, 0, -0.9]}>
          <coneGeometry args={[0.06, 0.2, 6]} />
          <Flat color="#18181b" />
        </mesh>
      </group>
      {/* Exit sign post */}
      <mesh position={[0.75, 0.45, -0.55]}>
        <boxGeometry args={[0.04, 0.8, 0.04]} />
        <Flat color="#a1a1aa" />
      </mesh>
      <mesh position={[0.75, 0.88, -0.55]}>
        <boxGeometry args={[0.36, 0.16, 0.04]} />
        <Flat color="#16a34a" />
      </mesh>
    </group>
  );
}

function GasScene() {
  const cloud = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (cloud.current == null) return;
    cloud.current.rotation.y = clock.elapsedTime * 0.25;
    const breathe = 1 + Math.sin(clock.elapsedTime * 1.6) * 0.05;
    cloud.current.scale.setScalar(breathe);
  });
  return (
    <group>
      {/* Leaking pipe */}
      <mesh position={[-0.2, 0.25, -0.45]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.07, 0.07, 1.3, 6]} />
        <Flat color="#a16207" />
      </mesh>
      <mesh position={[0.15, 0.25, -0.45]}>
        <cylinderGeometry args={[0.1, 0.1, 0.12, 6]} />
        <Flat color="#3f3f46" />
      </mesh>
      {/* Gas cloud: red inner zone, amber outer zone */}
      <group ref={cloud} position={[0.15, 0.32, -0.3]}>
        <mesh>
          <icosahedronGeometry args={[0.32, 0]} />
          <Flat color="#ef4444" opacity={0.45} />
        </mesh>
        <mesh scale={1.7}>
          <icosahedronGeometry args={[0.32, 0]} />
          <Flat color="#f59e0b" opacity={0.18} />
        </mesh>
      </group>
      {/* Manhole into the confined space, with a tripod and winch */}
      <mesh position={[0.35, 0.09, 0.4]}>
        <cylinderGeometry args={[0.32, 0.34, 0.06, 10]} />
        <Flat color="#3f3f46" />
      </mesh>
      <mesh position={[0.35, 0.12, 0.4]}>
        <cylinderGeometry args={[0.24, 0.24, 0.02, 10]} />
        <Flat color="#0a0a0a" />
      </mesh>
      {[0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((angle) => (
        <mesh
          key={angle}
          position={[0.35 + Math.cos(angle) * 0.22, 0.48, 0.4 + Math.sin(angle) * 0.22]}
          rotation={[Math.sin(angle) * 0.35, 0, -Math.cos(angle) * 0.35]}
        >
          <cylinderGeometry args={[0.02, 0.025, 0.8, 5]} />
          <Flat color="#f59e0b" />
        </mesh>
      ))}
      {/* Gas monitor on a stand */}
      <mesh position={[-0.55, 0.3, 0.3]}>
        <boxGeometry args={[0.18, 0.28, 0.08]} />
        <Flat color="#facc15" />
      </mesh>
      <mesh position={[-0.55, 0.33, 0.345]}>
        <boxGeometry args={[0.12, 0.1, 0.01]} />
        <Flat color="#14532d" />
      </mesh>
    </group>
  );
}

function Turntable({ module }: { module: 'fire' | 'gas' }) {
  const group = useRef<Group>(null);
  useFrame((_, delta) => {
    if (group.current != null) group.current.rotation.y += delta * 0.35;
  });
  return (
    <group ref={group} position={[0, -0.45, 0]}>
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[1.25, 1.35, 0.12, 6]} />
        <Flat color="#e4e4e7" />
      </mesh>
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[1.35, 1.2, 0.1, 6]} />
        <Flat color="#d4d4d8" />
      </mesh>
      <group position={[0, 0.02, 0]}>{module === 'fire' ? <FireScene /> : <GasScene />}</group>
    </group>
  );
}

export default function ModulePreview3D({ module }: { module: 'fire' | 'gas' }) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      camera={{ position: [2.1, 1.5, 2.3], fov: 38 }}
      gl={{ antialias: true, alpha: true }}
      style={{ touchAction: 'pan-y' }}
    >
      <hemisphereLight args={['#ffffff', '#a1a1aa', 1.6]} />
      <directionalLight position={[3, 5, 2]} intensity={1.6} />
      <Turntable module={module} />
      <OrbitControls
        enableZoom={false}
        enablePan={false}
        minPolarAngle={0.6}
        maxPolarAngle={1.35}
      />
    </Canvas>
  );
}
