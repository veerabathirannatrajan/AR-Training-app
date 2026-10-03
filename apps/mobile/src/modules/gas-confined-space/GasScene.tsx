import { GAS_CONFINED_SPACE, type LocalizedText } from '@ar-training/shared';
import { useFrame } from '@react-three/fiber';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CatmullRomCurve3, TubeGeometry, Vector3, type Group, type Mesh } from 'three';
import { CameraAttached } from '../../engine/CameraAttached';
import { FloorArrows, Sparks, SprayJet } from '../../engine/effects/particles';
import { engine, useEngineStore } from '../../engine/engineStore';
import { haptic, sfx } from '../../engine/feedback/sfx';
import { useAimTarget, useInteractable } from '../../engine/interaction';
import { flatMaterial } from '../../engine/materials';
import { PALETTE } from '../../engine/palette';
import { HighlightRing } from '../../engine/primitives/HighlightRing';
import { WorkerAvatar, type AvatarPose } from '../../engine/primitives/WorkerAvatar';
import {
  runner,
  stepPassed,
  useRunnerStore,
  useStepActive,
  useStepPassed,
  useStepCurrent,
} from '../../engine/runner/runnerStore';
import { usePlacementClock } from '../../engine/runner/usePlacementClock';
import { WorldLabel } from '../../engine/WorldLabel';
import { GasCloud, PitGas, SegmentLine } from './effects';
import { gas, gasSignals, raviOnScreen, useGasStore } from './gasStore';
import {
  AMBER_ZONE,
  AREA,
  BLOWER,
  BLOWER_OUTLET,
  COLLAR_HEIGHT,
  D_RING,
  FAN_BUTTON,
  HOSE_REST,
  LEAK,
  MANHOLE,
  MANHOLE_COVER,
  MANHOLE_OPENING,
  PERMIT_BOARD,
  PHONE_POST,
  PIT_FLOOR_Y,
  POINT_1,
  POINT_2,
  PULLEY_POINT,
  PUMP_PANEL,
  RAVI_AT_MANHOLE,
  RAVI_AT_PANEL,
  RAVI_AT_POINT_1,
  RAVI_EXIT_VIA,
  RAVI_RESCUED,
  RAVI_STAGING,
  RAVI_TO_MANHOLE_VIA,
  RED_ZONE,
  SUNITA_ARRIVES_FROM,
  SUNITA_AT_WINCH,
  SUNITA_STANDBY,
  WINDSOCK,
  type Spot,
} from './layout';
import { REQUIRED_PPE } from './ppe';
import { newSegment } from './segment';
import {
  Blower,
  EntrantGear,
  EntrantMask,
  GasAreaFloor,
  GasMonitorModel,
  GatheringSign,
  HazardZone,
  ManholeCover,
  ManholePit,
  PermitBoard,
  PhonePost,
  Pipeline,
  PopIn,
  PumpPanel,
  RadioModel,
  RescueTripod,
  Windsock,
} from './props';
import {
  allSafe,
  AMBIENT,
  CHANNEL_GASES,
  channelForStep,
  formatGas,
  GASES,
  PIT_BEFORE,
  pitAtmosphere,
  roundGas,
  SENSOR_TAU,
  VENT_SECONDS,
  ventProgress,
  type GasReadings,
} from './readings';

type Point = readonly [number, number];

/** Seconds without finding the manhole before the hint about heavy gas. */
const MANHOLE_HINT_SECONDS = 15;
/** Seconds the probe must stay in the pit for a test reading to settle. */
const SAMPLE_SECONDS = 2;
/** Sampling with no test chosen for this long shows a reminder. */
const CHOOSE_HINT_SECONDS = 2.5;
/** Permit step: the probe must be in the pit this long before the readings count. */
const SETTLE_SECONDS = 1;
const PUBLISH_INTERVAL_S = 0.125;
/** A hose dropped within this distance of the manhole's centre goes in. */
const HOSE_DROP_RADIUS = 0.34;
/** A release this far from where the hose lay counts as a real (missed) attempt. */
const MISSED_DROP_MIN_DISTANCE = 0.15;
const TALK_SECONDS = 1.3;
const LIFT_SECONDS = 3.5;
const WALK_SPEED = 0.75;
const DESCEND_SECONDS = 2.6;
const RESCUE_MOVE_SECONDS = 1.3;
const GLIDE_MS = 1500;
const NONE: readonly string[] = [];

function stepMessage(stepId: string, key: string): LocalizedText | undefined {
  return GAS_CONFINED_SPACE.steps.find((step) => step.id === stepId)?.messages?.[key];
}

/** Whether the story was already past a step when the scene mounted (retraining). */
function doneAtMount(stepId: string): boolean {
  return stepPassed(runner(), stepId);
}

export function GasScene() {
  usePlacementClock();
  const mode = useEngineStore((state) => state.mode);

  useLayoutEffect(() => {
    gas().reset();
    // Retraining can start part-way through the story: begin from where it stands (a signed
    // permit means the pit has already been cleared).
    const now = performance.now() / 1000;
    if (doneAtMount('sign-permit')) gasSignals.ventStartedAt = now - VENT_SECONDS;
    else if (doneAtMount('ventilate')) gasSignals.ventStartedAt = now;
    if (doneAtMount('winch-rescue')) gasSignals.lift = 1;
    return () => gas().reset();
  }, []);

  return (
    <group>
      <GasAreaFloor />
      <Windsock position={WINDSOCK} />
      <ManholePit mode={mode} />
      <ManholeCover position={MANHOLE_COVER} />
      <LeakAndZones />
      <PanelStep />
      <Evacuation />
      <EntryKit />
      <AirTesting />
      <Crew />
      <CommsCheck />
      <Rescue />
      <CameraGlide />
    </group>
  );
}

// ---------------------------------------------------------------------------
// 1. Recognise: the leak, its hazard zones and the manhole where the heavy gas collects.

type ZoneId = 'red' | 'amber' | 'manhole';
const ZONES: readonly ZoneId[] = ['red', 'amber', 'manhole'];

function LeakAndZones() {
  const { t } = useTranslation('gas');
  const active = useStepActive('identify-zones');
  const current = useStepCurrent('identify-zones');
  const identified = useStepPassed('identify-zones');
  const stopped = useStepPassed('call-control');
  const placed = useEngineStore((state) => state.placement === 'placed');
  const [found, setFound] = useState<readonly ZoneId[]>([]);
  const foundRef = useRef(found);
  /** 1 while gas escapes, easing to 0 once the line is shut off. */
  const leak = useRef(stopped ? 0 : 1);
  const red = useRef<Group>(null);
  const amber = useRef<Group>(null);
  const pit = useRef<Group>(null);
  const leakPoint = useRef<Group>(null);
  const jetEnd = useRef<Group>(null);
  const jetOn = useRef(!stopped);
  const jetTarget = useRef(new Vector3());
  const idle = useRef({ seconds: 0, hinted: false });

  useEffect(() => {
    foundRef.current = found;
  }, [found]);
  useEffect(() => {
    idle.current = { seconds: 0, hinted: false };
  }, [active]);

  const shown: readonly ZoneId[] = identified ? ZONES : found;
  const find = (zone: ZoneId) => {
    if (found.includes(zone)) return;
    const next = [...found, zone];
    setFound(next);
    sfx.tap();
    haptic.tap();
    runner().setStepProgress(next.length / ZONES.length);
    if (next.length === ZONES.length) {
      sfx.success();
      runner().completeStep('identify-zones', { detail: next.join('>') });
    }
  };
  useInteractable(red, { id: 'zone-red', enabled: active, onTap: () => find('red') });
  useInteractable(amber, { id: 'zone-amber', enabled: active, onTap: () => find('amber') });
  useInteractable(pit, { id: 'zone-manhole', enabled: active, onTap: () => find('manhole') });

  // The hiss of escaping gas, from when the area is placed until the line is shut off.
  useEffect(() => {
    if (!placed || stopped) return;
    const hiss = sfx.hiss();
    hiss?.setLevel?.(0.4);
    return () => hiss?.stop();
  }, [placed, stopped]);

  useFrame((_state, delta) => {
    const goal = stopped ? 0 : 1;
    leak.current += (goal - leak.current) * Math.min(1, delta * (stopped ? 0.7 : 4));
    jetOn.current = leak.current > 0.3;
    jetEnd.current?.getWorldPosition(jetTarget.current);

    if (!active) return;
    idle.current.seconds += delta;
    if (
      idle.current.seconds > MANHOLE_HINT_SECONDS &&
      !idle.current.hinted &&
      !foundRef.current.includes('manhole')
    ) {
      idle.current.hinted = true;
      runner().showHint('identify-zones');
    }
  });

  return (
    <>
      <Pipeline leakRef={leakPoint} />
      <SprayJet active={jetOn} origin={leakPoint} target={jetTarget} color="#f4f8ff" count={36} />
      <group ref={jetEnd} position={[LEAK[0] + 0.4, LEAK[1] - 0.08, LEAK[2] + 0.12]} />
      <GasCloud level={leak} />
      <HazardZone
        ref={amber}
        zone={AMBER_ZONE}
        color="#ffb020"
        domeHeight={0.3}
        y={0.006}
        level={leak}
        found={shown.includes('amber')}
      />
      <HazardZone
        ref={red}
        zone={RED_ZONE}
        color="#ff3b30"
        domeHeight={0.5}
        y={0.009}
        level={leak}
        found={shown.includes('red')}
      />
      {/* Tap area over the manhole (it is outside the marked zones). */}
      <group ref={pit} position={[MANHOLE[0], 0.12, MANHOLE[2]]}>
        <mesh visible={false}>
          <cylinderGeometry args={[0.46, 0.46, 0.3, 10]} />
        </mesh>
      </group>
      <HighlightRing
        position={MANHOLE}
        radius={0.5}
        color={PALETTE.critical}
        visible={current && shown.includes('manhole')}
      />
      <WorldLabel
        position={[LEAK[0], 0.62, LEAK[2]]}
        title={t('labels.leak')}
        variant="danger"
        visible={current}
      />
      <WorldLabel
        position={[RED_ZONE.x + 0.1, 0.95, RED_ZONE.z + 0.05]}
        title={t('labels.dangerZone')}
        subtitle={t('labels.noEntry')}
        variant="danger"
        visible={current && shown.includes('red')}
      />
      <WorldLabel
        position={[AMBER_ZONE.x + 0.55, 0.32, AMBER_ZONE.z + 0.45]}
        title={t('labels.warningZone')}
        subtitle={t('labels.keepOut')}
        variant="info"
        visible={current && shown.includes('amber')}
      />
      <WorldLabel
        position={[MANHOLE[0], 0.55, MANHOLE[2]]}
        title={t('labels.manhole')}
        subtitle={t('labels.gasCollects')}
        variant="danger"
        visible={current && shown.includes('manhole')}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// 2. Alert: no sparks at the pump panel, out upwind, then the call from a safe place.

function PanelStep() {
  const { t } = useTranslation('gas');
  const active = useStepActive('stop-sparks');
  const current = useStepCurrent('stop-sparks');
  const tried = useRunnerStore((state) => state.triedOptions['stop-sparks'] ?? NONE);
  const sparks = useRef(false);
  const sparksUntil = useRef(0);

  // A switch operated in the gas: show the spark it makes.
  useEffect(() => {
    if (tried.length === 0) return;
    sparks.current = true;
    sparksUntil.current = performance.now() + 1500;
  }, [tried.length]);
  useFrame(() => {
    if (sparks.current && performance.now() > sparksUntil.current) sparks.current = false;
  });

  return (
    <>
      <PumpPanel position={PUMP_PANEL} />
      <group
        position={[
          PUMP_PANEL[0] + FAN_BUTTON[0],
          PUMP_PANEL[1] + FAN_BUTTON[1],
          PUMP_PANEL[2] + FAN_BUTTON[2] + 0.02,
        ]}
      >
        <Sparks active={sparks} count={22} />
      </group>
      <HighlightRing
        position={PUMP_PANEL}
        radius={0.26}
        color={PALETTE.critical}
        visible={active}
      />
      <WorldLabel
        position={[PUMP_PANEL[0], 1.58, PUMP_PANEL[2]]}
        title={t('labels.fanSwitch')}
        variant="danger"
        visible={current}
      />
    </>
  );
}

const EXIT_ROUTE: readonly Point[] = [RAVI_AT_PANEL.at, RAVI_EXIT_VIA, RAVI_AT_POINT_1.at];

function Evacuation() {
  const { t } = useTranslation('gas');
  const chooseActive = useStepActive('go-upwind');
  const chooseCurrent = useStepCurrent('go-upwind');
  const out = useStepPassed('go-upwind');
  const callActive = useStepActive('call-control');
  const called = useStepPassed('call-control');
  const tried = useRunnerStore((state) => state.triedOptions['go-upwind'] ?? NONE);
  const one = useRef<Group>(null);
  const two = useRef<Group>(null);
  const phone = useRef<Group>(null);

  const pick = (id: string) => () => runner().chooseOption('go-upwind', id);
  useInteractable(one, { id: 'point-1', enabled: chooseActive, onTap: pick('point-1') });
  useInteractable(two, { id: 'point-2', enabled: chooseActive, onTap: pick('point-2') });
  useInteractable(phone, {
    id: 'phone',
    enabled: callActive,
    onTap: () => {
      sfx.radio();
      haptic.success();
      runner().completeStep('call-control', { detail: 'phone' });
    },
  });

  const wrongWay = tried.includes('point-2');
  return (
    <>
      <GatheringSign ref={one} position={POINT_1} number={1} />
      <GatheringSign ref={two} position={POINT_2} number={2} />
      <PhonePost ref={phone} position={PHONE_POST} active={called} />
      <WorldLabel
        position={[POINT_1[0], 2.0, POINT_1[2]]}
        title={t('labels.pointOne')}
        visible={chooseCurrent}
      />
      <WorldLabel
        position={[POINT_2[0], 2.0, POINT_2[2]]}
        title={t('labels.pointTwo')}
        subtitle={wrongWay ? t('labels.downwind') : undefined}
        variant={wrongWay ? 'danger' : 'tag'}
        visible={chooseCurrent}
      />
      <WorldLabel
        position={[WINDSOCK[0] + 0.3, 1.8, WINDSOCK[2]]}
        title={t('labels.windsock')}
        variant="info"
        visible={chooseCurrent}
      />
      <HighlightRing position={PHONE_POST} radius={0.22} visible={callActive} />
      <WorldLabel
        position={[PHONE_POST[0], 1.66, PHONE_POST[2]]}
        title={t('labels.phone')}
        subtitle={t('labels.tapToCall')}
        variant="info"
        visible={callActive}
      />
      <FloorArrows path={EXIT_ROUTE} visible={out && !called} />
    </>
  );
}

// ---------------------------------------------------------------------------
// 3–4. The entry kit: rescue tripod, permit board and the ventilation blower.

const blowerOutlet = new Vector3(
  BLOWER[0] + BLOWER_OUTLET[0],
  BLOWER[1] + BLOWER_OUTLET[1],
  BLOWER[2] + BLOWER_OUTLET[2],
);

/** The flexible air hose from the blower to wherever its end is (down into the pit once in). */
function hoseGeometry(end: Vector3, inPit: boolean): TubeGeometry {
  const sag = blowerOutlet.clone().lerp(end, 0.5).setY(0.05);
  const points = [
    blowerOutlet.clone(),
    blowerOutlet.clone().add(new Vector3(0.08, -0.08, 0)),
    sag,
    end.clone(),
  ];
  if (inPit) points.push(new Vector3(end.x, -0.4, end.z));
  return new TubeGeometry(new CatmullRomCurve3(points), 20, 0.035, 6, false);
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function EntryKit() {
  const arrived = useStepPassed('call-control');
  const signed = useStepPassed('sign-permit');
  const crank = useRef<Group>(null);

  useFrame(() => {
    if (crank.current != null) crank.current.rotation.z = -gasSignals.lift * 40;
  });

  return (
    <>
      <PopIn shown={arrived} at={[MANHOLE[0], 0, MANHOLE[2]]}>
        <RescueTripod crankRef={crank} />
      </PopIn>
      <PopIn shown={arrived} at={PERMIT_BOARD}>
        <PermitBoard position={PERMIT_BOARD} signed={signed} />
      </PopIn>
      <PopIn shown={arrived} at={BLOWER}>
        <Ventilation />
      </PopIn>
    </>
  );
}

type HoseState = 'rest' | 'dragging' | 'in-pit';

function Ventilation() {
  const { t } = useTranslation('gas');
  const active = useStepActive('ventilate');
  const running = useStepPassed('ventilate');
  const hoseEnd = useRef<Group>(null);
  const fan = useRef<Group>(null);
  const tube = useRef<Mesh>(null);
  const state = useRef<HoseState>(running ? 'in-pit' : 'rest');
  const goal = useRef(new Vector3(...HOSE_REST));
  const builtAt = useRef(new Vector3(...HOSE_REST));
  const builtInPit = useRef(running);
  const initialGeometry = useMemo(
    () =>
      running
        ? hoseGeometry(new Vector3(MANHOLE[0], COLLAR_HEIGHT + 0.04, MANHOLE[2]), true)
        : hoseGeometry(new Vector3(...HOSE_REST), false),
    // Built once for the first frame; later shapes are rebuilt as the end moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useInteractable(hoseEnd, {
    id: 'air-hose',
    enabled: active,
    drag: {
      onStart: () => {
        state.current = 'dragging';
      },
      onMove: (point) => {
        goal.current.set(
          clamp(point.x, AREA.minX + 0.1, AREA.maxX - 0.1),
          HOSE_REST[1] + 0.06,
          clamp(point.z, AREA.minZ + 0.1, AREA.maxZ - 0.1),
        );
      },
      onEnd: (point) => {
        const toManhole = Math.hypot(point.x - MANHOLE[0], point.z - MANHOLE[2]);
        if (toManhole <= HOSE_DROP_RADIUS) {
          state.current = 'in-pit';
          gasSignals.ventStartedAt = performance.now() / 1000;
          haptic.success();
          runner().completeStep('ventilate', { detail: `${toManhole.toFixed(2)}m` });
          return;
        }
        state.current = 'rest';
        const fromRest = Math.hypot(point.x - HOSE_REST[0], point.z - HOSE_REST[2]);
        if (fromRest >= MISSED_DROP_MIN_DISTANCE) {
          const missed = stepMessage('ventilate', 'missed');
          runner().recordMistake('ventilate', 'drag-drop', {
            detail: `missed-by-${toManhole.toFixed(2)}m`,
            ...(missed != null ? { message: missed } : {}),
          });
        }
      },
    },
  });

  useEffect(() => {
    if (running) state.current = 'in-pit';
  }, [running]);

  // Blower hum while it runs.
  useEffect(() => {
    if (!running) return;
    const hum = sfx.fan();
    hum?.setLevel?.(0.45);
    return () => hum?.stop();
  }, [running]);

  useEffect(() => () => tube.current?.geometry.dispose(), []);

  useFrame((_frame, delta) => {
    const end = hoseEnd.current;
    if (end == null) return;
    if (state.current === 'in-pit') goal.current.set(MANHOLE[0], COLLAR_HEIGHT + 0.04, MANHOLE[2]);
    else if (state.current === 'rest') goal.current.set(...HOSE_REST);
    end.position.lerp(goal.current, Math.min(1, delta * (state.current === 'dragging' ? 20 : 8)));
    if (running && fan.current != null) fan.current.rotation.x += delta * 28;

    // Re-shape the hose when its end has moved.
    const inPit = state.current === 'in-pit';
    const mesh = tube.current;
    if (
      mesh != null &&
      (end.position.distanceTo(builtAt.current) > 0.005 || inPit !== builtInPit.current)
    ) {
      builtAt.current.copy(end.position);
      builtInPit.current = inPit;
      const old = mesh.geometry;
      mesh.geometry = hoseGeometry(
        end.position,
        inPit && end.position.distanceTo(goal.current) < 0.02,
      );
      old.dispose();
    }
  });

  return (
    <>
      <Blower position={BLOWER} fanRef={fan} />
      <mesh ref={tube} geometry={initialGeometry} material={flatMaterial('#3a3f45')} />
      <group
        ref={hoseEnd}
        position={
          running
            ? [MANHOLE[0], COLLAR_HEIGHT + 0.04, MANHOLE[2]]
            : [HOSE_REST[0], HOSE_REST[1], HOSE_REST[2]]
        }
      >
        <mesh rotation-x={Math.PI / 2} material={flatMaterial(PALETTE.matte)}>
          <cylinderGeometry args={[0.045, 0.045, 0.06, 8]} />
        </mesh>
        {/* Generous grab area: the end of the hose is small on a phone screen. */}
        <mesh visible={false}>
          <sphereGeometry args={[0.16, 6, 4]} />
        </mesh>
      </group>
      <HighlightRing position={HOSE_REST} radius={0.17} visible={active} />
      <HighlightRing
        position={MANHOLE}
        radius={HOSE_DROP_RADIUS}
        color="#22c55e"
        visible={active}
      />
      <WorldLabel
        position={[HOSE_REST[0], 0.42, HOSE_REST[2]]}
        title={t('labels.airHose')}
        subtitle={t('labels.dragToManhole')}
        variant="info"
        visible={active}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// 3–4. The gas monitor: tests in order, then re-testing while the blower clears the pit.

const MONITOR_STEPS = new Set([
  'test-oxygen',
  'test-flammable',
  'test-toxic',
  'ventilate',
  'sign-permit',
]);

function AirTesting() {
  const { t } = useTranslation('gas');
  const stepId = useRunnerStore((state) =>
    state.status === 'running' ? state.module?.steps[state.stepIndex]?.id : undefined,
  );
  const signed = useStepPassed('sign-permit');
  const sampling = useGasStore((state) => state.sampling);
  const channel = channelForStep(stepId);
  const permitStep = stepId === 'sign-permit';
  const holding = stepId != null && MONITOR_STEPS.has(stepId);
  const probing = channel != null || permitStep;

  const manhole = useRef<Group>(null);
  const probe = useRef<Group>(null);
  const probeLine = useRef(newSegment());
  const pitAmount = useRef(1);
  const venting = useRef(0);
  const pit = useRef<GasReadings>({ ...PIT_BEFORE });
  const shown = useRef<GasReadings>({ ...AMBIENT });
  const rounded = useRef<GasReadings>({ ...AMBIENT });
  const timers = useRef({ sample: 0, idle: 0, hinted: false, settle: 0, publish: 0 });

  useAimTarget(manhole, { id: 'manhole', enabled: probing, radius: MANHOLE_OPENING + 0.04 });

  // Every test step starts with no test chosen.
  useEffect(() => {
    gas().setChannel(null);
    timers.current = { ...timers.current, sample: 0, idle: 0, hinted: false, settle: 0 };
  }, [stepId]);

  useFrame((_frame, delta) => {
    const started = gasSignals.ventStartedAt;
    const ventSeconds = started == null ? null : performance.now() / 1000 - started;
    pitAtmosphere(ventSeconds, pit.current);
    pitAmount.current = 1 - ventProgress(ventSeconds);
    venting.current = ventSeconds == null ? 0 : 1;

    // The probe reads the pit while it is in the manhole, fresh air otherwise.
    const inPit = probing && engine().aimedTargetId === 'manhole';
    const k = 1 - Math.exp(-delta / SENSOR_TAU);
    for (const name of GASES) {
      const target = inPit ? pit.current[name] : AMBIENT[name];
      shown.current[name] += (target - shown.current[name]) * k;
    }

    const line = probeLine.current;
    line.visible = inPit && probe.current != null && manhole.current != null;
    if (line.visible) {
      probe.current?.getWorldPosition(line.a);
      manhole.current?.getWorldPosition(line.b);
    }

    const timer = timers.current;
    const { stepDone } = runner();
    if (channel != null && stepId != null && !stepDone) {
      const chosen = gas().channel === channel;
      timer.sample =
        inPit && chosen ? timer.sample + delta : Math.max(0, timer.sample - delta * 1.5);
      timer.idle = inPit && gas().channel == null ? timer.idle + delta : 0;
      if (timer.idle > CHOOSE_HINT_SECONDS && !timer.hinted) {
        timer.hinted = true;
        runner().showHint(stepId, stepMessage(stepId, 'choose-test'));
      }
      runner().setStepProgress(timer.sample / SAMPLE_SECONDS);
      if (timer.sample >= SAMPLE_SECONDS) {
        haptic.success();
        runner().completeStep(stepId, {
          detail: CHANNEL_GASES[channel]
            .map((name) => `${name}=${formatGas(name, PIT_BEFORE[name])}`)
            .join(','),
        });
      }
    }
    if (permitStep && !stepDone) {
      timer.settle = inPit ? timer.settle + delta : 0;
      const settled = timer.settle >= SETTLE_SECONDS;
      gas().setPermitCheck(settled, settled && allSafe(pit.current) && allSafe(shown.current));
    }

    // Publish what the monitor shows at a low rate (and at once when the probe goes in or out).
    timer.publish += delta;
    if (timer.publish >= PUBLISH_INTERVAL_S || inPit !== gas().sampling) {
      timer.publish = 0;
      for (const name of GASES) rounded.current[name] = roundGas(name, shown.current[name]);
      gas().publishReadings(rounded.current, inPit);
    }
  });

  return (
    <>
      <group ref={manhole} position={[MANHOLE[0], 0.05, MANHOLE[2]]} />
      <PitGas amount={pitAmount} venting={venting} />
      {holding && !signed && (
        <CameraAttached offset={[0.11, -0.12, -0.42]}>
          <group rotation={[0.3, -0.45, 0.05]} scale={0.5}>
            <GasMonitorModel probeRef={probe} />
          </group>
        </CameraAttached>
      )}
      <SegmentLine segment={probeLine} radius={0.004} color="#1d1f22" world />
      <WorldLabel
        position={[MANHOLE[0], 0.45, MANHOLE[2]]}
        title={t('labels.probeHere')}
        variant="info"
        visible={probing && !sampling}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// The crew: Ravi (co-worker, later the entrant) and Sunita (the attendant).

type RaviPhase = 'panel' | 'point-1' | 'staging' | 'at-manhole' | 'in-pit' | 'rescued';
type WalkPhase = Exclude<RaviPhase, 'in-pit' | 'rescued'>;

const RAVI_WALKS: Record<WalkPhase, { route: readonly Point[]; spot: Spot }> = {
  panel: { route: [RAVI_AT_PANEL.at], spot: RAVI_AT_PANEL },
  'point-1': { route: [RAVI_EXIT_VIA, RAVI_AT_POINT_1.at], spot: RAVI_AT_POINT_1 },
  staging: { route: [RAVI_STAGING.at], spot: RAVI_STAGING },
  'at-manhole': { route: [RAVI_TO_MANHOLE_VIA, RAVI_AT_MANHOLE.at], spot: RAVI_AT_MANHOLE },
};

function isWalkPhase(phase: RaviPhase): phase is WalkPhase {
  return phase !== 'in-pit' && phase !== 'rescued';
}

/** Shortest turn from one heading to another, limited to `maxStep` radians. */
function turnTowards(from: number, to: number, maxStep: number): number {
  let delta = (to - from) % (Math.PI * 2);
  if (delta > Math.PI) delta -= Math.PI * 2;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return from + Math.max(-maxStep, Math.min(maxStep, delta));
}

const ease = (k: number) => k * k * (3 - 2 * k);

interface Walker {
  x: number;
  z: number;
  y: number;
  heading: number;
  waypoints: Point[];
}

/** Walks a walker along its waypoints; returns its speed this frame. */
function walk(walker: Walker, spot: Spot, delta: number): number {
  const target = walker.waypoints[0];
  if (target == null) {
    walker.heading = turnTowards(walker.heading, spot.facing, delta * 4);
    return 0;
  }
  const dx = target[0] - walker.x;
  const dz = target[1] - walker.z;
  const distance = Math.hypot(dx, dz);
  if (distance < 0.02) {
    walker.waypoints.shift();
    return WALK_SPEED;
  }
  const step = Math.min(distance, WALK_SPEED * delta);
  walker.x += (dx / distance) * step;
  walker.z += (dz / distance) * step;
  walker.heading = turnTowards(walker.heading, Math.atan2(dx, dz), delta * 8);
  return WALK_SPEED;
}

const worldPoint = new Vector3();
const projected = new Vector3();

function Crew() {
  const { t } = useTranslation('gas');
  const sparksActive = useStepActive('stop-sparks');
  const sparksCurrent = useStepCurrent('stop-sparks');
  const outUpwind = useStepPassed('go-upwind');
  const called = useStepPassed('call-control');
  const dressActive = useStepActive('dress-entrant');
  const dressCurrent = useStepCurrent('dress-entrant');
  const dressed = useStepPassed('dress-entrant');
  const assignCurrent = useStepCurrent('assign-attendant');
  const assigned = useStepPassed('assign-attendant');
  const commsCurrent = useStepCurrent('comms-check');
  const commsDone = useStepPassed('comms-check');
  const emergency = useStepCurrent('emergency-response');
  const winching = useStepActive('winch-rescue');
  const rescued = useStepPassed('winch-rescue');
  const worn = useGasStore((state) => state.worn);

  const phase: RaviPhase = rescued
    ? 'rescued'
    : commsDone
      ? 'in-pit'
      : dressed
        ? 'at-manhole'
        : called
          ? 'staging'
          : outUpwind
            ? 'point-1'
            : 'panel';
  const gear = dressed ? REQUIRED_PPE : worn;
  // He takes his helmet off to suit up, so it goes back on as part of the entry PPE.
  const helmet = !dressCurrent || gear.includes('helmet');
  const responded = useStepPassed('emergency-response');
  const alarm = (emergency || responded) && !rescued;

  const ravi = useRef<Group>(null);
  const raviBody = useRef<Group>(null);
  const dRing = useRef<Group>(null);
  const pulley = useRef<Group>(null);
  const raviPose = useRef<AvatarPose>({ speed: 0, crouch: 0, distress: 0, reach: 0 });
  const raviWalker = useRef<Walker | null>(null);
  const raviState = useRef({
    phase: null as RaviPhase | null,
    descend: 0,
    rescue: 0,
    liftFrom: PIT_FLOOR_Y,
  });
  const lifeline = useRef(newSegment());

  const sunita = useRef<Group>(null);
  const sunitaPose = useRef<AvatarPose>({ speed: 0, crouch: 0, distress: 0, reach: 0 });
  const sunitaWalker = useRef<Walker | null>(null);
  const sunitaPhase = useRef<'away' | 'standby' | 'winch' | null>(null);
  const sunitaGoal: 'away' | 'standby' | 'winch' = assigned ? 'winch' : called ? 'standby' : 'away';

  useFrame(({ camera, size, clock }, delta) => {
    // ---- Ravi ----
    const group = ravi.current;
    const body = raviBody.current;
    if (group != null && body != null) {
      const state = raviState.current;
      const first = state.phase == null;
      if (raviWalker.current == null) {
        raviWalker.current = {
          x: RAVI_AT_PANEL.at[0],
          z: RAVI_AT_PANEL.at[1],
          y: 0,
          heading: RAVI_AT_PANEL.facing,
          waypoints: [],
        };
      }
      const walker = raviWalker.current;
      if (state.phase !== phase) {
        state.phase = phase;
        if (isWalkPhase(phase)) {
          const { route, spot } = RAVI_WALKS[phase];
          walker.waypoints = [...route];
          if (first) {
            walker.x = spot.at[0];
            walker.z = spot.at[1];
            walker.heading = spot.facing;
            walker.waypoints = [];
          }
        } else if (phase === 'in-pit') {
          state.descend = first ? 1 : 0;
          state.liftFrom = PIT_FLOOR_Y;
        } else {
          state.rescue = first ? 1 : 0;
        }
      }

      const pose = raviPose.current;
      const reach = pose.reach ?? 0;
      pose.reach = reach + ((sparksActive ? 1 : 0) - reach) * Math.min(1, delta * 6);
      let tilt = 0;
      pose.limp = 0;
      if (isWalkPhase(phase)) {
        pose.speed = walk(walker, RAVI_WALKS[phase].spot, delta);
        walker.y = 0;
      } else if (phase === 'in-pit') {
        const lift = gasSignals.lift;
        if (lift > 0) {
          // Hauled up on the lifeline, limp.
          if (state.descend < 1) state.liftFrom = walker.y;
          state.descend = 1;
          walker.x = MANHOLE[0];
          walker.z = MANHOLE[2];
          walker.y = state.liftFrom + (COLLAR_HEIGHT + 0.06 - state.liftFrom) * lift;
          pose.speed = 0;
          pose.limp = 1;
          tilt = 0.18;
        } else {
          // Step onto the collar in the middle of the opening, then climb down the ladder.
          state.descend = Math.min(1, state.descend + delta / DESCEND_SECONDS);
          const k = state.descend;
          const step = ease(Math.min(1, k / 0.2));
          walker.x = RAVI_AT_MANHOLE.at[0] + (MANHOLE[0] - RAVI_AT_MANHOLE.at[0]) * step;
          walker.z = RAVI_AT_MANHOLE.at[1] + (MANHOLE[2] - RAVI_AT_MANHOLE.at[1]) * step;
          walker.y =
            k < 0.2
              ? COLLAR_HEIGHT * step
              : COLLAR_HEIGHT + (PIT_FLOOR_Y - COLLAR_HEIGHT) * ((k - 0.2) / 0.8);
          walker.heading = turnTowards(walker.heading, Math.PI, delta * 6);
          pose.speed = k < 1 ? 0.35 : 0;
        }
      } else {
        // Laid down in fresh air beside the manhole.
        state.rescue = Math.min(1, state.rescue + delta / RESCUE_MOVE_SECONDS);
        const k = ease(state.rescue);
        walker.x = MANHOLE[0] + (RAVI_RESCUED.at[0] - MANHOLE[0]) * k;
        walker.z = MANHOLE[2] + (RAVI_RESCUED.at[1] - MANHOLE[2]) * k;
        walker.y = (COLLAR_HEIGHT + 0.06) * (1 - k) + 0.12 * k + Math.sin(Math.PI * k) * 0.15;
        walker.heading = turnTowards(walker.heading, RAVI_RESCUED.facing, delta * 4);
        pose.speed = 0;
        pose.limp = 1;
        tilt = -(Math.PI / 2) * k;
      }
      group.position.set(walker.x, walker.y, walker.z);
      group.rotation.y = walker.heading;
      body.rotation.x = tilt;

      // Lifeline from the tripod's pulley to the D-ring on his back.
      const line = lifeline.current;
      line.visible = assigned && !rescued && dRing.current != null && pulley.current != null;
      if (line.visible) {
        pulley.current?.getWorldPosition(line.a);
        dRing.current?.getWorldPosition(line.b);
      }

      // Where he is on screen, so PPE cards can be dropped on him.
      if (dressCurrent) {
        group.updateWorldMatrix(true, false);
        projected.set(0, 0, 0).applyMatrix4(group.matrixWorld).project(camera);
        const feetX = ((projected.x + 1) / 2) * size.width;
        const feetY = ((1 - projected.y) / 2) * size.height;
        const feetVisible = projected.z < 1;
        worldPoint.set(0, 1.85, 0).applyMatrix4(group.matrixWorld);
        projected.copy(worldPoint).project(camera);
        const headY = ((1 - projected.y) / 2) * size.height;
        const halfWidth = Math.max(60, (feetY - headY) * 0.3);
        raviOnScreen.visible = feetVisible && projected.z < 1;
        raviOnScreen.left = feetX - halfWidth;
        raviOnScreen.right = feetX + halfWidth;
        raviOnScreen.top = headY - 40;
        raviOnScreen.bottom = feetY + 30;
      } else {
        raviOnScreen.visible = false;
      }
    }

    // ---- Sunita ----
    const her = sunita.current;
    if (her != null) {
      const firstSunita = sunitaPhase.current == null;
      if (sunitaWalker.current == null) {
        sunitaWalker.current = {
          x: SUNITA_ARRIVES_FROM[0],
          z: SUNITA_ARRIVES_FROM[1],
          y: 0,
          heading: Math.PI,
          waypoints: [],
        };
      }
      const walker = sunitaWalker.current;
      if (sunitaPhase.current !== sunitaGoal) {
        sunitaPhase.current = sunitaGoal;
        const spot = sunitaGoal === 'winch' ? SUNITA_AT_WINCH : SUNITA_STANDBY;
        walker.waypoints = sunitaGoal === 'away' ? [] : [spot.at];
        if (firstSunita && sunitaGoal !== 'away') {
          walker.x = spot.at[0];
          walker.z = spot.at[1];
          walker.heading = spot.facing;
          walker.waypoints = [];
        }
      }
      her.visible = sunitaGoal !== 'away';
      const spot = sunitaGoal === 'winch' ? SUNITA_AT_WINCH : SUNITA_STANDBY;
      const pose = sunitaPose.current;
      pose.speed = sunitaGoal === 'away' ? 0 : walk(walker, spot, delta);
      // Turning the winch with you, or calling Ravi on the radio when he stops answering.
      const cranking = winching && engine().holdPressed;
      const reachGoal = cranking
        ? 0.55 + Math.sin(clock.elapsedTime * 9) * 0.35
        : emergency
          ? 0.8
          : 0;
      pose.reach = (pose.reach ?? 0) + (reachGoal - (pose.reach ?? 0)) * Math.min(1, delta * 10);
      her.position.set(walker.x, 0, walker.z);
      her.rotation.y = walker.heading;
    }
  });

  const raviTitle = commsCurrent && commsDone ? t('labels.loudAndClear') : t('labels.ravi');
  const raviSubtitle = dressActive
    ? t('labels.dragHere')
    : assignCurrent
      ? t('labels.entrant')
      : undefined;
  return (
    <>
      <group ref={pulley} position={[PULLEY_POINT[0], PULLEY_POINT[1], PULLEY_POINT[2]]} />
      <group ref={ravi}>
        <group ref={raviBody}>
          <WorkerAvatar
            pose={raviPose}
            helmet={helmet}
            mustache
            headGear={gear.includes('breathing-apparatus') && <EntrantMask />}
          >
            <EntrantGear worn={gear} alarm={alarm} />
            <group ref={dRing} position={[D_RING[0], D_RING[1], D_RING[2]]} />
          </WorkerAvatar>
        </group>
        <WorldLabel
          position={[0, 2.0, 0]}
          title={raviTitle}
          subtitle={raviSubtitle}
          variant={dressActive ? 'ok' : 'tag'}
          visible={sparksCurrent || dressCurrent || assignCurrent || (commsCurrent && commsDone)}
        />
      </group>
      <HighlightRing
        position={[RAVI_STAGING.at[0], 0, RAVI_STAGING.at[1]]}
        radius={0.38}
        color="#22c55e"
        visible={dressActive}
      />
      <SegmentLine segment={lifeline} radius={0.008} color="#ff7a1a" world />
      <group ref={sunita} visible={false}>
        <WorkerAvatar
          pose={sunitaPose}
          build="female"
          vestColor="#c6e34a"
          shirtColor="#5a3a52"
          helmetColor="#f5f5f5"
        />
        <WorldLabel
          position={[0, 2.0, 0]}
          title={assigned ? t('labels.attendant') : t('labels.sunita')}
          subtitle={assigned ? t('labels.staysOutside') : undefined}
          variant="info"
          visible={assignCurrent || (assigned && !rescued)}
        />
      </group>
    </>
  );
}

// ---------------------------------------------------------------------------
// 6. Buddy system: the radio check before Ravi goes down.

function CommsCheck() {
  const current = useStepCurrent('comms-check');
  const active = useStepActive('comms-check');
  const timer = useRef({ held: 0, pressed: false, hinted: false });

  useEffect(() => {
    timer.current = { held: 0, pressed: false, hinted: false };
  }, [active]);

  useFrame((_frame, delta) => {
    if (!active) return;
    const pressed = engine().holdPressed;
    const state = timer.current;
    if (pressed && !state.pressed) sfx.radio();
    if (!pressed && state.pressed && state.held < TALK_SECONDS && !state.hinted) {
      state.hinted = true;
      runner().showHint('comms-check');
    }
    state.pressed = pressed;
    state.held = pressed ? state.held + delta : Math.max(0, state.held - delta);
    runner().setStepProgress(state.held / TALK_SECONDS);
    if (state.held >= TALK_SECONDS) {
      sfx.radio();
      haptic.success();
      runner().completeStep('comms-check', { detail: 'radio' });
    }
  });

  if (!current) return null;
  return (
    <CameraAttached offset={[0.11, -0.13, -0.42]}>
      <group rotation={[0.25, -0.4, 0]} scale={0.6}>
        <RadioModel />
      </group>
    </CameraAttached>
  );
}

// ---------------------------------------------------------------------------
// 7. Emergency: the alarm, then the non-entry rescue with the winch.

function Rescue() {
  const { t } = useTranslation('gas');
  const emergency = useStepCurrent('emergency-response');
  const responded = useStepPassed('emergency-response');
  const winchActive = useStepActive('winch-rescue');
  const rescued = useStepPassed('winch-rescue');
  const alarmOn = (emergency || responded) && !rescued;
  const respondedBefore = useRef(responded);
  const winch = useRef({ lastTick: 0, idle: 0, hinted: false });

  // Ravi's gas detector keeps beeping until he is out.
  useEffect(() => {
    if (!alarmOn) return;
    const beeps = sfx.gasAlarm();
    return () => beeps?.stop();
  }, [alarmOn]);

  // The site alarm, when it is raised in this attempt.
  useEffect(() => {
    if (!responded || respondedBefore.current) return;
    respondedBefore.current = true;
    const siren = sfx.siren();
    const timer = window.setTimeout(() => siren?.stop(), 4000);
    return () => {
      window.clearTimeout(timer);
      siren?.stop();
    };
  }, [responded]);

  useEffect(() => {
    winch.current = { lastTick: gasSignals.lift, idle: 0, hinted: false };
  }, [winchActive]);

  useFrame((_frame, delta) => {
    if (!winchActive) return;
    const pressed = engine().holdPressed;
    const state = winch.current;
    if (pressed) {
      gasSignals.lift = Math.min(1, gasSignals.lift + delta / LIFT_SECONDS);
      if (gasSignals.lift - state.lastTick > 0.035) {
        state.lastTick = gasSignals.lift;
        sfx.ratchet();
      }
    }
    state.idle = pressed ? 0 : state.idle + delta;
    if (state.idle > 5 && !state.hinted) {
      state.hinted = true;
      runner().showHint('winch-rescue');
    }
    runner().setStepProgress(gasSignals.lift);
    if (gasSignals.lift >= 1) {
      sfx.success();
      haptic.success();
      runner().completeStep('winch-rescue', { detail: 'winch' });
    }
  });

  return (
    <WorldLabel
      position={[MANHOLE[0], 0.62, MANHOLE[2]]}
      title={t('labels.ravi')}
      subtitle={t('labels.noAnswer')}
      variant="danger"
      visible={alarmOn && !winchActive}
    />
  );
}

// ---------------------------------------------------------------------------
// 3D mode: glide the camera to frame what a decision is about (a portrait screen cannot show
// the whole area): a wide shot of both gathering points and the windsock while choosing where
// to go, then the manhole once the line is shut off. The worker can orbit freely afterwards.

const SHOTS = {
  evacuate: { target: new Vector3(0.05, 0.85, -0.45), position: new Vector3(0.05, 2.8, 3.3) },
  confined: { target: new Vector3(0.45, 0.45, -0.45), position: new Vector3(0.45, 2.3, 2.2) },
} as const;

function CameraGlide() {
  const mode = useEngineStore((state) => state.mode);
  const choosingWay = useStepActive('go-upwind');
  const confined = useStepPassed('call-control');
  const shot =
    mode !== 'fallback3d' ? null : confined ? 'confined' : choosingWay ? 'evacuate' : null;

  useEffect(() => {
    if (shot == null) return;
    engine().setCameraDirected(true);
    const timer = window.setTimeout(() => engine().setCameraDirected(false), GLIDE_MS);
    return () => {
      window.clearTimeout(timer);
      engine().setCameraDirected(false);
    };
  }, [shot]);

  useFrame(({ camera, controls }, delta) => {
    if (shot == null || !engine().cameraDirected) return;
    const orbit = controls as { target: Vector3; update: () => void } | null;
    if (orbit == null) return;
    const k = Math.min(1, delta * 3);
    orbit.target.lerp(SHOTS[shot].target, k);
    camera.position.lerp(SHOTS[shot].position, k);
    orbit.update();
  });
  return null;
}
