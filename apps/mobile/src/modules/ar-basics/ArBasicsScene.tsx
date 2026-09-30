import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { Vector3, type Group } from 'three';
import { engine, useEngineStore } from '../../engine/engineStore';
import { useAimTarget, useInteractable } from '../../engine/interaction';
import { HighlightRing } from '../../engine/primitives/HighlightRing';
import { SmokePuffs } from '../../engine/primitives/SmokePuffs';
import {
  runner,
  useStepActive,
  useStepCompleted,
  useStepCurrent,
} from '../../engine/runner/runnerStore';
import { localizedFrom } from '../../i18n/localized';
import {
  Barrel,
  Crate,
  Helmet,
  HelmetStand,
  SafetyCone,
  STAND_TOP,
  TargetBoard,
  TrainingMat,
  MAT_HEIGHT,
  MAT_RADIUS,
} from './props';

const CONE = [-0.55, MAT_HEIGHT, -0.05] as const;
const CRATE = [0, MAT_HEIGHT, -0.35] as const;
const BARREL = [0.55, MAT_HEIGHT, -0.05] as const;
const HELMET_HOME = [-0.45, MAT_HEIGHT, 0.5] as const;
const STAND = [0.45, MAT_HEIGHT, 0.5] as const;
const TARGET = [0, MAT_HEIGHT, -0.8] as const;

const ROTATE_GOAL_RAD = (45 * Math.PI) / 180;
const DROP_RADIUS = 0.2;
const DRAG_LIFT = 0.08;
/** A release this far from home counts as a real (missed) attempt rather than a slip. */
const MISSED_DROP_MIN_DISTANCE = 0.15;
const AIM_SECONDS = 1.2;
const HOLD_SECONDS = 2;
const CROUCH_SECONDS = 1;
const STAND_CALIBRATION_SECONDS = 1.5;
const OFF_TARGET_HINT_SECONDS = 1;

const helmetGoal = new Vector3();

/** AR Basics: every engine interaction, one step at a time. */
export function ArBasicsScene() {
  return (
    <group>
      <TrainingMat />
      <PlaceStep />
      <RotateStep />
      <TapStep />
      <DragStep />
      <AimAndHoldSteps />
      <CrouchStep />
    </group>
  );
}

/** Completes as soon as the area is placed (AR tap, or automatically in 3D mode). */
function PlaceStep() {
  const active = useStepActive('place');
  const placed = useEngineStore((state) => state.placement === 'placed');
  const mode = useEngineStore((state) => state.mode);
  useEffect(() => {
    if (active && placed) runner().completeStep('place', mode === 'ar' ? 'ar-hit-test' : '3d-auto');
  }, [active, placed, mode]);
  return null;
}

function RotateStep() {
  const active = useStepActive('rotate');
  const turned = useEngineStore((state) => state.turnMeter);

  useEffect(() => {
    if (active) engine().resetTurnMeter();
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const progress = turned / ROTATE_GOAL_RAD;
    runner().setStepProgress(Math.min(1, progress));
    if (progress >= 1)
      runner().completeStep('rotate', `${Math.round((turned * 180) / Math.PI)}deg`);
  }, [active, turned]);
  return null;
}

function TapStep() {
  const active = useStepActive('tap-cone');
  const cone = useRef<Group>(null);
  const crate = useRef<Group>(null);
  const barrel = useRef<Group>(null);

  const wrong = (object: 'crate' | 'barrel') => () =>
    runner().recordMistake('tap-cone', 'tap', {
      detail: object,
      message: localizedFrom('training', (t) =>
        t('feedback.wrongObject', { name: t(`objects.${object}`) }),
      ),
    });

  useInteractable(cone, {
    id: 'cone',
    enabled: active,
    onTap: () => runner().completeStep('tap-cone', 'cone'),
  });
  useInteractable(crate, { id: 'crate', enabled: active, onTap: wrong('crate') });
  useInteractable(barrel, { id: 'barrel', enabled: active, onTap: wrong('barrel') });

  return (
    <>
      <SafetyCone ref={cone} position={CONE} />
      <Crate ref={crate} position={CRATE} />
      <Barrel ref={barrel} position={BARREL} />
      <HighlightRing position={CONE} radius={0.22} visible={active} />
    </>
  );
}

type HelmetState = 'home' | 'dragging' | 'on-stand';

function DragStep() {
  const active = useStepActive('drag-helmet');
  const completed = useStepCompleted('drag-helmet');
  const helmet = useRef<Group>(null);
  const state = useRef<HelmetState>(completed ? 'on-stand' : 'home');
  const dragPoint = useRef(new Vector3(...HELMET_HOME));

  useInteractable(helmet, {
    id: 'helmet',
    enabled: active,
    drag: {
      onStart: () => {
        state.current = 'dragging';
      },
      onMove: (point) => {
        // Keep the helmet over the mat while it is carried.
        const distance = Math.hypot(point.x, point.z);
        const scale = distance > MAT_RADIUS - 0.1 ? (MAT_RADIUS - 0.1) / distance : 1;
        dragPoint.current.set(point.x * scale, MAT_HEIGHT + DRAG_LIFT, point.z * scale);
      },
      onEnd: (point) => {
        const toStand = Math.hypot(point.x - STAND[0], point.z - STAND[2]);
        if (toStand <= DROP_RADIUS) {
          state.current = 'on-stand';
          runner().completeStep('drag-helmet', `${toStand.toFixed(2)}m`);
          return;
        }
        state.current = 'home';
        const fromHome = Math.hypot(point.x - HELMET_HOME[0], point.z - HELMET_HOME[2]);
        if (fromHome >= MISSED_DROP_MIN_DISTANCE) {
          runner().recordMistake('drag-helmet', 'drag-drop', {
            detail: `missed-by-${toStand.toFixed(2)}m`,
          });
        }
      },
    },
  });

  useEffect(() => {
    if (completed) state.current = 'on-stand';
  }, [completed]);

  // Ease the helmet towards wherever it should be: carried, back home, or on the stand.
  useFrame((_frame, delta) => {
    const group = helmet.current;
    if (group == null) return;
    if (state.current === 'dragging') helmetGoal.copy(dragPoint.current);
    else if (state.current === 'on-stand') helmetGoal.set(STAND[0], STAND[1] + STAND_TOP, STAND[2]);
    else helmetGoal.set(...HELMET_HOME);
    group.position.lerp(helmetGoal, Math.min(1, delta * (state.current === 'dragging' ? 20 : 8)));
  });

  return (
    <>
      <Helmet ref={helmet} position={HELMET_HOME} />
      <HelmetStand position={STAND} />
      <HighlightRing position={HELMET_HOME} radius={0.22} visible={active} />
      <HighlightRing position={STAND} radius={DROP_RADIUS} color="#22c55e" visible={active} />
    </>
  );
}

function AimAndHoldSteps() {
  const aimActive = useStepActive('aim-target');
  const holdActive = useStepActive('hold-target');
  const target = useRef<Group>(null);
  const aimTime = useRef(0);
  const holdTime = useRef(0);
  const offTargetTime = useRef(0);
  const hinted = useRef(false);

  // Stay aimable through the pause between the aim and hold steps, so the view does not
  // leave look-around mode (and lose the target) during the hand-off.
  const aimCurrent = useStepCurrent('aim-target');
  const holdCurrent = useStepCurrent('hold-target');
  useAimTarget(target, { id: 'target', enabled: aimCurrent || holdCurrent, radius: 0.22 });

  useEffect(() => {
    aimTime.current = 0;
    holdTime.current = 0;
    offTargetTime.current = 0;
    hinted.current = false;
  }, [aimActive, holdActive]);

  useFrame((_frame, delta) => {
    if (!aimActive && !holdActive) return;
    const { aimedTargetId, holdPressed } = engine();
    const onTarget = aimedTargetId === 'target';

    if (aimActive) {
      aimTime.current = onTarget
        ? aimTime.current + delta
        : Math.max(0, aimTime.current - delta * 2);
      runner().setStepProgress(aimTime.current / AIM_SECONDS);
      if (aimTime.current >= AIM_SECONDS) runner().completeStep('aim-target');
      return;
    }

    if (holdPressed && onTarget) {
      holdTime.current += delta;
      offTargetTime.current = 0;
    } else {
      holdTime.current = Math.max(0, holdTime.current - delta * 0.5);
      offTargetTime.current = holdPressed ? offTargetTime.current + delta : 0;
      if (offTargetTime.current >= OFF_TARGET_HINT_SECONDS && !hinted.current) {
        hinted.current = true;
        runner().showHint('hold-target');
      }
    }
    runner().setStepProgress(holdTime.current / HOLD_SECONDS);
    if (holdTime.current >= HOLD_SECONDS) runner().completeStep('hold-target');
  });

  return (
    <>
      <TargetBoard ref={target} position={TARGET} />
      <HighlightRing position={TARGET} radius={0.2} visible={aimActive || holdActive} />
    </>
  );
}

function CrouchStep() {
  const active = useStepActive('crouch');
  const mode = useEngineStore((state) => state.mode);
  const standingHeight = useEngineStore((state) => state.standingHeight);
  const calibration = useRef({ elapsed: 0, maxHeight: 0 });
  const crouchTime = useRef(0);

  useEffect(() => {
    if (!active) return;
    crouchTime.current = 0;
    calibration.current = { elapsed: 0, maxHeight: 0 };
    // AR: measure standing height fresh for this step (the worker may have moved or sat down).
    if (engine().mode === 'ar') engine().setStandingHeight(null);
  }, [active]);

  useFrame((_frame, delta) => {
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
      runner().completeStep('crouch', state.deviceHeight?.toFixed(2) ?? undefined);
    }
  });

  // A smoke layer just above crouching height makes the point of the exercise visible.
  const smokeBase =
    mode === 'ar' && standingHeight != null ? Math.max(0.7, standingHeight - 0.2) : 1.1;
  return <SmokePuffs visible={active} height={smokeBase} radius={MAT_RADIUS} />;
}
