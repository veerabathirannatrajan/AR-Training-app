import { useFrame } from '@react-three/fiber';
import { forwardRef, useMemo, useRef, type ReactNode } from 'react';
import {
  CatmullRomCurve3,
  MeshBasicMaterial,
  Vector3,
  type Group,
  type Mesh,
  type PointLight,
} from 'three';
import { flatMaterial } from '../../engine/materials';
import { PALETTE } from '../../engine/palette';
import { EXTINGUISHER_STYLE, type ExtinguisherType } from './extinguishers';
import { AREA, DESK_HEIGHT } from './layout';

type Vec3 = readonly [number, number, number];

const glowGreen = new MeshBasicMaterial({ color: '#19c25a', toneMapped: false });
const glowWhite = new MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
const screenMaterial = new MeshBasicMaterial({ color: '#1c2b3a', toneMapped: false });

/** Dark floor zone with a safety-orange edge marking the training area. */
export function AreaFloor() {
  const width = AREA.maxX - AREA.minX;
  const depth = AREA.maxZ - AREA.minZ;
  const cx = (AREA.minX + AREA.maxX) / 2;
  const cz = (AREA.minZ + AREA.maxZ) / 2;
  const edge = 0.035;
  return (
    <group position={[cx, 0, cz]}>
      <mesh
        position-y={0.004}
        rotation-x={-Math.PI / 2}
        material={flatMaterial('#20262e', { opacity: 0.72 })}
      >
        <planeGeometry args={[width, depth]} />
      </mesh>
      {[
        [0, depth / 2, width, edge],
        [0, -depth / 2, width, edge],
        [width / 2, 0, edge, depth],
        [-width / 2, 0, edge, depth],
      ].map(([x, z, w, d], index) => (
        <mesh key={index} position={[x!, 0.008, z!]} material={flatMaterial(PALETTE.safetyOrange)}>
          <boxGeometry args={[w!, 0.012, d!]} />
        </mesh>
      ))}
    </group>
  );
}

/** Desk with monitor, PC tower, keyboard and a power strip on the floor. */
export function Workstation({ position, burnt }: { position: Vec3; burnt: boolean }) {
  const top = burnt ? '#3a3330' : '#8a8f96';
  return (
    <group position={[position[0], position[1], position[2]]}>
      <mesh position-y={DESK_HEIGHT - 0.02} material={flatMaterial(top)}>
        <boxGeometry args={[1.05, 0.04, 0.55]} />
      </mesh>
      {[
        [-0.48, -0.23],
        [0.48, -0.23],
        [-0.48, 0.23],
        [0.48, 0.23],
      ].map(([x, z], index) => (
        <mesh
          key={index}
          position={[x!, (DESK_HEIGHT - 0.04) / 2, z!]}
          material={flatMaterial(PALETTE.steelDark)}
        >
          <boxGeometry args={[0.04, DESK_HEIGHT - 0.04, 0.04]} />
        </mesh>
      ))}
      {/* Monitor */}
      <mesh position={[0.18, DESK_HEIGHT + 0.03, -0.12]} material={flatMaterial(PALETTE.matte)}>
        <boxGeometry args={[0.16, 0.02, 0.1]} />
      </mesh>
      <mesh position={[0.18, DESK_HEIGHT + 0.12, -0.13]} material={flatMaterial(PALETTE.matte)}>
        <boxGeometry args={[0.03, 0.16, 0.03]} />
      </mesh>
      <mesh position={[0.18, DESK_HEIGHT + 0.27, -0.12]} material={flatMaterial(PALETTE.matte)}>
        <boxGeometry args={[0.5, 0.3, 0.03]} />
      </mesh>
      <mesh position={[0.18, DESK_HEIGHT + 0.27, -0.104]} material={screenMaterial}>
        <planeGeometry args={[0.46, 0.26]} />
      </mesh>
      {/* Keyboard */}
      <mesh position={[0.1, DESK_HEIGHT + 0.01, 0.1]} material={flatMaterial('#3b4350')}>
        <boxGeometry args={[0.36, 0.02, 0.12]} />
      </mesh>
      {/* PC tower under the desk */}
      <mesh position={[-0.35, 0.22, -0.05]} material={flatMaterial('#2b3139')}>
        <boxGeometry args={[0.18, 0.44, 0.42]} />
      </mesh>
      <mesh position={[-0.35, 0.36, 0.165]} material={flatMaterial('#3dff7a', { opacity: 0.9 })}>
        <boxGeometry args={[0.02, 0.02, 0.005]} />
      </mesh>
    </group>
  );
}

export function PowerStrip({ position }: { position: Vec3 }) {
  return (
    <group position={[position[0], position[1], position[2]]} rotation-y={0.4}>
      <mesh position-y={0.02} material={flatMaterial('#e9ecef')}>
        <boxGeometry args={[0.32, 0.04, 0.07]} />
      </mesh>
      {[-0.1, 0, 0.1].map((x) => (
        <mesh key={x} position={[x, 0.041, 0]} material={flatMaterial(PALETTE.matte)}>
          <boxGeometry args={[0.04, 0.004, 0.035]} />
        </mesh>
      ))}
      {/* Tangle of cables to the desk */}
      <mesh position={[0.2, 0.01, -0.1]} rotation-y={0.9} material={flatMaterial(PALETTE.matte)}>
        <boxGeometry args={[0.35, 0.015, 0.015]} />
      </mesh>
      <mesh position={[0.05, 0.01, -0.16]} rotation-y={-0.3} material={flatMaterial(PALETTE.matte)}>
        <boxGeometry args={[0.28, 0.015, 0.015]} />
      </mesh>
    </group>
  );
}

/**
 * Manual fire alarm call point on a post, with a beacon that flashes once the alarm is raised.
 * The ref marks the press point (for tapping).
 */
export const CallPoint = forwardRef<Group, { position: Vec3; active: boolean }>(function CallPoint(
  { position, active },
  ref,
) {
  const beacon = useRef<Mesh>(null);
  const light = useRef<PointLight>(null);
  const beaconMaterial = useMemo(
    () => new MeshBasicMaterial({ color: '#7a1010', toneMapped: false }),
    [],
  );

  useFrame(({ clock }) => {
    const on = active && Math.floor(clock.elapsedTime * 3) % 2 === 0;
    beaconMaterial.color.set(on ? '#ff2d2d' : '#7a1010');
    if (light.current != null) light.current.intensity = on ? 2.5 : 0;
    if (beacon.current != null) beacon.current.rotation.y = clock.elapsedTime * 6;
  });

  return (
    <group position={[position[0], position[1], position[2]]}>
      <mesh position-y={0.6} material={flatMaterial(PALETTE.steel)}>
        <boxGeometry args={[0.05, 1.2, 0.05]} />
      </mesh>
      <group ref={ref} position={[0, 1.25, 0.035]}>
        <mesh material={flatMaterial('#d62828')}>
          <boxGeometry args={[0.16, 0.16, 0.06]} />
        </mesh>
        <mesh position-z={0.031} material={flatMaterial('#f1f3f5')}>
          <boxGeometry args={[0.1, 0.1, 0.004]} />
        </mesh>
        <mesh position-z={0.035} material={flatMaterial('#d62828')}>
          <cylinderGeometry args={[0.02, 0.02, 0.006, 10]} />
        </mesh>
        {/* Generous invisible hit area so it is easy to tap from a distance. */}
        <mesh visible={false}>
          <boxGeometry args={[0.3, 0.3, 0.2]} />
        </mesh>
      </group>
      <mesh ref={beacon} position-y={1.42} material={beaconMaterial}>
        <cylinderGeometry args={[0.045, 0.05, 0.07, 8]} />
      </mesh>
      <pointLight
        ref={light}
        position={[0, 1.45, 0.1]}
        color="#ff2d2d"
        distance={2.5}
        intensity={0}
      />
    </group>
  );
});

/**
 * Portable extinguisher, about 0.6 m tall, facing +z. Colour band per type (EN 3 style),
 * horn nozzle on CO₂. `pinRef` / `nozzleRef` let the scene animate the pin and emit spray.
 */
export function ExtinguisherModel({
  type,
  pinRef,
  nozzleRef,
  pinVisible = true,
  hoseForward = false,
  children,
}: {
  type: ExtinguisherType;
  pinRef?: React.Ref<Group>;
  nozzleRef?: React.Ref<Group>;
  pinVisible?: boolean;
  /** Held in the hand: hose swung forward so the nozzle points ahead. */
  hoseForward?: boolean;
  children?: ReactNode;
}) {
  const style = EXTINGUISHER_STYLE[type];
  const hose = useMemo(() => {
    const points = hoseForward
      ? [
          new Vector3(0.03, 0.5, 0.02),
          new Vector3(0.08, 0.46, -0.06),
          new Vector3(0.05, 0.47, -0.2),
        ]
      : [
          new Vector3(0.03, 0.5, 0.02),
          new Vector3(0.09, 0.4, 0.06),
          new Vector3(0.085, 0.22, 0.08),
        ];
    return new CatmullRomCurve3(points);
  }, [hoseForward]);
  const nozzleEnd = hose.getPoint(1);
  // The nozzle hangs down (-y); held, it is turned to point forward (-z).
  const nozzleRotation: [number, number, number] = hoseForward ? [Math.PI / 2, 0, 0] : [0, 0, 0];

  return (
    <group>
      <mesh position-y={0.24} material={flatMaterial('#d62828')}>
        <cylinderGeometry args={[0.075, 0.075, 0.44, 10]} />
      </mesh>
      <mesh position-y={0.31} material={flatMaterial(style.band)}>
        <cylinderGeometry args={[0.077, 0.077, 0.09, 10]} />
      </mesh>
      <mesh position-y={0.46} material={flatMaterial('#d62828')}>
        <sphereGeometry args={[0.075, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
      <mesh position-y={0.015} material={flatMaterial(PALETTE.matte)}>
        <cylinderGeometry args={[0.078, 0.078, 0.03, 10]} />
      </mesh>
      {/* Valve head and handles */}
      <mesh position-y={0.55} material={flatMaterial('#2b2f35')}>
        <boxGeometry args={[0.05, 0.07, 0.05]} />
      </mesh>
      <mesh position={[0, 0.6, -0.04]} rotation-x={-0.35} material={flatMaterial('#2b2f35')}>
        <boxGeometry args={[0.035, 0.012, 0.13]} />
      </mesh>
      <mesh position={[0, 0.575, -0.05]} material={flatMaterial('#2b2f35')}>
        <boxGeometry args={[0.03, 0.012, 0.12]} />
      </mesh>
      {/* Safety pin */}
      <group
        ref={pinRef ?? null}
        name="extinguisher-pin"
        position={[0.035, 0.56, 0]}
        visible={pinVisible}
      >
        <mesh rotation-y={Math.PI / 2} material={flatMaterial('#d9dde2')}>
          <torusGeometry args={[0.018, 0.004, 4, 10]} />
        </mesh>
        <mesh position-x={-0.02} rotation-z={Math.PI / 2} material={flatMaterial('#d9dde2')}>
          <cylinderGeometry args={[0.003, 0.003, 0.05, 4]} />
        </mesh>
        <mesh visible={false}>
          <sphereGeometry args={[0.05, 6, 4]} />
        </mesh>
      </group>
      {/* Hose and nozzle */}
      <mesh material={flatMaterial(PALETTE.matte)}>
        <tubeGeometry args={[hose, 8, 0.009, 5, false]} />
      </mesh>
      <group position={[nozzleEnd.x, nozzleEnd.y, nozzleEnd.z]} rotation={nozzleRotation}>
        {style.horn ? (
          <mesh position-y={-0.05} material={flatMaterial('#1d1f22')}>
            <cylinderGeometry args={[0.012, 0.035, 0.11, 8, 1, true]} />
          </mesh>
        ) : (
          <mesh position-y={-0.02} material={flatMaterial('#1d1f22')}>
            <cylinderGeometry args={[0.013, 0.011, 0.05, 6]} />
          </mesh>
        )}
        {/* Discharge point at the tip of the nozzle. */}
        <group ref={nozzleRef ?? null} position-y={style.horn ? -0.11 : -0.045} />
      </group>
      {children}
    </group>
  );
}

/** Wall-style stand holding the extinguishers in a row. */
export function ExtinguisherStand({ position, width = 0.85 }: { position: Vec3; width?: number }) {
  return (
    <group position={[position[0], position[1], position[2]]}>
      <mesh position={[0, 0.02, -0.08]} material={flatMaterial(PALETTE.steelDark)}>
        <boxGeometry args={[width, 0.04, 0.26]} />
      </mesh>
      <mesh position={[0, 0.55, -0.16]} material={flatMaterial('#c9302c')}>
        <boxGeometry args={[width, 1.1, 0.03]} />
      </mesh>
      <mesh position={[0, 1.02, -0.143]} material={glowWhite}>
        <boxGeometry args={[width * 0.7, 0.07, 0.005]} />
      </mesh>
    </group>
  );
}

// Box-segment letters for the EXIT sign (low-poly, no fonts or textures needed).
const EXIT_SEGMENTS: Array<[number, number, number, number, number]> = [
  // E
  [-0.105, 0, 0.012, 0.07, 0],
  [-0.09, 0.03, 0.035, 0.012, 0],
  [-0.093, 0, 0.03, 0.012, 0],
  [-0.09, -0.03, 0.035, 0.012, 0],
  // X
  [-0.035, 0, 0.012, 0.078, 0.55],
  [-0.035, 0, 0.012, 0.078, -0.55],
  // I
  [0.02, 0, 0.012, 0.07, 0],
  // T
  [0.075, 0.03, 0.05, 0.012, 0],
  [0.075, -0.004, 0.012, 0.058, 0],
];

function ExitSign() {
  return (
    <group>
      <mesh material={glowGreen}>
        <boxGeometry args={[0.3, 0.11, 0.025]} />
      </mesh>
      {EXIT_SEGMENTS.map(([x, y, w, h, rotation], index) => (
        <mesh key={index} position={[x, y, 0.014]} rotation-z={rotation} material={glowWhite}>
          <boxGeometry args={[w, h, 0.004]} />
        </mesh>
      ))}
    </group>
  );
}

/** Door frame with an illuminated EXIT sign above. `ref` covers the doorway for tapping. */
export const ExitDoor = forwardRef<Group, { position: Vec3; blocked: boolean }>(function ExitDoor(
  { position, blocked },
  ref,
) {
  return (
    <group position={[position[0], position[1], position[2]]}>
      {[-0.42, 0.42].map((x) => (
        <mesh key={x} position={[x, 1.05, 0]} material={flatMaterial('#5b6672')}>
          <boxGeometry args={[0.07, 2.1, 0.12]} />
        </mesh>
      ))}
      <mesh position={[0, 2.08, 0]} material={flatMaterial('#5b6672')}>
        <boxGeometry args={[0.91, 0.07, 0.12]} />
      </mesh>
      {/* Door leaf, pushed open */}
      <mesh
        position={[-0.2, 1.0, -0.33]}
        rotation-y={1.15}
        material={flatMaterial(blocked ? '#3a2a24' : '#2f6b4f')}
      >
        <boxGeometry args={[0.78, 2.0, 0.04]} />
      </mesh>
      <group position={[0, 2.26, 0.02]}>
        <ExitSign />
      </group>
      <group ref={ref} position={[0, 1.0, 0]}>
        <mesh visible={false}>
          <boxGeometry args={[0.9, 2.1, 0.3]} />
        </mesh>
      </group>
    </group>
  );
});

/** Lift doors with call buttons. `ref` covers the doors for tapping. */
export const LiftDoor = forwardRef<Group, { position: Vec3 }>(function LiftDoor({ position }, ref) {
  return (
    <group position={[position[0], position[1], position[2]]}>
      <mesh position={[0, 1.1, -0.03]} material={flatMaterial('#6d7885')}>
        <boxGeometry args={[1.0, 2.2, 0.06]} />
      </mesh>
      {[-0.205, 0.205].map((x) => (
        <mesh key={x} position={[x, 1.02, 0.005]} material={flatMaterial('#b8c1ca')}>
          <boxGeometry args={[0.4, 1.95, 0.02]} />
        </mesh>
      ))}
      <mesh position={[0.6, 1.15, 0]} material={flatMaterial('#2b3139')}>
        <boxGeometry args={[0.1, 0.22, 0.03]} />
      </mesh>
      {[1.2, 1.1].map((y, index) => (
        <mesh
          key={y}
          position={[0.6, y, 0.018]}
          rotation-z={index === 0 ? 0 : Math.PI}
          material={glowWhite}
        >
          <circleGeometry args={[0.025, 3]} />
        </mesh>
      ))}
      <group ref={ref} position={[0, 1.0, 0.05]}>
        <mesh visible={false}>
          <boxGeometry args={[1.0, 2.0, 0.3]} />
        </mesh>
      </group>
    </group>
  );
});

/** Green assembly point sign on a post (people gathering, arrows inwards). */
export function AssemblyPointSign({ position }: { position: Vec3 }) {
  const people = [-0.07, -0.025, 0.025, 0.07];
  return (
    <group position={[position[0], position[1], position[2]]} rotation-y={-0.6}>
      <mesh position-y={0.75} material={flatMaterial(PALETTE.steel)}>
        <boxGeometry args={[0.05, 1.5, 0.05]} />
      </mesh>
      <mesh position={[0, 1.6, 0.03]} material={glowGreen}>
        <boxGeometry args={[0.42, 0.42, 0.025]} />
      </mesh>
      {people.map((x) => (
        <group key={x} position={[x, 1.58, 0.045]}>
          <mesh position-y={0.035} material={glowWhite}>
            <circleGeometry args={[0.014, 6]} />
          </mesh>
          <mesh position-y={-0.01} material={glowWhite}>
            <planeGeometry args={[0.024, 0.06]} />
          </mesh>
        </group>
      ))}
      {[
        [0, 0.15, Math.PI],
        [0, -0.15, 0],
        [-0.15, 0, -Math.PI / 2],
        [0.15, 0, Math.PI / 2],
      ].map(([x, y, rotation], index) => (
        <mesh
          key={index}
          position={[x!, 1.6 + y!, 0.045]}
          rotation-z={rotation}
          material={glowWhite}
        >
          <circleGeometry args={[0.03, 3]} />
        </mesh>
      ))}
    </group>
  );
}
