import type { RenderMode } from './render';

export type SessionStatus = 'in-progress' | 'completed' | 'abandoned';

/**
 * - `practice`: tutorials (completed, not passed or failed)
 * - `assessment`: a full scored attempt at an assessed module
 * - `retraining`: replaying only the steps failed in the last assessment
 */
export type AttemptType = 'practice' | 'assessment' | 'retraining';

/** One attempt at a module, from the moment the worker enters the training scene. */
export interface TrainingSession {
  id: string;
  workerId: string;
  moduleId: string;
  moduleVersion: number;
  mode: RenderMode;
  attemptType?: AttemptType;
  startedAt: number;
  endedAt: number | null;
  status: SessionStatus;
}

export interface StepOutcome {
  stepId: string;
  completed: boolean;
  /** Not part of this attempt (retraining replays only failed steps). */
  skipped?: boolean;
  mistakes: number;
  points: number;
  maxPoints: number;
  timeTakenMs: number;
  critical: boolean;
  /** Critical errors made on this step (ids from the module content). */
  criticalErrorIds?: string[];
}

export interface QuizAnswer {
  questionId: string;
  optionId: string;
  correct: boolean;
}

export interface ModuleResult {
  id: string;
  sessionId: string;
  workerId: string;
  moduleId: string;
  moduleVersion: number;
  mode: RenderMode;
  attemptType?: AttemptType;
  startedAt: number;
  completedAt: number;
  /** Practical points earned / available (steps in this attempt). */
  score: number;
  maxScore: number;
  /** 0–100 */
  practicalPercent?: number;
  quizPercent?: number | null;
  totalPercent?: number;
  /** `null` for tutorials and retraining, which are not pass/fail. */
  passed: boolean | null;
  failReason?: 'critical-error' | 'below-pass-mark' | null;
  criticalErrors?: string[];
  quiz?: QuizAnswer[];
  steps: StepOutcome[];
}

/** Percentage shown for a result, compatible with results saved before the assessment engine. */
export function resultPercent(result: ModuleResult): number {
  if (result.totalPercent != null) return result.totalPercent;
  return result.maxScore > 0 ? Math.round((result.score / result.maxScore) * 100) : 0;
}
