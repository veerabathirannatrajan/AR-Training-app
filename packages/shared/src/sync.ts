import type { Certificate, SigningKey } from './certificates';
import type { TrainingEvent } from './events';
import type { ModuleResult, TrainingSession } from './results';

/** A completed attempt pushed by the phone, with its session and step events. */
export interface SyncItem {
  result: ModuleResult;
  session: TrainingSession | null;
  events: TrainingEvent[];
}

/** POST /api/sync (worker token). Pushes queued results and pulls certificates and settings. */
export interface SyncRequest {
  /** Random id of this phone (one per app install). */
  deviceId: string;
  appVersion: string;
  /** Results still waiting on the phone after this batch (all workers), for the admin portal. */
  pendingCount: number;
  items: SyncItem[];
}

/** Settings the admin portal controls and phones follow. */
export interface SyncSettings {
  /** Percent. */
  passMark: number;
  certificateValidityDays: number;
  expiringSoonDays: number;
}

export interface SyncedResult {
  resultId: string;
  /** `duplicate`: already uploaded before (sync is idempotent). */
  status: 'accepted' | 'duplicate' | 'rejected';
  reason: string | null;
  /** The server's decision, using the pass mark in force. */
  passed: boolean | null;
  failReason: 'critical-error' | 'below-pass-mark' | null;
  /** Certificate for this pass (newly issued, or the worker's current one for the module). */
  certificateId: string | null;
}

export interface SyncResponse {
  results: SyncedResult[];
  /** All of this worker's certificates, signed. */
  certificates: Certificate[];
  /** Revoked certificate ids, so phones can check revocation offline. */
  revokedCertificateIds: string[];
  signingKeys: SigningKey[];
  settings: SyncSettings;
  serverTime: string;
}

/** GET /api/certificates/keys (public): keys and revocations for offline verification. */
export interface TrustBundle {
  signingKeys: SigningKey[];
  revokedCertificateIds: string[];
  serverTime: string;
}
