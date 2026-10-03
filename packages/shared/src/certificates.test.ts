import * as ed from '@noble/ed25519';
import { hexToBytes } from '@noble/hashes/utils.js';
import { describe, expect, it } from 'vitest';
import {
  addDays,
  canonicalJson,
  certificateHash,
  certificateState,
  encodeCertificateQr,
  istDate,
  normalizeCertificateId,
  parseCertificateQr,
  signingKeyId,
  toBase64Url,
  verifyCertificateQr,
  type CertificatePayload,
  type SigningKey,
} from './certificates';

// Fixed test key (seed bytes 1..32). The API test suite uses the same vector, which proves
// Python and TypeScript hash and sign certificates identically.
const SEED = new Uint8Array(32).map((_, index) => index + 1);
const PUBLIC_KEY = '79b5562e8fe654f94078b112e8a98ba7901f853ae695bed7e0e3910bad049664';
const KEY: SigningKey = {
  keyId: signingKeyId(PUBLIC_KEY),
  algorithm: 'Ed25519',
  publicKey: PUBLIC_KEY,
};

const PAYLOAD: CertificatePayload = {
  v: 1,
  id: 'CERT-0017',
  workerId: '11003',
  workerName: 'Birsa Murmu',
  moduleId: 'fire-explosion',
  score: 82,
  issuedOn: '2026-10-03',
  expiresOn: '2027-10-03',
};
const EXPECTED_CANONICAL =
  '{"expiresOn":"2027-10-03","id":"CERT-0017","issuedOn":"2026-10-03","moduleId":"fire-explosion","score":82,"v":1,"workerId":"11003","workerName":"Birsa Murmu"}';
const EXPECTED_HASH = '32455bf8b978ae86e923a9e64aa6bb7e5c3c1d4bb8e916611e76b1bfc1cc77c4';

function sign(payload: CertificatePayload) {
  const hash = certificateHash(payload);
  const signature = toBase64Url(ed.sign(hexToBytes(hash), SEED));
  return { ...payload, hash, signature, keyId: KEY.keyId };
}

const NOW = Date.parse('2026-12-01T06:00:00Z');

describe('canonical form', () => {
  it('sorts keys and drops whitespace', () => {
    expect(canonicalJson({ b: 1, a: { d: 'x', c: [1, 'ü'] } })).toBe(
      '{"a":{"c":[1,"ü"],"d":"x"},"b":1}',
    );
    expect(canonicalJson(PAYLOAD as never)).toBe(EXPECTED_CANONICAL);
  });

  it('rejects fractional numbers', () => {
    expect(() => canonicalJson({ score: 82.5 })).toThrow();
  });

  it('hashes the payload with SHA-256', () => {
    const hash = certificateHash(PAYLOAD);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    // Extra fields (status, anchor…) are not part of the signed payload.
    expect(certificateHash({ ...PAYLOAD, status: 'valid' } as CertificatePayload)).toBe(hash);
    expect(hash).toBe(EXPECTED_HASH);
  });
});

describe('QR payload', () => {
  it('round-trips a signed certificate', () => {
    const certificate = sign(PAYLOAD);
    const text = encodeCertificateQr(certificate);
    expect(text.startsWith('https://')).toBe(true);
    expect(text.length).toBeLessThan(300);
    const parsed = parseCertificateQr(text);
    expect(parsed).toEqual({
      payload: PAYLOAD,
      hash: certificate.hash,
      signature: certificate.signature,
      keyId: KEY.keyId,
    });
  });

  it('accepts percent-encoded separators and the bare fragment', () => {
    const text = encodeCertificateQr(sign(PAYLOAD));
    const fragment = text.slice(text.indexOf('#c=') + 3);
    expect(parseCertificateQr(fragment)).not.toBeNull();
    expect(parseCertificateQr(text.replace(/~/g, '%7E'))).not.toBeNull();
  });

  it('keeps names with spaces and Devanagari', () => {
    const payload = { ...PAYLOAD, workerName: 'सुनीता देवी' };
    expect(parseCertificateQr(encodeCertificateQr(sign(payload)))?.payload.workerName).toBe(
      'सुनीता देवी',
    );
  });

  it('rejects other QR codes', () => {
    expect(parseCertificateQr('https://example.com')).toBeNull();
    expect(parseCertificateQr('WIFI:S:mine;T:WPA;P:secret;;')).toBeNull();
    expect(parseCertificateQr('1~CERT-1~abc~x~m~82~20261003~20271003~k~h~s')).toBeNull();
  });
});

describe('verification', () => {
  it('accepts a genuine certificate', () => {
    const qr = parseCertificateQr(encodeCertificateQr(sign(PAYLOAD)));
    expect(qr).not.toBeNull();
    const result = verifyCertificateQr(qr!, [KEY], { now: NOW, revokedIds: new Set() });
    expect(result.verdict).toBe('valid');
    expect(result.checks).toEqual({
      hashMatches: true,
      signatureValid: true,
      expired: false,
      revoked: false,
    });
  });

  it('detects edited details', () => {
    const certificate = sign(PAYLOAD);
    const forged = encodeCertificateQr({ ...certificate, score: 99 });
    expect(verifyCertificateQr(parseCertificateQr(forged)!, [KEY], { now: NOW }).verdict).toBe(
      'invalid',
    );
  });

  it('detects a re-hashed forgery without the signing key', () => {
    const forgedPayload = { ...PAYLOAD, score: 99 };
    const forged = {
      ...forgedPayload,
      hash: certificateHash(forgedPayload),
      signature: sign(PAYLOAD).signature,
      keyId: KEY.keyId,
    };
    const result = verifyCertificateQr(parseCertificateQr(encodeCertificateQr(forged))!, [KEY], {
      now: NOW,
    });
    expect(result.verdict).toBe('invalid');
    expect(result.checks.signatureValid).toBe(false);
  });

  it('reports revoked, expired, provisional and unknown keys', () => {
    const qr = parseCertificateQr(encodeCertificateQr(sign(PAYLOAD)))!;
    expect(
      verifyCertificateQr(qr, [KEY], { now: NOW, revokedIds: new Set(['CERT-0017']) }).verdict,
    ).toBe('revoked');
    expect(
      verifyCertificateQr(qr, [KEY], { now: Date.parse('2027-10-04T12:00:00Z') }).verdict,
    ).toBe('expired');
    expect(verifyCertificateQr(qr, [], { now: NOW }).verdict).toBe('unknown-key');
    const provisional = { ...PAYLOAD, id: 'P-7K2QX9MD' };
    const unsigned = {
      ...provisional,
      hash: certificateHash(provisional),
      signature: null,
      keyId: null,
    };
    expect(
      verifyCertificateQr(parseCertificateQr(encodeCertificateQr(unsigned))!, [KEY], { now: NOW })
        .verdict,
    ).toBe('provisional');
  });
});

describe('dates and ids', () => {
  it('uses the date in India', () => {
    // 20:00 UTC is 01:30 the next day in IST.
    expect(istDate(Date.parse('2026-10-03T20:00:00Z'))).toBe('2026-10-04');
    expect(addDays('2026-10-03', 365)).toBe('2027-10-03');
  });

  it('derives the state shown to people', () => {
    const base = { status: 'valid' as const, expiresOn: '2027-01-15' };
    expect(certificateState(base, Date.parse('2026-10-03T06:00:00Z'))).toBe('valid');
    expect(certificateState(base, Date.parse('2027-01-01T06:00:00Z'))).toBe('expiring');
    expect(certificateState(base, Date.parse('2027-01-16T06:00:00Z'))).toBe('expired');
    expect(certificateState({ ...base, status: 'revoked' }, NOW)).toBe('revoked');
    expect(certificateState({ ...base, status: 'provisional' }, NOW)).toBe('provisional');
  });

  it('normalises typed certificate ids', () => {
    expect(normalizeCertificateId('cert-0017')).toBe('CERT-0017');
    expect(normalizeCertificateId(' 17 ')).toBe('CERT-0017');
    expect(normalizeCertificateId('CERT 12')).toBe('CERT-0012');
    expect(normalizeCertificateId('p-7k2qx9md')).toBe('P-7K2QX9MD');
    expect(normalizeCertificateId('hello')).toBeNull();
  });
});
