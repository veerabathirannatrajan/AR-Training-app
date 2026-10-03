import type { ApiErrorBody } from '@ar-training/shared';

const API_KEY = 'armt-admin-api';
const TOKEN_KEY = 'armt-admin-token';
export const DEFAULT_API = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null): void {
  try {
    if (value == null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // storage blocked: the session lasts until the page closes
  }
}

let memoryToken: string | null = read(TOKEN_KEY);

export function apiBase(): string {
  return (read(API_KEY) ?? DEFAULT_API).replace(/\/+$/, '');
}

export function setApiBase(url: string): void {
  write(API_KEY, url.trim() === '' || url.trim() === DEFAULT_API ? null : url.trim());
}

export function getToken(): string | null {
  return memoryToken;
}

export function setToken(token: string | null): void {
  memoryToken = token;
  write(TOKEN_KEY, token);
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/** The API could not be reached at all. */
export class NetworkError extends Error {
  constructor(readonly url: string) {
    super(`Cannot reach ${url}`);
    this.name = 'NetworkError';
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

export function buildUrl(path: string, query?: Query): string {
  const url = new URL(`${apiBase()}${path}`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value != null && value !== '') url.searchParams.set(key, String(value));
  }
  return url.toString();
}

/** Called when the API rejects the session (expired or revoked token). */
let onUnauthorized: () => void = () => undefined;
export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

export async function apiFetch(
  path: string,
  init: RequestInit & { query?: Query; auth?: boolean } = {},
): Promise<Response> {
  const { query, auth = true, headers, ...rest } = init;
  const url = buildUrl(path, query);
  let response: Response;
  try {
    response = await fetch(url, {
      ...rest,
      headers: {
        ...(rest.body != null ? { 'Content-Type': 'application/json' } : {}),
        ...(auth && memoryToken != null ? { Authorization: `Bearer ${memoryToken}` } : {}),
        ...headers,
      },
      signal: rest.signal ?? AbortSignal.timeout(20000),
    });
  } catch {
    throw new NetworkError(apiBase());
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    const code = body?.detail?.code ?? 'error';
    if (response.status === 401 && auth) onUnauthorized();
    throw new ApiError(response.status, code, body?.detail?.message ?? `HTTP ${response.status}`);
  }
  return response;
}

export async function api<T>(
  path: string,
  init: Omit<RequestInit, 'body'> & { query?: Query; auth?: boolean; body?: unknown } = {},
): Promise<T> {
  const { body, ...rest } = init;
  const response = await apiFetch(path, {
    ...rest,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return (await response.json()) as T;
}
