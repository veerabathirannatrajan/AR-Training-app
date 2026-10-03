import type { SyncItem, SyncResponse } from '@ar-training/shared';
import { useLiveQuery } from 'dexie-react-hooks';
import { create } from 'zustand';
import { ApiError, NetworkError, postSync } from '../lib/api';
import { saveAppSettings, saveTrust } from './certificates';
import {
  db,
  getSetting,
  setSetting,
  type LocalResult,
  type LocalWorker,
  type SyncQueueItem,
} from './db';

/**
 * Sync engine. Results are queued in Dexie when an attempt ends (works offline); whenever the
 * phone is online the engine pushes them to the API with the worker's token and pulls back
 * signed certificates, signing keys, revocations and portal settings. Failures retry with
 * exponential backoff. It runs on app start, when the network comes back, after every attempt,
 * when the app returns to the foreground, and every few minutes while open.
 */

const BATCH_SIZE = 20;
const RETRY_BASE_MS = 15_000;
const RETRY_MAX_MS = 30 * 60_000;
const PULL_EVERY_MS = 5 * 60_000;
const TICK_MS = 30_000;

export type SyncPhase = 'idle' | 'syncing' | 'offline' | 'error' | 'needs-login';

interface SyncState {
  phase: SyncPhase;
  lastSyncAt: number | null;
  lastError: string | null;
}

export const useSyncStore = create<SyncState>()(() => ({
  phase: 'idle',
  lastSyncAt: null,
  lastError: null,
}));

/** Retry delay after `attempts` failures: 15 s, 30 s, 1 min … capped at 30 min, ±20% jitter. */
export function retryDelay(attempts: number, random = Math.random()): number {
  const base = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** Math.max(0, attempts - 1));
  return Math.round(base * (0.8 + random * 0.4));
}

export async function deviceId(): Promise<string> {
  const existing = await getSetting('deviceId');
  if (existing != null) return existing;
  const id = crypto.randomUUID();
  await setSetting('deviceId', id);
  return id;
}

function tokenUsable(worker: LocalWorker, now: number): boolean {
  return worker.token !== '' && Date.parse(worker.tokenExpiresAt) > now + 60_000;
}

async function buildItems(queue: readonly SyncQueueItem[]): Promise<SyncItem[]> {
  const items: SyncItem[] = [];
  for (const entry of queue) {
    const result = await db.results.get(entry.refId);
    if (result == null) continue;
    const [session, events] = await Promise.all([
      db.sessions.get(result.sessionId),
      db.events.where('sessionId').equals(result.sessionId).toArray(),
    ]);
    // Local-only fields stay on the phone.
    const upload: LocalResult = { ...result };
    delete upload.syncedAt;
    delete upload.certificateId;
    delete upload.syncError;
    // The API accepts up to 500 events per attempt; the latest matter most.
    items.push({ result: upload, session: session ?? null, events: events.slice(-500) });
  }
  return items;
}

async function backoff(queue: readonly SyncQueueItem[], error: string, now: number) {
  await db.syncQueue.bulkPut(
    queue.map((item) => ({
      ...item,
      attempts: item.attempts + 1,
      nextAttemptAt: now + retryDelay(item.attempts + 1),
      lastError: error,
    })),
  );
}

/** Applies the server's answer: queue, results, certificates, keys, revocations, settings. */
export async function applySyncResponse(
  workerId: string,
  queue: readonly SyncQueueItem[],
  response: SyncResponse,
  now = Date.now(),
): Promise<void> {
  await db.transaction('rw', [db.syncQueue, db.results, db.certificates, db.settings], async () => {
    for (const outcome of response.results) {
      const item = queue.find((entry) => entry.refId === outcome.resultId);
      if (item?.seq != null) await db.syncQueue.delete(item.seq);
      if (outcome.status === 'rejected') {
        console.warn('[sync] result rejected by the server', outcome.resultId, outcome.reason);
        await db.results.update(outcome.resultId, { syncError: outcome.reason ?? 'rejected' });
        continue;
      }
      // The server is the authority on pass / fail (it applies the pass mark in force).
      await db.results.update(outcome.resultId, {
        syncedAt: now,
        certificateId: outcome.certificateId,
        passed: outcome.passed,
        failReason: outcome.failReason,
      });
      // The provisional certificate is replaced by the signed one (or by none).
      const provisional = await db.certificates
        .where('resultId')
        .equals(outcome.resultId)
        .filter((cert) => cert.status === 'provisional')
        .primaryKeys();
      await db.certificates.bulkDelete(provisional);
    }
    await db.certificates.bulkPut(
      response.certificates.map((cert) => ({ ...cert, syncedAt: now })),
    );
    // Signed certificates the server no longer lists for this worker are dropped.
    const listed = new Set(response.certificates.map((cert) => cert.id));
    const stale = await db.certificates
      .where('workerId')
      .equals(workerId)
      .filter((cert) => cert.status !== 'provisional' && !listed.has(cert.id))
      .primaryKeys();
    await db.certificates.bulkDelete(stale);
    await saveTrust(response.signingKeys, response.revokedCertificateIds);
    await saveAppSettings(response.settings);
  });
}

let running: Promise<void> | null = null;
let rerun = false;
let lastPullAt = 0;
/** Ignore retry backoff on the next run (sync tapped, network back, fresh login). */
let retryNow = false;

/**
 * Starts a sync now (or once the running one finishes). `pull` also refreshes certificates;
 * `retryNow` uploads waiting results without waiting for their retry time.
 */
export function requestSync(options: { pull?: boolean; retryNow?: boolean } = {}): Promise<void> {
  if (options.pull === true) lastPullAt = 0;
  if (options.retryNow === true) retryNow = true;
  if (running != null) {
    rerun = true;
    return running;
  }
  running = runSync()
    .catch((error: unknown) => {
      console.error('[sync] failed', error);
      useSyncStore.setState({ phase: 'error', lastError: String(error) });
    })
    .finally(() => {
      running = null;
      if (rerun) {
        rerun = false;
        void requestSync();
      }
    });
  return running;
}

async function runSync(): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    useSyncStore.setState({ phase: 'offline' });
    return;
  }
  const now = Date.now();
  const queue = await db.syncQueue.toArray();
  const due = retryNow ? queue : queue.filter((item) => item.nextAttemptAt <= now);
  retryNow = false;
  const currentId = await getSetting('currentWorkerId');
  const pullDue = now - lastPullAt >= PULL_EVERY_MS || useSyncStore.getState().lastSyncAt == null;
  const workerIds = [
    ...new Set([
      ...due.map((item) => item.workerId),
      ...(currentId != null && (pullDue || due.length > 0) ? [currentId] : []),
    ]),
  ];
  if (workerIds.length === 0) {
    if (queue.length === 0) useSyncStore.setState({ phase: 'idle' });
    return;
  }

  useSyncStore.setState({ phase: 'syncing' });
  const id = await deviceId();
  let failure: SyncPhase | null = null;
  let lastError: string | null = null;
  let more = false;

  for (const workerId of workerIds) {
    const worker = await db.workers.get(workerId);
    const batch = due.filter((item) => item.workerId === workerId).slice(0, BATCH_SIZE);
    if (due.filter((item) => item.workerId === workerId).length > batch.length) more = true;
    if (worker == null || !tokenUsable(worker, now)) {
      // Uploading needs a valid login token: the worker has to log in once while online.
      if (batch.length > 0) {
        await backoff(batch, 'login-needed', now);
        failure ??= 'needs-login';
      }
      continue;
    }
    try {
      const items = await buildItems(batch);
      const pendingCount = Math.max(0, queue.length - batch.length);
      const response = await postSync(worker.token, {
        deviceId: id,
        appVersion: __APP_VERSION__,
        pendingCount,
        items,
      });
      await applySyncResponse(workerId, batch, response, Date.now());
      if (workerId === currentId) lastPullAt = Date.now();
    } catch (error) {
      if (error instanceof NetworkError) {
        await backoff(batch, 'network', now);
        failure = 'offline';
        lastError = 'network';
        break;
      }
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        await backoff(batch, 'login-needed', now);
        failure ??= 'needs-login';
        continue;
      }
      await backoff(batch, error instanceof ApiError ? `http-${error.status}` : 'error', now);
      failure = 'error';
      lastError = error instanceof Error ? error.message : String(error);
    }
  }

  if (failure == null) {
    useSyncStore.setState({ phase: 'idle', lastSyncAt: Date.now(), lastError: null });
    if (more) rerun = true;
  } else {
    useSyncStore.setState({ phase: failure, lastError });
  }
}

let started = false;

/** Runs the engine for the lifetime of the app. */
export function startSyncEngine(): () => void {
  if (started) return () => undefined;
  started = true;
  const onOnline = () => void requestSync({ retryNow: true });
  const onOffline = () => useSyncStore.setState({ phase: 'offline' });
  const onVisible = () => {
    if (document.visibilityState === 'visible') void requestSync();
  };
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  document.addEventListener('visibilitychange', onVisible);
  const timer = window.setInterval(() => void requestSync(), TICK_MS);
  void requestSync();
  return () => {
    started = false;
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    document.removeEventListener('visibilitychange', onVisible);
    window.clearInterval(timer);
  };
}

/** Results waiting to upload: for one worker, or for everyone on this phone. */
export function usePendingCount(workerId?: string | null): number {
  return (
    useLiveQuery(
      () =>
        workerId == null
          ? db.syncQueue.count()
          : db.syncQueue.where('workerId').equals(workerId).count(),
      [workerId],
    ) ?? 0
  );
}
