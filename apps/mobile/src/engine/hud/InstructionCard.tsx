import type { ModuleStep, TrainingAction } from '@ar-training/shared';
import {
  ArrowDownToLine,
  CircleCheck,
  Crosshair,
  Footprints,
  Hand,
  Lightbulb,
  ListChecks,
  MapPin,
  Move,
  Pointer,
  RotateCw,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cx } from '../../design/cx';
import { useLocalized } from '../../i18n/localized';
import type { Feedback } from '../runner/runnerStore';

const INTERACTION_ICONS: Record<TrainingAction, LucideIcon> = {
  place: MapPin,
  rotate: RotateCw,
  tap: Pointer,
  'drag-drop': Move,
  hold: Hand,
  aim: Crosshair,
  swipe: Move,
  crouch: ArrowDownToLine,
  move: Footprints,
  'select-option': ListChecks,
};

const FEEDBACK_ICONS = { success: CircleCheck, mistake: TriangleAlert, hint: Lightbulb } as const;

export function InstructionCard({
  step,
  inFallback,
  progress,
  showProgress,
}: {
  step: ModuleStep;
  inFallback: boolean;
  progress: number;
  showProgress: boolean;
}) {
  const { t } = useTranslation();
  const localize = useLocalized();
  const danger = step.tone === 'danger';
  const Icon = danger ? TriangleAlert : INTERACTION_ICONS[step.interaction];
  const headline = localize(step.headline ?? step.title);
  const text = localize(
    inFallback && step.fallbackInstruction ? step.fallbackInstruction : step.instruction,
  );
  const warning = step.warning != null ? localize(step.warning) : null;

  return (
    <section
      key={step.id}
      className={cx('hud-card hud-glass', danger && 'is-danger')}
      aria-live="polite"
    >
      <div className="hud-card-head">
        <span className="hud-card-icon">
          <Icon size={20} />
        </span>
        <div>
          <p className="hud-card-headline" lang={headline.lang}>
            {headline.text}
          </p>
          <p className="hud-card-text" lang={text.lang}>
            {text.text}
          </p>
        </div>
      </div>
      {warning != null && (
        <p className="hud-warning" lang={warning.lang}>
          {warning.text}
        </p>
      )}
      {(text.needsReview || headline.needsReview) && (
        <span className="hud-draft">{t('language.draft')}</span>
      )}
      {showProgress && (
        <div className="hud-progress" role="progressbar" aria-valuenow={Math.round(progress * 100)}>
          <i style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
      )}
    </section>
  );
}

export function FeedbackToast({ feedback }: { feedback: Feedback }) {
  const localize = useLocalized();
  const Icon = FEEDBACK_ICONS[feedback.tone];
  const text = localize(feedback.text);
  return (
    <div
      key={feedback.id}
      className={cx('feedback-toast', `feedback-${feedback.tone}`)}
      role="status"
    >
      <Icon size={22} />
      <span lang={text.lang}>{text.text}</span>
    </div>
  );
}
