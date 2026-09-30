import {
  totalPoints,
  type LocalizedText,
  type ModuleResult,
  type ModuleStep,
  type RenderMode,
  type StepOutcome,
  type TrainingAction,
  type TrainingEvent,
  type TrainingModuleContent,
} from '@ar-training/shared';
import { create } from 'zustand';
import { db } from '../../data/db';

/** Points lost per mistake on a step (never below zero for that step). */
export const MISTAKE_PENALTY = 5;
/** Pause after a completed step so the worker sees and hears the confirmation. */
export const ADVANCE_DELAY_MS = 1600;
/** Pass mark for assessed modules; the full assessment engine arrives with the Fire module. */
export const PASS_MARK = 0.7;

export type FeedbackTone = 'success' | 'mistake' | 'hint';

export interface Feedback {
  id: number;
  tone: FeedbackTone;
  text: LocalizedText;
  narrationId: string;
}

type RunnerStatus = 'idle' | 'running' | 'finished';

interface RunnerState {
  status: RunnerStatus;
  module: TrainingModuleContent | null;
  sessionId: string | null;
  workerId: string | null;
  mode: RenderMode;
  startedAt: number;
  stepIndex: number;
  stepStartedAt: number;
  stepMistakes: number;
  /** The current step is complete and the runner is about to advance. */
  stepDone: boolean;
  /** 0..1 progress of the current step (hold bars, aim timers), set by the module scene. */
  stepProgress: number;
  outcomes: StepOutcome[];
  score: number;
  feedback: Feedback | null;
  result: ModuleResult | null;

  start: (args: {
    module: TrainingModuleContent;
    workerId: string;
    mode: RenderMode;
  }) => Promise<void>;
  completeStep: (stepId: string, detail?: string) => void;
  recordMistake: (
    stepId: string,
    action: TrainingAction,
    options?: { detail?: string; message?: LocalizedText; critical?: boolean },
  ) => void;
  /** Shows (and speaks) the step's hint without counting a mistake. */
  showHint: (stepId: string) => void;
  setStepProgress: (progress: number) => void;
  setMode: (mode: RenderMode) => void;
  abandon: () => Promise<void>;
  reset: () => void;
}

let advanceTimer: ReturnType<typeof setTimeout> | null = null;
let feedbackId = 0;

function clearAdvanceTimer() {
  if (advanceTimer != null) clearTimeout(advanceTimer);
  advanceTimer = null;
}

const idle = {
  status: 'idle' as RunnerStatus,
  module: null,
  sessionId: null,
  workerId: null,
  mode: 'fallback3d' as RenderMode,
  startedAt: 0,
  stepIndex: 0,
  stepStartedAt: 0,
  stepMistakes: 0,
  stepDone: false,
  stepProgress: 0,
  outcomes: [],
  score: 0,
  feedback: null,
  result: null,
};

export const useRunnerStore = create<RunnerState>()((set, get) => {
  /** Appends an event to the local log; the sync engine uploads it later. */
  function logEvent(
    step: ModuleStep,
    action: TrainingAction,
    correct: boolean,
    critical: boolean,
    detail?: string,
  ) {
    const { sessionId, workerId, module, stepStartedAt } = get();
    if (sessionId == null || workerId == null || module == null) return;
    const now = Date.now();
    const event: TrainingEvent = {
      id: crypto.randomUUID(),
      sessionId,
      workerId,
      moduleId: module.id,
      stepId: step.id,
      action,
      correct,
      critical,
      timestamp: now,
      timeTakenMs: now - stepStartedAt,
      ...(detail != null ? { detail } : {}),
    };
    db.events
      .add(event)
      .catch((error: unknown) => console.error('[runner] could not log event', error));
  }

  function currentStep(stepId: string): ModuleStep | null {
    const { status, module, stepIndex, stepDone } = get();
    const step = module?.steps[stepIndex];
    if (status !== 'running' || step == null || step.id !== stepId || stepDone) return null;
    return step;
  }

  async function finish() {
    const state = get();
    const { module, sessionId, workerId } = state;
    if (module == null || sessionId == null || workerId == null) return;
    const now = Date.now();
    const maxScore = totalPoints(module);
    const result: ModuleResult = {
      id: crypto.randomUUID(),
      sessionId,
      workerId,
      moduleId: module.id,
      moduleVersion: module.version,
      mode: state.mode,
      startedAt: state.startedAt,
      completedAt: now,
      score: state.score,
      maxScore,
      // Tutorials are completed, not passed.
      passed: module.kind === 'tutorial' ? null : state.score >= maxScore * PASS_MARK,
      steps: state.outcomes,
    };
    set({ status: 'finished', result, stepDone: true });
    try {
      await db.transaction('rw', db.results, db.sessions, db.syncQueue, async () => {
        await db.results.add(result);
        await db.sessions.update(sessionId, { status: 'completed', endedAt: now });
        await db.syncQueue.add({
          kind: 'session-result',
          refId: result.id,
          workerId,
          createdAt: now,
          attempts: 0,
          nextAttemptAt: now,
          lastError: null,
        });
      });
    } catch (error) {
      console.error('[runner] could not save result', error);
    }
  }

  return {
    ...idle,

    async start({ module, workerId, mode }) {
      clearAdvanceTimer();
      const now = Date.now();
      const sessionId = crypto.randomUUID();
      set({
        ...idle,
        status: 'running',
        module,
        sessionId,
        workerId,
        mode,
        startedAt: now,
        stepStartedAt: now,
      });
      await db.sessions.add({
        id: sessionId,
        workerId,
        moduleId: module.id,
        moduleVersion: module.version,
        mode,
        startedAt: now,
        endedAt: null,
        status: 'in-progress',
      });
    },

    completeStep(stepId, detail) {
      const step = currentStep(stepId);
      if (step == null) return;
      const { stepMistakes, stepStartedAt, module } = get();
      logEvent(step, step.interaction, true, false, detail);
      const points = Math.max(0, step.points - stepMistakes * MISTAKE_PENALTY);
      const outcome: StepOutcome = {
        stepId: step.id,
        completed: true,
        mistakes: stepMistakes,
        points,
        maxPoints: step.points,
        timeTakenMs: Date.now() - stepStartedAt,
        critical: false,
      };
      set((state) => ({
        stepDone: true,
        stepProgress: 1,
        outcomes: [...state.outcomes, outcome],
        score: state.score + points,
        feedback: {
          id: ++feedbackId,
          tone: 'success',
          text: step.success,
          narrationId: `${module?.id}.${step.id}.success`,
        },
      }));

      clearAdvanceTimer();
      advanceTimer = setTimeout(() => {
        advanceTimer = null;
        const { module: current, stepIndex, status } = get();
        if (current == null || status !== 'running') return;
        if (stepIndex + 1 >= current.steps.length) {
          void finish();
          return;
        }
        set({
          stepIndex: stepIndex + 1,
          stepStartedAt: Date.now(),
          stepMistakes: 0,
          stepDone: false,
          stepProgress: 0,
          feedback: null,
        });
      }, ADVANCE_DELAY_MS);
    },

    recordMistake(stepId, action, options = {}) {
      const step = currentStep(stepId);
      if (step == null) return;
      const { module } = get();
      logEvent(step, action, false, options.critical ?? false, options.detail);
      const text = options.message ?? step.hint;
      set((state) => ({
        stepMistakes: state.stepMistakes + 1,
        feedback:
          text == null
            ? state.feedback
            : {
                id: ++feedbackId,
                tone: 'mistake',
                text,
                narrationId:
                  options.message == null
                    ? `${module?.id}.${step.id}.hint`
                    : `${module?.id}.${step.id}.mistake`,
              },
      }));
    },

    showHint(stepId) {
      const step = currentStep(stepId);
      if (step?.hint == null) return;
      const { module } = get();
      set({
        feedback: {
          id: ++feedbackId,
          tone: 'hint',
          text: step.hint,
          narrationId: `${module?.id}.${step.id}.hint`,
        },
      });
    },

    setStepProgress(progress) {
      const rounded = Math.round(progress * 50) / 50;
      if (get().stepProgress !== rounded) set({ stepProgress: rounded });
    },

    setMode(mode) {
      set({ mode });
    },

    async abandon() {
      clearAdvanceTimer();
      const { status, sessionId } = get();
      set({ ...idle });
      if (status === 'running' && sessionId != null) {
        await db.sessions.update(sessionId, { status: 'abandoned', endedAt: Date.now() });
      }
    },

    reset() {
      clearAdvanceTimer();
      set({ ...idle });
    },
  };
});

export const runner = () => useRunnerStore.getState();

/** The step the worker is on, or null when no module is running. */
export function useCurrentStep(): ModuleStep | null {
  return useRunnerStore((state) =>
    state.status === 'idle' ? null : (state.module?.steps[state.stepIndex] ?? null),
  );
}

/** True while `stepId` is the active step and still waiting for the worker. */
export function useStepActive(stepId: string): boolean {
  return useRunnerStore(
    (state) =>
      state.status === 'running' &&
      !state.stepDone &&
      state.module?.steps[state.stepIndex]?.id === stepId,
  );
}

/** True while `stepId` is the current step, including its confirmation pause after completion. */
export function useStepCurrent(stepId: string): boolean {
  return useRunnerStore(
    (state) => state.status === 'running' && state.module?.steps[state.stepIndex]?.id === stepId,
  );
}

/** True once `stepId` has been completed in this attempt. */
export function useStepCompleted(stepId: string): boolean {
  return useRunnerStore((state) => state.outcomes.some((outcome) => outcome.stepId === stepId));
}
