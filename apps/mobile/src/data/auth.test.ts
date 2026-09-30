import 'fake-indexeddb/auto';
import type { WorkerLoginResponse } from '@ar-training/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { currentWorker, login, logout, LOCAL_MAX_FAILED_ATTEMPTS } from './auth';
import { db } from './db';

const LOGIN_RESPONSE: WorkerLoginResponse = {
  token: 'token-123',
  expiresAt: '2026-12-31T00:00:00Z',
  worker: {
    workerId: '11001',
    name: 'Ramesh Mahto',
    role: 'Miner',
    siteId: 'DHN',
    siteName: 'Dhanbad Coal Site',
    district: 'Dhanbad',
    sector: 'coal',
    preferredLanguage: 'hi',
  },
};

function respond(status: number, body: unknown) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status }));
}

const offline = () =>
  vi.fn(async () => {
    throw new TypeError('Failed to fetch');
  });

beforeEach(async () => {
  await db.delete();
  await db.open();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('login', () => {
  it('logs in online and caches the worker for offline use', async () => {
    vi.stubGlobal('fetch', respond(200, LOGIN_RESPONSE));

    const outcome = await login('11001', '1234');

    expect(outcome).toMatchObject({ ok: true, offline: false });
    const cached = await db.workers.get('11001');
    expect(cached?.token).toBe('token-123');
    expect(cached?.pinVerifier.hash).not.toContain('1234');
    expect((await currentWorker())?.name).toBe('Ramesh Mahto');
  });

  it('logs in offline with the cached verifier after a first online login', async () => {
    vi.stubGlobal('fetch', respond(200, LOGIN_RESPONSE));
    await login('11001', '1234');
    await logout();
    vi.stubGlobal('fetch', offline());

    expect(await login('11001', '1234')).toMatchObject({ ok: true, offline: true });
    expect(await login('11001', '9999')).toEqual({ ok: false, error: 'invalid-credentials' });
  });

  it('needs the network for the very first login on a phone', async () => {
    vi.stubGlobal('fetch', offline());
    expect(await login('11001', '1234')).toEqual({
      ok: false,
      error: 'first-login-needs-network',
    });
  });

  it('locks offline login after repeated wrong PINs', async () => {
    vi.stubGlobal('fetch', respond(200, LOGIN_RESPONSE));
    await login('11001', '1234');
    vi.stubGlobal('fetch', offline());

    for (let attempt = 1; attempt < LOCAL_MAX_FAILED_ATTEMPTS; attempt += 1) {
      expect(await login('11001', '0000')).toMatchObject({ error: 'invalid-credentials' });
    }
    expect(await login('11001', '0000')).toMatchObject({ ok: false, error: 'locked' });
    // Even the right PIN is refused while locked.
    expect(await login('11001', '1234')).toMatchObject({ ok: false, error: 'locked' });
  });

  it('maps API errors to login errors', async () => {
    vi.stubGlobal(
      'fetch',
      respond(401, {
        detail: { code: 'invalid-credentials', message: 'Worker ID or PIN is incorrect.' },
      }),
    );
    expect(await login('11001', '0000')).toEqual({ ok: false, error: 'invalid-credentials' });

    vi.stubGlobal(
      'fetch',
      respond(423, { detail: { code: 'locked', message: 'Locked', retryAfterSeconds: 120 } }),
    );
    expect(await login('11001', '0000')).toEqual({
      ok: false,
      error: 'locked',
      retryAfterSeconds: 120,
    });
  });

  it('removes a cached worker the server reports as inactive', async () => {
    vi.stubGlobal('fetch', respond(200, LOGIN_RESPONSE));
    await login('11001', '1234');
    vi.stubGlobal('fetch', respond(403, { detail: { code: 'inactive', message: 'Inactive' } }));

    expect(await login('11001', '1234')).toEqual({ ok: false, error: 'inactive' });
    expect(await db.workers.get('11001')).toBeUndefined();
  });
});
