import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { cx } from '../../design/cx';
import { ProgressBar } from '../../design/components';
import { crouchDepth } from '../crouch';
import { useEngineStore } from '../engineStore';
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
function PressHoldButton({
  label,
  icon,
  onChange,
  pressed,
}: {
  label: string;
  icon: ReactNode;
  onChange: (pressed: boolean) => void;
  pressed: boolean;
}) {
  useEffect(() => () => onChange(false), [onChange]);
  const release = () => onChange(false);
  return (
    <button
      type="button"
      className={cx('hold-button', pressed && 'is-pressed')}
      aria-pressed={pressed}
      {...XR_UI_PROPS}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        onChange(true);
      }}
      onPointerUp={release}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(event) => event.preventDefault()}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function HoldButton({ icon }: { icon: ReactNode }) {
  const { t } = useTranslation('training');
  const pressed = useEngineStore((state) => state.holdPressed);
  const setHoldPressed = useEngineStore((state) => state.setHoldPressed);
  return (
    <PressHoldButton
      label={t('controls.hold')}
      icon={icon}
      pressed={pressed}
      onChange={setHoldPressed}
    />
  );
}

export function CrouchButton({ icon }: { icon: ReactNode }) {
  const { t } = useTranslation('training');
  const pressed = useEngineStore((state) => state.crouchHeld);
  const setCrouchHeld = useEngineStore((state) => state.setCrouchHeld);
  return (
    <PressHoldButton
      label={t('controls.crouch')}
      icon={icon}
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
    <div className={cx('glass crouch-meter', crouching && 'is-low')} role="status">
      <span className="t-strong">{message}</span>
      <ProgressBar value={calibrating ? 0 : depth} tone={crouching ? 'ok' : 'accent'} />
      {height != null && <span className="t-caption t-muted t-num">{height.toFixed(2)} m</span>}
    </div>
  );
}
