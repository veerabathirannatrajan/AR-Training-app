import * as ed from '@noble/ed25519';
import { sha256, sha512 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';

// Pure-JS hashing so certificates hash and verify the same way everywhere: on the phone
// offline, in the admin portal (also when it is opened over plain http) and in Node tests.
ed.hashes.sha512 = sha512;

/** Version of the signed payload and QR format. */
export const CERT_FORMAT_VERSION = 1;
/** Defaults; the API's settings (synced to phones) can change them. */
export const CERTIFICATE_VALIDITY_DAYS = 365;
export const EXPIRING_SOON_DAYS = 30;
/**
 * QR codes are links to the worker app, so any phone camera can open them; the app (or the
 * admin portal) then verifies the certificate offline from the data in the link.
 */
export const VERIFY_URL_BASE = 'https://ar-mining-training.vercel.app/#c=';
export const POLYGONSCAN_TX_URL = 'https://amoy.polygonscan.com/tx/';

/** The signed part of a certificate. Its canonical JSON is hashed with SHA-256. */
export interface CertificatePayload {
  v: typeof CERT_FORMAT_VERSION;
  /** `CERT-0001` from the server; `P-XXXXXXXX` while provisional (issued offline). */
  id: string;
  workerId: string;
  workerName: string;
  moduleId: string;
  /** Assessment score, 0–100. */
  score: number;
  /** Calendar dates in India (IST), YYYY-MM-DD. */
  issuedOn: string;
  expiresOn: string;
}

/** Stored status. Expiry is not stored: it follows from `expiresOn` (see certificateState). */
export type CertificateStatus = 'provisional' | 'valid' | 'revoked';
/** What a certificate is today, for display. */
export type CertificateState = 'provisional' | 'valid' | 'expiring' | 'expired' | 'revoked';

export type AnchorStatus = 'not-anchored' | 'pending' | 'anchored' | 'failed';

/** Where the certificate hash is anchored on a public blockchain (Polygon Amoy). */
export interface CertificateAnchor {
  status: AnchorStatus;
  network: string | null;
  txHash: string | null;
  blockNumber: number | null;
  explorerUrl: string | null;
  anchoredAt: string | null;
  error: string | null;
}

export const NOT_ANCHORED: CertificateAnchor = {
  status: 'not-anchored',
  network: null,
  txHash: null,
  blockNumber: null,
  explorerUrl: null,
  anchoredAt: null,
  error: null,
};

/** A certificate as the API returns it. */
export interface Certificate extends CertificatePayload {
  /** SHA-256 of the canonical payload, lowercase hex. */
  hash: string;
  /** Ed25519 signature over the 32 hash bytes, base64url. Null while provisional. */
  signature: string | null;
  /** Which signing key (see SigningKey.keyId). */
  keyId: string | null;
  status: CertificateStatus;
  moduleVersion: number;
  /** The assessment result the certificate was issued for. */
  resultId: string | null;
  /** The phone's provisional id, before the server assigned `id`. */
  provisionalId: string | null;
  revokedAt: string | null;
  revokedReason: string | null;
  anchor: CertificateAnchor;
}

/** Public half of the server's certificate signing key. */
export interface SigningKey {
  keyId: string;
  algorithm: 'Ed25519';
  /** 32-byte public key, lowercase hex. */
  publicKey: string;
}

// ---- Encoding helpers ----------------------------------------------------------------------

export function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function fromBase64Url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/**
 * Canonical JSON: object keys sorted, no whitespace, integers only. The API produces the same
 * bytes (json.dumps(sort_keys=True, separators=(",", ":"), ensure_ascii=False)).
 */
export function canonicalJson(value: Json): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key] as Json)}`).join(',')}}`;
  }
  if (typeof value === 'number' && !Number.isInteger(value)) {
    throw new Error('canonicalJson: only integers are allowed');
  }
  return JSON.stringify(value);
}

export function certificatePayload(certificate: CertificatePayload): CertificatePayload {
  return {
    v: CERT_FORMAT_VERSION,
    id: certificate.id,
    workerId: certificate.workerId,
    workerName: certificate.workerName,
    moduleId: certificate.moduleId,
    score: certificate.score,
    issuedOn: certificate.issuedOn,
    expiresOn: certificate.expiresOn,
  };
}

/** SHA-256 of the canonical payload, lowercase hex. */
export function certificateHash(certificate: CertificatePayload): string {
  const payload = certificatePayload(certificate) as unknown as Json;
  return bytesToHex(sha256(utf8ToBytes(canonicalJson(payload))));
}

/** Short id of a public key: the first 8 hex digits of its SHA-256. */
export function signingKeyId(publicKeyHex: string): string {
  return bytesToHex(sha256(hexToBytes(publicKeyHex))).slice(0, 8);
}

// ---- Dates (India Standard Time) ------------------------------------------------------------

const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The calendar date in India at `ms`, as YYYY-MM-DD. */
export function istDate(ms: number): string {
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/** DD-MM-YYYY, the way dates are written on Indian certificates. */
export function formatCertDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}-${month}-${year}`;
}

export function certificateState(
  certificate: Pick<Certificate, 'status' | 'expiresOn'>,
  now = Date.now(),
  expiringSoonDays = EXPIRING_SOON_DAYS,
): CertificateState {
  if (certificate.status === 'revoked') return 'revoked';
  const today = istDate(now);
  if (today > certificate.expiresOn) return 'expired';
  if (certificate.status === 'provisional') return 'provisional';
  return daysBetween(today, certificate.expiresOn) <= expiringSoonDays ? 'expiring' : 'valid';
}

// ---- QR payload ------------------------------------------------------------------------------

/** What a certificate QR code carries: the payload fields, hash, signature and key id. */
export interface CertificateQr {
  payload: CertificatePayload;
  hash: string;
  signature: string | null;
  keyId: string | null;
}

const QR_SEPARATOR = '~';
const compactDate = (date: string) => date.replace(/-/g, '');
const expandDate = (date: string) =>
  /^\d{8}$/.test(date) ? `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)}` : null;

/**
 * Compact QR text: VERIFY_URL_BASE + `1~id~worker~name~module~score~issued~expires~key~hash~sig`.
 * Dates are YYYYMMDD, the name is URI-encoded, the hash and signature are base64url
 * (`-` for the key and signature of a provisional certificate).
 */
export function encodeCertificateQr(
  certificate: CertificatePayload & Pick<Certificate, 'hash' | 'signature' | 'keyId'>,
): string {
  const fields = [
    String(CERT_FORMAT_VERSION),
    certificate.id,
    certificate.workerId,
    encodeURIComponent(certificate.workerName),
    certificate.moduleId,
    String(certificate.score),
    compactDate(certificate.issuedOn),
    compactDate(certificate.expiresOn),
    certificate.keyId ?? '-',
    toBase64Url(hexToBytes(certificate.hash)),
    certificate.signature ?? '-',
  ];
  return `${VERIFY_URL_BASE}${fields.join(QR_SEPARATOR)}`;
}

/** Reads a certificate QR (the link, or just the part after `#c=`). Null if it is not one. */
export function parseCertificateQr(text: string): CertificateQr | null {
  const trimmed = text.trim();
  const marker = trimmed.indexOf('#c=');
  const body = marker >= 0 ? trimmed.slice(marker + 3) : trimmed;
  // Camera apps sometimes percent-encode the separators.
  const fields = body.replace(/%7E/gi, QR_SEPARATOR).split(QR_SEPARATOR);
  if (fields.length !== 11 || fields[0] !== String(CERT_FORMAT_VERSION)) return null;
  const [, id, workerId, name, moduleId, score, issued, expires, keyId, hash, signature] = fields;
  const issuedOn = expandDate(issued ?? '');
  const expiresOn = expandDate(expires ?? '');
  const scoreNumber = Number(score);
  if (
    id == null ||
    !/^[A-Z0-9-]{3,24}$/.test(id) ||
    workerId == null ||
    !/^\d{5}$/.test(workerId) ||
    moduleId == null ||
    !/^[a-z0-9-]{2,40}$/.test(moduleId) ||
    !Number.isInteger(scoreNumber) ||
    scoreNumber < 0 ||
    scoreNumber > 100 ||
    issuedOn == null ||
    expiresOn == null ||
    hash == null ||
    signature == null ||
    keyId == null
  ) {
    return null;
  }
  let workerName: string;
  let hashHex: string;
  try {
    workerName = decodeURIComponent(name ?? '');
    hashHex = bytesToHex(fromBase64Url(hash));
  } catch {
    return null;
  }
  if (hashHex.length !== 64) return null;
  return {
    payload: {
      v: CERT_FORMAT_VERSION,
      id,
      workerId,
      workerName,
      moduleId,
      score: scoreNumber,
      issuedOn,
      expiresOn,
    },
    hash: hashHex,
    signature: signature === '-' ? null : signature,
    keyId: keyId === '-' ? null : keyId,
  };
}

/** A typed-in certificate id, normalised (e.g. "cert 17" → "CERT-0017"). Null if not an id. */
export function normalizeCertificateId(input: string): string | null {
  const value = input.trim().toUpperCase().replace(/\s+/g, '');
  const cert = /^(?:CERT)?-?(\d{1,6})$/.exec(value);
  if (cert != null) return `CERT-${(cert[1] ?? '').padStart(4, '0')}`;
  if (/^P-[A-Z0-9]{8}$/.test(value)) return value;
  return null;
}

// ---- Verification ----------------------------------------------------------------------------

export type VerificationVerdict =
  | 'valid'
  | 'expired'
  | 'revoked'
  /** Not signed yet: issued offline, waiting for the phone to sync. */
  | 'provisional'
  /** Signed with a key this device does not know (check online). */
  | 'unknown-key'
  /** Tampered with, or not signed by the training authority. */
  | 'invalid';

export interface VerificationChecks {
  /** The hash in the QR matches the certificate details. */
  hashMatches: boolean;
  /** Ed25519 signature checked against a known public key (null when it could not be checked). */
  signatureValid: boolean | null;
  expired: boolean;
  /** Null when no revocation list is available. */
  revoked: boolean | null;
}

export interface Verification {
  verdict: VerificationVerdict;
  payload: CertificatePayload;
  checks: VerificationChecks;
}

/**
 * Verifies a certificate offline: recomputes the hash from the details, checks the Ed25519
 * signature with the known public keys, then expiry and (if a list is given) revocation.
 */
export function verifyCertificateQr(
  qr: CertificateQr,
  keys: readonly SigningKey[],
  options: { now?: number; revokedIds?: ReadonlySet<string> | null } = {},
): Verification {
  const now = options.now ?? Date.now();
  const hashMatches = certificateHash(qr.payload) === qr.hash;
  const expired = istDate(now) > qr.payload.expiresOn;
  const revoked = options.revokedIds == null ? null : options.revokedIds.has(qr.payload.id);
  const result = (verdict: VerificationVerdict, signatureValid: boolean | null): Verification => ({
    verdict,
    payload: qr.payload,
    checks: { hashMatches, signatureValid, expired, revoked },
  });

  if (!hashMatches) return result('invalid', null);
  if (qr.signature == null) return result('provisional', null);
  const key = keys.find((candidate) => candidate.keyId === qr.keyId);
  if (key == null) return result('unknown-key', null);
  let signatureValid: boolean;
  try {
    signatureValid = ed.verify(
      fromBase64Url(qr.signature),
      hexToBytes(qr.hash),
      hexToBytes(key.publicKey),
    );
  } catch {
    signatureValid = false;
  }
  if (!signatureValid) return result('invalid', false);
  if (revoked === true) return result('revoked', true);
  if (expired) return result('expired', true);
  return result('valid', true);
}

/** Verifies a full certificate record (e.g. one stored on this phone). */
export function verifyCertificate(
  certificate: CertificatePayload & Pick<Certificate, 'hash' | 'signature' | 'keyId'>,
  keys: readonly SigningKey[],
  options: { now?: number; revokedIds?: ReadonlySet<string> | null } = {},
): Verification {
  return verifyCertificateQr(
    {
      payload: certificatePayload(certificate),
      hash: certificate.hash,
      signature: certificate.signature,
      keyId: certificate.keyId,
    },
    keys,
    options,
  );
}
