import type { ModuleKind } from './content';
import type { AttemptType, ModuleResult, QuizAnswer, StepOutcome } from './results';

/** Assessment rules from the problem statement. */
export const ASSESSMENT_RULES = {
  practicalWeight: 0.6,
  quizWeight: 0.4,
  /** Percent. */
  passMark: 70,
} as const;

export interface AttemptScore {
  practicalPercent: number;
  quizPercent: number | null;
  totalPercent: number;
  passed: boolean | null;
  failReason: 'critical-error' | 'below-pass-mark' | null;
}

const percent = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

/**
 * Scores an attempt: 60% practical (steps: correct actions, order and time are reflected in
 * the points) + 40% scenario quiz. Pass mark 70%, and any critical error fails the attempt
 * regardless of score. Tutorials and retraining runs are not pass/fail.
 */
export function scoreAttempt(args: {
  kind: ModuleKind;
  attemptType: AttemptType;
  steps: readonly StepOutcome[];
  quiz: readonly QuizAnswer[];
  quizTotal: number;
  criticalErrors: readonly string[];
  /** Percent; defaults to ASSESSMENT_RULES.passMark (the admin portal can change it). */
  passMark?: number;
}): AttemptScore {
  const counted = args.steps.filter((step) => step.skipped !== true);
  const practicalPercent = percent(
    counted.reduce((sum, step) => sum + step.points, 0),
    counted.reduce((sum, step) => sum + step.maxPoints, 0),
  );

  if (args.kind === 'tutorial' || args.attemptType !== 'assessment') {
    return {
      practicalPercent,
      quizPercent: null,
      totalPercent: practicalPercent,
      passed: null,
      failReason: null,
    };
  }

  const quizPercent =
    args.quizTotal > 0
      ? percent(args.quiz.filter((answer) => answer.correct).length, args.quizTotal)
      : null;
  const totalPercent =
    quizPercent == null
      ? practicalPercent
      : Math.round(
          practicalPercent * ASSESSMENT_RULES.practicalWeight +
            quizPercent * ASSESSMENT_RULES.quizWeight,
        );

  if (args.criticalErrors.length > 0) {
    return {
      practicalPercent,
      quizPercent,
      totalPercent,
      passed: false,
      failReason: 'critical-error',
    };
  }
  const passed = totalPercent >= (args.passMark ?? ASSESSMENT_RULES.passMark);
  return {
    practicalPercent,
    quizPercent,
    totalPercent,
    passed,
    failReason: passed ? null : 'below-pass-mark',
  };
}

/** Steps to replay first after a failed assessment: critical errors, mistakes or lost points. */
export function stepsToRetrain(result: ModuleResult): string[] {
  return result.steps
    .filter(
      (step) =>
        step.skipped !== true &&
        (step.critical || step.mistakes > 0 || !step.completed || step.points < step.maxPoints),
    )
    .map((step) => step.stepId);
}

export interface StepMastery {
  stepId: string;
  attempts: number;
  /** Attempts where the step was done right first time (no mistakes, no critical error). */
  clean: number;
  /** 0..1 */
  mastery: number;
}

/** Per-step mastery across a worker's results for one module (latest results weigh equally). */
export function stepMastery(results: readonly ModuleResult[]): Map<string, StepMastery> {
  const byStep = new Map<string, StepMastery>();
  for (const result of results) {
    for (const step of result.steps) {
      if (step.skipped === true) continue;
      const entry = byStep.get(step.stepId) ?? {
        stepId: step.stepId,
        attempts: 0,
        clean: 0,
        mastery: 0,
      };
      entry.attempts += 1;
      if (step.completed && step.mistakes === 0 && !step.critical) entry.clean += 1;
      entry.mastery = entry.clean / entry.attempts;
      byStep.set(step.stepId, entry);
    }
  }
  return byStep;
}
