import type {
  AnchorStatus,
  AssessmentRow,
  CertificateState,
  CertificationState,
} from '@ar-training/shared';
import { useTranslation } from 'react-i18next';
import { StatusDot, type DotTone } from '@/components/ui/misc';

export function AssessmentStatus({
  row,
}: {
  row: Pick<AssessmentRow, 'passed' | 'certificateId' | 'failReason' | 'attemptType'>;
}) {
  const { t } = useTranslation();
  if (row.passed === true) {
    return (
      <StatusDot tone="green">
        {row.certificateId != null ? t('status.certified') : t('status.passed')}
      </StatusDot>
    );
  }
  if (row.passed === false) {
    return (
      <StatusDot tone="red">
        {row.failReason === 'critical-error' ? t('status.critical') : t('status.retry')}
      </StatusDot>
    );
  }
  return <StatusDot tone="grey">{t('status.completed')}</StatusDot>;
}

const CERT_TONE: Record<CertificateState, DotTone> = {
  provisional: 'amber',
  valid: 'green',
  expiring: 'amber',
  expired: 'grey',
  revoked: 'red',
};

export function CertificateStateDot({ state }: { state: CertificateState }) {
  const { t } = useTranslation();
  return <StatusDot tone={CERT_TONE[state]}>{t(`certState.${state}`)}</StatusDot>;
}

const CERTIFICATION_TONE: Record<CertificationState, DotTone> = {
  certified: 'green',
  partial: 'blue',
  expiring: 'amber',
  'not-certified': 'grey',
};

export function CertificationDot({ state }: { state: CertificationState }) {
  const { t } = useTranslation();
  return <StatusDot tone={CERTIFICATION_TONE[state]}>{t(`certification.${state}`)}</StatusDot>;
}

const ANCHOR_TONE: Record<AnchorStatus, DotTone> = {
  'not-anchored': 'grey',
  pending: 'amber',
  anchored: 'green',
  failed: 'red',
};

export function AnchorDot({ status }: { status: AnchorStatus }) {
  const { t } = useTranslation();
  return <StatusDot tone={ANCHOR_TONE[status]}>{t(`anchor.${status}`)}</StatusDot>;
}
