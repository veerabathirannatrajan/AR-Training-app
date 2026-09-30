import type { ModuleStep, TrainingModuleContent } from '@ar-training/shared';
import { Globe, LogOut, OctagonAlert, Play, RotateCcw, X } from 'lucide-react';
import { useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../design/components';
import { cx } from '../../design/cx';
import { useLanguage } from '../../i18n';
import { useLocalized } from '../../i18n/localized';
import { narrationFromText, speak } from '../../voice/narrator';
import { haptic, sfx } from '../feedback/sfx';
import type { CriticalAlert } from '../runner/runnerStore';
import { XR_UI_PROPS } from '../xr/xrUi';

/** Dark glass sheet for the training HUD. Tapping outside calls onClose (when given). */
export function HudSheet({
  title,
  onClose,
  className,
  children,
}: {
  title?: string;
  onClose?: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className="sheet-backdrop" {...XR_UI_PROPS} onClick={onClose}>
      <section
        className={cx('hud-sheet', className)}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        {title != null && <h2 className="t-title">{title}</h2>}
        {children}
      </section>
    </div>
  );
}

/** Answer buttons for a decision step (the question itself is on the instruction card). */
export function OptionPanel({
  step,
  tried,
  onChoose,
}: {
  step: ModuleStep;
  tried: readonly string[];
  onChoose: (optionId: string) => void;
}) {
  const localize = useLocalized();
  const options = step.options ?? [];
  const single = options.some((option) => localize(option.label).text.length > 28);
  return (
    <div
      className={cx('option-panel hud-glass', single && 'is-single')}
      role="group"
      {...XR_UI_PROPS}
    >
      {options.map((option, index) => {
        const label = localize(option.label);
        const wrong = tried.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            className={cx('option-button', wrong && 'is-wrong')}
            disabled={wrong}
            onClick={() => {
              haptic.tap();
              onChoose(option.id);
            }}
          >
            <span className="option-letter">
              {wrong ? <X size={16} /> : String.fromCharCode(65 + index)}
            </span>
            <span lang={label.lang}>{label.text}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Explains a critical error. The attempt is already failed; training continues after "I understand". */
export function CriticalModal({
  module,
  alert,
  onAcknowledge,
}: {
  module: TrainingModuleContent;
  alert: CriticalAlert;
  onAcknowledge: () => void;
}) {
  const { t } = useTranslation('training');
  const lang = useLanguage();
  const localize = useLocalized();
  const error = module.criticalErrors?.find((candidate) => candidate.id === alert.errorId);

  useEffect(() => {
    sfx.critical();
    haptic.critical();
    if (error != null) {
      speak(narrationFromText(`${module.id}.critical.${error.id}`, error.explanation), lang);
    }
    // Once per alert.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alert.id]);

  const title = error != null ? localize(error.title) : null;
  const explanation = error != null ? localize(error.explanation) : null;
  return (
    <>
      <div className="critical-vignette" aria-hidden />
      <div className="sheet-backdrop" {...XR_UI_PROPS} style={{ justifyContent: 'center' }}>
        <section className="hud-sheet critical-sheet" role="alertdialog" aria-modal="true">
          <div className="row">
            <span className="critical-icon">
              <OctagonAlert size={38} />
            </span>
            <div className="stack-1">
              <span className="critical-label">{t('critical.label')}</span>
              {title != null && (
                <h2 className="t-title" lang={title.lang}>
                  {title.text}
                </h2>
              )}
            </div>
          </div>
          {explanation != null && (
            <p className="t-body" lang={explanation.lang}>
              {explanation.text}
            </p>
          )}
          <p className="critical-notice">{t('critical.failNotice')}</p>
          <Button variant="danger" size="lg" block onClick={onAcknowledge}>
            {t('critical.continue')}
          </Button>
        </section>
      </div>
    </>
  );
}

export function PauseMenu({
  onResume,
  onRestart,
  onLanguage,
  onLeave,
}: {
  onResume: () => void;
  onRestart: () => void;
  onLanguage: () => void;
  onLeave: () => void;
}) {
  const { t } = useTranslation('training');
  return (
    <HudSheet title={t('pause.title')} onClose={onResume}>
      <div className="sheet-actions">
        <Button size="lg" block icon={<Play size={20} />} onClick={onResume}>
          {t('pause.resume')}
        </Button>
        <Button variant="secondary" block icon={<Globe size={20} />} onClick={onLanguage}>
          {t('pause.language')}
        </Button>
        <Button variant="secondary" block icon={<RotateCcw size={20} />} onClick={onRestart}>
          {t('pause.restart')}
        </Button>
        <Button variant="danger" block icon={<LogOut size={20} />} onClick={onLeave}>
          {t('pause.exit')}
        </Button>
      </div>
    </HudSheet>
  );
}
