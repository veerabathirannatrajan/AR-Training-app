import type { ModuleStep, TrainingAction } from '@ar-training/shared';
import {
  ArrowDownToLine,
  CircleCheck,
  Crosshair,
  Hand,
  Lightbulb,
  MapPin,
  Move,
  Pointer,
  RotateCw,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Chip, ProgressBar } from '../../design/components';
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
  move: Move,
  'select-option': Pointer,
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
  const Icon = INTERACTION_ICONS[step.interaction];
  const text = localize(
    inFallback && step.fallbackInstruction ? step.fallbackInstruction : step.instruction,
  );

  return (
    <section className="glass instruction-card" aria-live="polite">
      <div className="instruction-icon">
        <Icon size={24} />
      </div>
      <div className="grow stack-1">
        <p className="t-body t-strong" lang={text.lang}>
          {text.text}
        </p>
        {text.needsReview && <Chip tone="warn">{t('language.draft')}</Chip>}
        {showProgress && <ProgressBar value={progress} tone={progress >= 1 ? 'ok' : 'accent'} />}
      </div>
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
