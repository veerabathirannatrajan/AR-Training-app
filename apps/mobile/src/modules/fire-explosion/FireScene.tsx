import { FIRE_EXPLOSION } from '@ar-training/shared';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Vector3, type Group } from 'three';
import { CameraAttached } from '../../engine/CameraAttached';
import { LowPolyFire } from '../../engine/effects/LowPolyFire';
import { FloorArrows, SmokePlume, Sparks, SprayJet } from '../../engine/effects/particles';
import { engine, takeSwipe, useEngineStore } from '../../engine/engineStore';
import { haptic, sfx } from '../../engine/feedback/sfx';
import { angleDelta, headingOf } from '../../engine/gestures';
import { useAimTarget, useInteractable } from '../../engine/interaction';
import { HighlightRing } from '../../engine/primitives/HighlightRing';
import { SmokePuffs } from '../../engine/primitives/SmokePuffs';
import { WorkerAvatar, type AvatarPose } from '../../engine/primitives/WorkerAvatar';
import {
  runner,
  useFact,
  useRunnerStore,
  useStepActive,
  useStepCompleted,
  useStepCurrent,
} from '../../engine/runner/runnerStore';
import { usePlacementClock } from '../../engine/runner/usePlacementClock';
import { WorldLabel } from '../../engine/WorldLabel';
import { useLocalized } from '../../i18n/localized';
import {
  EXTINGUISHER_STYLE,
  EXTINGUISHER_TYPES,
  isExtinguisherType,
  type ExtinguisherType,
} from './extinguishers';
import {
  AREA,
  ASSEMBLY,
  AVATAR_START,
  BLOCK_AT,
  CALL_POINT,
  EXIT_A,
  EXIT_B,
  FIRE_BASE,
  LIFT,
  OUTSIDE_Z,
  POWER_STRIP,
  RACK,
  RACK_SLOTS,
  ROUTE_TO_EXIT_A,
  ROUTE_TO_EXIT_B_TAIL,
  WORKSTATION,
} from './layout';
import {
  AreaFloor,
  AssemblyPointSign,
  CallPoint,
  ExitDoor,
  ExtinguisherModel,
  ExtinguisherStand,
  LiftDoor,
  PowerStrip,
  Workstation,
} from './props';

type Point = readonly [number, number];

/** Seconds the crosshair must rest on the base of the fire (Aim). */
const AIM_SECONDS = 1;
/** Seconds of discharge on target before Squeeze counts. */
const SQUEEZE_SECONDS = 1.2;
/** Direction changes across the base needed to put the fire out (Sweep). */
const SWEEP_PASSES = 4;
/** Minimum swing (radians of heading) between direction changes for a sweep to count. */
const SWEEP_MIN_SWING = 0.05;
const HINT_AFTER_SECONDS = 1.2;
const CROUCHED_SPEED = 0.42;
const STANDING_SPEED = 0.6;
/** Standing up while moving through smoke for this long costs points. */
const SMOKE_EXPOSURE_SECONDS = 0.6;

function useOptionLabel(stepId: string, optionId: string): string {
  const localize = useLocalized();
  const option = FIRE_EXPLOSION.steps
    .find((step) => step.id === stepId)
    ?.options?.find((candidate) => candidate.id === optionId);
  return option != null ? localize(option.label).text : optionId;
}

export function FireScene() {
  usePlacementClock();
  const swept = useStepCompleted('pass-sweep');
  // Per-frame fire state shared by the effects (refs, not React state).
  const fireRef = useRef(1);
  const exitFireRef = useRef(0);
  const plumeRef = useRef(1);
  const sparksRef = useRef(true);

  // Retraining can start after the fire is out: reflect that immediately.
  useEffect(() => {
    if (swept) {
      fireRef.current = 0;
      sparksRef.current = false;
    }
  }, [swept]);

  useFrame(() => {
    plumeRef.current = Math.max(fireRef.current, swept ? 0.35 : 0);
  });

  return (
    <group>
      <AreaFloor />
      <Workstation position={WORKSTATION} burnt={swept} />
      <PowerStrip position={POWER_STRIP} />
      <group position={FIRE_BASE}>
        <LowPolyFire intensity={fireRef} radius={0.3} height={0.62} />
        <SmokePlume strength={plumeRef} height={1.6} />
      </group>
      <group position={[POWER_STRIP[0], 0.04, POWER_STRIP[2]]}>
        <LowPolyFire
          intensity={fireRef}
          radius={0.1}
          height={0.28}
          shards={10}
          embers={10}
          light={false}
          seed={21}
        />
        <Sparks active={sparksRef} />
      </group>
      <AlarmStep />
      <ExtinguisherRack />
      <PassSteps fireRef={fireRef} sparksRef={sparksRef} />
      <RoomSmoke />
      <CrouchUnderSmoke />
      <Evacuation exitFireRef={exitFireRef} />
    </group>
  );
}

// ---------------------------------------------------------------------------

function AlarmStep() {
  const { t } = useTranslation('fire');
  const active = useStepActive('raise-alarm');
  const raised = useStepCompleted('raise-alarm');
  const callPoint = useRef<Group>(null);

  useInteractable(callPoint, {
    id: 'call-point',
    enabled: active,
    onTap: () => {
      runner().completeStep('raise-alarm', { detail: 'call-point' });
      const siren = sfx.siren();
      haptic.success();
      window.setTimeout(() => siren?.stop(), 5000);
    },
  });

  return (
    <>
      <CallPoint ref={callPoint} position={CALL_POINT} active={raised} />
      <HighlightRing position={CALL_POINT} radius={0.22} visible={active} />
      <WorldLabel
        position={[CALL_POINT[0], 1.5, CALL_POINT[2]]}
        title={t('labels.callPoint')}
        subtitle={t('labels.tapToRaise')}
        variant="danger"
        visible={active}
      />
    </>
  );
}

// ---------------------------------------------------------------------------

function RackExtinguisher({ type, slot }: { type: ExtinguisherType; slot: number }) {
  const { t } = useTranslation('fire');
  const ref = useRef<Group>(null);
  const alarmActive = useStepActive('raise-alarm');
  const chooseActive = useStepActive('choose-extinguisher');
  const chosen = useFact('choose-extinguisher');
  const preview = useFact('preview-extinguisher');
  const label = useOptionLabel('choose-extinguisher', type);
  const inHand = chosen === type;
  const x = RACK[0] + slot;
  const z = RACK[2];

  useInteractable(ref, {
    id: `extinguisher-${type}`,
    enabled: (alarmActive || chooseActive) && !inHand,
    onTap: () => {
      if (alarmActive) {
        runner().recordMistake('raise-alarm', 'tap', {
          detail: `extinguisher-${type}-before-alarm`,
        });
        return;
      }
      runner().setFact('preview-extinguisher', type);
      runner().chooseOption('choose-extinguisher', type);
    },
  });

  const highlighted = chooseActive && preview === type;
  return (
    <group>
      <group ref={ref} position={[x, 0, z]} visible={!inHand}>
        <ExtinguisherModel type={type} />
        <mesh position-y={0.3} visible={false}>
          <cylinderGeometry args={[0.12, 0.12, 0.7, 6]} />
        </mesh>
      </group>
      <HighlightRing position={[x, 0, z]} radius={0.13} color="#22c55e" visible={highlighted} />
      <WorldLabel
        position={[x, 0.78, z]}
        title={label}
        subtitle={t('labels.tapToPickUp')}
        variant="ok"
        visible={highlighted && !inHand}
      />
    </group>
  );
}

function ExtinguisherRack() {
  return (
    <group>
      <ExtinguisherStand position={[RACK[0], 0, RACK[2]]} width={0.72} />
      {EXTINGUISHER_TYPES.map((type, index) => (
        <RackExtinguisher key={type} type={type} slot={RACK_SLOTS[index] ?? 0} />
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------

/**
 * The extinguisher in the worker's hand, fixed in the lower right of the view. Mounted only
 * once picked up, so the pin registers as tappable at that moment.
 */
function HeldExtinguisher({
  type,
  pinRef,
  nozzleRef,
  pullActive,
  pullLabel,
}: {
  type: ExtinguisherType;
  pinRef: React.RefObject<Group>;
  nozzleRef: React.RefObject<Group>;
  pullActive: boolean;
  pullLabel: string;
}) {
  useInteractable(pinRef, {
    id: 'extinguisher-pin',
    enabled: pullActive,
    onTap: () => {
      sfx.pinPull();
      haptic.tap();
      runner().completeStep('pass-pull');
    },
  });

  return (
    <CameraAttached offset={[0.12, -0.15, -0.5]}>
      <group rotation={[0.35, -0.75, 0.1]} scale={0.3}>
        <ExtinguisherModel type={type} pinRef={pinRef} nozzleRef={nozzleRef} hoseForward />
        <WorldLabel
          position={[0.06, 0.68, 0]}
          title={pullLabel}
          variant="info"
          visible={pullActive}
        />
      </group>
    </CameraAttached>
  );
}

const desiredTarget = new Vector3();
const desiredPosition = new Vector3();
const cameraPosition = new Vector3();
const cameraForward = new Vector3();
const fireWorld = new Vector3();

function PassSteps({
  fireRef,
  sparksRef,
}: {
  fireRef: { current: number };
  sparksRef: { current: boolean };
}) {
  const { t } = useTranslation('fire');
  const chosen = useFact('choose-extinguisher');
  const type: ExtinguisherType = isExtinguisherType(chosen) ? chosen : 'co2';
  const hasExtinguisher = useStepCompleted('choose-extinguisher');
  const moveCurrent = useStepCurrent('move-exit');
  const moveDone = useStepCompleted('move-exit');
  const evacuating = moveCurrent || moveDone;
  const pullActive = useStepActive('pass-pull');
  const pulled = useStepCompleted('pass-pull');
  const aimActive = useStepActive('pass-aim');
  const squeezeActive = useStepActive('pass-squeeze');
  const sweepActive = useStepActive('pass-sweep');
  const aimCurrent = useStepCurrent('pass-aim');
  const squeezeCurrent = useStepCurrent('pass-squeeze');
  const sweepCurrent = useStepCurrent('pass-sweep');
  const discharging = squeezeCurrent || sweepCurrent;

  const pin = useRef<Group>(null);
  const nozzle = useRef<Group>(null);
  const fireBaseRef = useRef<Group>(null);
  const fireTopRef = useRef<Group>(null);
  const sprayOn = useRef(false);
  const sprayTarget = useRef(new Vector3());
  const pinOffset = useRef(0);
  const timers = useRef({ aim: 0, top: 0, squeeze: 0, idle: 0, offTarget: 0 });
  const hints = useRef(new Set<string>());
  const sweep = useRef({ passes: 0, travel: 0, direction: 0, lastHeading: null as number | null });
  const hiss = useRef<ReturnType<typeof sfx.hiss>>(null);

  useAimTarget(fireBaseRef, {
    id: 'fire-base',
    enabled: aimCurrent || discharging,
    radius: sweepCurrent ? 0.36 : 0.2,
  });
  useAimTarget(fireTopRef, { id: 'fire-top', enabled: aimCurrent, radius: 0.2 });

  // Sweeping uses the swipe gesture instead of turning the training area.
  useEffect(() => {
    if (!sweepCurrent) return;
    engine().setGestureMode('swipe');
    return () => engine().setGestureMode('rotate');
  }, [sweepCurrent]);

  useEffect(() => {
    timers.current = { aim: 0, top: 0, squeeze: 0, idle: 0, offTarget: 0 };
    hints.current.clear();
    sweep.current = { passes: 0, travel: 0, direction: 0, lastHeading: null };
    takeSwipe(); // drop swipes made before this step
  }, [aimActive, squeezeActive, sweepActive]);

  useEffect(
    () => () => {
      hiss.current?.stop();
      hiss.current = null;
    },
    [],
  );

  useFrame(({ camera }, delta) => {
    // Pull: slide the pin out once pulled.
    if (pulled && pin.current != null && pinOffset.current < 1) {
      pinOffset.current = Math.min(1, pinOffset.current + delta * 3);
      pin.current.position.x = 0.035 + pinOffset.current * 0.12;
      pin.current.visible = pinOffset.current < 1;
    }

    const state = engine();
    const onBase = state.aimedTargetId === 'fire-base';
    const onTop = state.aimedTargetId === 'fire-top';
    const hint = (stepId: string) => {
      if (hints.current.has(stepId)) return;
      hints.current.add(stepId);
      runner().showHint(stepId);
    };

    // Spray whenever the handle is squeezed with the pin out.
    const spraying = discharging && pulled && state.holdPressed;
    sprayOn.current = spraying;
    if (spraying && hiss.current == null) hiss.current = sfx.hiss();
    if (!spraying && hiss.current != null) {
      hiss.current.stop();
      hiss.current = null;
    }
    camera.getWorldPosition(cameraPosition);
    camera.getWorldDirection(cameraForward);
    fireBaseRef.current?.getWorldPosition(fireWorld);
    const reach = Math.min(3, Math.max(0.6, cameraPosition.distanceTo(fireWorld)));
    sprayTarget.current.copy(cameraPosition).addScaledVector(cameraForward, reach);

    const timer = timers.current;
    if (aimActive) {
      timer.aim = onBase ? timer.aim + delta : Math.max(0, timer.aim - delta * 2);
      timer.top = onTop ? timer.top + delta : 0;
      if (timer.top > HINT_AFTER_SECONDS) hint('pass-aim');
      runner().setStepProgress(timer.aim / AIM_SECONDS);
      if (timer.aim >= AIM_SECONDS) runner().completeStep('pass-aim');
    } else if (squeezeActive) {
      if (spraying && onBase) {
        timer.squeeze += delta;
        fireRef.current = Math.max(0.85, fireRef.current - delta * 0.1);
      }
      timer.offTarget = spraying && !onBase ? timer.offTarget + delta : 0;
      if (timer.offTarget > HINT_AFTER_SECONDS) hint('pass-squeeze');
      runner().setStepProgress(timer.squeeze / SQUEEZE_SECONDS);
      if (timer.squeeze >= SQUEEZE_SECONDS) runner().completeStep('pass-squeeze');
    } else if (sweepActive) {
      // Sweep: count direction changes of the nozzle (phone heading, plus swipes in AR)
      // while discharging onto the base of the fire.
      const heading = headingOf(cameraForward);
      const turn =
        sweep.current.lastHeading == null ? 0 : angleDelta(sweep.current.lastHeading, heading);
      sweep.current.lastHeading = heading;
      // Phone / view movement plus swipes (AR screen swipes, or sliding the thumb on Squeeze).
      const swing = turn + takeSwipe();
      if (spraying && onBase && swing !== 0) {
        const direction = Math.sign(swing);
        if (
          direction !== sweep.current.direction &&
          Math.abs(sweep.current.travel) >= SWEEP_MIN_SWING
        ) {
          sweep.current.passes += 1;
          sweep.current.travel = 0;
          haptic.tap();
        } else if (direction !== sweep.current.direction) {
          sweep.current.travel = 0;
        }
        sweep.current.direction = direction;
        sweep.current.travel += Math.abs(swing);
      }
      timer.idle = !spraying ? timer.idle + delta : 0;
      if (timer.idle > HINT_AFTER_SECONDS * 2) hint('pass-sweep');
      const progress = Math.min(1, sweep.current.passes / SWEEP_PASSES);
      const target = 0.85 * (1 - progress);
      fireRef.current += (target - fireRef.current) * Math.min(1, delta * 3);
      runner().setStepProgress(progress);
      if (sweep.current.passes >= SWEEP_PASSES) {
        fireRef.current = 0;
        sparksRef.current = false;
        sfx.success();
        runner().completeStep('pass-sweep', { detail: `${sweep.current.passes}-passes` });
      }
    }
  });

  const showHeld = hasExtinguisher && !evacuating;
  return (
    <>
      {/* Aim targets: the base of the fire (correct) and the top of the flames (too high). */}
      <group ref={fireBaseRef} position={[FIRE_BASE[0], FIRE_BASE[1] + 0.06, FIRE_BASE[2] + 0.1]} />
      <group ref={fireTopRef} position={[FIRE_BASE[0], FIRE_BASE[1] + 0.55, FIRE_BASE[2]]} />
      {showHeld && (
        <HeldExtinguisher
          type={type}
          pinRef={pin}
          nozzleRef={nozzle}
          pullActive={pullActive}
          pullLabel={t('labels.pullPin')}
        />
      )}
      <SprayJet
        active={sprayOn}
        origin={nozzle}
        target={sprayTarget}
        color={EXTINGUISHER_STYLE[type].spray}
      />
    </>
  );
}

// ---------------------------------------------------------------------------

const CROUCH_SECONDS = 1;
const STAND_CALIBRATION_SECONDS = 1.5;

/**
 * "Stay low under smoke": in AR, first measure the worker's standing phone height, then they
 * must get (and stay) below the crouch threshold for a second. In 3D mode, hold Crouch.
 */
function CrouchUnderSmoke() {
  const active = useStepActive('crouch-smoke');
  const calibration = useRef({ elapsed: 0, maxHeight: 0 });
  const crouchTime = useRef(0);

  useEffect(() => {
    if (!active) return;
    crouchTime.current = 0;
    calibration.current = { elapsed: 0, maxHeight: 0 };
    if (engine().mode === 'ar') engine().setStandingHeight(null);
  }, [active]);

  useFrame((_state, delta) => {
    if (!active) return;
    const state = engine();
    if (state.mode === 'ar' && state.standingHeight == null) {
      if (state.deviceHeight == null) return;
      calibration.current.elapsed += delta;
      calibration.current.maxHeight = Math.max(calibration.current.maxHeight, state.deviceHeight);
      if (calibration.current.elapsed >= STAND_CALIBRATION_SECONDS) {
        state.setStandingHeight(calibration.current.maxHeight);
      }
      return;
    }
    crouchTime.current = state.crouching
      ? crouchTime.current + delta
      : Math.max(0, crouchTime.current - delta);
    runner().setStepProgress(crouchTime.current / CROUCH_SECONDS);
    if (crouchTime.current >= CROUCH_SECONDS) {
      haptic.success();
      runner().completeStep(
        'crouch-smoke',
        state.deviceHeight != null ? { detail: state.deviceHeight.toFixed(2) } : {},
      );
    }
  });
  return null;
}

/** Smoke layer that drops from the ceiling to just above crouching height once the fire is out. */
function RoomSmoke() {
  const smokeCurrent = useStepCurrent('crouch-smoke');
  const later = useStepCompleted('crouch-smoke');
  const mode = useEngineStore((state) => state.mode);
  const standing = useEngineStore((state) => state.standingHeight);
  const visible = smokeCurrent || later;
  const goal = mode === 'ar' && standing != null ? Math.max(0.75, standing - 0.25) : 1.2;
  const height = useRef(2.4);
  const layer = useRef<Group>(null);

  useFrame((_state, delta) => {
    if (!visible) {
      height.current = 2.4;
      return;
    }
    height.current += (goal - height.current) * Math.min(1, delta * 0.8);
    if (layer.current != null) layer.current.position.y = height.current - goal;
  });

  const cx = (AREA.minX + AREA.maxX) / 2;
  const cz = (AREA.minZ + AREA.maxZ) / 2;
  return (
    <group ref={layer} position={[cx, 0, cz]}>
      <SmokePuffs
        visible={visible}
        height={goal}
        radius={1.7}
        count={mode === 'ar' ? 70 : 50}
        thickness={0.7}
        seed={17}
        opacity={mode === 'ar' ? 0.72 : 0.42}
      />
    </group>
  );
}

// ---------------------------------------------------------------------------

function pathLength(points: readonly Point[]): number {
  let length = 0;
  for (let i = 0; i < points.length - 1; i += 1) {
    const [ax, az] = points[i]!;
    const [bx, bz] = points[i + 1]!;
    length += Math.hypot(bx - ax, bz - az);
  }
  return length;
}

function pointAt(
  points: readonly Point[],
  distance: number,
): { x: number; z: number; heading: number } {
  let remaining = distance;
  for (let i = 0; i < points.length - 1; i += 1) {
    const [ax, az] = points[i]!;
    const [bx, bz] = points[i + 1]!;
    const segment = Math.hypot(bx - ax, bz - az);
    const heading = Math.atan2(bx - ax, bz - az);
    if (remaining <= segment || i === points.length - 2) {
      const k = segment === 0 ? 0 : Math.min(1, remaining / segment);
      return { x: ax + (bx - ax) * k, z: az + (bz - az) * k, heading };
    }
    remaining -= segment;
  }
  const [x, z] = points[0]!;
  return { x, z, heading: 0 };
}

function Evacuation({ exitFireRef }: { exitFireRef: { current: number } }) {
  const { t } = useTranslation('fire');
  const moveActive = useStepActive('move-exit');
  const moveCurrent = useStepCurrent('move-exit');
  const blocked = useStepCompleted('move-exit');
  const chooseActive = useStepActive('choose-exit');
  const exitChosen = useStepCompleted('choose-exit');
  const reachActive = useStepActive('reach-assembly');
  const arrived = useStepCompleted('reach-assembly');
  const smokeDone = useStepCompleted('crouch-smoke');
  const mode = useEngineStore((state) => state.mode);
  const retrainingFrom = useRunnerStore((state) => state.skippedStepIds.includes('move-exit'));

  const avatar = useRef<Group>(null);
  const pose = useRef<AvatarPose>({ speed: 0, crouch: 0, distress: 0 });
  const exitA = useRef<Group>(null);
  const lift = useRef<Group>(null);
  const exitB = useRef<Group>(null);
  const travel = useRef({ first: 0, second: 0 });
  const exposure = useRef({ seconds: 0, penalised: false });

  const firstLength = useMemo(() => pathLength(ROUTE_TO_EXIT_A), []);
  const blockedAt = useMemo(() => {
    const point = pointAt(ROUTE_TO_EXIT_A, firstLength * BLOCK_AT);
    return [point.x, point.z] as const;
  }, [firstLength]);
  const secondRoute = useMemo<readonly Point[]>(
    () => [blockedAt, ...ROUTE_TO_EXIT_B_TAIL],
    [blockedAt],
  );
  const secondLength = useMemo(() => pathLength(secondRoute), [secondRoute]);
  const firstVisibleRoute = useMemo<readonly Point[]>(
    () => ROUTE_TO_EXIT_A.slice(0, 3).concat([blockedAt]),
    [blockedAt],
  );

  // In 3D mode the camera is steered for the whole evacuation (until the assembly point).
  const directing = mode === 'fallback3d' && (moveCurrent || blocked) && !arrived;
  useEffect(() => {
    if (!directing) return;
    engine().setCameraDirected(true);
    return () => engine().setCameraDirected(false);
  }, [directing]);

  const pick = (id: string) => () => runner().chooseOption('choose-exit', id);
  useInteractable(exitA, { id: 'exit-a', enabled: chooseActive, onTap: pick('exit-a') });
  useInteractable(lift, { id: 'lift', enabled: chooseActive, onTap: pick('lift') });
  useInteractable(exitB, { id: 'exit-b', enabled: chooseActive, onTap: pick('exit-b') });

  // Arriving at later steps directly (retraining) puts the avatar where the story left it.
  useEffect(() => {
    if (blocked) travel.current.first = firstLength * BLOCK_AT;
    if (arrived) travel.current.second = secondLength;
    exitFireRef.current = blocked ? 1 : 0;
  }, [blocked, arrived, firstLength, secondLength, exitFireRef]);

  useFrame(({ controls: frameControls, camera }, delta) => {
    const group = avatar.current;
    if (group == null) return;
    const state = engine();
    const controls = frameControls as { target: Vector3; update: () => void } | null;

    // Exit A catches fire when the route gets blocked.
    const exitGoal = blocked ? 1 : 0;
    exitFireRef.current += (exitGoal - exitFireRef.current) * Math.min(1, delta * 2);

    const moving = state.movePressed && (moveActive || reachActive);
    const onSecondRoute = blocked;
    const route = onSecondRoute ? secondRoute : ROUTE_TO_EXIT_A;
    const distance = onSecondRoute ? travel.current.second : travel.current.first;
    const here = pointAt(route, distance);
    const inside = here.z > OUTSIDE_Z;
    const crouched = state.crouching;
    const speed = moving ? (crouched ? CROUCHED_SPEED : STANDING_SPEED) : 0;

    if (moving) {
      if (onSecondRoute)
        travel.current.second = Math.min(secondLength, travel.current.second + speed * delta);
      else
        travel.current.first = Math.min(
          firstLength * BLOCK_AT,
          travel.current.first + speed * delta,
        );
    }

    // Standing up in the smoke while moving costs points (once per time you stand up).
    const exposed = moving && inside && !crouched;
    exposure.current.seconds = exposed ? exposure.current.seconds + delta : 0;
    if (!exposed && crouched) exposure.current.penalised = false;
    if (exposure.current.seconds > SMOKE_EXPOSURE_SECONDS && !exposure.current.penalised) {
      exposure.current.penalised = true;
      sfx.cough();
      haptic.error();
      const stepId = moveActive ? 'move-exit' : 'reach-assembly';
      runner().recordMistake(stepId, 'crouch', { detail: 'stood-up-in-smoke' });
    }
    const inSmoke = exposed ? '1' : '0';
    if (runner().facts['in-smoke'] !== inSmoke) runner().setFact('in-smoke', inSmoke);

    pose.current.speed = speed;
    pose.current.crouch = inside && (crouched || !moving) && smokeDone ? 1 : 0;
    if (!inside) pose.current.crouch = 0;
    pose.current.distress = exposed ? 1 : Math.max(0, pose.current.distress - delta * 2);
    group.position.set(here.x, 0, here.z);
    if (moving) group.rotation.y = here.heading;

    if (moveActive) {
      runner().setStepProgress(travel.current.first / (firstLength * BLOCK_AT));
      if (travel.current.first >= firstLength * BLOCK_AT - 1e-3) {
        haptic.error();
        sfx.error();
        runner().completeStep('move-exit', { detail: 'exit-a-blocked', tone: 'hint' });
      }
    } else if (reachActive) {
      runner().setStepProgress(travel.current.second / secondLength);
      if (travel.current.second >= secondLength - 1e-3) {
        sfx.success();
        runner().completeStep('reach-assembly');
      }
    }

    // 3D mode: third-person camera behind the avatar while walking, wide shot of all the
    // exits while choosing one. Crouching lowers the eye below the smoke.
    if (directing && controls != null) {
      const crouch = state.crouchHeld ? 0.4 : 0;
      if (chooseActive) {
        desiredTarget.set(0.1, 1.1, -1.4);
        desiredPosition.set(0.1, 2.7, 3.4);
      } else {
        desiredTarget.set(group.position.x, 0.7 - crouch * 0.5, group.position.z - 0.6);
        desiredPosition.set(group.position.x + 0.5, 2.4 - crouch, group.position.z + 3.0);
      }
      const k = Math.min(1, delta * 2.5);
      controls.target.lerp(desiredTarget, k);
      camera.position.lerp(desiredPosition, k);
      controls.update();
    }
  });

  const showAvatar = moveCurrent || blocked || retrainingFrom;
  return (
    <>
      <ExitDoor ref={exitA} position={EXIT_A} blocked={blocked} />
      <group position={[EXIT_A[0], 0, EXIT_A[2] + 0.12]}>
        <LowPolyFire intensity={exitFireRef} radius={0.35} height={0.9} seed={31} />
      </group>
      <LiftDoor ref={lift} position={LIFT} />
      <ExitDoor ref={exitB} position={EXIT_B} blocked={false} />
      <AssemblyPointSign position={ASSEMBLY} />
      <WorldLabel
        position={[ASSEMBLY[0], 1.95, ASSEMBLY[2]]}
        title={t('labels.assembly')}
        variant="ok"
        visible={exitChosen && !arrived}
      />

      <WorldLabel
        position={[EXIT_A[0], chooseActive ? 1.3 : 2.55, EXIT_A[2] + 0.1]}
        title={t('labels.exitA')}
        subtitle={blocked ? t('labels.blocked') : undefined}
        variant={blocked ? 'danger' : 'ok'}
        visible={moveCurrent || chooseActive}
      />
      <WorldLabel
        position={[LIFT[0], 1.3, LIFT[2] + 0.1]}
        title={t('labels.lift')}
        variant="info"
        visible={chooseActive}
      />
      <WorldLabel
        position={[EXIT_B[0], chooseActive ? 1.3 : 2.55, EXIT_B[2] + 0.1]}
        title={t('labels.exitB')}
        variant="ok"
        visible={chooseActive || reachActive}
      />

      <FloorArrows path={firstVisibleRoute} visible={moveCurrent && !blocked} />
      <FloorArrows path={secondRoute} visible={exitChosen && !arrived} />

      <group ref={avatar} position={[AVATAR_START[0], 0, AVATAR_START[1]]} visible={showAvatar}>
        <WorkerAvatar pose={pose} />
      </group>
      {arrived && (
        <group position={[ASSEMBLY[0] + 0.35, 0, ASSEMBLY[2] + 0.35]} rotation-y={-2.2}>
          <WorkerAvatar
            pose={{ current: { speed: 0, crouch: 0, distress: 0 } }}
            helmetColor="#f5f5f5"
          />
          <WorldLabel position={[0, 1.95, 0]} title={t('labels.warden')} variant="info" visible />
        </group>
      )}
    </>
  );
}
