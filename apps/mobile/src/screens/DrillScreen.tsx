import type { QuizAnswer } from '@ar-training/shared';
import { House, Trophy } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '../app/navigation';
import { db } from '../data/db';
import { completeDrill, pickDrillQuestions } from '../data/drills';
import { Button } from '../design/components';
import { HudSheet } from '../engine/hud/panels';
import { QuizPanel } from '../engine/hud/QuizPanel';
import { useLocalized } from '../i18n/localized';
import { findModule } from '../modules/registry';

/** Refresher micro-drill: three quiz questions from a module the worker has passed. */
export function DrillScreen({ drillId }: { drillId: string }) {
  const { t } = useTranslation('training');
  const localize = useLocalized();
  const drill = useLiveQuery(() => db.drills.get(drillId), [drillId]);
  const definition = drill != null ? findModule(drill.moduleId) : undefined;
  const questions = useMemo(() => {
    const bank = definition?.content.quiz ?? [];
    const ids = pickDrillQuestions(
      bank.map((question) => question.id),
      drill?.dayOffset ?? 1,
    );
    return ids
      .map((id) => bank.find((question) => question.id === id))
      .filter((question) => question != null);
  }, [definition, drill?.dayOffset]);
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [finished, setFinished] = useState(false);

  if (drill == null || definition == null || questions.length === 0) return null;
  const question = questions[index];
  const correct = answers.filter((answer) => answer.correct).length;

  const next = () => {
    if (index + 1 < questions.length) {
      setIndex(index + 1);
      return;
    }
    setFinished(true);
    void completeDrill(drill.id, correct, questions.length);
  };

  return (
    <main className="screen drill-screen">
      <div className="hud">
        {!finished && question != null && (
          <QuizPanel
            moduleId={definition.content.id}
            question={question}
            index={index}
            total={questions.length}
            answer={answers.find((answer) => answer.questionId === question.id)}
            illustrations={definition.illustrations}
            onAnswer={(optionId) => {
              const isCorrect =
                question.options.find((option) => option.id === optionId)?.correct === true;
              setAnswers((current) => [
                ...current,
                { questionId: question.id, optionId, correct: isCorrect },
              ]);
            }}
            onNext={next}
          />
        )}
        {finished && (
          <HudSheet>
            <div className="result-hero">
              <div className="result-badge is-pass">
                <Trophy size={36} />
              </div>
              <h2 className="t-title">{t('drill.done')}</h2>
              <p className="t-muted">{localize(definition.content.title).text}</p>
              <span className="result-score">
                {t('drill.score', { correct, total: questions.length })}
              </span>
            </div>
            <Button
              size="lg"
              block
              icon={<House size={20} />}
              onClick={() => useNavigation.getState().reset({ name: 'home' })}
            >
              {t('drill.home')}
            </Button>
          </HudSheet>
        )}
      </div>
    </main>
  );
}
