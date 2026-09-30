import {
  ASSESSMENT_RULES,
  stepsToRetrain,
  type ModuleResult,
  type TrainingModuleContent,
} from '@ar-training/shared';
import {
  CircleCheck,
  CircleX,
  House,
  OctagonAlert,
  RotateCcw,
  ShieldCheck,
  Target,
  TriangleAlert,
  Trophy,
} from 'lucide-react';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../design/components';
import { cx } from '../../design/cx';
import { useLocalized } from '../../i18n/localized';
import { haptic, sfx } from '../feedback/sfx';
import { HudSheet } from './panels';

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/**
 * End of an attempt. Tutorials show a completion summary; assessments show pass / fail with
 * practical + quiz scores, critical errors and what to do for every step that went wrong;
 * a failed assessment offers retraining of just those steps.
 */
export function ResultPanel({
  module,
  result,
  onHome,
  onAgain,
  onRetrain,
}: {
  module: TrainingModuleContent;
  result: ModuleResult;
  onHome: () => void;
  onAgain: () => void;
  onRetrain: (stepIds: string[]) => void;
}) {
  const { t } = useTranslation('training');
  const localize = useLocalized();
  const assessment = result.attemptType === 'assessment';
  const retraining = result.attemptType === 'retraining';
  const passed = result.passed === true;
  const failed = result.passed === false;
  const total =
    result.totalPercent ??
    (result.maxScore > 0 ? Math.round((result.score / result.maxScore) * 100) : 0);
  const retrain = failed ? stepsToRetrain(result) : [];
  const critical = (result.criticalErrors ?? [])
    .map((id) => module.criticalErrors?.find((error) => error.id === id))
    .filter((error) => error != null);

  useEffect(() => {
    if (failed) {
      sfx.error();
      haptic.error();
    } else {
      sfx.success();
      haptic.success();
    }
    // Once when the result appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.id]);

  const heading = assessment
    ? passed
      ? t('assessment.passed')
      : t('assessment.failed')
    : retraining
      ? t('assessment.retrainingDone')
      : t('result.tutorialDone');

  return (
    <HudSheet className="result-sheet">
      <div className="result-hero">
        <div className={cx('result-badge', passed && 'is-pass', failed && 'is-fail')}>
          {failed ? (
            <CircleX size={40} />
          ) : passed ? (
            <ShieldCheck size={40} />
          ) : (
            <Trophy size={38} />
          )}
        </div>
        <h2 className="t-title">{heading}</h2>
        <p className="t-muted">{localize(module.title).text}</p>
        <span className="result-score">{total}%</span>
        {assessment && (
          <span className="t-small t-muted">
            {t('assessment.weights')} ·{' '}
            {t('assessment.passMark', { mark: ASSESSMENT_RULES.passMark })}
          </span>
        )}
      </div>

      <div className="result-stats">
        {assessment ? (
          <>
            <div>
              <span className="t-caption t-muted">{t('assessment.practical')}</span>
              <strong>{result.practicalPercent ?? total}%</strong>
            </div>
            <div>
              <span className="t-caption t-muted">{t('assessment.quizPart')}</span>
              <strong>{result.quizPercent ?? '–'}%</strong>
            </div>
          </>
        ) : (
          <>
            <div>
              <span className="t-caption t-muted">{t('result.score')}</span>
              <strong className="t-num">
                {result.score}/{result.maxScore}
              </strong>
            </div>
            <div>
              <span className="t-caption t-muted">{t('result.time')}</span>
              <strong>{formatDuration(result.completedAt - result.startedAt)}</strong>
            </div>
          </>
        )}
      </div>

      {critical.length > 0 && (
        <div className="result-critical">
          <strong className="row">
            <OctagonAlert size={18} className="icon-red" />
            {t('assessment.criticalTitle')}
          </strong>
          {critical.map((error) => {
            const title = localize(error.title);
            const explanation = localize(error.explanation);
            return (
              <div key={error.id}>
                <p className="t-strong" lang={title.lang}>
                  {title.text}
                </p>
                <p className="t-small t-muted" lang={explanation.lang}>
                  {explanation.text}
                </p>
              </div>
            );
          })}
          <p className="t-small">{t('assessment.criticalReason')}</p>
        </div>
      )}
      {result.failReason === 'below-pass-mark' && (
        <p className="t-small t-muted">{t('assessment.belowMark')}</p>
      )}
      {passed && <p className="t-small t-muted">{t('assessment.drillsScheduled')}</p>}
      {retraining && <p className="t-small t-muted">{t('assessment.retrainNext')}</p>}

      <h3 className="t-heading">{assessment ? t('assessment.stepsTitle') : t('result.steps')}</h3>
      <ol className="result-steps">
        {result.steps
          .filter((outcome) => outcome.skipped !== true)
          .map((outcome) => {
            const step = module.steps.find((candidate) => candidate.id === outcome.stepId);
            const title = step != null ? localize(step.title) : null;
            const clean =
              !outcome.critical && outcome.mistakes === 0 && outcome.points >= outcome.maxPoints;
            const fix = !clean && step != null ? localize(step.hint ?? step.success) : null;
            return (
              <li key={outcome.stepId} className="result-step">
                <div className="result-step-head">
                  {outcome.critical ? (
                    <OctagonAlert size={20} className="icon-red" />
                  ) : clean ? (
                    <CircleCheck size={20} className="icon-green" />
                  ) : (
                    <TriangleAlert size={20} className="icon-amber" />
                  )}
                  <span lang={title?.lang}>{title?.text ?? outcome.stepId}</span>
                  <span className="t-num">
                    {outcome.points}/{outcome.maxPoints}
                  </span>
                </div>
                {fix != null && (
                  <p className="result-step-fix" lang={fix.lang}>
                    <Target size={13} /> {t('assessment.correctAction')}: {fix.text}
                  </p>
                )}
              </li>
            );
          })}
      </ol>

      <div className="sheet-actions">
        {retrain.length > 0 && (
          <Button size="lg" block icon={<Target size={20} />} onClick={() => onRetrain(retrain)}>
            {t('assessment.retrain')}
          </Button>
        )}
        <Button
          size={retrain.length > 0 ? 'md' : 'lg'}
          variant={retrain.length > 0 ? 'secondary' : 'primary'}
          block
          icon={<House size={20} />}
          onClick={onHome}
        >
          {assessment || retraining ? t('assessment.home') : t('result.home')}
        </Button>
        <Button variant="secondary" block icon={<RotateCcw size={20} />} onClick={onAgain}>
          {assessment || retraining ? t('assessment.tryAgain') : t('result.again')}
        </Button>
      </div>
    </HudSheet>
  );
}
