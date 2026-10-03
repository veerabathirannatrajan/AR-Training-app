import {
  groupIndexOf,
  stepGroups,
  type ModuleStep,
  type TrainingModuleContent,
} from '@ar-training/shared';
import { ArrowDownToLine, Footprints, Hand, Radio, RotateCcw, type LucideIcon } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cx } from '../../design/cx';
import { crouchDepth } from '../crouch';
import { signals, useEngineStore } from '../engineStore';
import { haptic } from '../feedback/sfx';
import { XR_UI_PROPS } from '../xr/xrUi';

/** Centre-screen crosshair; turns green while an aim target is under it. */
export function Crosshair() {
  const aimed = useEngineStore((state) => state.aimedTargetId != null);
  return (
    <div className={cx('crosshair', aimed && 'is-aimed')} aria-hidden>
      <span className="crosshair-ring" />
      <span className="crosshair-dot" />
    </div>
  );
}

/**
 * Round press-and-hold button. Reports pressed while a finger is down on it (and releases on
 * lift, cancel or when the finger slides off), with the long-press menu suppressed.
 */
/** Horizontal thumb slide on a held button, as swipe radians (≈ 60 px → 0.24 rad). */
const SWIPE_RADIANS_PER_PX = 0.004;

function PressHoldButton({
  label,
  icon,
  variant,
  onChange,
  pressed,
  reportsSwipe = false,
}: {
  label: string;
  icon: ReactNode;
  variant: 'hold' | 'move' | 'crouch';
  onChange: (pressed: boolean) => void;
  pressed: boolean;
  /** Sliding the thumb sideways while holding feeds the swipe signal (e.g. sweeping). */
  reportsSwipe?: boolean;
}) {
  useEffect(() => () => onChange(false), [onChange]);
  const release = () => onChange(false);
  const lastX = useRef<number | null>(null);
  return (
    <button
      type="button"
      className={cx('hold-button', variant !== 'hold' && `is-${variant}`, pressed && 'is-pressed')}
      aria-pressed={pressed}
      {...XR_UI_PROPS}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        lastX.current = event.clientX;
        haptic.tap();
        onChange(true);
      }}
      onPointerMove={(event) => {
        if (!reportsSwipe || lastX.current == null) return;
        signals.swipe += (event.clientX - lastX.current) * SWIPE_RADIANS_PER_PX;
        lastX.current = event.clientX;
      }}
      onPointerUp={() => {
        lastX.current = null;
        release();
      }}
      onPointerCancel={() => {
        lastX.current = null;
        release();
      }}
      onLostPointerCapture={() => {
        lastX.current = null;
        release();
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/** What the Hold button says it does (and its icon). */
export type HoldLabel = 'hold' | 'squeeze' | 'talk' | 'winch';

const HOLD_ICONS: Record<HoldLabel, LucideIcon> = {
  hold: Hand,
  squeeze: Hand,
  talk: Radio,
  winch: RotateCcw,
};

export function HoldButton({ label }: { label: HoldLabel }) {
  const { t } = useTranslation('training');
  const pressed = useEngineStore((state) => state.holdPressed);
  const setHoldPressed = useEngineStore((state) => state.setHoldPressed);
  const Icon = HOLD_ICONS[label];
  return (
    <PressHoldButton
      label={t(`controls.${label}`)}
      icon={<Icon size={26} />}
      variant="hold"
      pressed={pressed}
      onChange={setHoldPressed}
      reportsSwipe
    />
  );
}

export function MoveButton() {
  const { t } = useTranslation('training');
  const pressed = useEngineStore((state) => state.movePressed);
  const setMovePressed = useEngineStore((state) => state.setMovePressed);
  return (
    <PressHoldButton
      label={t('controls.move')}
      icon={<Footprints size={26} />}
      variant="move"
      pressed={pressed}
      onChange={setMovePressed}
    />
  );
}

export function CrouchButton() {
  const { t } = useTranslation('training');
  const pressed = useEngineStore((state) => state.crouchHeld);
  const setCrouchHeld = useEngineStore((state) => state.setCrouchHeld);
  return (
    <PressHoldButton
      label={t('controls.crouch')}
      icon={<ArrowDownToLine size={26} />}
      variant="crouch"
      pressed={pressed}
      onChange={setCrouchHeld}
    />
  );
}

/** AR: how low the phone is compared with the worker's standing height. */
export function CrouchMeter() {
  const { t } = useTranslation('training');
  const height = useEngineStore((state) => state.deviceHeight);
  const standing = useEngineStore((state) => state.standingHeight);
  const crouching = useEngineStore((state) => state.crouching);

  const calibrating = standing == null;
  const depth = height == null || standing == null ? 0 : crouchDepth(height, standing);
  const message = calibrating
    ? t('crouch.standUp')
    : crouching
      ? t('crouch.stayLow')
      : t('crouch.goLow');

  return (
    <div className={cx('hud-glass crouch-meter', crouching && 'is-low')} role="status">
      <span>{message}</span>
      <div className="hud-progress">
        <i
          className={cx(crouching && 'is-ok')}
          style={{ width: `${Math.round((calibrating ? 0 : depth) * 100)}%` }}
        />
      </div>
      {height != null && <span className="t-caption t-num">{height.toFixed(2)} m</span>}
    </div>
  );
}

/** Dots for the sub-steps of the current group, e.g. P · A · S · S for the PASS technique. */
export function SubStepIndicator({
  module,
  step,
  completedIds,
}: {
  module: TrainingModuleContent;
  step: ModuleStep;
  completedIds: readonly string[];
}) {
  const group = stepGroups(module)[groupIndexOf(module, step.id)] ?? [];
  const members = group
    .map((id) => module.steps.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is ModuleStep => candidate?.badge != null);
  if (members.length < 2) return null;
  return (
    <div className="substeps hud-glass" aria-hidden>
      {members.map((member) => (
        <span
          key={member.id}
          className={cx(
            'substep',
            completedIds.includes(member.id) && 'is-done',
            member.id === step.id && !completedIds.includes(member.id) && 'is-current',
          )}
        >
          {member.badge}
        </span>
      ))}
    </div>
  );
}
