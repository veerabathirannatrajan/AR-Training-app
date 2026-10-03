import type {
  Certificate,
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

/**
 * A certificate on this phone: provisional (issued offline on a pass, id `P-XXXXXXXX`, not
 * signed) until the sync engine replaces it with the server's signed certificate (CERT-0001).
 */
export interface CertificateRecord extends Certificate {
  /** When the server copy was last received (null for provisional certificates). */
  syncedAt: number | null;
}

/** A result on this phone, with what the server decided once it was uploaded. */
export interface LocalResult extends ModuleResult {
  syncedAt?: number;
  /** Certificate the server linked to this result (a pass). */
  certificateId?: string | null;
  /** Why the server refused the upload (not retried). */
  syncError?: string;
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

/**
 * A refresher micro-drill, scheduled 1, 3 and 7 days after passing a module. Due drills are
 * offered on the home screen when the app opens (no push server needed, works offline).
 */
export interface DrillRecord {
  id: string;
  workerId: string;
  moduleId: string;
  /** 1, 3 or 7 */
  dayOffset: number;
  dueAt: number;
  completedAt: number | null;
  /** Correct answers out of the questions asked, once completed. */
  score: number | null;
  questions: number | null;
}

export interface SettingRecord {
  key: string;
  value: string;
}

export class TrainingDatabase extends Dexie {
  declare workers: EntityTable<LocalWorker, 'workerId'>;
  declare sessions: EntityTable<TrainingSession, 'id'>;
  declare events: EntityTable<TrainingEvent, 'id'>;
  declare results: EntityTable<LocalResult, 'id'>;
  declare certificates: EntityTable<CertificateRecord, 'id'>;
  declare syncQueue: EntityTable<SyncQueueItem, 'seq'>;
  declare settings: EntityTable<SettingRecord, 'key'>;
  declare drills: EntityTable<DrillRecord, 'id'>;

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
    // v2 (Phase 2): refresher micro-drills.
    this.version(2).stores({
      drills: 'id, workerId, moduleId, dueAt, [workerId+moduleId]',
    });
    // v3 (Phase 4): signed certificates (the table was empty until now).
    this.version(3).stores({
      certificates: 'id, workerId, moduleId, resultId, status, [workerId+moduleId]',
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
