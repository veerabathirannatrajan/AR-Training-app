import {
  normalizeCertificateId,
  parseCertificateQr,
  verifyCertificateQr,
  type CertificateAnchor,
  type CertificatePayload,
  type TrustBundle,
  type VerificationChecks,
  type VerifyResponse,
} from '@ar-training/shared';
import { NetworkError } from '@/lib/api';
import { fetchVerification } from '@/lib/queries';

export interface VerifyOutcome {
  verdict: VerifyResponse['verdict'];
  payload: CertificatePayload | null;
  checks: VerificationChecks | null;
  /** Confirmed against the server's records (otherwise checked offline from the QR). */
  serverConfirmed: boolean;
  anchor: CertificateAnchor | null;
  moduleTitle: Record<string, string> | null;
}

export type VerifyFailure = 'not-certificate' | 'invalid-id';

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
    anchor: cert?.anchor ?? null,
    moduleTitle: (cert?.moduleTitle as Record<string, string> | undefined) ?? null,
  };
}

async function server(id: string): Promise<VerifyResponse | null> {
  try {
    return await fetchVerification(id);
  } catch (error) {
    if (error instanceof NetworkError) return null;
    throw error;
  }
}

/**
 * Verifies what was typed or scanned: QR text is checked offline first (hash + Ed25519
 * signature with the API's public key), then against the server's record; an ID is looked up.
 */
export async function verifyInput(
  input: string,
  trust: TrustBundle | undefined,
): Promise<VerifyOutcome | VerifyFailure> {
  const qr = parseCertificateQr(input);
  if (qr != null) {
    const offline = verifyCertificateQr(qr, trust?.signingKeys ?? [], {
      revokedIds: trust != null ? new Set(trust.revokedCertificateIds) : null,
    });
    const outcome: VerifyOutcome = {
      verdict: offline.verdict,
      payload: offline.payload,
      checks: offline.checks,
      serverConfirmed: false,
      anchor: null,
      moduleTitle: null,
    };
    if (offline.verdict === 'invalid' || offline.verdict === 'provisional') return outcome;
    const response = await server(qr.payload.id);
    if (response?.certificate == null) return outcome;
    if (response.certificate.hash !== qr.hash) {
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
  if (/^https?:\/\//i.test(input.trim()) || input.includes('~')) return 'not-certificate';
  const id = normalizeCertificateId(input);
  if (id == null) return 'invalid-id';
  const response = await fetchVerification(id);
  return fromServer(response);
}
