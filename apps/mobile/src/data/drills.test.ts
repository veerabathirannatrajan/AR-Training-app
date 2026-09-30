import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { completeDrill, pickDrillQuestions, scheduleRefresherDrills } from './drills';

const DAY = 24 * 60 * 60 * 1000;

beforeEach(async () => {
  await db.delete();
  await db.open();
});

describe('refresher drills', () => {
  it('schedules drills 1, 3 and 7 days after a pass', async () => {
    await scheduleRefresherDrills('11001', 'fire-explosion', 0);
    const drills = await db.drills.orderBy('dueAt').toArray();
    expect(drills.map((drill) => drill.dueAt)).toEqual([DAY, 3 * DAY, 7 * DAY]);
  });

  it('restarts the cycle on a new pass, keeping completed drills', async () => {
    await scheduleRefresherDrills('11001', 'fire-explosion', 0);
    const [first] = await db.drills.orderBy('dueAt').toArray();
    await completeDrill(first!.id, 3, 3);
    await scheduleRefresherDrills('11001', 'fire-explosion', 10 * DAY);
    const drills = await db.drills.toArray();
    expect(drills).toHaveLength(4);
    expect(
      drills
        .filter((drill) => drill.completedAt == null)
        .map((d) => d.dueAt)
        .sort((a, b) => a - b),
    ).toEqual([11 * DAY, 13 * DAY, 17 * DAY]);
  });

  it('rotates questions through the bank', () => {
    const bank = ['a', 'b', 'c', 'd', 'e'];
    expect(pickDrillQuestions(bank, 1)).toEqual(['c', 'd', 'e']);
    expect(pickDrillQuestions(bank, 3)).toEqual(['b', 'c', 'd']);
    expect(pickDrillQuestions(['a', 'b'], 7)).toEqual(['a', 'b']);
  });
});
