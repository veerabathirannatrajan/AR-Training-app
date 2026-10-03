import 'fake-indexeddb/auto';
import {
  certificateHash,
  NOT_ANCHORED,
  type Certificate,
  type ModuleResult,
  type SyncResponse,
} from '@ar-training/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_SETTINGS,
  getAppSettings,
  getTrust,
  issueProvisionalCertificate,
} from './certificates';
import { db, setSetting, type LocalWorker } from './db';
import { requestSync, retryDelay, useSyncStore } from './sync';

const WORKER: LocalWorker = {
  workerId: '11003',
  name: 'Birsa Murmu',
  role: 'Dumper operator',
  siteId: 'DHN',
  siteName: 'Dhanbad Coal Site',
  district: 'Dhanbad',
  sector: 'coal',
  preferredLanguage: 'sat',
  token: 'token-abc',
  tokenExpiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  pinVerifier: { salt: '', hash: '', iterations: 1 },
  failedAttempts: 0,
  lockedUntil: null,
  lastLoginAt: 0,
  lastOnlineLoginAt: 0,
};

const PASSED_AT = Date.parse('2026-10-03T06:00:00Z');

function result(id: string): ModuleResult {
  return {
    id,
    sessionId: `session-${id}`,
    workerId: WORKER.workerId,
    moduleId: 'fire-explosion',
    moduleVersion: 1,
    mode: 'ar',
    attemptType: 'assessment',
    startedAt: PASSED_AT - 300_000,
    completedAt: PASSED_AT,
    score: 140,
    maxScore: 155,
    totalPercent: 88,
    passed: true,
    steps: [],
  };
}

function signed(id: string, resultId: string): Certificate {
  const payload = {
    v: 1 as const,
    id,
    workerId: WORKER.workerId,
    workerName: WORKER.name,
    moduleId: 'fire-explosion',
    score: 88,
    issuedOn: '2026-10-03',
    expiresOn: '2027-10-03',
  };
  return {
    ...payload,
    hash: certificateHash(payload),
    signature: 'c2lnbmF0dXJl',
    keyId: 'abcd1234',
    status: 'valid',
    moduleVersion: 1,
    resultId,
    provisionalId: null,
    revokedAt: null,
    revokedReason: null,
    anchor: NOT_ANCHORED,
  };
}

beforeEach(async () => {
  await db.delete();
  await db.open();
  await db.workers.put(WORKER);
  await setSetting('currentWorkerId', WORKER.workerId);
  useSyncStore.setState({ phase: 'idle', lastSyncAt: null, lastError: null });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('provisional certificates', () => {
  it('issues one offline on a pass, with a hash of its details', async () => {
    const cert = await issueProvisionalCertificate({
      workerId: WORKER.workerId,
      moduleId: 'fire-explosion',
      moduleVersion: 1,
      resultId: 'r1',
      score: 88,
      passedAt: PASSED_AT,
      settings: DEFAULT_SETTINGS,
    });
    expect(cert?.id).toMatch(/^P-[A-Z2-9]{8}$/);
    expect(cert?.status).toBe('provisional');
    expect(cert?.issuedOn).toBe('2026-10-03');
    expect(cert?.expiresOn).toBe('2027-10-03');
    expect(cert?.hash).toBe(certificateHash(cert!));
  });

  it('keeps a certificate that is still valid for a while', async () => {
    await db.certificates.put({ ...signed('CERT-0001', 'r0'), syncedAt: 1 });
    const again = await issueProvisionalCertificate({
      workerId: WORKER.workerId,
      moduleId: 'fire-explosion',
      moduleVersion: 1,
      resultId: 'r1',
      score: 90,
      passedAt: PASSED_AT + 86_400_000,
      settings: DEFAULT_SETTINGS,
    });
    expect(again).toBeNull();
  });
});

describe('sync engine', () => {
  it('backs off exponentially with a cap', () => {
    expect(retryDelay(1, 0.5)).toBe(15_000);
    expect(retryDelay(3, 0.5)).toBe(60_000);
    expect(retryDelay(20, 0.5)).toBe(30 * 60_000);
  });

  it('uploads a pass and swaps the provisional certificate for the signed one', async () => {
    await db.results.add(result('r1'));
    await db.syncQueue.add({
      kind: 'session-result',
      refId: 'r1',
      workerId: WORKER.workerId,
      createdAt: PASSED_AT,
      attempts: 0,
      nextAttemptAt: 0,
      lastError: null,
    });
    await issueProvisionalCertificate({
      workerId: WORKER.workerId,
      moduleId: 'fire-explosion',
      moduleVersion: 1,
      resultId: 'r1',
      score: 88,
      passedAt: PASSED_AT,
      settings: DEFAULT_SETTINGS,
    });

    const response: SyncResponse = {
      results: [
        {
          resultId: 'r1',
          status: 'accepted',
          reason: null,
          passed: true,
          failReason: null,
          certificateId: 'CERT-0007',
        },
      ],
      certificates: [signed('CERT-0007', 'r1')],
      revokedCertificateIds: ['CERT-0002'],
      signingKeys: [{ keyId: 'abcd1234', algorithm: 'Ed25519', publicKey: 'ab'.repeat(32) }],
      settings: { passMark: 75, certificateValidityDays: 365, expiringSoonDays: 30 },
      serverTime: new Date().toISOString(),
    };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(response), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await requestSync();

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const body = JSON.parse(String(init.body));
    expect(body.items).toHaveLength(1);
    expect(body.items[0].result.id).toBe('r1');
    expect(body.deviceId).toMatch(/[0-9a-f-]{36}/);
    expect(await db.syncQueue.count()).toBe(0);
    const certificates = await db.certificates.toArray();
    expect(certificates.map((cert) => cert.id)).toEqual(['CERT-0007']);
    expect((await db.results.get('r1'))?.certificateId).toBe('CERT-0007');
    expect((await getTrust()).revokedIds).toEqual(['CERT-0002']);
    expect((await getAppSettings()).passMark).toBe(75);
    expect(useSyncStore.getState().phase).toBe('idle');
  });

  it('keeps results queued and retries later when the API is unreachable', async () => {
    await db.results.add(result('r2'));
    await db.syncQueue.add({
      kind: 'session-result',
      refId: 'r2',
      workerId: WORKER.workerId,
      createdAt: PASSED_AT,
      attempts: 0,
      nextAttemptAt: 0,
      lastError: null,
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    await requestSync();
    const [item] = await db.syncQueue.toArray();
    expect(item?.attempts).toBe(1);
    expect(item?.lastError).toBe('network');
    expect(item?.nextAttemptAt).toBeGreaterThan(Date.now());
    expect(useSyncStore.getState().phase).toBe('offline');
  });

  it('asks for an online login when the token has expired', async () => {
    await db.workers.put({ ...WORKER, tokenExpiresAt: '2020-01-01T00:00:00Z' });
    await db.results.add(result('r3'));
    await db.syncQueue.add({
      kind: 'session-result',
      refId: 'r3',
      workerId: WORKER.workerId,
      createdAt: PASSED_AT,
      attempts: 0,
      nextAttemptAt: 0,
      lastError: null,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await requestSync();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(useSyncStore.getState().phase).toBe('needs-login');
  });
});
