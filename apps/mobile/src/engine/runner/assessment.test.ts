import 'fake-indexeddb/auto';
import { FIRE_EXPLOSION } from '@ar-training/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../data/db';
import { ADVANCE_DELAY_MS, MISTAKE_PENALTY, runner } from './runnerStore';

/** Completes the current step the way a worker would (options pick their correct answer). */
function doCurrentStep() {
  const state = runner();
  const step = FIRE_EXPLOSION.steps[state.stepIndex];
  if (step == null) throw new Error('no current step');
  const correct = step.options?.find((option) => option.outcome === 'correct');
  if (correct != null) state.chooseOption(step.id, correct.id);
  else state.completeStep(step.id);
  vi.advanceTimersByTime(ADVANCE_DELAY_MS);
}

function answerQuiz(correctCount: number) {
  FIRE_EXPLOSION.quiz?.forEach((question, index) => {
    const option = question.options.find((candidate) => candidate.correct === index < correctCount);
    runner().answerQuiz(question.id, option!.id);
    runner().nextQuestion();
  });
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  await db.delete();
  await db.open();
  runner().reset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('fire module assessment', () => {
  it('passes a clean attempt, goes through the quiz and schedules refresher drills', async () => {
    await runner().start({ module: FIRE_EXPLOSION, workerId: '11001', mode: 'ar' });
    expect(runner().attemptType).toBe('assessment');
    while (runner().status === 'running') doCurrentStep();

    expect(runner().status).toBe('quiz');
    answerQuiz(5);
    await vi.waitFor(() => expect(runner().status).toBe('finished'));
    expect(runner().result).toMatchObject({
      practicalPercent: 100,
      quizPercent: 100,
      totalPercent: 100,
      passed: true,
    });
    await vi.waitFor(async () => expect(await db.drills.count()).toBe(3));
  });

  it('fails the attempt on a critical error, whatever the score', async () => {
    await runner().start({ module: FIRE_EXPLOSION, workerId: '11001', mode: 'ar' });
    doCurrentStep(); // raise-alarm
    doCurrentStep(); // identify-fire
    runner().chooseOption('choose-extinguisher', 'water');
    expect(runner().criticalAlert).toMatchObject({ errorId: 'water-on-electrical' });
    runner().acknowledgeCritical();
    runner().chooseOption('choose-extinguisher', 'co2');
    vi.advanceTimersByTime(ADVANCE_DELAY_MS);
    while (runner().status === 'running') doCurrentStep();
    answerQuiz(5);

    await vi.waitFor(() => expect(runner().status).toBe('finished'));
    const result = runner().result!;
    expect(result).toMatchObject({
      passed: false,
      failReason: 'critical-error',
      criticalErrors: ['water-on-electrical'],
    });
    expect(result.steps.find((step) => step.stepId === 'choose-extinguisher')).toMatchObject({
      critical: true,
      points: 0,
    });
    expect(await db.drills.count()).toBe(0);
  });

  it('gives partial points for an acceptable choice and deducts mistakes', async () => {
    await runner().start({ module: FIRE_EXPLOSION, workerId: '11001', mode: 'ar' });
    doCurrentStep();
    runner().chooseOption('identify-fire', 'liquid');
    doCurrentStep();
    runner().chooseOption('choose-extinguisher', 'powder');
    vi.advanceTimersByTime(ADVANCE_DELAY_MS);
    const outcomes = runner().outcomes;
    expect(outcomes.find((step) => step.stepId === 'identify-fire')?.points).toBe(
      10 - MISTAKE_PENALTY,
    );
    expect(outcomes.find((step) => step.stepId === 'choose-extinguisher')?.points).toBe(15);
    expect(runner().facts['choose-extinguisher']).toBe('powder');
  });

  it('retrains only the chosen steps, without a quiz or pass/fail', async () => {
    await runner().start({
      module: FIRE_EXPLOSION,
      workerId: '11001',
      mode: 'fallback3d',
      focusStepIds: ['choose-extinguisher', 'stay-out'],
      defaultFacts: { 'choose-extinguisher': 'co2' },
    });
    expect(runner().attemptType).toBe('retraining');
    expect(FIRE_EXPLOSION.steps[runner().stepIndex]?.id).toBe('choose-extinguisher');
    doCurrentStep();
    expect(FIRE_EXPLOSION.steps[runner().stepIndex]?.id).toBe('stay-out');
    doCurrentStep();

    await vi.waitFor(() => expect(runner().status).toBe('finished'));
    expect(runner().result).toMatchObject({
      attemptType: 'retraining',
      passed: null,
      practicalPercent: 100,
    });
  });
});
