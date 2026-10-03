import {
  normalizeCertificateId,
  parseCertificateQr,
  verifyCertificate,
  verifyCertificateQr,
  type CertificateAnchor,
  type CertificatePayload,
  type CertificateQr,
  type VerificationChecks,
  type VerificationVerdict,
  type VerifyResponse,
} from '@ar-training/shared';
import type { TrustStore } from '../../data/certificates';
import { db } from '../../data/db';
import { fetchVerification, NetworkError } from '../../lib/api';

export interface VerifyOutcome {
  verdict: VerificationVerdict | 'not-found';
  payload: CertificatePayload | null;
  checks: VerificationChecks | null;
  /** The server confirmed the result (otherwise it was checked offline only). */
  serverConfirmed: boolean;
  /** A revocation list (or the server) was available. */
  revocationKnown: boolean;
  anchor: CertificateAnchor | null;
}

export type VerifyFailure = 'not-certificate' | 'invalid-id' | 'needs-online';

function revokedSet(trust: TrustStore) {
  return trust.updatedAt != null ? new Set(trust.revokedIds) : null;
}

async function serverCheck(id: string): Promise<VerifyResponse | null> {
  try {
    return await fetchVerification(id);
  } catch (error) {
    if (!(error instanceof NetworkError)) console.warn('[verify] server check failed', error);
    return null;
  }
}

function fromServer(response: VerifyResponse): VerifyOutcome {
  const cert = response.certificate;
  return {
    verdict: response.verdict,
    payload:
      cert == null
        ? null
        : {
            v: 1,
            id: cert.id,
            workerId: cert.workerId,
            workerName: cert.workerName,
            moduleId: cert.moduleId,
            score: cert.score,
            issuedOn: cert.issuedOn,
            expiresOn: cert.expiresOn,
          },
    checks: response.checks,
    serverConfirmed: true,
    revocationKnown: true,
    anchor: cert?.anchor ?? null,
  };
}

/**
 * Verifies scanned QR text: offline first (hash + Ed25519 signature + expiry + cached
 * revocations), then, when online, confirms with the server (revocation, matching record).
 */
export async function verifyQrText(
  text: string,
  trust: TrustStore,
  online: boolean,
): Promise<VerifyOutcome | VerifyFailure> {
  const qr = parseCertificateQr(text);
  if (qr == null) return 'not-certificate';
  return combine(qr, trust, online);
}

async function combine(
  qr: CertificateQr,
  trust: TrustStore,
  online: boolean,
): Promise<VerifyOutcome> {
  const offline = verifyCertificateQr(qr, trust.keys, { revokedIds: revokedSet(trust) });
  const outcome: VerifyOutcome = {
    verdict: offline.verdict,
    payload: offline.payload,
    checks: offline.checks,
    serverConfirmed: false,
    revocationKnown: offline.checks.revoked != null,
    anchor: null,
  };
  if (!online || offline.verdict === 'provisional' || offline.verdict === 'invalid') return outcome;

  const response = await serverCheck(qr.payload.id);
  if (response == null || response.verdict === 'not-found' || response.certificate == null) {
    return outcome;
  }
  if (response.certificate.hash !== qr.hash) {
    // Signed, but not the certificate on record (e.g. details changed and re-signed elsewhere).
    return { ...outcome, verdict: 'invalid', serverConfirmed: true };
  }
  return {
    ...fromServer(response),
    payload: offline.payload,
    checks: {
      ...offline.checks,
      signatureValid: offline.checks.signatureValid ?? response.checks?.signatureValid ?? null,
      revoked: response.checks?.revoked ?? offline.checks.revoked,
    },
  };
}

/** Verifies a typed certificate id: this phone's own certificates offline, any id online. */
export async function verifyId(
  input: string,
  trust: TrustStore,
  online: boolean,
): Promise<VerifyOutcome | VerifyFailure> {
  const id = normalizeCertificateId(input);
  if (id == null) return 'invalid-id';
  const local = await db.certificates.get(id);
  if (online) {
    const response = await serverCheck(id);
    if (response != null) return fromServer(response);
  }
  if (local != null) {
    const offline = verifyCertificate(local, trust.keys, { revokedIds: revokedSet(trust) });
    return {
      verdict: offline.verdict,
      payload: offline.payload,
      checks: offline.checks,
      serverConfirmed: false,
      revocationKnown: offline.checks.revoked != null,
      anchor: local.anchor,
    };
  }
  return 'needs-online';
}
