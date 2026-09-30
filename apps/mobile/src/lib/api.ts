import type {
  ApiErrorBody,
  HealthResponse,
  WorkerLoginRequest,
  WorkerLoginResponse,
} from '@ar-training/shared';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

/** The server answered with an error status. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ApiErrorBody | null,
  ) {
    super(body?.detail.message ?? `API responded with ${status}`);
    this.name = 'ApiError';
  }
}

/** The server could not be reached (offline, timeout, no adb reverse, server down). */
export class NetworkError extends Error {
  constructor(cause: unknown) {
    super('Could not reach the API', { cause });
    this.name = 'NetworkError';
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  const detail = (value as ApiErrorBody | null)?.detail;
  return detail != null && typeof detail === 'object' && typeof detail.code === 'string';
}

async function request<T>(path: string, init: RequestInit = {}, timeoutMs = 8000): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init.headers },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    throw new NetworkError(error);
  }
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    throw new ApiError(response.status, isApiErrorBody(body) ? body : null);
  }
  return (await response.json()) as T;
}

export function fetchHealth(): Promise<HealthResponse> {
  return request<HealthResponse>('/api/health', {}, 2500);
}

export function loginWorker(body: WorkerLoginRequest): Promise<WorkerLoginResponse> {
  return request<WorkerLoginResponse>('/api/auth/worker/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
