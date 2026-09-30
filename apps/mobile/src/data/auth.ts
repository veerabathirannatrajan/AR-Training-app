import { ApiError, loginWorker, NetworkError } from '../lib/api';
import { db, getSetting, setSetting, type LocalWorker } from './db';
import { createPinVerifier, verifyPin } from './pin';

const CURRENT_WORKER_KEY = 'currentWorkerId';
export const LOCAL_MAX_FAILED_ATTEMPTS = 5;
export const LOCAL_LOCKOUT_MS = 5 * 60 * 1000;

export type LoginError =
  'invalid-credentials' | 'locked' | 'inactive' | 'first-login-needs-network' | 'server';

export type LoginOutcome =
  | { ok: true; worker: LocalWorker; offline: boolean }
  | { ok: false; error: LoginError; retryAfterSeconds?: number };

function lockedOutcome(lockedUntil: number, now: number): LoginOutcome {
  return { ok: false, error: 'locked', retryAfterSeconds: Math.ceil((lockedUntil - now) / 1000) };
}

async function recordLocalFailure(worker: LocalWorker, now: number): Promise<LoginOutcome> {
  const failedAttempts = worker.failedAttempts + 1;
  if (failedAttempts >= LOCAL_MAX_FAILED_ATTEMPTS) {
    const lockedUntil = now + LOCAL_LOCKOUT_MS;
    await db.workers.update(worker.workerId, { failedAttempts: 0, lockedUntil });
    return lockedOutcome(lockedUntil, now);
  }
  await db.workers.update(worker.workerId, { failedAttempts });
  return { ok: false, error: 'invalid-credentials' };
}

async function offlineLogin(
  cached: LocalWorker | undefined,
  pin: string,
  now: number,
): Promise<LoginOutcome> {
  if (cached == null) return { ok: false, error: 'first-login-needs-network' };
  if (!(await verifyPin(pin, cached.pinVerifier))) return recordLocalFailure(cached, now);
  const worker: LocalWorker = { ...cached, failedAttempts: 0, lockedUntil: null, lastLoginAt: now };
  await db.workers.put(worker);
  await setSetting(CURRENT_WORKER_KEY, worker.workerId);
  return { ok: true, worker, offline: true };
}

/**
 * Logs a worker in. Online, the API is the authority and the phone caches the profile plus a
 * PIN verifier; offline (or when the API is unreachable), a worker who has logged in on this
 * phone before is checked against that verifier. Both paths lock out after repeated wrong PINs.
 */
export async function login(
  workerId: string,
  pin: string,
  now = Date.now(),
): Promise<LoginOutcome> {
  const cached = await db.workers.get(workerId);
  if (cached?.lockedUntil != null && cached.lockedUntil > now) {
    return lockedOutcome(cached.lockedUntil, now);
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return offlineLogin(cached, pin, now);
  }

  try {
    const response = await loginWorker({ workerId, pin });
    const worker: LocalWorker = {
      ...response.worker,
      token: response.token,
      tokenExpiresAt: response.expiresAt,
      pinVerifier: await createPinVerifier(pin),
      failedAttempts: 0,
      lockedUntil: null,
      lastLoginAt: now,
      lastOnlineLoginAt: now,
    };
    await db.workers.put(worker);
    await setSetting(CURRENT_WORKER_KEY, worker.workerId);
    return { ok: true, worker, offline: false };
  } catch (error) {
    if (error instanceof NetworkError) return offlineLogin(cached, pin, now);
    if (error instanceof ApiError) {
      const code = error.body?.detail.code;
      if (code === 'locked') {
        const retryAfterSeconds = error.body?.detail.retryAfterSeconds;
        return retryAfterSeconds == null
          ? { ok: false, error: 'locked' }
          : { ok: false, error: 'locked', retryAfterSeconds };
      }
      if (code === 'inactive') {
        // The server says this account is off: stop allowing offline logins with it too.
        await db.workers.delete(workerId);
        await setSetting(CURRENT_WORKER_KEY, null);
        return { ok: false, error: 'inactive' };
      }
      if (code === 'invalid-credentials' || code === 'validation') {
        return { ok: false, error: 'invalid-credentials' };
      }
      // 5xx and anything unexpected: the server is having trouble, so fall back to offline.
      if (error.status >= 500) return offlineLogin(cached, pin, now);
    }
    console.error('[auth] login failed', error);
    return { ok: false, error: 'server' };
  }
}

export async function currentWorker(): Promise<LocalWorker | null> {
  const workerId = await getSetting(CURRENT_WORKER_KEY);
  if (workerId == null) return null;
  return (await db.workers.get(workerId)) ?? null;
}

/** Ends the session on this phone. The cached profile stays so the worker can log in offline. */
export async function logout(): Promise<void> {
  await setSetting(CURRENT_WORKER_KEY, null);
}
