import 'fake-indexeddb/auto';
import { AR_BASICS, totalPoints } from '@ar-training/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '../../data/db';
import { ADVANCE_DELAY_MS, MISTAKE_PENALTY, runner } from './runnerStore';

async function startTutorial() {
  await runner().start({ module: AR_BASICS, workerId: '11001', mode: 'fallback3d' });
}

function completeCurrent() {
  const step = AR_BASICS.steps[runner().stepIndex];
  if (step == null) throw new Error('no current step');
  runner().completeStep(step.id);
  vi.advanceTimersByTime(ADVANCE_DELAY_MS);
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

describe('step runner', () => {
  it('only accepts the current step', async () => {
    await startTutorial();
    runner().completeStep('crouch');
    expect(runner().stepIndex).toBe(0);
    expect(runner().stepDone).toBe(false);
  });

  it('advances after the confirmation pause and logs an event', async () => {
    await startTutorial();
    runner().completeStep('place');
    expect(runner().stepDone).toBe(true);
    expect(runner().feedback?.tone).toBe('success');

    vi.advanceTimersByTime(ADVANCE_DELAY_MS);
    expect(runner().stepIndex).toBe(1);
    await vi.waitFor(async () => expect(await db.events.count()).toBe(1));
  });

  it('deducts points for mistakes on a step', async () => {
    await startTutorial();
    completeCurrent(); // place
    completeCurrent(); // rotate
    runner().recordMistake('tap-cone', 'tap', { detail: 'crate' });
    expect(runner().feedback?.tone).toBe('mistake');
    completeCurrent();
    const tap = runner().outcomes.find((outcome) => outcome.stepId === 'tap-cone');
    expect(tap).toMatchObject({ mistakes: 1, points: 15 - MISTAKE_PENALTY });
  });

  it('saves a result and queues it for sync when the last step is done', async () => {
    await startTutorial();
    for (let index = 0; index < AR_BASICS.steps.length; index += 1) completeCurrent();

    expect(runner().status).toBe('finished');
    expect(runner().score).toBe(totalPoints(AR_BASICS));
    await vi.waitFor(async () => expect(await db.results.count()).toBe(1));
    const [session] = await db.sessions.toArray();
    expect(session?.status).toBe('completed');
    expect(await db.syncQueue.count()).toBe(1);
    expect(runner().result?.passed).toBeNull();
  });

  it('marks the session abandoned when the worker leaves', async () => {
    await startTutorial();
    await runner().abandon();
    const [session] = await db.sessions.toArray();
    expect(session?.status).toBe('abandoned');
    expect(runner().status).toBe('idle');
  });
});
