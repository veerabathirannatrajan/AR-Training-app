import type { ModuleResult, TrainingModuleContent } from '@ar-training/shared';
import { CircleCheck, House, RotateCcw, Trophy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../design/components';
import { useLocalized } from '../../i18n/localized';
import { XR_UI_PROPS } from '../xr/xrUi';

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** End-of-module summary with the per-step breakdown. */
export function ResultPanel({
  module,
  result,
  onHome,
  onAgain,
}: {
  module: TrainingModuleContent;
  result: ModuleResult;
  onHome: () => void;
  onAgain: () => void;
}) {
  const { t } = useTranslation('training');
  const localize = useLocalized();
  const percent = result.maxScore > 0 ? Math.round((result.score / result.maxScore) * 100) : 0;

  return (
    <div className="sheet-backdrop result-backdrop" {...XR_UI_PROPS}>
      <section
        className="sheet glass card-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="result-title"
      >
        <div className="result-hero">
          <div className="result-badge">
            <Trophy size={36} />
          </div>
          <h2 id="result-title" className="t-title">
            {t('result.tutorialDone')}
          </h2>
          <p className="t-muted">{localize(module.title).text}</p>
        </div>

        <div className="result-stats">
          <div>
            <span className="t-caption t-muted">{t('result.score')}</span>
            <span className="t-display t-num">{percent}%</span>
            <span className="t-small t-muted t-num">
              {result.score}/{result.maxScore}
            </span>
          </div>
          <div>
            <span className="t-caption t-muted">{t('result.time')}</span>
            <span className="t-display t-num">
              {formatDuration(result.completedAt - result.startedAt)}
            </span>
          </div>
        </div>

        <h3 className="t-heading">{t('result.steps')}</h3>
        <ol className="result-steps">
          {result.steps.map((outcome) => {
            const step = module.steps.find((candidate) => candidate.id === outcome.stepId);
            const title = step != null ? localize(step.title) : null;
            return (
              <li key={outcome.stepId} className="result-step">
                <CircleCheck size={20} className="icon-ok" />
                <span className="grow" lang={title?.lang}>
                  {title?.text ?? outcome.stepId}
                  {outcome.mistakes > 0 && (
                    <span className="t-small t-muted">
                      {' '}
                      · {t('result.mistakes', { count: outcome.mistakes })}
                    </span>
                  )}
                </span>
                <span className="t-small t-num t-muted">
                  {outcome.points}/{outcome.maxPoints}
                </span>
              </li>
            );
          })}
        </ol>

        <div className="sheet-actions">
          <Button size="lg" block icon={<House size={20} />} onClick={onHome}>
            {t('result.home')}
          </Button>
          <Button variant="secondary" block icon={<RotateCcw size={20} />} onClick={onAgain}>
            {t('result.again')}
          </Button>
        </div>
      </section>
    </div>
  );
}
