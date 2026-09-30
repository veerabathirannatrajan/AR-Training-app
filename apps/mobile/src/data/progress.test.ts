import type { ModuleResult, TrainingSession } from '@ar-training/shared';
import { describe, expect, it } from 'vitest';
import { summarizeProgress } from './progress';

const session = (moduleId: string): TrainingSession => ({
  id: crypto.randomUUID(),
  workerId: '11001',
  moduleId,
  moduleVersion: 1,
  mode: 'ar',
  startedAt: 0,
  endedAt: null,
  status: 'completed',
});

const result = (moduleId: string, extra: Partial<ModuleResult>): ModuleResult => ({
  id: crypto.randomUUID(),
  sessionId: 's',
  workerId: '11001',
  moduleId,
  moduleVersion: 1,
  mode: 'ar',
  startedAt: 0,
  completedAt: 10,
  score: 50,
  maxScore: 100,
  passed: null,
  steps: [],
  ...extra,
});

describe('summarizeProgress', () => {
  it('keeps a pass even after a later failed attempt, ignoring retraining runs', () => {
    const progress = summarizeProgress(
      [session('fire'), session('fire'), session('fire')],
      [
        result('fire', { attemptType: 'assessment', passed: true, totalPercent: 82 }),
        result('fire', { attemptType: 'assessment', passed: false, totalPercent: 40 }),
        result('fire', { attemptType: 'retraining', passed: null, totalPercent: 100 }),
      ],
    );
    expect(progress.get('fire')).toMatchObject({ status: 'passed', attempts: 3, bestPercent: 82 });
  });

  it('marks tutorials completed and failed assessments failed', () => {
    const progress = summarizeProgress(
      [session('tutorial'), session('fire')],
      [result('tutorial', {}), result('fire', { attemptType: 'assessment', passed: false })],
    );
    expect(progress.get('tutorial')?.status).toBe('completed');
    expect(progress.get('fire')?.status).toBe('failed');
  });
});
