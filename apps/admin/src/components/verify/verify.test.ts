import * as ed from '@noble/ed25519';
import { hexToBytes } from '@noble/hashes/utils.js';
import {
  certificateHash,
  encodeCertificateQr,
  NOT_ANCHORED,
  signingKeyId,
  toBase64Url,
  type CertificatePayload,
  type TrustBundle,
  type VerifyResponse,
} from '@ar-training/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyInput } from './verify';

const SEED = new Uint8Array(32).map((_, index) => index + 1);
const PUBLIC_KEY = '79b5562e8fe654f94078b112e8a98ba7901f853ae695bed7e0e3910bad049664';
const TRUST: TrustBundle = {
  signingKeys: [{ keyId: signingKeyId(PUBLIC_KEY), algorithm: 'Ed25519', publicKey: PUBLIC_KEY }],
  revokedCertificateIds: [],
  serverTime: new Date().toISOString(),
};

const PAYLOAD: CertificatePayload = {
  v: 1,
  id: 'CERT-0017',
  workerId: '11003',
  workerName: 'Birsa Murmu',
  moduleId: 'fire-explosion',
  score: 82,
  issuedOn: '2026-10-03',
  expiresOn: '2099-10-03',
};

function signed(payload: CertificatePayload) {
  const hash = certificateHash(payload);
  return {
    ...payload,
    hash,
    signature: toBase64Url(ed.sign(hexToBytes(hash), SEED)),
    keyId: TRUST.signingKeys[0]!.keyId,
  };
}

function serverSays(verdict: VerifyResponse['verdict'], hash: string) {
  const response: VerifyResponse = {
    verdict,
    checks: { hashMatches: true, signatureValid: true, expired: false, revoked: verdict === 'revoked' },
    checkedAt: new Date().toISOString(),
    certificate: {
      ...PAYLOAD,
      hash,
      signature: 'x',
      keyId: TRUST.signingKeys[0]!.keyId,
      status: verdict === 'revoked' ? 'revoked' : 'valid',
      moduleVersion: 1,
      resultId: null,
      provisionalId: null,
      revokedAt: null,
      revokedReason: null,
      anchor: NOT_ANCHORED,
      state: verdict === 'revoked' ? 'revoked' : 'valid',
      siteId: 'DHN',
      siteName: 'Dhanbad Coal Site',
      moduleTitle: { en: 'Fire & Explosion Response', hi: 'आग' },
    },
  };
  return vi.fn(async () => new Response(JSON.stringify(response), { status: 200 }));
}

afterEach(() => vi.unstubAllGlobals());

describe('verifyInput', () => {
  it('verifies a scanned QR offline and confirms it with the server', async () => {
    const certificate = signed(PAYLOAD);
    vi.stubGlobal('fetch', serverSays('valid', certificate.hash));
    const outcome = await verifyInput(encodeCertificateQr(certificate), TRUST);
    expect(outcome).toMatchObject({ verdict: 'valid', serverConfirmed: true });
  });

  it('keeps the offline verdict when the API cannot be reached', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const outcome = await verifyInput(encodeCertificateQr(signed(PAYLOAD)), TRUST);
    expect(outcome).toMatchObject({ verdict: 'valid', serverConfirmed: false });
  });

  it('reports revocation from the server and edited QR details', async () => {
    const certificate = signed(PAYLOAD);
    vi.stubGlobal('fetch', serverSays('revoked', certificate.hash));
    expect(await verifyInput(encodeCertificateQr(certificate), TRUST)).toMatchObject({
      verdict: 'revoked',
    });
    const edited = encodeCertificateQr({ ...certificate, score: 99 });
    expect(await verifyInput(edited, TRUST)).toMatchObject({ verdict: 'invalid' });
  });

  it('flags a validly signed QR that is not the certificate on record', async () => {
    const certificate = signed(PAYLOAD);
    vi.stubGlobal('fetch', serverSays('valid', 'f'.repeat(64)));
    expect(await verifyInput(encodeCertificateQr(certificate), TRUST)).toMatchObject({
      verdict: 'invalid',
      serverConfirmed: true,
    });
  });

  it('looks up typed ids and rejects other input', async () => {
    const fetchMock = serverSays('valid', signed(PAYLOAD).hash);
    vi.stubGlobal('fetch', fetchMock);
    expect(await verifyInput('cert 17', TRUST)).toMatchObject({ verdict: 'valid' });
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain('/api/verify/CERT-0017');
    expect(await verifyInput('hello', TRUST)).toBe('invalid-id');
    expect(await verifyInput('https://example.com/x', TRUST)).toBe('not-certificate');
  });
});
