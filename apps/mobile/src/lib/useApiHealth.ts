import type { HealthResponse } from '@ar-training/shared';
import { useEffect, useState } from 'react';
import { fetchHealth } from './api';

export type ApiHealth =
  | { status: 'checking' }
  | { status: 'online'; health: HealthResponse }
  | { status: 'offline'; error: string };

const RECHECK_MS = 10_000;

/** Polls GET /api/health so the device check shows whether the phone can reach the API. */
export function useApiHealth(): ApiHealth {
  const [state, setState] = useState<ApiHealth>({ status: 'checking' });

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const health = await fetchHealth();
        if (!cancelled) setState({ status: 'online', health });
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'offline',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    };
    void check();
    const timer = window.setInterval(() => void check(), RECHECK_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return state;
}
