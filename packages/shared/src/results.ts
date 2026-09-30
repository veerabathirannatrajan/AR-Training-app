import type { RenderMode } from './render';

export type SessionStatus = 'in-progress' | 'completed' | 'abandoned';

/** One attempt at a module, from the moment the worker enters the training scene. */
export interface TrainingSession {
  id: string;
  workerId: string;
  moduleId: string;
  moduleVersion: number;
  mode: RenderMode;
  startedAt: number;
  endedAt: number | null;
  status: SessionStatus;
}

export interface StepOutcome {
  stepId: string;
  completed: boolean;
  mistakes: number;
  points: number;
  maxPoints: number;
  timeTakenMs: number;
  critical: boolean;
}

export interface ModuleResult {
  id: string;
  sessionId: string;
  workerId: string;
  moduleId: string;
  moduleVersion: number;
  mode: RenderMode;
  startedAt: number;
  completedAt: number;
  score: number;
  maxScore: number;
  /** `null` for tutorials, which are completed rather than passed. */
  passed: boolean | null;
  steps: StepOutcome[];
}
