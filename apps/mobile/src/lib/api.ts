import type { HealthResponse } from '@ar-training/shared';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

export async function fetchHealth(timeoutMs = 2500): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/health`, {
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`API responded with ${response.status}`);
  }
  return (await response.json()) as HealthResponse;
}
