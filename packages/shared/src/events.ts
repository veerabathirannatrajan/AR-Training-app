/**
 * Every interactive training step emits these events to the event logger.
 * They feed the assessment engine, per-step mastery and the admin dashboard.
 */
export type TrainingAction =
  'tap' | 'drag-drop' | 'hold' | 'aim' | 'swipe' | 'crouch' | 'move' | 'select-option';

export interface TrainingEvent {
  /** Client-generated UUID so events can be de-duplicated on sync. */
  id: string;
  sessionId: string;
  workerId: string;
  moduleId: string;
  stepId: string;
  action: TrainingAction;
  correct: boolean;
  critical: boolean;
  /** Epoch milliseconds. */
  timestamp: number;
  /** Milliseconds since the step started. */
  timeTakenMs: number;
  /** Optional free-form detail, e.g. which extinguisher was chosen. */
  detail?: string;
}
