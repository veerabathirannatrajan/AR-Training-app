import {
  addDays,
  CERTIFICATE_VALIDITY_DAYS,
  certificateHash,
  certificateState,
  daysBetween,
  EXPIRING_SOON_DAYS,
  istDate,
  NOT_ANCHORED,
  ASSESSMENT_RULES,
  type CertificateState,
  type SigningKey,
  type SyncSettings,
} from '@ar-training/shared';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSetting, setSetting, type CertificateRecord } from './db';

// ---- Settings from the admin portal (synced) ----------------------------------------------

const SETTINGS_KEY = 'appSettings';

export const DEFAULT_SETTINGS: SyncSettings = {
  passMark: ASSESSMENT_RULES.passMark,
  certificateValidityDays: CERTIFICATE_VALIDITY_DAYS,
  expiringSoonDays: EXPIRING_SOON_DAYS,
};

export async function getAppSettings(): Promise<SyncSettings> {
  const raw = await getSetting(SETTINGS_KEY);
  if (raw == null) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<SyncSettings>) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveAppSettings(settings: SyncSettings): Promise<void> {
  await setSetting(SETTINGS_KEY, JSON.stringify(settings));
}

// ---- Trust store: public keys and revocations for offline verification ---------------------

const TRUST_KEY = 'trust';

export interface TrustStore {
  keys: SigningKey[];
  revokedIds: string[];
  /** Epoch ms of the last update from the API; null if only the built-in key is known. */
  updatedAt: number | null;
}

/** The API's public key at build time (see vite.config.ts), so new installs verify offline. */
const BUILT_IN_KEYS: SigningKey[] = __ARMT_CERT_KEYS__;

export async function getTrust(): Promise<TrustStore> {
  const raw = await getSetting(TRUST_KEY);
  let stored: TrustStore = { keys: [], revokedIds: [], updatedAt: null };
  if (raw != null) {
    try {
      stored = JSON.parse(raw) as TrustStore;
    } catch {
      // Corrupt entry: fall back to the built-in key.
    }
  }
  const keys = [...stored.keys];
  for (const key of BUILT_IN_KEYS) {
    if (!keys.some((known) => known.keyId === key.keyId)) keys.push(key);
  }
  return { ...stored, keys };
}

export async function saveTrust(keys: SigningKey[], revokedIds: string[]): Promise<void> {
  const trust: TrustStore = { keys, revokedIds, updatedAt: Date.now() };
  await setSetting(TRUST_KEY, JSON.stringify(trust));
}

export function useTrust(): TrustStore | undefined {
  return useLiveQuery(getTrust, []);
}

// ---- Certificates on this phone --------------------------------------------------------------

const PROVISIONAL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function provisionalId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return `P-${Array.from(bytes, (byte) => PROVISIONAL_ALPHABET[byte % PROVISIONAL_ALPHABET.length]).join('')}`;
}

/** Live (not expired, not revoked) certificate for a module, newest expiry first. */
export function currentCertificate(
  certificates: readonly CertificateRecord[],
  moduleId: string,
  now = Date.now(),
): CertificateRecord | undefined {
  const today = istDate(now);
  return certificates
    .filter(
      (cert) => cert.moduleId === moduleId && cert.status !== 'revoked' && cert.expiresOn >= today,
    )
    .sort((a, b) => b.expiresOn.localeCompare(a.expiresOn))[0];
}

/**
 * On a pass the worker gets a provisional certificate straight away, offline. It is replaced by
 * the signed one when the result syncs. A worker who already holds a certificate for the module
 * with more than `expiringSoonDays` left keeps it (the server applies the same rule).
 * Must run inside a Dexie transaction that includes `certificates` and `workers`.
 */
export async function issueProvisionalCertificate(args: {
  workerId: string;
  moduleId: string;
  moduleVersion: number;
  resultId: string;
  score: number;
  passedAt: number;
  settings: SyncSettings;
}): Promise<CertificateRecord | null> {
  const worker = await db.workers.get(args.workerId);
  if (worker == null) return null;
  const mine = await db.certificates
    .where('[workerId+moduleId]')
    .equals([args.workerId, args.moduleId])
    .toArray();
  const current = currentCertificate(mine, args.moduleId, args.passedAt);
  const today = istDate(args.passedAt);
  if (current != null && daysBetween(today, current.expiresOn) > args.settings.expiringSoonDays) {
    return null;
  }
  const id = provisionalId();
  const payload = {
    v: 1 as const,
    id,
    workerId: args.workerId,
    workerName: worker.name,
    moduleId: args.moduleId,
    score: args.score,
    issuedOn: today,
    expiresOn: addDays(today, args.settings.certificateValidityDays),
  };
  const record: CertificateRecord = {
    ...payload,
    hash: certificateHash(payload),
    signature: null,
    keyId: null,
    status: 'provisional',
    moduleVersion: args.moduleVersion,
    resultId: args.resultId,
    provisionalId: id,
    revokedAt: null,
    revokedReason: null,
    anchor: NOT_ANCHORED,
    syncedAt: null,
  };
  await db.certificates.add(record);
  return record;
}

export function useWorkerCertificates(workerId: string | null): CertificateRecord[] | undefined {
  return useLiveQuery(async () => {
    if (workerId == null) return [];
    const certificates = await db.certificates.where('workerId').equals(workerId).toArray();
    return certificates.sort(
      (a, b) => b.issuedOn.localeCompare(a.issuedOn) || b.id.localeCompare(a.id),
    );
  }, [workerId]);
}

export function useCertificate(id: string): CertificateRecord | null | undefined {
  return useLiveQuery(async () => (await db.certificates.get(id)) ?? null, [id]);
}

/** The certificate a result earned (provisional or signed), if any. */
export function useResultCertificate(
  resultId: string | null,
): CertificateRecord | null | undefined {
  return useLiveQuery(async () => {
    if (resultId == null) return null;
    const result = await db.results.get(resultId);
    if (result?.certificateId != null) {
      const linked = await db.certificates.get(result.certificateId);
      if (linked != null) return linked;
    }
    return (await db.certificates.where('resultId').equals(resultId).first()) ?? null;
  }, [resultId]);
}

/** A certificate's state with the synced expiry warning period and revocation list. */
export function stateOf(
  certificate: CertificateRecord,
  trust: TrustStore | undefined,
  settings: SyncSettings = DEFAULT_SETTINGS,
): CertificateState {
  if (trust?.revokedIds.includes(certificate.id) === true) return 'revoked';
  return certificateState(certificate, Date.now(), settings.expiringSoonDays);
}
