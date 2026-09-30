import { useLiveQuery } from 'dexie-react-hooks';
import { db, type DrillRecord } from './db';

/** Refresher drills after passing a module, in days. */
export const DRILL_DAY_OFFSETS = [1, 3, 7] as const;
export const DRILL_QUESTIONS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Schedules refresher micro-drills after a pass. Any drills still open for the module are
 * replaced, so a new pass restarts the 1-3-7 day cycle.
 */
export async function scheduleRefresherDrills(
  workerId: string,
  moduleId: string,
  passedAt: number,
): Promise<void> {
  const open = await db.drills
    .where('[workerId+moduleId]')
    .equals([workerId, moduleId])
    .filter((drill) => drill.completedAt == null)
    .primaryKeys();
  await db.drills.bulkDelete(open);
  await db.drills.bulkAdd(
    DRILL_DAY_OFFSETS.map((dayOffset) => ({
      id: crypto.randomUUID(),
      workerId,
      moduleId,
      dayOffset,
      dueAt: passedAt + dayOffset * DAY_MS,
      completedAt: null,
      score: null,
      questions: null,
    })),
  );
}

export async function completeDrill(id: string, score: number, questions: number): Promise<void> {
  await db.drills.update(id, { completedAt: Date.now(), score, questions });
}

/** Drills that are due for a worker (checked when the home screen opens), oldest first. */
export function useDueDrills(workerId: string | null): DrillRecord[] {
  return (
    useLiveQuery(async () => {
      if (workerId == null) return [];
      const now = Date.now();
      const drills = await db.drills.where('workerId').equals(workerId).toArray();
      return drills
        .filter((drill) => drill.completedAt == null && drill.dueAt <= now)
        .sort((a, b) => a.dueAt - b.dueAt);
    }, [workerId]) ?? []
  );
}

/** Picks `count` quiz question ids for a drill, rotating through the bank by drill day. */
export function pickDrillQuestions(
  questionIds: readonly string[],
  dayOffset: number,
  count = DRILL_QUESTIONS,
) {
  if (questionIds.length <= count) return [...questionIds];
  const start = (dayOffset * 2) % questionIds.length;
  return Array.from(
    { length: count },
    (_, index) => questionIds[(start + index) % questionIds.length] as string,
  );
}
