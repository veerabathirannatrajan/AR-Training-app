import { FIRE_EXPLOSION } from '@ar-training/shared';
import { Check, TriangleAlert, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cx } from '../../design/cx';
import { haptic, sfx } from '../../engine/feedback/sfx';
import {
  runner,
  useFact,
  useRunnerStore,
  useStepCompleted,
  useStepCurrent,
} from '../../engine/runner/runnerStore';
import { XR_UI_PROPS } from '../../engine/xr/xrUi';
import { useLocalized } from '../../i18n/localized';
import { ExtinguisherIcon } from './ExtinguisherIcon';
import { EXTINGUISHER_TYPES } from './extinguishers';

const CHOOSE_STEP = FIRE_EXPLOSION.steps.find((step) => step.id === 'choose-extinguisher');
/** Stable empty list, so the store selector does not return a new array on every read. */
const NONE: readonly string[] = [];

/**
 * Extinguisher tray (bottom of the screen during "Choose the extinguisher"): tap a card to
 * highlight it in the scene, tap it again (or the extinguisher in the scene) to pick it up.
 */
export function FireTray() {
  const { t } = useTranslation('fire');
  const localize = useLocalized();
  const preview = useFact('preview-extinguisher');
  const chosen = useFact('choose-extinguisher');
  const tried = useRunnerStore((state) => state.triedOptions['choose-extinguisher'] ?? NONE);

  const onCard = (type: string) => {
    if (chosen != null) return;
    haptic.tap();
    if (preview === type) {
      runner().chooseOption('choose-extinguisher', type);
      return;
    }
    sfx.tap();
    runner().setFact('preview-extinguisher', type);
  };

  return (
    <div className="hud-tray fire-tray" {...XR_UI_PROPS} role="group" aria-label={t('tray.title')}>
      {EXTINGUISHER_TYPES.map((type) => {
        const option = CHOOSE_STEP?.options?.find((candidate) => candidate.id === type);
        const label = option != null ? localize(option.label).text : type;
        const wrong = tried.includes(type);
        const isChosen = chosen === type;
        const selected = preview === type || isChosen;
        return (
          <button
            key={type}
            type="button"
            className={cx('extinguisher-card', selected && 'is-selected', wrong && 'is-wrong')}
            onClick={() => onCard(type)}
            aria-pressed={selected}
          >
            <ExtinguisherIcon type={type} size={58} />
            <span className="extinguisher-card-label">{label}</span>
            {wrong && (
              <span className="card-badge card-badge-wrong" aria-hidden>
                <X size={14} strokeWidth={3} />
              </span>
            )}
            {(isChosen || (selected && !wrong)) && (
              <span className="card-badge card-badge-ok" aria-hidden>
                <Check size={14} strokeWidth={3} />
              </span>
            )}
            {preview === type && !isChosen && (
              <span className="extinguisher-card-hint">{t('tray.tapAgain')}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Crouching figure (no suitable icon in the icon set). */
function CrouchIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <circle cx="9" cy="5" r="2.4" />
      <path d="M8 8.5 L13 10 L16 14 L14.6 15 L12.2 12.4 L11 15 L15 18 L15 21.5 L13 21.5 L13 19 L8.6 16.4 L8 21.5 L6 21.5 L6.6 14.5 Z" />
    </svg>
  );
}

/** Smoke warnings above the tray while the room is full of smoke. */
export function FireOverlay() {
  const { t } = useTranslation('fire');
  const inSmoke = useFact('in-smoke') === '1';
  const smokeNow = useStepCurrent('crouch-smoke');
  const smokeDone = useStepCompleted('crouch-smoke');
  const outside = useStepCompleted('reach-assembly');
  if (!(smokeNow || smokeDone) || outside) return null;
  return (
    <div className={cx('hud-chip smoke-chip', inSmoke && 'is-danger')} role="status">
      {inSmoke ? <TriangleAlert size={20} /> : <CrouchIcon />}
      <span>{inSmoke ? t('smoke.inSmoke') : t('smoke.rising')}</span>
    </div>
  );
}
