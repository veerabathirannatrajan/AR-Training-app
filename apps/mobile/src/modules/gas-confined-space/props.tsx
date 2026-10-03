import { useFrame } from '@react-three/fiber';
import { forwardRef, useMemo, useRef, type ReactNode } from 'react';
import {
  BackSide,
  DoubleSide,
  LatheGeometry,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Path,
  Quaternion,
  Shape,
  Vector2,
  Vector3,
  type Group,
  type Material,
  type Mesh,
  type PointLight,
} from 'three';
import { engine } from '../../engine/engineStore';
import { flatMaterial } from '../../engine/materials';
import { PALETTE } from '../../engine/palette';
import { gas } from './gasStore';
import {
  AREA,
  COLLAR_HEIGHT,
  FAN_BUTTON,
  FLANGES,
  MANHOLE,
  MANHOLE_COLLAR,
  MANHOLE_OPENING,
  PIPE_FROM_X,
  PIPE_RADIUS,
  PIPE_SUPPORTS,
  PIPE_TO_X,
  PIPE_Y,
  PIPE_Z,
  PULLEY_POINT,
  SHAFT_DEPTH,
  TRIPOD_APEX,
  TRIPOD_FEET,
  WINCH_AT,
  WINCH_LEG,
  type Zone,
} from './layout';
import { GASES, gasStatus } from './readings';

type Vec3 = readonly [number, number, number];

/*
 * Low-poly props for the gas module, built from primitives (no downloaded models). Every
 * prop has its base on y = 0; the pit below the manhole goes under the floor.
 */

const glowGreen = new MeshBasicMaterial({ color: '#19c25a', toneMapped: false });
const glowWhite = new MeshBasicMaterial({ color: '#ffffff', toneMapped: false });
const pitBlack = new MeshBasicMaterial({ color: '#07090b', toneMapped: false });
/** Writes depth but no colour: hides whatever is below the real floor in AR. */
const floorMask = new MeshBasicMaterial({ colorWrite: false });

const PIPE_YELLOW = '#f2c230';
const TRIPOD_YELLOW = '#e0a800';
const CONCRETE = '#a3a9b0';
export const STATUS_GREEN = '#34d17a';
export const STATUS_RED = '#ff4d4d';

const up = new Vector3(0, 1, 0);

/** A round bar between two points (tripod legs, lifelines). */
export function Strut({
  from,
  to,
  radius,
  color,
  sides = 6,
}: {
  from: Vec3;
  to: Vec3;
  radius: number;
  color: string;
  sides?: number;
}) {
  const { position, quaternion, length } = useMemo(() => {
    const a = new Vector3(...from);
    const b = new Vector3(...to);
    const direction = b.clone().sub(a);
    return {
      position: a.clone().add(b).multiplyScalar(0.5),
      quaternion: new Quaternion().setFromUnitVectors(up, direction.clone().normalize()),
      length: direction.length(),
    };
  }, [from, to]);
  return (
    <mesh position={position} quaternion={quaternion} material={flatMaterial(color)}>
      <cylinderGeometry args={[radius, radius, length, sides]} />
    </mesh>
  );
}

/** Dark floor zone with a safety-orange edge, with a hole where the manhole opens. */
export function GasAreaFloor() {
  const outline = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(AREA.minX, -AREA.minZ);
    shape.lineTo(AREA.maxX, -AREA.minZ);
    shape.lineTo(AREA.maxX, -AREA.maxZ);
    shape.lineTo(AREA.minX, -AREA.maxZ);
    shape.closePath();
    const hole = new Path();
    hole.absarc(MANHOLE[0], -MANHOLE[2], MANHOLE_OPENING, 0, Math.PI * 2, false);
    shape.holes.push(hole);
    return shape;
  }, []);
  const width = AREA.maxX - AREA.minX;
  const depth = AREA.maxZ - AREA.minZ;
  const cx = (AREA.minX + AREA.maxX) / 2;
  const cz = (AREA.minZ + AREA.maxZ) / 2;
  const edge = 0.035;
  return (
    <group>
      {/* Shape is drawn in x/-z, then laid flat (rotation maps shape y to -z). */}
      <mesh
        position-y={0.004}
        rotation-x={-Math.PI / 2}
        material={flatMaterial('#20262e', { opacity: 0.72 })}
      >
        <shapeGeometry args={[outline, 12]} />
      </mesh>
      <group position={[cx, 0, cz]}>
        {[
          [0, depth / 2, width, edge],
          [0, -depth / 2, width, edge],
          [width / 2, 0, edge, depth],
          [-width / 2, 0, edge, depth],
        ].map(([x, z, w, d], index) => (
          <mesh
            key={index}
            position={[x!, 0.008, z!]}
            material={flatMaterial(PALETTE.safetyOrange)}
          >
            <boxGeometry args={[w!, 0.012, d!]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Yellow gas pipeline on concrete supports, with flange joints. `leakRef` marks the leaking joint. */
export function Pipeline({ leakRef }: { leakRef: React.Ref<Group> }) {
  const length = PIPE_TO_X - PIPE_FROM_X;
  return (
    <group>
      <mesh
        position={[(PIPE_FROM_X + PIPE_TO_X) / 2, PIPE_Y, PIPE_Z]}
        rotation-z={Math.PI / 2}
        material={flatMaterial(PIPE_YELLOW)}
      >
        <cylinderGeometry args={[PIPE_RADIUS, PIPE_RADIUS, length, 8]} />
      </mesh>
      {PIPE_SUPPORTS.map((x) => (
        <group key={x} position={[x, 0, PIPE_Z]}>
          <mesh position-y={0.1} material={flatMaterial(CONCRETE)}>
            <boxGeometry args={[0.16, 0.2, 0.2]} />
          </mesh>
          <mesh position-y={PIPE_Y - 0.04} material={flatMaterial(PALETTE.steelDark)}>
            <boxGeometry args={[0.03, 0.16, 0.16]} />
          </mesh>
        </group>
      ))}
      {FLANGES.map((x, index) => (
        <group key={x} position={[x, PIPE_Y, PIPE_Z]}>
          <mesh rotation-z={Math.PI / 2} material={flatMaterial('#c99a1c')}>
            <cylinderGeometry args={[0.095, 0.095, 0.05, 8]} />
          </mesh>
          {[0, 1, 2, 3].map((bolt) => {
            const angle = (bolt / 4) * Math.PI * 2 + Math.PI / 4;
            return (
              <mesh
                key={bolt}
                position={[0, Math.sin(angle) * 0.075, Math.cos(angle) * 0.075]}
                rotation-z={Math.PI / 2}
                material={flatMaterial(PALETTE.steelDark)}
              >
                <cylinderGeometry args={[0.012, 0.012, 0.075, 5]} />
              </mesh>
            );
          })}
          {index === 0 && <group ref={leakRef} position={[0.02, 0.02, 0.07]} />}
        </group>
      ))}
      {/* End caps */}
      {[PIPE_FROM_X, PIPE_TO_X].map((x) => (
        <mesh
          key={x}
          position={[x, PIPE_Y, PIPE_Z]}
          rotation-z={Math.PI / 2}
          material={flatMaterial('#c99a1c')}
        >
          <cylinderGeometry args={[0.075, 0.075, 0.03, 8]} />
        </mesh>
      ))}
    </group>
  );
}

function setOpacity(material: Material, opacity: number) {
  material.opacity = opacity;
}

/**
 * A gas hazard zone: a translucent floor disc (the tap target, via `ref`), a pulsing rim and a
 * faceted dome. `level` (0..1, read every frame) fades it out once the leak is stopped.
 */
export const HazardZone = forwardRef<
  Group,
  {
    zone: Zone;
    color: string;
    domeHeight: number;
    y: number;
    level: { current: number };
    found: boolean;
  }
>(function HazardZone({ zone, color, domeHeight, y, level, found }, ref) {
  const root = useRef<Group>(null);
  const materials = useMemo(
    () => ({
      disc: new MeshBasicMaterial({
        color,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
      rim: new MeshBasicMaterial({
        color,
        transparent: true,
        depthWrite: false,
        toneMapped: false,
      }),
      dome: new MeshLambertMaterial({
        color,
        flatShading: true,
        transparent: true,
        depthWrite: false,
        side: DoubleSide,
      }),
    }),
    [color],
  );

  useFrame(({ clock }) => {
    const k = Math.max(0, Math.min(1, level.current));
    if (root.current != null) root.current.visible = k > 0.01;
    const pulse = (Math.sin(clock.elapsedTime * (found ? 2 : 3.5)) + 1) / 2;
    setOpacity(materials.disc, k * (found ? 0.36 : 0.2));
    setOpacity(materials.rim, k * (0.5 + pulse * 0.45));
    setOpacity(materials.dome, k * (found ? 0.2 : 0.12));
  });

  return (
    <group ref={root} position={[zone.x, 0, zone.z]}>
      <group ref={ref}>
        <mesh position-y={y} rotation-x={-Math.PI / 2} material={materials.disc} renderOrder={1}>
          <circleGeometry args={[zone.radius, 32]} />
        </mesh>
      </group>
      <mesh
        position-y={y + 0.002}
        rotation-x={-Math.PI / 2}
        material={materials.rim}
        renderOrder={1}
      >
        <ringGeometry args={[zone.radius * 0.93, zone.radius, 40]} />
      </mesh>
      <mesh
        position-y={y}
        scale={[1, domeHeight / zone.radius, 1]}
        material={materials.dome}
        renderOrder={2}
      >
        <sphereGeometry args={[zone.radius, 12, 4, 0, Math.PI * 2, 0, Math.PI / 2]} />
      </mesh>
    </group>
  );
});

const WINDSOCK_HEIGHT = 1.4;

/** Portable orange-and-white windsock on a tripod stand: its tail streams downwind (+x). */
export function Windsock({ position }: { position: Vec3 }) {
  const sock = useRef<Group>(null);
  const radii = [0.09, 0.075, 0.062, 0.05, 0.04];
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (sock.current == null) return;
    sock.current.rotation.y = Math.sin(t * 2.3) * 0.07;
    sock.current.rotation.z = -0.1 + Math.sin(t * 3.1) * 0.04;
  });
  return (
    <group position={[position[0], position[1], position[2]]}>
      <mesh position-y={WINDSOCK_HEIGHT / 2} material={flatMaterial(PALETTE.steel)}>
        <cylinderGeometry args={[0.02, 0.025, WINDSOCK_HEIGHT, 6]} />
      </mesh>
      {[0, 1, 2].map((leg) => {
        const angle = (leg / 3) * Math.PI * 2 + 0.5;
        return (
          <Strut
            key={leg}
            from={[Math.cos(angle) * 0.22, 0, Math.sin(angle) * 0.22]}
            to={[0, 0.35, 0]}
            radius={0.012}
            color={PALETTE.steelDark}
            sides={4}
          />
        );
      })}
      <group ref={sock} position={[0.02, WINDSOCK_HEIGHT - 0.04, 0]}>
        <mesh rotation-y={Math.PI / 2} material={flatMaterial(PALETTE.steelDark)}>
          <torusGeometry args={[0.09, 0.008, 4, 10]} />
        </mesh>
        {radii.slice(0, -1).map((radius, index) => (
          <mesh
            key={index}
            position-x={0.07 + index * 0.13}
            rotation-z={-Math.PI / 2}
            material={flatMaterial(index % 2 === 0 ? PALETTE.safetyOrange : '#f5f5f5', {
              side: DoubleSide,
            })}
          >
            <cylinderGeometry args={[radii[index + 1]!, radius, 0.13, 8, 1, true]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

/** Electrical panel on a post (pump and pit-fan starter). */
export function PumpPanel({ position }: { position: Vec3 }) {
  return (
    <group position={[position[0], position[1], position[2]]}>
      <mesh position-y={0.55} material={flatMaterial(PALETTE.steelDark)}>
        <boxGeometry args={[0.06, 1.1, 0.06]} />
      </mesh>
      <mesh position={[0, 1.15, 0.04]} material={flatMaterial('#9aa3ad')}>
        <boxGeometry args={[0.36, 0.44, 0.14]} />
      </mesh>
      <mesh position={[0, 1.15, 0.112]} material={flatMaterial('#87909a')}>
        <boxGeometry args={[0.3, 0.38, 0.006]} />
      </mesh>
      {/* Warning plate */}
      <mesh position={[0, 1.31, 0.117]} material={flatMaterial(PALETTE.safetyYellow)}>
        <boxGeometry args={[0.16, 0.05, 0.004]} />
      </mesh>
      <mesh position={[0, 1.31, 0.12]} rotation-z={Math.PI} material={flatMaterial(PALETTE.matte)}>
        <circleGeometry args={[0.02, 3]} />
      </mesh>
      {/* Start (green) and stop (red) buttons */}
      <mesh
        position={[FAN_BUTTON[0], FAN_BUTTON[1], FAN_BUTTON[2]]}
        rotation-x={Math.PI / 2}
        material={flatMaterial('#22a55a')}
      >
        <cylinderGeometry args={[0.032, 0.032, 0.03, 10]} />
      </mesh>
      <mesh
        position={[0.07, 1.14, 0.12]}
        rotation-x={Math.PI / 2}
        material={flatMaterial('#d62828')}
      >
        <cylinderGeometry args={[0.032, 0.032, 0.03, 10]} />
      </mesh>
      <mesh position={[0, 1.02, 0.117]} material={flatMaterial(PALETTE.matte)}>
        <boxGeometry args={[0.2, 0.04, 0.006]} />
      </mesh>
    </group>
  );
}

// Seven-segment digits for the gathering-point numbers (no fonts or textures needed).
const SEGMENTS: Record<string, Array<[number, number, number, number]>> = {
  a: [[0, 0.06, 0.05, 0.012]],
  b: [[0.025, 0.03, 0.012, 0.055]],
  c: [[0.025, -0.03, 0.012, 0.055]],
  d: [[0, -0.06, 0.05, 0.012]],
  e: [[-0.025, -0.03, 0.012, 0.055]],
  f: [[-0.025, 0.03, 0.012, 0.055]],
  g: [[0, 0, 0.05, 0.012]],
};
const DIGITS: Record<number, string> = { 1: 'bc', 2: 'abged' };

function Digit({ value }: { value: number }) {
  const bars = [...(DIGITS[value] ?? '')].flatMap((segment) => SEGMENTS[segment] ?? []);
  return (
    <group>
      {bars.map(([x, y, w, h], index) => (
        <mesh key={index} position={[x, y, 0]} material={flatMaterial(PALETTE.matte)}>
          <boxGeometry args={[w, h, 0.004]} />
        </mesh>
      ))}
    </group>
  );
}

/** Green gathering-point sign with a number. `ref` is a generous tap area. */
export const GatheringSign = forwardRef<Group, { position: Vec3; number: 1 | 2 }>(
  function GatheringSign({ position, number }, ref) {
    const people = [-0.075, -0.025, 0.025, 0.075];
    return (
      <group position={[position[0], position[1], position[2]]}>
        <mesh position-y={0.8} material={flatMaterial(PALETTE.steel)}>
          <boxGeometry args={[0.05, 1.6, 0.05]} />
        </mesh>
        <mesh position={[0, 1.62, 0.03]} material={glowGreen}>
          <boxGeometry args={[0.4, 0.4, 0.025]} />
        </mesh>
        {people.map((x) => (
          <group key={x} position={[x, 1.6, 0.045]}>
            <mesh position-y={0.04} material={glowWhite}>
              <circleGeometry args={[0.016, 6]} />
            </mesh>
            <mesh position-y={-0.012} material={glowWhite}>
              <planeGeometry args={[0.026, 0.065]} />
            </mesh>
          </group>
        ))}
        {/* Number plate */}
        <mesh position={[0, 1.31, 0.03]} material={glowWhite}>
          <boxGeometry args={[0.16, 0.18, 0.02]} />
        </mesh>
        <group position={[0, 1.31, 0.042]}>
          <Digit value={number} />
        </group>
        <group ref={ref} position-y={1.0}>
          <mesh visible={false}>
            <boxGeometry args={[0.6, 2.0, 0.4]} />
          </mesh>
        </group>
      </group>
    );
  },
);

/** Emergency phone on a striped post, with a beacon that flashes once a call is made. */
export const PhonePost = forwardRef<Group, { position: Vec3; active: boolean }>(function PhonePost(
  { position, active },
  ref,
) {
  const beacon = useMemo(() => new MeshBasicMaterial({ color: '#6b4a00', toneMapped: false }), []);
  const light = useRef<PointLight>(null);
  useFrame(({ clock }) => {
    const on = active && Math.floor(clock.elapsedTime * 3) % 2 === 0;
    beacon.color.set(on ? '#ffb020' : '#6b4a00');
    if (light.current != null) light.current.intensity = on ? 1.8 : 0;
  });
  return (
    <group position={[position[0], position[1], position[2]]}>
      {[0, 1, 2, 3, 4].map((band) => (
        <mesh
          key={band}
          position-y={0.11 + band * 0.22}
          material={flatMaterial(band % 2 === 0 ? PALETTE.safetyYellow : PALETTE.matte)}
        >
          <boxGeometry args={[0.07, 0.22, 0.07]} />
        </mesh>
      ))}
      <mesh position={[0, 1.2, 0.03]} material={flatMaterial('#2f5fd6')}>
        <boxGeometry args={[0.18, 0.26, 0.1]} />
      </mesh>
      <mesh position={[0, 1.22, 0.082]} material={flatMaterial('#1b2a4a')}>
        <boxGeometry args={[0.12, 0.16, 0.006]} />
      </mesh>
      {/* Handset */}
      <mesh position={[0.11, 1.2, 0.04]} material={flatMaterial(PALETTE.matte)}>
        <boxGeometry args={[0.035, 0.2, 0.05]} />
      </mesh>
      <mesh position-y={1.38} material={beacon}>
        <cylinderGeometry args={[0.04, 0.045, 0.07, 8]} />
      </mesh>
      <pointLight
        ref={light}
        position={[0, 1.42, 0.1]}
        color="#ffb020"
        distance={2}
        intensity={0}
      />
      <group ref={ref} position={[0, 1.0, 0.03]}>
        <mesh visible={false}>
          <boxGeometry args={[0.45, 0.8, 0.35]} />
        </mesh>
      </group>
    </group>
  );
});

/**
 * Valve-pit manhole: concrete collar, ladder and a dark shaft. In AR a depth-only ring around
 * the opening hides everything below the real floor except what is seen through the hole, so
 * the shaft (and anyone climbing down it) reads as a hole in the floor. In 3D mode the room's
 * floor does that, and a black disc stands in for the depth.
 */
export function ManholePit({ mode }: { mode: 'ar' | 'fallback3d' }) {
  const collar = useMemo(
    () =>
      new LatheGeometry(
        [
          new Vector2(MANHOLE_OPENING, 0),
          new Vector2(MANHOLE_OPENING, COLLAR_HEIGHT),
          new Vector2(MANHOLE_COLLAR, COLLAR_HEIGHT),
          new Vector2(MANHOLE_COLLAR, 0),
        ],
        16,
      ),
    [],
  );
  const rungs = useMemo(() => {
    const ys: number[] = [];
    for (let y = 0.25; y > -SHAFT_DEPTH; y -= 0.22) ys.push(y);
    return ys;
  }, []);
  const railLength = SHAFT_DEPTH + 0.35;
  return (
    <group position={[MANHOLE[0], 0, MANHOLE[2]]}>
      <mesh geometry={collar} material={flatMaterial(CONCRETE, { side: DoubleSide })} />
      <mesh position-y={-SHAFT_DEPTH / 2} material={flatMaterial('#3a3f45', { side: BackSide })}>
        <cylinderGeometry args={[MANHOLE_OPENING, MANHOLE_OPENING, SHAFT_DEPTH, 16, 1, true]} />
      </mesh>
      <mesh position-y={-SHAFT_DEPTH} rotation-x={-Math.PI / 2} material={pitBlack}>
        <circleGeometry args={[MANHOLE_OPENING, 16]} />
      </mesh>
      {/* Ladder on the back wall, poking out above the collar */}
      <group position-z={-MANHOLE_OPENING + 0.05}>
        {[-0.12, 0.12].map((x) => (
          <mesh
            key={x}
            position={[x, 0.35 - railLength / 2, 0]}
            material={flatMaterial(PALETTE.steel)}
          >
            <boxGeometry args={[0.025, railLength, 0.025]} />
          </mesh>
        ))}
        {rungs.map((y) => (
          <mesh
            key={y}
            position-y={y}
            rotation-z={Math.PI / 2}
            material={flatMaterial(PALETTE.steel)}
          >
            <cylinderGeometry args={[0.01, 0.01, 0.24, 5]} />
          </mesh>
        ))}
      </group>
      {mode === 'ar' ? (
        <mesh position-y={0.001} rotation-x={-Math.PI / 2} material={floorMask} renderOrder={-1}>
          <ringGeometry args={[MANHOLE_OPENING, 4, 40]} />
        </mesh>
      ) : (
        <mesh position-y={0.003} rotation-x={-Math.PI / 2} material={pitBlack}>
          <circleGeometry args={[MANHOLE_OPENING, 16]} />
        </mesh>
      )}
    </group>
  );
}

/** The manhole's cover, lifted off and laid on the floor. */
export function ManholeCover({ position }: { position: Vec3 }) {
  return (
    <group position={[position[0], position[1], position[2]]}>
      <mesh position-y={0.015} material={flatMaterial('#4a4f55')}>
        <cylinderGeometry args={[0.34, 0.34, 0.03, 12]} />
      </mesh>
      {[-0.12, 0, 0.12].map((x) => (
        <mesh key={x} position={[x, 0.032, 0]} material={flatMaterial('#3a3f45')}>
          <boxGeometry args={[0.04, 0.006, 0.5]} />
        </mesh>
      ))}
    </group>
  );
}

const winchPosition = new Vector3(...TRIPOD_FEET[WINCH_LEG]!).lerp(
  new Vector3(...TRIPOD_APEX),
  WINCH_AT,
);
/** Rescue tripod over the manhole, with a pulley and a hand winch. `crankRef` turns the handle. */
export function RescueTripod({ crankRef }: { crankRef: React.Ref<Group> }) {
  return (
    <group>
      {TRIPOD_FEET.map((foot, index) => (
        <group key={index}>
          <Strut from={foot} to={TRIPOD_APEX} radius={0.022} color={TRIPOD_YELLOW} />
          <mesh position={[foot[0], 0.01, foot[2]]} material={flatMaterial(PALETTE.matte)}>
            <cylinderGeometry args={[0.045, 0.05, 0.02, 6]} />
          </mesh>
        </group>
      ))}
      <mesh
        position={[TRIPOD_APEX[0], TRIPOD_APEX[1], TRIPOD_APEX[2]]}
        material={flatMaterial(PALETTE.steelDark)}
      >
        <boxGeometry args={[0.12, 0.08, 0.12]} />
      </mesh>
      <mesh
        position={[PULLEY_POINT[0], PULLEY_POINT[1] + 0.03, PULLEY_POINT[2]]}
        rotation-x={Math.PI / 2}
        material={flatMaterial(PALETTE.steel)}
      >
        <cylinderGeometry args={[0.045, 0.045, 0.025, 10]} />
      </mesh>
      <group position={winchPosition}>
        <mesh material={flatMaterial('#c0392b')}>
          <boxGeometry args={[0.1, 0.13, 0.1]} />
        </mesh>
        <mesh position-z={0.06} rotation-x={Math.PI / 2} material={flatMaterial(PALETTE.matte)}>
          <cylinderGeometry args={[0.045, 0.045, 0.03, 10]} />
        </mesh>
        <group ref={crankRef} position-z={0.085}>
          <mesh position-x={0.045} material={flatMaterial(PALETTE.steel)}>
            <boxGeometry args={[0.09, 0.014, 0.014]} />
          </mesh>
          <mesh
            position={[0.09, 0, 0.025]}
            rotation-x={Math.PI / 2}
            material={flatMaterial(PALETTE.matte)}
          >
            <cylinderGeometry args={[0.012, 0.012, 0.05, 6]} />
          </mesh>
        </group>
      </group>
    </group>
  );
}

/** Portable ventilation blower; `fanRef` spins when it runs. Intake faces upwind (-x). */
export function Blower({ position, fanRef }: { position: Vec3; fanRef: React.Ref<Group> }) {
  return (
    <group position={[position[0], position[1], position[2]]}>
      {[-0.1, 0.1].map((z) => (
        <mesh key={z} position={[0, 0.02, z]} material={flatMaterial(PALETTE.matte)}>
          <boxGeometry args={[0.32, 0.03, 0.03]} />
        </mesh>
      ))}
      <mesh position-y={0.17} rotation-z={Math.PI / 2} material={flatMaterial('#f5b800')}>
        <cylinderGeometry args={[0.15, 0.15, 0.26, 12]} />
      </mesh>
      <mesh
        position={[-0.132, 0.17, 0]}
        rotation-z={Math.PI / 2}
        material={flatMaterial(PALETTE.matte)}
      >
        <cylinderGeometry args={[0.135, 0.135, 0.006, 12]} />
      </mesh>
      <group ref={fanRef} position={[-0.14, 0.17, 0]}>
        {[0, 1, 2].map((blade) => (
          <mesh
            key={blade}
            rotation-x={(blade / 3) * Math.PI * 2}
            material={flatMaterial(PALETTE.steel)}
          >
            <boxGeometry args={[0.008, 0.22, 0.04]} />
          </mesh>
        ))}
      </group>
      <mesh position={[0.17, 0.17, 0]} rotation-z={Math.PI / 2} material={flatMaterial('#d39e00')}>
        <cylinderGeometry args={[0.06, 0.09, 0.08, 10]} />
      </mesh>
      <mesh position={[0, 0.33, 0]} material={flatMaterial(PALETTE.matte)}>
        <boxGeometry args={[0.2, 0.025, 0.03]} />
      </mesh>
    </group>
  );
}

/** Entry permit on a board; a green tick appears once it is signed. */
export function PermitBoard({ position, signed }: { position: Vec3; signed: boolean }) {
  return (
    <group position={[position[0], position[1], position[2]]}>
      <mesh position-y={0.6} material={flatMaterial(PALETTE.steel)}>
        <boxGeometry args={[0.04, 1.2, 0.04]} />
      </mesh>
      <mesh position={[0, 1.25, 0.025]} material={flatMaterial('#2f5fd6')}>
        <boxGeometry args={[0.44, 0.34, 0.025]} />
      </mesh>
      <mesh position={[0, 1.25, 0.04]} material={glowWhite}>
        <planeGeometry args={[0.32, 0.26]} />
      </mesh>
      {[0.08, 0.04, 0, -0.04].map((y) => (
        <mesh key={y} position={[-0.03, 1.25 + y, 0.042]} material={flatMaterial('#8a96a3')}>
          <planeGeometry args={[0.2, 0.012]} />
        </mesh>
      ))}
      <group position={[0.07, 1.16, 0.045]} visible={signed}>
        <mesh position={[-0.025, -0.005, 0]} rotation-z={-0.8} material={glowGreen}>
          <boxGeometry args={[0.05, 0.016, 0.004]} />
        </mesh>
        <mesh position={[0.02, 0.02, 0]} rotation-z={0.9} material={glowGreen}>
          <boxGeometry args={[0.09, 0.016, 0.004]} />
        </mesh>
      </group>
    </group>
  );
}

const screenOrder = GASES;

/**
 * Handheld 4-gas monitor (held in view during the tests). Its four status bars show the live
 * readings: green in the safe range, red outside it. `probeRef` marks the sampling probe.
 */
export function GasMonitorModel({ probeRef }: { probeRef: React.Ref<Group> }) {
  const bars = useMemo(
    () => screenOrder.map(() => new MeshBasicMaterial({ color: STATUS_GREEN, toneMapped: false })),
    [],
  );
  useFrame(() => {
    const { display } = gas();
    screenOrder.forEach((name, index) => {
      bars[index]!.color.set(gasStatus(name, display[name]) === 'ok' ? STATUS_GREEN : STATUS_RED);
    });
  });
  return (
    <group>
      <mesh material={flatMaterial(PALETTE.safetyYellow)}>
        <boxGeometry args={[0.075, 0.13, 0.035]} />
      </mesh>
      <mesh position={[0, -0.045, 0.019]} material={flatMaterial(PALETTE.matte)}>
        <boxGeometry args={[0.06, 0.03, 0.004]} />
      </mesh>
      <mesh position={[0, 0.022, 0.0185]} material={flatMaterial('#10161d')}>
        <boxGeometry args={[0.058, 0.06, 0.004]} />
      </mesh>
      {bars.map((material, index) => (
        <mesh
          key={index}
          position={[index % 2 === 0 ? -0.013 : 0.013, index < 2 ? 0.036 : 0.008, 0.021]}
          material={material}
        >
          <planeGeometry args={[0.022, 0.018]} />
        </mesh>
      ))}
      {/* Probe socket and a short hose stub; the probe line starts at the tip. */}
      <mesh position={[0.025, 0.075, 0]} material={flatMaterial(PALETTE.matte)}>
        <cylinderGeometry args={[0.007, 0.007, 0.03, 5]} />
      </mesh>
      <group ref={probeRef} position={[0.025, 0.09, 0]} />
    </group>
  );
}

/** Handheld radio; its light turns green while Talk is held. */
export function RadioModel() {
  const led = useMemo(() => new MeshBasicMaterial({ color: '#2a3a2e', toneMapped: false }), []);
  useFrame(() => {
    led.color.set(engine().holdPressed ? '#3dff7a' : '#2a3a2e');
  });
  return (
    <group>
      <mesh material={flatMaterial('#22272e')}>
        <boxGeometry args={[0.055, 0.11, 0.03]} />
      </mesh>
      <mesh position={[0, 0.02, 0.016]} material={flatMaterial('#3a434d')}>
        <boxGeometry args={[0.04, 0.035, 0.003]} />
      </mesh>
      <mesh position={[0.015, 0.1, 0]} material={flatMaterial(PALETTE.matte)}>
        <cylinderGeometry args={[0.006, 0.008, 0.09, 5]} />
      </mesh>
      <mesh position={[-0.015, 0.058, 0]} material={led}>
        <boxGeometry args={[0.01, 0.006, 0.01]} />
      </mesh>
    </group>
  );
}

/** Full-face mask of the breathing apparatus, in WorkerAvatar head coordinates. */
export function EntrantMask() {
  return (
    <group position={[0, 0.075, 0.09]}>
      <mesh material={flatMaterial('#1d2228')}>
        <boxGeometry args={[0.15, 0.12, 0.07]} />
      </mesh>
      <mesh position={[0, 0.03, 0.036]} material={flatMaterial('#7fb8e6')}>
        <boxGeometry args={[0.11, 0.05, 0.004]} />
      </mesh>
      <mesh position={[0, -0.035, 0.04]} material={flatMaterial(PALETTE.matte)}>
        <cylinderGeometry args={[0.022, 0.022, 0.03, 6]} />
      </mesh>
    </group>
  );
}

/** Gear worn by the entrant, in WorkerAvatar body coordinates (the mask is EntrantMask). */
export function EntrantGear({ worn, alarm }: { worn: readonly string[]; alarm: boolean }) {
  const led = useRef<Mesh>(null);
  const ledMaterial = useMemo(
    () => new MeshBasicMaterial({ color: '#3dff7a', toneMapped: false }),
    [],
  );
  useFrame(({ clock }) => {
    const flash = alarm && Math.floor(clock.elapsedTime * 6) % 2 === 0;
    ledMaterial.color.set(alarm ? (flash ? '#ff2d2d' : '#5a0d0d') : '#3dff7a');
  });
  const has = (id: string) => worn.includes(id);
  return (
    <group>
      {has('breathing-apparatus') && (
        <group>
          <mesh position={[0, 0.3, -0.2]} material={flatMaterial('#2b2f35')}>
            <cylinderGeometry args={[0.07, 0.07, 0.42, 8]} />
          </mesh>
          <mesh position={[0, 0.42, -0.2]} material={flatMaterial(PALETTE.safetyYellow)}>
            <cylinderGeometry args={[0.072, 0.072, 0.05, 8]} />
          </mesh>
          {/* Shoulder straps and the regulator hose over the shoulder to the mask. */}
          {[-0.1, 0.1].map((x) => (
            <mesh key={x} position={[x, 0.5, 0]} material={flatMaterial('#1d2228')}>
              <boxGeometry args={[0.04, 0.02, 0.29]} />
            </mesh>
          ))}
          <mesh
            position={[0.12, 0.5, -0.04]}
            rotation-x={0.6}
            material={flatMaterial(PALETTE.matte)}
          >
            <cylinderGeometry args={[0.012, 0.012, 0.3, 5]} />
          </mesh>
        </group>
      )}
      {has('harness') && (
        <group>
          {[-0.09, 0.09].map((x) => (
            <mesh key={x} position={[x, 0.3, 0.138]} material={flatMaterial('#1f6feb')}>
              <boxGeometry args={[0.035, 0.5, 0.008]} />
            </mesh>
          ))}
          <mesh position={[0, 0.4, 0.142]} material={flatMaterial('#1f6feb')}>
            <boxGeometry args={[0.2, 0.03, 0.008]} />
          </mesh>
          <mesh position={[0, 0.02, 0]} material={flatMaterial('#1f6feb')}>
            <boxGeometry args={[0.34, 0.045, 0.24]} />
          </mesh>
          {/* Back D-ring for the lifeline */}
          <mesh position={[0, 0.56, -0.155]} material={flatMaterial(PALETTE.steel)}>
            <torusGeometry args={[0.03, 0.007, 4, 8]} />
          </mesh>
        </group>
      )}
      {has('gas-detector') && (
        <group position={[-0.1, 0.44, 0.145]}>
          <mesh material={flatMaterial(PALETTE.safetyYellow)}>
            <boxGeometry args={[0.055, 0.075, 0.025]} />
          </mesh>
          <mesh ref={led} position={[0, 0.026, 0.014]} material={ledMaterial}>
            <boxGeometry args={[0.02, 0.01, 0.004]} />
          </mesh>
        </group>
      )}
    </group>
  );
}

/**
 * Wraps props that are brought in later: they grow into place around `at` when `shown`
 * turns true (and are simply there if already shown on mount).
 */
export function PopIn({ shown, at, children }: { shown: boolean; at: Vec3; children: ReactNode }) {
  const group = useRef<Group>(null);
  const scale = useRef(shown ? 1 : 0);
  useFrame((_state, delta) => {
    const node = group.current;
    if (node == null) return;
    const goal = shown ? 1 : 0;
    scale.current += (goal - scale.current) * Math.min(1, delta * 7);
    if (Math.abs(goal - scale.current) < 0.002) scale.current = goal;
    // Ease-out-back overshoot on the way in.
    const k = scale.current;
    const s = k <= 0 ? 0.0001 : k * (1 + 0.25 * Math.sin(k * Math.PI));
    node.scale.setScalar(s);
    node.visible = k > 0.001;
  });
  return (
    <group position={[at[0], at[1], at[2]]}>
      <group ref={group}>
        <group position={[-at[0], -at[1], -at[2]]}>{children}</group>
      </group>
    </group>
  );
}
