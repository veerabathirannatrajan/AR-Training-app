import type { PinVerifier } from './db';

/**
 * Offline PIN verification. A 4-digit PIN has only 10,000 values, so the verifier is not a
 * secret against someone who copies the phone's storage; it stops casual use of another
 * worker's account on a shared phone, and the local lockout limits guessing in the app.
 */
export const PIN_ITERATIONS = 150_000;

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    256,
  );
  return new Uint8Array(bits);
}

export async function createPinVerifier(pin: string): Promise<PinVerifier> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await derive(pin, salt, PIN_ITERATIONS);
  return { salt: toBase64(salt), hash: toBase64(hash), iterations: PIN_ITERATIONS };
}

export async function verifyPin(pin: string, verifier: PinVerifier): Promise<boolean> {
  const actual = await derive(pin, fromBase64(verifier.salt), verifier.iterations);
  const expected = fromBase64(verifier.hash);
  if (actual.length !== expected.length) return false;
  let difference = 0;
  for (let index = 0; index < actual.length; index += 1) {
    difference |= (actual[index] ?? 0) ^ (expected[index] ?? 0);
  }
  return difference === 0;
}
