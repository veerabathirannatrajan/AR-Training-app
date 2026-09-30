import type { QuizAnswer, QuizQuestion } from '@ar-training/shared';
import { Check, ChevronRight, Volume2, X } from 'lucide-react';
import { useEffect, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../../design/components';
import { cx } from '../../design/cx';
import { useLanguage } from '../../i18n';
import { useLocalized } from '../../i18n/localized';
import { narrationFromText, speak } from '../../voice/narrator';
import { haptic, sfx } from '../feedback/sfx';
import { XR_UI_PROPS } from '../xr/xrUi';

/**
 * One scenario-quiz question: illustration, narrated prompt, answers, then the explanation.
 * Used for the assessment quiz and for refresher drills.
 */
export function QuizPanel({
  moduleId,
  question,
  index,
  total,
  answer,
  illustrations,
  onAnswer,
  onNext,
}: {
  moduleId: string;
  question: QuizQuestion;
  index: number;
  total: number;
  answer: QuizAnswer | undefined;
  illustrations: Readonly<Record<string, ComponentType>> | undefined;
  onAnswer: (optionId: string) => void;
  onNext: () => void;
}) {
  const { t } = useTranslation('training');
  const lang = useLanguage();
  const localize = useLocalized();
  const Illustration = illustrations?.[question.illustration];
  const prompt = localize(question.prompt);
  const explanation = localize(question.explanation);
  const narrate = () =>
    speak(narrationFromText(`${moduleId}.quiz.${question.id}`, question.prompt), lang);

  useEffect(() => {
    narrate();
    // Read each question aloud once when it appears (and again if the language changes).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.id, lang]);

  const choose = (optionId: string) => {
    if (answer != null) return;
    const correct = question.options.find((option) => option.id === optionId)?.correct === true;
    if (correct) {
      sfx.success();
      haptic.success();
    } else {
      sfx.error();
      haptic.error();
    }
    onAnswer(optionId);
    speak(
      narrationFromText(`${moduleId}.quiz.${question.id}.explanation`, question.explanation),
      lang,
      { queue: true },
    );
  };

  return (
    <div className="quiz" {...XR_UI_PROPS}>
      <section className="hud-sheet" aria-live="polite">
        <div className="row-between">
          <span className="t-small t-muted">
            {t('quiz.title')} · {t('quiz.progress', { current: index + 1, total })}
          </span>
          <button
            type="button"
            className="hud-round hud-glass"
            aria-label={t('quiz.listen')}
            onClick={narrate}
          >
            <Volume2 size={20} />
          </button>
        </div>
        {Illustration != null && (
          <div className="quiz-illustration" aria-hidden>
            <Illustration />
          </div>
        )}
        <p className="quiz-prompt" lang={prompt.lang}>
          {prompt.text}
        </p>
        <div className="quiz-options">
          {question.options.map((option, optionIndex) => {
            const label = localize(option.label);
            const chosen = answer?.optionId === option.id;
            const revealCorrect = answer != null && option.correct;
            return (
              <button
                key={option.id}
                type="button"
                className={cx(
                  'option-button',
                  revealCorrect && 'is-correct',
                  chosen && !option.correct && 'is-wrong',
                )}
                disabled={answer != null}
                onClick={() => choose(option.id)}
              >
                <span className="option-letter">
                  {revealCorrect ? (
                    <Check size={16} />
                  ) : chosen ? (
                    <X size={16} />
                  ) : (
                    String.fromCharCode(65 + optionIndex)
                  )}
                </span>
                <span lang={label.lang}>{label.text}</span>
              </button>
            );
          })}
        </div>
        {answer != null && (
          <>
            <div className={cx('quiz-explanation', answer.correct ? 'is-correct' : 'is-incorrect')}>
              <strong>{answer.correct ? t('quiz.correct') : t('quiz.incorrect')}. </strong>
              <span lang={explanation.lang}>{explanation.text}</span>
            </div>
            <Button size="lg" block icon={<ChevronRight size={22} />} onClick={onNext}>
              {index + 1 >= total ? t('quiz.finish') : t('quiz.next')}
            </Button>
          </>
        )}
      </section>
    </div>
  );
}
