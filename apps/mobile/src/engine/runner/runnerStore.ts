import {
  scoreAttempt,
  type AttemptType,
  type LocalizedText,
  type ModuleResult,
  type ModuleStep,
  type QuizAnswer,
  type RenderMode,
  type StepOutcome,
  type TrainingAction,
  type TrainingEvent,
  type TrainingModuleContent,
} from '@ar-training/shared';
import { create } from 'zustand';
import { db } from '../../data/db';
import { scheduleRefresherDrills } from '../../data/drills';

/** Points lost per mistake on a step (never below zero for that step). */
export const MISTAKE_PENALTY = 5;
/** Share of a step's points lost when it takes longer than its time limit. */
export const SLOW_PENALTY_RATIO = 0.2;
/** Pause after a completed step so the worker sees and hears the confirmation. */
export const ADVANCE_DELAY_MS = 1600;

export type FeedbackTone = 'success' | 'mistake' | 'hint';

export interface Feedback {
  id: number;
  tone: FeedbackTone;
  text: LocalizedText;
  narrationId: string;
}

export interface CriticalAlert {
  id: number;
  stepId: string;
  errorId: string;
}

export type RunnerStatus = 'idle' | 'running' | 'quiz' | 'finished';

interface StartArgs {
  module: TrainingModuleContent;
  workerId: string;
  mode: RenderMode;
  /** Retraining: only these steps are played; the others count as already done. */
  focusStepIds?: readonly string[];
  /** Facts assumed for skipped steps (e.g. which extinguisher is in hand). */
  defaultFacts?: Readonly<Record<string, string>>;
}

interface RunnerState {
  status: RunnerStatus;
  module: TrainingModuleContent | null;
  attemptType: AttemptType;
  sessionId: string | null;
  workerId: string | null;
  mode: RenderMode;
  startedAt: number;
  stepIndex: number;
  stepStartedAt: number;
  stepMistakes: number;
  stepCriticalErrors: string[];
  /** The current step is complete and the runner is about to advance. */
  stepDone: boolean;
  /** 0..1 progress of the current step (hold bars, aim timers), set by the module scene. */
  stepProgress: number;
  skippedStepIds: string[];
  outcomes: StepOutcome[];
  score: number;
  /** Decisions made along the way, e.g. { "choose-extinguisher": "co2" }. */
  facts: Record<string, string>;
  criticalErrors: string[];
  /** Options already tried and rejected, per step (for ✗ marks on trays and answer cards). */
  triedOptions: Record<string, string[]>;
  /** Set when a critical error happens; the HUD explains it until acknowledged. */
  criticalAlert: CriticalAlert | null;
  quizIndex: number;
  quizAnswers: QuizAnswer[];
  feedback: Feedback | null;
  result: ModuleResult | null;

  start: (args: StartArgs) => Promise<void>;
  completeStep: (
    stepId: string,
    options?: { detail?: string; points?: number; message?: LocalizedText; tone?: FeedbackTone },
  ) => void;
  recordMistake: (
    stepId: string,
    action: TrainingAction,
    options?: { detail?: string; message?: LocalizedText },
  ) => void;
  recordCritical: (stepId: string, errorId: string, detail?: string) => void;
  acknowledgeCritical: () => void;
  /** Applies a choice on a decision step according to its content (correct / acceptable / wrong / critical). */
  chooseOption: (stepId: string, optionId: string) => void;
  /** Shows (and speaks) the step's hint, or the given message, without counting a mistake. */
  showHint: (stepId: string, message?: LocalizedText) => void;
  setFact: (key: string, value: string) => void;
  setStepProgress: (progress: number) => void;
  /** Restarts the current step's clock (e.g. once the AR area has been placed). */
  restartStepTimer: () => void;
  answerQuiz: (questionId: string, optionId: string) => void;
  nextQuestion: () => void;
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
  attemptType: 'practice' as AttemptType,
  sessionId: null,
  workerId: null,
  mode: 'fallback3d' as RenderMode,
  startedAt: 0,
  stepIndex: 0,
  stepStartedAt: 0,
  stepMistakes: 0,
  stepCriticalErrors: [] as string[],
  stepDone: false,
  stepProgress: 0,
  skippedStepIds: [] as string[],
  outcomes: [] as StepOutcome[],
  score: 0,
  facts: {} as Record<string, string>,
  criticalErrors: [] as string[],
  triedOptions: {} as Record<string, string[]>,
  criticalAlert: null,
  quizIndex: 0,
  quizAnswers: [] as QuizAnswer[],
  feedback: null,
  result: null,
};

const freshStep = () => ({
  stepStartedAt: Date.now(),
  stepMistakes: 0,
  stepCriticalErrors: [] as string[],
  stepDone: false,
  stepProgress: 0,
  feedback: null,
});

export const useRunnerStore = create<RunnerState>()((set, get) => {
  /** Appends an event to the local log; the sync engine uploads it later. */
  function logEvent(
    stepId: string,
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
      stepId,
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

  function markTried(stepId: string, optionId: string) {
    set((state) => {
      const tried = state.triedOptions[stepId] ?? [];
      if (tried.includes(optionId)) return {};
      return { triedOptions: { ...state.triedOptions, [stepId]: [...tried, optionId] } };
    });
  }

  function nextPlayableIndex(
    module: TrainingModuleContent,
    from: number,
    skipped: readonly string[],
  ) {
    for (let index = from; index < module.steps.length; index += 1) {
      const step = module.steps[index];
      if (step != null && !skipped.includes(step.id)) return index;
    }
    return -1;
  }

  /** After the last step: the scenario quiz for assessments, otherwise the result. */
  function endPractical() {
    const { module, attemptType } = get();
    if (attemptType === 'assessment' && (module?.quiz?.length ?? 0) > 0) {
      set({ status: 'quiz', quizIndex: 0, stepDone: true, feedback: null });
      return;
    }
    void finish();
  }

  async function finish() {
    const state = get();
    const { module, sessionId, workerId } = state;
    if (module == null || sessionId == null || workerId == null) return;
    const now = Date.now();
    const score = scoreAttempt({
      kind: module.kind,
      attemptType: state.attemptType,
      steps: state.outcomes,
      quiz: state.quizAnswers,
      quizTotal: module.quiz?.length ?? 0,
      criticalErrors: state.criticalErrors,
    });
    const counted = state.outcomes.filter((outcome) => outcome.skipped !== true);
    const result: ModuleResult = {
      id: crypto.randomUUID(),
      sessionId,
      workerId,
      moduleId: module.id,
      moduleVersion: module.version,
      mode: state.mode,
      attemptType: state.attemptType,
      startedAt: state.startedAt,
      completedAt: now,
      score: state.score,
      maxScore: counted.reduce((sum, outcome) => sum + outcome.maxPoints, 0),
      practicalPercent: score.practicalPercent,
      quizPercent: score.quizPercent,
      totalPercent: score.totalPercent,
      passed: score.passed,
      failReason: score.failReason,
      criticalErrors: state.criticalErrors,
      quiz: state.quizAnswers,
      steps: state.outcomes,
    };
    set({ status: 'finished', result, stepDone: true, feedback: null });
    try {
      await db.transaction('rw', [db.results, db.sessions, db.syncQueue, db.drills], async () => {
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
        if (result.passed === true) await scheduleRefresherDrills(workerId, module.id, now);
      });
    } catch (error) {
      console.error('[runner] could not save result', error);
    }
  }

  return {
    ...idle,

    async start({ module, workerId, mode, focusStepIds, defaultFacts }) {
      clearAdvanceTimer();
      const now = Date.now();
      const sessionId = crypto.randomUUID();
      const retraining = focusStepIds != null && focusStepIds.length > 0;
      const attemptType: AttemptType =
        module.kind === 'tutorial' ? 'practice' : retraining ? 'retraining' : 'assessment';
      const skippedStepIds = retraining
        ? module.steps.filter((step) => !focusStepIds.includes(step.id)).map((step) => step.id)
        : [];
      // Skipped steps count as done so the scene shows their end state.
      const skippedOutcomes: StepOutcome[] = skippedStepIds.map((stepId) => ({
        stepId,
        completed: true,
        skipped: true,
        mistakes: 0,
        points: 0,
        maxPoints: 0,
        timeTakenMs: 0,
        critical: false,
      }));
      const firstIndex = Math.max(0, nextPlayableIndex(module, 0, skippedStepIds));
      set({
        ...idle,
        ...freshStep(),
        status: 'running',
        module,
        attemptType,
        sessionId,
        workerId,
        mode,
        startedAt: now,
        stepIndex: firstIndex,
        skippedStepIds,
        outcomes: skippedOutcomes,
        // Assumed choices only stand in for steps that are skipped (retraining).
        facts: Object.fromEntries(
          Object.entries(defaultFacts ?? {}).filter(([stepId]) => skippedStepIds.includes(stepId)),
        ),
      });
      await db.sessions.add({
        id: sessionId,
        workerId,
        moduleId: module.id,
        moduleVersion: module.version,
        mode,
        attemptType,
        startedAt: now,
        endedAt: null,
        status: 'in-progress',
      });
    },

    completeStep(stepId, options = {}) {
      const step = currentStep(stepId);
      if (step == null) return;
      const { stepMistakes, stepStartedAt, stepCriticalErrors, module } = get();
      logEvent(step.id, step.interaction, true, false, options.detail);

      const timeTakenMs = Date.now() - stepStartedAt;
      const base = options.points ?? step.points;
      const slow = step.timeLimitSeconds != null && timeTakenMs > step.timeLimitSeconds * 1000;
      const critical = stepCriticalErrors.length > 0;
      const points = critical
        ? 0
        : Math.max(
            0,
            base -
              stepMistakes * MISTAKE_PENALTY -
              (slow ? Math.round(step.points * SLOW_PENALTY_RATIO) : 0),
          );
      const outcome: StepOutcome = {
        stepId: step.id,
        completed: true,
        mistakes: stepMistakes,
        points,
        maxPoints: step.points,
        timeTakenMs,
        critical,
        ...(critical ? { criticalErrorIds: stepCriticalErrors } : {}),
      };
      set((state) => ({
        stepDone: true,
        stepProgress: 1,
        outcomes: [...state.outcomes, outcome],
        score: state.score + points,
        feedback: {
          id: ++feedbackId,
          tone: options.tone ?? 'success',
          text: options.message ?? step.success,
          narrationId: `${module?.id}.${step.id}.success`,
        },
      }));

      clearAdvanceTimer();
      advanceTimer = setTimeout(() => {
        advanceTimer = null;
        const { module: current, stepIndex, status, skippedStepIds } = get();
        if (current == null || status !== 'running') return;
        const next = nextPlayableIndex(current, stepIndex + 1, skippedStepIds);
        if (next < 0) {
          endPractical();
          return;
        }
        set({ stepIndex: next, ...freshStep() });
      }, ADVANCE_DELAY_MS);
    },

    recordMistake(stepId, action, options = {}) {
      const step = currentStep(stepId);
      if (step == null) return;
      const { module } = get();
      logEvent(step.id, action, false, false, options.detail);
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

    recordCritical(stepId, errorId, detail) {
      const step = currentStep(stepId);
      if (step == null) return;
      logEvent(step.id, step.interaction, false, true, detail ?? errorId);
      set((state) => ({
        stepMistakes: state.stepMistakes + 1,
        stepCriticalErrors: [...state.stepCriticalErrors, errorId],
        criticalErrors: state.criticalErrors.includes(errorId)
          ? state.criticalErrors
          : [...state.criticalErrors, errorId],
        criticalAlert: { id: ++feedbackId, stepId: step.id, errorId },
        feedback: null,
      }));
    },

    acknowledgeCritical() {
      set({ criticalAlert: null });
    },

    chooseOption(stepId, optionId) {
      const step = currentStep(stepId);
      const option = step?.options?.find((candidate) => candidate.id === optionId);
      if (step == null || option == null) return;
      const state = get();
      switch (option.outcome) {
        case 'correct':
          set({ facts: { ...state.facts, [step.id]: option.id } });
          state.completeStep(step.id, { detail: option.id });
          break;
        case 'acceptable':
          set({ facts: { ...state.facts, [step.id]: option.id } });
          state.completeStep(step.id, {
            detail: option.id,
            points: option.points ?? Math.max(0, step.points - MISTAKE_PENALTY),
            ...(option.feedback != null ? { message: option.feedback } : {}),
          });
          break;
        case 'wrong':
          markTried(step.id, option.id);
          state.recordMistake(step.id, step.interaction, {
            detail: option.id,
            ...(option.feedback != null ? { message: option.feedback } : {}),
          });
          break;
        case 'critical':
          markTried(step.id, option.id);
          state.recordCritical(step.id, option.criticalErrorId ?? option.id, option.id);
          break;
      }
    },

    showHint(stepId, message) {
      const step = currentStep(stepId);
      const text = message ?? step?.hint;
      if (step == null || text == null) return;
      const { module } = get();
      set({
        feedback: {
          id: ++feedbackId,
          tone: 'hint',
          text,
          narrationId: `${module?.id}.${step.id}.${message == null ? 'hint' : 'message'}`,
        },
      });
    },

    setFact(key, value) {
      set((state) => ({ facts: { ...state.facts, [key]: value } }));
    },

    setStepProgress(progress) {
      const rounded = Math.round(Math.min(1, Math.max(0, progress)) * 50) / 50;
      if (get().stepProgress !== rounded) set({ stepProgress: rounded });
    },

    restartStepTimer() {
      set({ stepStartedAt: Date.now() });
    },

    answerQuiz(questionId, optionId) {
      const { status, module, quizAnswers } = get();
      const question = module?.quiz?.find((candidate) => candidate.id === questionId);
      if (status !== 'quiz' || question == null) return;
      if (quizAnswers.some((answer) => answer.questionId === questionId)) return;
      const correct = question.options.find((option) => option.id === optionId)?.correct === true;
      logEvent(`quiz.${questionId}`, 'select-option', correct, false, optionId);
      set({ quizAnswers: [...quizAnswers, { questionId, optionId, correct }] });
    },

    nextQuestion() {
      const { status, module, quizIndex } = get();
      if (status !== 'quiz' || module == null) return;
      if (quizIndex + 1 >= (module.quiz?.length ?? 0)) {
        void finish();
        return;
      }
      set({ quizIndex: quizIndex + 1 });
    },

    setMode(mode) {
      set({ mode });
    },

    async abandon() {
      clearAdvanceTimer();
      const { status, sessionId } = get();
      set({ ...idle });
      if ((status === 'running' || status === 'quiz') && sessionId != null) {
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
    state.status === 'running' || state.status === 'quiz' || state.status === 'finished'
      ? (state.module?.steps[state.stepIndex] ?? null)
      : null,
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

/** True once `stepId` has been completed (or skipped in retraining) in this attempt. */
export function useStepCompleted(stepId: string): boolean {
  return useRunnerStore((state) => state.outcomes.some((outcome) => outcome.stepId === stepId));
}

type RunnerSnapshot = ReturnType<typeof useRunnerStore.getState>;

/**
 * True once the attempt has moved past `stepId`: it was completed, or skipped in retraining
 * and comes before the step being played. Unlike `useStepCompleted`, steps skipped later in
 * the module are not past yet, so a scene shows the story as it stands at the current step.
 */
export function stepPassed(state: RunnerSnapshot, stepId: string): boolean {
  const index = state.module?.steps.findIndex((step) => step.id === stepId) ?? -1;
  if (index < 0 || state.status === 'idle') return false;
  if (state.status !== 'running' || index < state.stepIndex) return true;
  return (
    index === state.stepIndex &&
    state.outcomes.some((outcome) => outcome.stepId === stepId && outcome.skipped !== true)
  );
}

export function useStepPassed(stepId: string): boolean {
  return useRunnerStore((state) => stepPassed(state, stepId));
}

/** A decision recorded during the attempt (see `facts`). */
export function useFact(key: string): string | undefined {
  return useRunnerStore((state) => state.facts[key]);
}
