import {
  encodeCertificateQr,
  findModuleContent,
  formatCertDate,
  type CertificateState,
} from '@ar-training/shared';
import { Award, Clock, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { CertificateRecord } from '../../data/db';
import { Chip } from '../../design/components';
import { cx } from '../../design/cx';
import { QrCode } from '../../design/QrCode';
import { useLocalized } from '../../i18n/localized';
import { STATE_TONE } from './stateTone';

export function StateIcon({ state, size = 16 }: { state: CertificateState; size?: number }) {
  if (state === 'valid') return <ShieldCheck size={size} />;
  if (state === 'provisional') return <Clock size={size} />;
  if (state === 'expiring') return <ShieldAlert size={size} />;
  return <ShieldX size={size} />;
}

/** The certificate as the worker shows it: details, status and the verification QR code. */
export function CertificateCard({
  certificate,
  state,
}: {
  certificate: CertificateRecord;
  state: CertificateState;
}) {
  const { t } = useTranslation('certificates');
  const localize = useLocalized();
  const module = findModuleContent(certificate.moduleId);
  const title = module != null ? localize(module.title) : null;
  const qrText = encodeCertificateQr(certificate);

  return (
    <article className={cx('cert-card', `is-${state}`)}>
      <header className="cert-card-head">
        <span className="cert-seal" aria-hidden>
          <Award size={22} />
        </span>
        <span className="cert-brand">AR Mining Training</span>
        <Chip tone={STATE_TONE[state]} icon={<StateIcon state={state} />}>
          {t(`state.${state}`)}
        </Chip>
      </header>
      <h2 className="cert-title">{t('heading')}</h2>
      <p className="t-small t-muted">{t('certifies')}</p>
      <p className="cert-name">{certificate.workerName}</p>
      <p className="t-small t-muted">
        {t('workerId')} <span className="t-num">{certificate.workerId}</span>
      </p>
      <p className="t-small t-muted">{t('passed')}</p>
      <p className="cert-module" lang={title?.lang}>
        {title?.text ?? certificate.moduleId}
      </p>
      <dl className="cert-facts">
        <div>
          <dt>{t('score')}</dt>
          <dd className="t-num">{certificate.score}%</dd>
        </div>
        <div>
          <dt>{t('issued')}</dt>
          <dd className="t-num">{formatCertDate(certificate.issuedOn)}</dd>
        </div>
        <div>
          <dt>{t('validUntil')}</dt>
          <dd className="t-num">{formatCertDate(certificate.expiresOn)}</dd>
        </div>
      </dl>
      <QrCode text={qrText} label={t('scanHint')} className="cert-qr" />
      <p className="cert-id">
        <span className="t-caption t-muted">{t('scanHint')}</span>
        <strong className="t-num">{certificate.id}</strong>
      </p>
    </article>
  );
}
