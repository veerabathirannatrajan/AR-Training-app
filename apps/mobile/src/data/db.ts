import type {
  ModuleResult,
  TrainingEvent,
  TrainingSession,
  WorkerProfile,
} from '@ar-training/shared';
import Dexie, { type EntityTable } from 'dexie';

/** PBKDF2 verifier for offline PIN checks. The PIN itself is never stored. */
export interface PinVerifier {
  salt: string;
  hash: string;
  iterations: number;
}

/** A worker who has logged in on this phone at least once (needed for offline login). */
export interface LocalWorker extends WorkerProfile {
  token: string;
  tokenExpiresAt: string;
  pinVerifier: PinVerifier;
  failedAttempts: number;
  lockedUntil: number | null;
  lastLoginAt: number;
  lastOnlineLoginAt: number;
}

/** Certificates are issued in Phase 4; the table exists now so the schema stays stable. */
export interface CertificateRecord {
  id: string;
  workerId: string;
  moduleId: string;
  score: number;
  issuedAt: string;
  expiresAt: string;
  hash: string;
  signature: string | null;
  status: 'provisional' | 'valid' | 'revoked';
}

export type SyncKind = 'session-result';

/** Work waiting to be pushed to the API; processed by the sync engine. */
export interface SyncQueueItem {
  seq?: number;
  kind: SyncKind;
  refId: string;
  workerId: string;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
  lastError: string | null;
}

export interface SettingRecord {
  key: string;
  value: string;
}

export class TrainingDatabase extends Dexie {
  declare workers: EntityTable<LocalWorker, 'workerId'>;
  declare sessions: EntityTable<TrainingSession, 'id'>;
  declare events: EntityTable<TrainingEvent, 'id'>;
  declare results: EntityTable<ModuleResult, 'id'>;
  declare certificates: EntityTable<CertificateRecord, 'id'>;
  declare syncQueue: EntityTable<SyncQueueItem, 'seq'>;
  declare settings: EntityTable<SettingRecord, 'key'>;

  constructor(name = 'ar-mining-training') {
    super(name);
    this.version(1).stores({
      workers: 'workerId, siteId, lastLoginAt',
      sessions: 'id, workerId, moduleId, startedAt, status, [workerId+moduleId]',
      events: 'id, sessionId, workerId, moduleId, stepId, timestamp',
      results: 'id, sessionId, workerId, moduleId, completedAt, [workerId+moduleId]',
      certificates: 'id, workerId, moduleId, issuedAt, status',
      syncQueue: '++seq, kind, workerId, nextAttemptAt',
      settings: 'key',
    });
  }
}

export const db = new TrainingDatabase();

export async function getSetting(key: string): Promise<string | null> {
  return (await db.settings.get(key))?.value ?? null;
}

export async function setSetting(key: string, value: string | null): Promise<void> {
  if (value == null) await db.settings.delete(key);
  else await db.settings.put({ key, value });
}
