import { describe, expect, it } from 'vitest';
import { scoreAttempt, stepMastery, stepsToRetrain } from './assessment';
import type { ModuleResult, QuizAnswer, StepOutcome } from './results';

const step = (
  stepId: string,
  points: number,
  maxPoints: number,
  extra: Partial<StepOutcome> = {},
): StepOutcome => ({
  stepId,
  completed: true,
  mistakes: 0,
  points,
  maxPoints,
  timeTakenMs: 1000,
  critical: false,
  ...extra,
});

const answers = (correct: number, total: number): QuizAnswer[] =>
  Array.from({ length: total }, (_, index) => ({
    questionId: `q${index}`,
    optionId: 'a',
    correct: index < correct,
  }));

describe('scoreAttempt', () => {
  it('weights practical 60% and quiz 40%', () => {
    const score = scoreAttempt({
      kind: 'assessed',
      attemptType: 'assessment',
      steps: [step('a', 80, 100)],
      quiz: answers(3, 5),
      quizTotal: 5,
      criticalErrors: [],
    });
    // 0.6 × 80 + 0.4 × 60 = 72
    expect(score).toEqual({
      practicalPercent: 80,
      quizPercent: 60,
      totalPercent: 72,
      passed: true,
      failReason: null,
    });
  });

  it('fails below the 70% pass mark', () => {
    const score = scoreAttempt({
      kind: 'assessed',
      attemptType: 'assessment',
      steps: [step('a', 70, 100)],
      quiz: answers(2, 5),
      quizTotal: 5,
      criticalErrors: [],
    });
    expect(score.totalPercent).toBe(58);
    expect(score).toMatchObject({ passed: false, failReason: 'below-pass-mark' });
  });

  it('fails on any critical error even with a perfect score', () => {
    const score = scoreAttempt({
      kind: 'assessed',
      attemptType: 'assessment',
      steps: [step('a', 100, 100)],
      quiz: answers(5, 5),
      quizTotal: 5,
      criticalErrors: ['water-on-electrical'],
    });
    expect(score).toMatchObject({ totalPercent: 100, passed: false, failReason: 'critical-error' });
  });

  it('does not pass or fail tutorials and retraining runs', () => {
    for (const [kind, attemptType] of [
      ['tutorial', 'practice'],
      ['assessed', 'retraining'],
    ] as const) {
      const score = scoreAttempt({
        kind,
        attemptType,
        steps: [step('a', 5, 10), step('b', 0, 10, { skipped: true })],
        quiz: [],
        quizTotal: 0,
        criticalErrors: [],
      });
      expect(score).toMatchObject({ practicalPercent: 50, passed: null });
    }
  });
});

describe('retraining and mastery', () => {
  const result = (steps: StepOutcome[]): ModuleResult => ({
    id: 'r',
    sessionId: 's',
    workerId: 'w',
    moduleId: 'm',
    moduleVersion: 1,
    mode: 'ar',
    startedAt: 0,
    completedAt: 1,
    score: 0,
    maxScore: 0,
    passed: false,
    steps,
  });

  it('picks steps with critical errors, mistakes or lost points', () => {
    const failed = result([
      step('ok', 10, 10),
      step('mistake', 5, 10, { mistakes: 1 }),
      step('critical', 0, 20, { critical: true }),
      step('partial', 15, 20),
      step('skipped', 0, 10, { skipped: true }),
    ]);
    expect(stepsToRetrain(failed)).toEqual(['mistake', 'critical', 'partial']);
  });

  it('tracks how often each step was done right first time', () => {
    const mastery = stepMastery([
      result([step('pass', 10, 10), step('alarm', 10, 10)]),
      result([step('pass', 5, 10, { mistakes: 1 }), step('alarm', 10, 10)]),
    ]);
    expect(mastery.get('pass')).toMatchObject({ attempts: 2, clean: 1, mastery: 0.5 });
    expect(mastery.get('alarm')?.mastery).toBe(1);
  });
});
