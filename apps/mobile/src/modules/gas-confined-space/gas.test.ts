import 'fake-indexeddb/auto';
import { GAS_CONFINED_SPACE, resolveText } from '@ar-training/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../data/db';
import {
  ADVANCE_DELAY_MS,
  MISTAKE_PENALTY,
  runner,
  stepPassed,
} from '../../engine/runner/runnerStore';
import { gas } from './gasStore';
import { checkPpeReady, equipPpe, REQUIRED_PPE } from './ppe';
import {
  allSafe,
  AMBIENT,
  channelStatus,
  formatGas,
  gasStatus,
  LIMITS,
  PIT_BEFORE,
  pitAtmosphere,
  TEST_ORDER,
  TEST_STEP,
  VENT_SECONDS,
  type GasReadings,
} from './readings';

const step = (id: string) => {
  const found = GAS_CONFINED_SPACE.steps.find((candidate) => candidate.id === id);
  if (found == null) throw new Error(`no step ${id}`);
  return found;
};
const atmosphere = (seconds: number | null): GasReadings => pitAtmosphere(seconds, { ...AMBIENT });

describe('gas monitor readings', () => {
  it('the pit fails oxygen, flammable and toxic tests before ventilation', () => {
    expect(channelStatus('oxygen', PIT_BEFORE)).toBe('low');
    expect(channelStatus('flammable', PIT_BEFORE)).toBe('high');
    expect(channelStatus('toxic', PIT_BEFORE)).toBe('high');
    // H₂S is what fails the toxic test; CO is within its limit.
    expect(gasStatus('h2s', PIT_BEFORE.h2s)).toBe('high');
    expect(gasStatus('co', PIT_BEFORE.co)).toBe('ok');
  });

  it('fresh air reads safe, which is why the probe must be in the pit', () => {
    expect(allSafe(AMBIENT)).toBe(true);
  });

  it('ventilation clears the pit over time, not at once', () => {
    expect(allSafe(atmosphere(null))).toBe(false);
    expect(allSafe(atmosphere(VENT_SECONDS * 0.3))).toBe(false);
    expect(allSafe(atmosphere(VENT_SECONDS))).toBe(true);
  });

  it('the test steps come in the required order: oxygen, flammable, toxic', () => {
    const order = GAS_CONFINED_SPACE.steps
      .map((candidate) => candidate.id)
      .filter((id) => Object.values(TEST_STEP).includes(id));
    expect(order).toEqual(TEST_ORDER.map((channel) => TEST_STEP[channel]));
  });

  it('the content quotes the readings and limits the monitor shows', () => {
    const oxygen = step('test-oxygen').success;
    const flammable = step('test-flammable').success;
    const toxic = step('test-toxic').success;
    for (const lang of ['en', 'hi'] as const) {
      expect(resolveText(oxygen, lang).text).toContain(`${formatGas('o2', PIT_BEFORE.o2)}%`);
      expect(resolveText(oxygen, lang).text).toContain(String(LIMITS.o2Min));
      expect(resolveText(oxygen, lang).text).toContain(String(LIMITS.o2Max));
      expect(resolveText(flammable, lang).text).toContain(`${PIT_BEFORE.lel}% LEL`);
      expect(resolveText(flammable, lang).text).toContain(`${LIMITS.lelMax}% LEL`);
      expect(resolveText(toxic, lang).text).toContain(`H₂S ${PIT_BEFORE.h2s} ppm`);
      expect(resolveText(toxic, lang).text).toContain(`${LIMITS.h2sMax} ppm`);
      expect(resolveText(toxic, lang).text).toContain(`CO ${PIT_BEFORE.co} ppm`);
      expect(resolveText(toxic, lang).text).toContain(`${LIMITS.coMax} ppm`);
    }
  });
});

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  await db.delete();
  await db.open();
  runner().reset();
  gas().reset();
});

afterEach(() => {
  vi.useRealTimers();
});

/** Does the current step the right way, as a worker would. */
function doCurrentStep() {
  const current = GAS_CONFINED_SPACE.steps[runner().stepIndex];
  if (current == null) throw new Error('no current step');
  if (current.id === 'dress-entrant') {
    REQUIRED_PPE.forEach(equipPpe);
    checkPpeReady();
  } else {
    const correct = current.options?.find((option) => option.outcome === 'correct');
    if (correct != null) runner().chooseOption(current.id, correct.id);
    else runner().completeStep(current.id);
  }
  vi.advanceTimersByTime(ADVANCE_DELAY_MS);
}

function answerQuiz() {
  for (const question of GAS_CONFINED_SPACE.quiz ?? []) {
    runner().answerQuiz(question.id, question.options.find((option) => option.correct)!.id);
    runner().nextQuestion();
  }
}

function runTo(stepId: string) {
  while (GAS_CONFINED_SPACE.steps[runner().stepIndex]?.id !== stepId) doCurrentStep();
}

describe('PPE for the entrant', () => {
  beforeEach(async () => {
    await runner().start({
      module: GAS_CONFINED_SPACE,
      workerId: '11001',
      mode: 'fallback3d',
      focusStepIds: ['dress-entrant'],
    });
  });

  it('refuses a wrong item with the reason, and it stays refused', () => {
    equipPpe('dust-mask');
    expect(gas().rejected).toEqual(['dust-mask']);
    expect(gas().worn).toEqual([]);
    expect(runner().stepMistakes).toBe(1);
    expect(runner().feedback?.text.en).toMatch(/gives no oxygen/);
    equipPpe('dust-mask');
    expect(runner().stepMistakes).toBe(1);
  });

  it('flags what is missing on an early Ready, then completes with everything on', () => {
    equipPpe('helmet');
    checkPpeReady();
    expect(runner().stepDone).toBe(false);
    expect(gas().flagged).toEqual(REQUIRED_PPE.filter((id) => id !== 'helmet'));
    expect(runner().feedback?.text.en).toBe(
      'Ravi is not ready. Missing: breathing apparatus, personal gas detector, harness with lifeline.',
    );

    REQUIRED_PPE.forEach(equipPpe);
    expect(gas().flagged).toEqual([]);
    checkPpeReady();
    expect(runner().stepDone).toBe(true);
    const outcome = runner().outcomes.find((candidate) => candidate.stepId === 'dress-entrant');
    expect(outcome).toMatchObject({ mistakes: 1, points: 20 - MISTAKE_PENALTY });
  });
});

describe('gas module assessment', () => {
  it('passes a clean attempt and goes through the quiz', async () => {
    await runner().start({ module: GAS_CONFINED_SPACE, workerId: '11001', mode: 'ar' });
    while (runner().status === 'running') doCurrentStep();
    expect(runner().status).toBe('quiz');
    answerQuiz();
    await vi.waitFor(() => expect(runner().status).toBe('finished'));
    expect(runner().result).toMatchObject({
      practicalPercent: 100,
      quizPercent: 100,
      passed: true,
    });
  });

  it('fails on entry without an attendant, whatever the score', async () => {
    await runner().start({ module: GAS_CONFINED_SPACE, workerId: '11001', mode: 'ar' });
    runTo('assign-attendant');
    runner().chooseOption('assign-attendant', 'both-inside');
    expect(runner().criticalAlert).toMatchObject({ errorId: 'no-attendant' });
    runner().acknowledgeCritical();
    while (runner().status === 'running') doCurrentStep();
    answerQuiz();
    await vi.waitFor(() => expect(runner().status).toBe('finished'));
    expect(runner().result).toMatchObject({
      passed: false,
      failReason: 'critical-error',
      criticalErrors: ['no-attendant'],
    });
  });

  it('fails on a rescue attempt without breathing apparatus', async () => {
    await runner().start({ module: GAS_CONFINED_SPACE, workerId: '11001', mode: 'fallback3d' });
    runTo('emergency-response');
    runner().chooseOption('emergency-response', 'send-sunita');
    expect(runner().criticalAlert).toMatchObject({ errorId: 'unprotected-rescue' });
    runner().acknowledgeCritical();
    runner().chooseOption('emergency-response', 'alarm-winch');
    vi.advanceTimersByTime(ADVANCE_DELAY_MS);
    while (runner().status === 'running') doCurrentStep();
    answerQuiz();
    await vi.waitFor(() => expect(runner().status).toBe('finished'));
    const result = runner().result!;
    expect(result.failReason).toBe('critical-error');
    expect(result.steps.find((outcome) => outcome.stepId === 'emergency-response')).toMatchObject({
      critical: true,
      points: 0,
    });
  });

  it('treats a spark at the panel as critical and going downwind as a mistake', async () => {
    await runner().start({ module: GAS_CONFINED_SPACE, workerId: '11001', mode: 'ar' });
    doCurrentStep(); // identify-zones
    runner().chooseOption('stop-sparks', 'switch-off');
    expect(runner().criticalAlert).toMatchObject({ errorId: 'ignition-source' });
    runner().acknowledgeCritical();
    runner().chooseOption('stop-sparks', 'touch-nothing');
    vi.advanceTimersByTime(ADVANCE_DELAY_MS);
    runner().chooseOption('go-upwind', 'point-2');
    expect(runner().criticalAlert).toBeNull();
    expect(runner().triedOptions['go-upwind']).toEqual(['point-2']);
    runner().chooseOption('go-upwind', 'point-1');
    const outcome = runner().outcomes.find((candidate) => candidate.stepId === 'go-upwind');
    expect(outcome).toMatchObject({ mistakes: 1, points: 10 - MISTAKE_PENALTY });
  });
});

describe('retraining part of the story', () => {
  it('counts skipped steps before the replayed one as past, and later ones as not yet', async () => {
    await runner().start({
      module: GAS_CONFINED_SPACE,
      workerId: '11001',
      mode: 'fallback3d',
      focusStepIds: ['stop-sparks'],
    });
    expect(stepPassed(runner(), 'identify-zones')).toBe(true);
    expect(stepPassed(runner(), 'stop-sparks')).toBe(false);
    // Skipped, but later in the story: the scene must not show Ravi already rescued.
    expect(runner().outcomes.some((outcome) => outcome.stepId === 'winch-rescue')).toBe(true);
    expect(stepPassed(runner(), 'winch-rescue')).toBe(false);

    runner().chooseOption('stop-sparks', 'touch-nothing');
    expect(stepPassed(runner(), 'stop-sparks')).toBe(true);
    vi.advanceTimersByTime(ADVANCE_DELAY_MS);
    await vi.waitFor(() => expect(runner().status).toBe('finished'));
    expect(stepPassed(runner(), 'winch-rescue')).toBe(true);
  });
});
