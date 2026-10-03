import type { CertificateState } from '@ar-training/shared';
import type { Tone } from '../../design/components';

/** Chip colour for each certificate state. */
export const STATE_TONE: Record<CertificateState, Tone> = {
  provisional: 'warn',
  valid: 'ok',
  expiring: 'warn',
  expired: 'critical',
  revoked: 'critical',
};
