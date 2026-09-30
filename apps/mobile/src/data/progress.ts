import { resultPercent, type ModuleResult, type TrainingSession } from '@ar-training/shared';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';

/**
 * - tutorials: not-started → in-progress → completed
 * - assessed modules: not-started → in-progress → failed / passed (a pass is never undone)
 */
export type ModuleStatus = 'not-started' | 'in-progress' | 'completed' | 'passed' | 'failed';

export interface ModuleProgress {
  status: ModuleStatus;
  /** Attempts that reached the training scene (completed or abandoned). */
  attempts: number;
  bestPercent: number | null;
  lastCompletedAt: number | null;
}

export const NO_PROGRESS: ModuleProgress = {
  status: 'not-started',
  attempts: 0,
  bestPercent: null,
  lastCompletedAt: null,
};

export function summarizeProgress(
  sessions: readonly TrainingSession[],
  results: readonly ModuleResult[],
): Map<string, ModuleProgress> {
  const byModule = new Map<string, ModuleProgress>();
  const entry = (moduleId: string) => {
    let progress = byModule.get(moduleId);
    if (progress == null) {
      progress = { ...NO_PROGRESS };
      byModule.set(moduleId, progress);
    }
    return progress;
  };

  for (const session of sessions) {
    const progress = entry(session.moduleId);
    progress.attempts += 1;
    if (progress.status === 'not-started') progress.status = 'in-progress';
  }
  for (const result of results) {
    const progress = entry(result.moduleId);
    if (result.attemptType === 'retraining') continue;
    if (result.passed === true) progress.status = 'passed';
    else if (result.passed === false) {
      if (progress.status !== 'passed') progress.status = 'failed';
    } else progress.status = 'completed';
    progress.bestPercent = Math.max(progress.bestPercent ?? 0, resultPercent(result));
    progress.lastCompletedAt = Math.max(progress.lastCompletedAt ?? 0, result.completedAt);
  }
  return byModule;
}

/** Live per-module progress for a worker; updates as sessions and results are written. */
export function useModuleProgress(
  workerId: string | null,
): Map<string, ModuleProgress> | undefined {
  return useLiveQuery(async () => {
    if (workerId == null) return new Map<string, ModuleProgress>();
    const [sessions, results] = await Promise.all([
      db.sessions.where('workerId').equals(workerId).toArray(),
      db.results.where('workerId').equals(workerId).toArray(),
    ]);
    return summarizeProgress(sessions, results);
  }, [workerId]);
}
