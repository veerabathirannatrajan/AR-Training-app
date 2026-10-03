import { useFrame } from '@react-three/fiber';
import { forwardRef, useId, useMemo, useRef, type ReactNode } from 'react';
import type { Group } from 'three';
import { PALETTE } from '../palette';
import {
  avatarGeometry,
  avatarMaterial,
  DEFAULT_LOOK,
  shoulderJointX,
  type AvatarBuild,
} from './avatar/geometry';
import { HIP_HEIGHT, legAngles, RIG } from './avatar/rig';

/** Pose inputs read every frame, so the avatar animates without React re-renders. */
export interface AvatarPose {
  /** Metres per second along the route (drives the walk cycle). */
  speed: number;
  /** 0 = standing, 1 = fully crouched. */
  crouch: number;
  /** 0..1 coughing into a hand when standing in smoke. */
  distress: number;
  /** 0..1 the +x arm raised forward (reaching for something, turning a crank). */
  reach?: number;
  /** 0..1 unconscious: head and limbs hang (e.g. while being hauled out of a pit). */
  limp?: number;
}

/** How far the hips drop in a full crouch, metres. */
const CROUCH_DROP = 0.42;
/** Half a stride at full walking speed, metres. */
const STRIDE = 0.2;
const STEP_LIFT = 0.06;
/** Limbs by index: 0 on the -x side, 1 on the +x side. */
const LIMBS = [0, 1] as const;
const sideOf = (limb: 0 | 1) => (limb === 0 ? -1 : 1);

const mix = (from: number, to: number, k: number) => from + (to - from) * k;

/** A stable per-avatar phase, so several avatars do not idle in step. */
function seedFrom(id: string): number {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) % 997;
  return hash * 0.13;
}

/**
 * Low-poly site worker, about 1.72 m tall, facing +z: hard hat, hi-vis vest over a work shirt,
 * cargo trousers with reflective bands and safety boots, with a face and jointed limbs.
 * Animated procedurally from a mutable pose: a walk cycle whose feet plant on the floor (leg
 * IK), real crouching (hips drop, knees bend), coughing into a hand, reaching, idle glances and
 * going limp.
 *
 * `children` are worn on the torso (body coordinates: hip joint at y = 0, chest front at
 * z ≈ 0.13, top of the neck at y = 0.6) and `headGear` on the head (top of the neck at the
 * origin, face front at z ≈ 0.1), so gear follows every pose.
 */
export const WorkerAvatar = forwardRef<
  Group,
  {
    pose: { current: AvatarPose };
    helmetColor?: string;
    /** Wearing the hard hat (default true). */
    helmet?: boolean;
    vestColor?: string;
    shirtColor?: string;
    skinColor?: string;
    build?: AvatarBuild;
    mustache?: boolean;
    headGear?: ReactNode;
    children?: ReactNode;
  }
>(function WorkerAvatar(
  {
    pose,
    helmetColor = PALETTE.safetyYellow,
    helmet = true,
    vestColor = DEFAULT_LOOK.vest,
    shirtColor = DEFAULT_LOOK.shirt,
    skinColor = DEFAULT_LOOK.skin,
    build = DEFAULT_LOOK.build,
    mustache = DEFAULT_LOOK.mustache,
    headGear,
    children,
  },
  ref,
) {
  const seed = seedFrom(useId());
  const geometry = useMemo(
    () =>
      avatarGeometry({
        ...DEFAULT_LOOK,
        helmet: helmetColor,
        vest: vestColor,
        shirt: shirtColor,
        skin: skinColor,
        build,
        mustache,
      }),
    [helmetColor, vestColor, shirtColor, skinColor, build, mustache],
  );
  const shoulderX = shoulderJointX(build);

  const hips = useRef<Group>(null);
  const torso = useRef<Group>(null);
  const head = useRef<Group>(null);
  const thighs = [useRef<Group>(null), useRef<Group>(null)] as const;
  const knees = [useRef<Group>(null), useRef<Group>(null)] as const;
  const ankles = [useRef<Group>(null), useRef<Group>(null)] as const;
  const shoulders = [useRef<Group>(null), useRef<Group>(null)] as const;
  const elbows = [useRef<Group>(null), useRef<Group>(null)] as const;
  const phase = useRef(0);
  const crouch = useRef(0);
  const slack = useRef(0);

  useFrame(({ clock }, delta) => {
    const { speed, crouch: targetCrouch, distress, reach = 0, limp = 0 } = pose.current;
    const t = clock.elapsedTime;
    phase.current += delta * speed * 9;
    crouch.current += (targetCrouch - crouch.current) * Math.min(1, delta * 6);
    slack.current += (limp - slack.current) * Math.min(1, delta * 4);
    const c = crouch.current;
    const l = slack.current;
    const p = phase.current;
    const moving = Math.min(1, speed * 3) * (1 - l);

    // Hips: crouching lowers them; walking lowers them a little when the feet are apart.
    const hipY = HIP_HEIGHT - c * CROUCH_DROP - Math.abs(Math.sin(p)) * 0.03 * moving;
    const twist = Math.sin(p) * 0.07 * moving;
    if (hips.current != null) {
      hips.current.position.y = hipY;
      hips.current.rotation.y = twist;
    }

    const stride = STRIDE * moving * (1 - c * 0.4);
    LIMBS.forEach((index) => {
      const side = sideOf(index);
      // Each foot: forward and back through the stride, lifted while it swings forward.
      const legPhase = p + (side > 0 ? 0 : Math.PI);
      const forward = Math.sin(legPhase) * stride;
      const lift = Math.max(0, Math.cos(legPhase)) * STEP_LIFT * moving;
      const leg = legAngles(forward, hipY - RIG.ankle - lift);
      const thigh = thighs[index].current;
      const knee = knees[index].current;
      const ankle = ankles[index].current;
      if (thigh != null) thigh.rotation.x = mix(leg.hip, -0.15, l);
      if (knee != null) knee.rotation.x = mix(leg.knee, 0.3, l);
      if (ankle != null) ankle.rotation.x = mix(leg.ankle, 0.45, l);

      // Arms swing against the leg on the same side; elbows bend more on the forward swing.
      const back = Math.sin(legPhase) * 0.45 * moving;
      let shoulderPitch = back * (1 - c * 0.5) - c * 0.35;
      let shoulderRoll = side * (0.07 + c * 0.05);
      let elbow = -(0.12 + Math.max(0, -back) * 0.7 + moving * 0.1 + c * 0.25);
      if (side > 0 && reach > 0) {
        shoulderPitch = mix(shoulderPitch, -1.45, reach);
        elbow = mix(elbow, -0.15, reach);
      }
      if (side < 0 && distress > 0) {
        // Hand up to the mouth.
        shoulderPitch = mix(shoulderPitch, -0.95, distress);
        shoulderRoll = mix(shoulderRoll, 0.35, distress);
        elbow = mix(elbow, -2.0, distress);
      }
      const shoulder = shoulders[index].current;
      if (shoulder != null) {
        shoulder.rotation.x = mix(shoulderPitch, 0.1, l);
        shoulder.rotation.z = mix(shoulderRoll, side * 0.12, l);
      }
      const forearm = elbows[index].current;
      if (forearm != null) forearm.rotation.x = mix(elbow, -0.05, l);
    });

    // Torso: leans into a crouch, counter-twists the hips, shakes with a cough, breathes.
    if (torso.current != null) {
      torso.current.rotation.x = c * 0.45 + moving * 0.05 + Math.sin(t * 18) * distress * 0.05;
      torso.current.rotation.y = -twist * 1.6;
      torso.current.position.y = Math.sin(t * 1.7 + seed) * 0.003 * (1 - l);
    }

    // Head: keeps the eyes forward in a crouch, glances around when idle, drops when limp.
    if (head.current != null) {
      const idle = (1 - moving) * (1 - reach) * (1 - distress) * (1 - l);
      head.current.rotation.y =
        Math.sin(t * 0.33 + seed) * 0.35 * idle + Math.sin(t * 0.9 + seed) * 0.03;
      head.current.rotation.x =
        -c * 0.3 +
        distress * (0.18 + Math.sin(t * 18 + 1) * 0.08) +
        Math.sin(t * 0.27 + seed * 2) * 0.06 * idle +
        l * 0.6;
    }
  });

  return (
    <group ref={ref}>
      <group ref={hips} position-y={HIP_HEIGHT}>
        {LIMBS.map((index) => (
          <group key={index} ref={thighs[index]} position={[sideOf(index) * RIG.hipX, 0, 0]}>
            <mesh geometry={geometry.thigh[index]} material={avatarMaterial} />
            <group ref={knees[index]} position-y={-RIG.thigh}>
              <mesh geometry={geometry.shin} material={avatarMaterial} />
              <group ref={ankles[index]} position-y={-RIG.shin}>
                <mesh geometry={geometry.boot} material={avatarMaterial} />
              </group>
            </group>
          </group>
        ))}
        <group ref={torso}>
          <mesh geometry={geometry.torso} material={avatarMaterial} />
          {LIMBS.map((index) => (
            <group
              key={index}
              ref={shoulders[index]}
              position={[sideOf(index) * shoulderX, RIG.shoulderY, 0]}
            >
              <mesh geometry={geometry.upperArm} material={avatarMaterial} />
              <group ref={elbows[index]} position-y={-RIG.upperArm}>
                <mesh geometry={geometry.forearm[index]} material={avatarMaterial} />
              </group>
            </group>
          ))}
          <group ref={head} position-y={RIG.neckTop}>
            <mesh geometry={geometry.head} material={avatarMaterial} />
            <mesh geometry={geometry.helmet} material={avatarMaterial} visible={helmet} />
            {headGear}
          </group>
          {children}
        </group>
      </group>
    </group>
  );
});
