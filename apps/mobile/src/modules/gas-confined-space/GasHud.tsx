import { GAS_CONFINED_SPACE } from '@ar-training/shared';
import { Check, Fan, Gauge, Signature, Siren, TriangleAlert, X } from 'lucide-react';
import { useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { cx } from '../../design/cx';
import { haptic, sfx } from '../../engine/feedback/sfx';
import {
  runner,
  useRunnerStore,
  useStepActive,
  useStepPassed,
  useStepCurrent,
} from '../../engine/runner/runnerStore';
import { XR_UI_PROPS } from '../../engine/xr/xrUi';
import { useLocalized } from '../../i18n/localized';
import { overlayRoot } from '../../lib/overlayRoot';
import { gas, raviOnScreen, useGasStore } from './gasStore';
import { checkPpeReady, equipPpe, PPE_OPTIONS } from './ppe';
import { PpeIcon } from './PpeIcon';
import {
  channelForStep,
  channelStatus,
  formatGas,
  LIMITS,
  PIT_BEFORE,
  type GasChannel,
  type GasReadings,
  type GasStatus,
} from './readings';

/** Not the test order, so the monitor does not give the answer away. */
const CELL_ORDER: readonly GasChannel[] = ['flammable', 'toxic', 'oxygen'];

function useStepId(): string | undefined {
  return useRunnerStore((state) =>
    state.status === 'running' ? state.module?.steps[state.stepIndex]?.id : undefined,
  );
}

/** The module tray for whichever step needs one. */
export function GasTray() {
  const stepId = useStepId();
  if (stepId === 'dress-entrant') return <PpeTray />;
  if (stepId === 'sign-permit') return <MonitorTray mode="permit" />;
  if (channelForStep(stepId) != null) return <MonitorTray mode="test" />;
  return null;
}

// ---------------------------------------------------------------------------
// Gas monitor

type CellState = 'idle' | 'live' | 'locked';

function ChannelReading({ channel, readings }: { channel: GasChannel; readings: GasReadings }) {
  switch (channel) {
    case 'oxygen':
      return (
        <span className="gas-value">
          O₂ <b>{formatGas('o2', readings.o2)}</b> %
        </span>
      );
    case 'flammable':
      return (
        <span className="gas-value">
          <b>{formatGas('lel', readings.lel)}</b> % LEL
        </span>
      );
    case 'toxic':
      return (
        <span className="gas-value gas-value-pair">
          <span>
            H₂S <b>{formatGas('h2s', readings.h2s)}</b> ppm
          </span>
          <span>
            CO <b>{formatGas('co', readings.co)}</b> ppm
          </span>
        </span>
      );
  }
}

function MonitorTray({ mode }: { mode: 'test' | 'permit' }) {
  const { t } = useTranslation('gas');
  const stepId = useStepId();
  const expected = channelForStep(stepId);
  const display = useGasStore((state) => state.display);
  const sampling = useGasStore((state) => state.sampling);
  const chosen = useGasStore((state) => state.channel);
  const wrong = useGasStore((state) => state.wrongChannel);
  const tested: Record<GasChannel, boolean> = {
    oxygen: useStepPassed('test-oxygen'),
    flammable: useStepPassed('test-flammable'),
    toxic: useStepPassed('test-toxic'),
  };

  const pick = (channel: GasChannel) => {
    if (stepId == null || expected == null || tested[channel] || chosen === expected) return;
    if (runner().stepDone) return;
    if (channel === expected) {
      sfx.tap();
      haptic.tap();
      gas().setChannel(channel);
      return;
    }
    // Out of order: the step's hint explains the order.
    sfx.error();
    haptic.error();
    gas().setWrongChannel(channel);
    runner().recordMistake(stepId, 'select-option', { detail: `${channel}-before-${expected}` });
  };

  const sign = () => {
    if (runner().stepDone) return;
    const { confirmedSafe, sampleSettled } = gas();
    if (confirmedSafe) {
      sfx.success();
      haptic.success();
      runner().completeStep('sign-permit', {
        detail: `o2=${display.o2},lel=${display.lel},h2s=${display.h2s},co=${display.co}`,
      });
      return;
    }
    sfx.error();
    haptic.error();
    if (!sampleSettled) {
      const message = GAS_CONFINED_SPACE.steps.find((step) => step.id === 'sign-permit')
        ?.messages?.['test-first'];
      runner().recordMistake('sign-permit', 'tap', {
        detail: 'not-tested',
        ...(message != null ? { message } : {}),
      });
    } else {
      runner().recordMistake('sign-permit', 'tap', { detail: 'unsafe' });
    }
  };

  const limitText: Record<GasChannel, string> = {
    oxygen: t('monitor.safeOxygen', { min: LIMITS.o2Min, max: LIMITS.o2Max }),
    flammable: t('monitor.safeFlammable', { max: LIMITS.lelMax }),
    toxic: t('monitor.safeToxic', { h2s: LIMITS.h2sMax, co: LIMITS.coMax }),
  };
  const statusText: Record<GasStatus, string> = {
    ok: t('monitor.ok'),
    low: t('monitor.low'),
    high: t('monitor.high'),
  };
  const headState =
    mode === 'test' && chosen == null
      ? t('monitor.chooseTest')
      : sampling
        ? t('monitor.sampling')
        : t('monitor.notInPit');

  return (
    <div
      className="hud-tray gas-monitor"
      {...XR_UI_PROPS}
      role="group"
      aria-label={t('monitor.title')}
    >
      <div className="gas-monitor-head">
        <span className="gas-monitor-title">
          <Gauge size={18} />
          {t('monitor.title')}
        </span>
        <span className={cx('gas-monitor-state', sampling && 'is-sampling')}>
          <i aria-hidden />
          {headState}
        </span>
      </div>
      <div className="gas-cells">
        {CELL_ORDER.map((channel) => {
          const state: CellState =
            mode === 'permit'
              ? 'live'
              : tested[channel]
                ? 'locked'
                : chosen === channel
                  ? 'live'
                  : 'idle';
          const readings = state === 'locked' ? PIT_BEFORE : state === 'live' ? display : null;
          const status = readings != null ? channelStatus(channel, readings) : null;
          const isWrong = mode === 'test' && wrong === channel;
          const content = (
            <>
              <span className="gas-cell-name">{t(`monitor.${channel}`)}</span>
              {readings != null ? (
                <ChannelReading channel={channel} readings={readings} />
              ) : (
                <span className="gas-value gas-value-idle">
                  {isWrong ? <X size={20} strokeWidth={3} /> : t('monitor.tapToTest')}
                </span>
              )}
              {status != null && (
                <span className={cx('gas-status', `is-${status}`)}>
                  {status === 'ok' ? (
                    <Check size={13} strokeWidth={3} />
                  ) : (
                    <TriangleAlert size={13} />
                  )}
                  {statusText[status]}
                </span>
              )}
              <span className="gas-limit">{limitText[channel]}</span>
            </>
          );
          const className = cx(
            'gas-cell',
            `is-${state}`,
            status != null && `status-${status}`,
            isWrong && 'is-wrong',
          );
          return mode === 'test' ? (
            <button
              key={channel}
              type="button"
              className={className}
              disabled={tested[channel] || isWrong}
              aria-pressed={chosen === channel}
              onClick={() => pick(channel)}
            >
              {content}
            </button>
          ) : (
            <div key={channel} className={className}>
              {content}
            </div>
          );
        })}
      </div>
      {mode === 'permit' && (
        <button type="button" className="gas-sign" onClick={sign}>
          <Signature size={20} />
          {t('monitor.sign')}
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PPE tray: drag a card onto Ravi (or tap it twice) to put the item on him.

interface CardDrag {
  id: string;
  pointerId: number;
  startX: number;
  startY: number;
  x: number;
  y: number;
  moved: boolean;
}

const DRAG_START_PX = 12;

function overRavi(x: number, y: number): boolean {
  const area = raviOnScreen;
  return area.visible && x >= area.left && x <= area.right && y >= area.top && y <= area.bottom;
}

function PpeTray() {
  const { t } = useTranslation('gas');
  const localize = useLocalized();
  const active = useStepActive('dress-entrant');
  const worn = useGasStore((state) => state.worn);
  const rejected = useGasStore((state) => state.rejected);
  const flagged = useGasStore((state) => state.flagged);
  const preview = useGasStore((state) => state.preview);
  const drag = useRef<CardDrag | null>(null);
  const ghost = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);

  const placeGhost = () => {
    const current = drag.current;
    if (current != null && ghost.current != null) {
      ghost.current.style.transform = `translate(${current.x}px, ${current.y}px) translate(-50%, -60%)`;
      ghost.current.classList.toggle('is-over', overRavi(current.x, current.y));
    }
  };
  useLayoutEffect(placeGhost, [dragging]);

  const onDown = (id: string) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (!active || worn.includes(id) || rejected.includes(id)) return;
    try {
      // Keeps the drag going when the finger leaves the card for the 3D view.
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // The pointer is already gone (released before the handler ran).
    }
    drag.current = {
      id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      moved: false,
    };
  };
  const onMove = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    if (current == null || current.pointerId !== event.pointerId) return;
    current.x = event.clientX;
    current.y = event.clientY;
    if (
      !current.moved &&
      Math.hypot(current.x - current.startX, current.y - current.startY) > DRAG_START_PX
    ) {
      current.moved = true;
      haptic.tap();
      setDragging(current.id);
    }
    if (current.moved) placeGhost();
  };
  const onUp = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const current = drag.current;
    drag.current = null;
    setDragging(null);
    if (current == null || current.pointerId !== event.pointerId) return;
    if (current.moved) {
      if (overRavi(event.clientX, event.clientY)) equipPpe(current.id);
      return;
    }
    // Tap: the first selects the card, the second puts the item on.
    if (gas().preview === current.id) {
      equipPpe(current.id);
    } else {
      sfx.tap();
      gas().setPreview(current.id);
    }
  };
  const onCancel = () => {
    drag.current = null;
    setDragging(null);
  };

  const dragged = PPE_OPTIONS.find((option) => option.id === dragging);
  return (
    <div className="hud-tray ppe-tray" {...XR_UI_PROPS} role="group" aria-label={t('ppe.title')}>
      <div className="ppe-head">
        <strong>{t('ppe.title')}</strong>
        <span>{t('ppe.hint')}</span>
      </div>
      <div className="ppe-grid">
        {PPE_OPTIONS.map((option) => {
          const label = localize(option.label);
          const isWorn = worn.includes(option.id);
          const isRejected = rejected.includes(option.id);
          const isFlagged = flagged.includes(option.id);
          const isPreview = preview === option.id && !isWorn;
          return (
            <button
              key={option.id}
              type="button"
              className={cx(
                'ppe-card',
                isWorn && 'is-worn',
                isRejected && 'is-wrong',
                isFlagged && 'is-flagged',
                isPreview && 'is-selected',
                dragging === option.id && 'is-dragging',
              )}
              disabled={isWorn || isRejected}
              onPointerDown={onDown(option.id)}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onCancel}
              onContextMenu={(event) => event.preventDefault()}
            >
              <PpeIcon id={option.id} />
              <span className="ppe-card-label" lang={label.lang}>
                {label.text}
              </span>
              {isWorn && (
                <span className="card-badge card-badge-ok" aria-label={t('ppe.onRavi')}>
                  <Check size={14} strokeWidth={3} />
                </span>
              )}
              {isRejected && (
                <span className="card-badge card-badge-wrong" aria-hidden>
                  <X size={14} strokeWidth={3} />
                </span>
              )}
              {isFlagged && <span className="ppe-needed">{t('ppe.needed')}</span>}
              {isPreview && <span className="ppe-tap-again">{t('ppe.tapAgain')}</span>}
            </button>
          );
        })}
      </div>
      <button type="button" className="ppe-ready" disabled={!active} onClick={checkPpeReady}>
        <Check size={20} strokeWidth={3} />
        {t('ppe.ready')}
      </button>
      {dragged != null &&
        createPortal(
          <div ref={ghost} className="ppe-ghost" aria-hidden>
            <PpeIcon id={dragged.id} size={56} />
          </div>,
          overlayRoot,
        )}
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Status chips above the tray: the blower running, then the gas alarm in the emergency. */
export function GasOverlay() {
  const { t } = useTranslation('gas');
  const ventilating = useStepPassed('ventilate');
  const emergency = useStepCurrent('emergency-response');
  const responded = useStepPassed('emergency-response');
  const rescued = useStepPassed('winch-rescue');
  if ((emergency || responded) && !rescued) {
    return (
      <div className="hud-chip gas-chip is-danger" role="status">
        <Siren size={20} />
        <span>{t('overlay.alarm')}</span>
      </div>
    );
  }
  if (ventilating && !rescued) {
    return (
      <div className="hud-chip gas-chip" role="status">
        <Fan size={20} className="spin" />
        <span>{t('overlay.blower')}</span>
      </div>
    );
  }
  return null;
}
