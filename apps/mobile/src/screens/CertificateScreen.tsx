import { encodeCertificateQr, findModuleContent } from '@ar-training/shared';
import { ArrowLeft, ExternalLink, Link2, Share2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '../app/navigation';
import { stateOf, useCertificate, useTrust } from '../data/certificates';
import { Button, IconButton, Notice } from '../design/components';
import { LowPolyBackdrop } from '../design/LowPolyBackdrop';
import { useLocalized } from '../i18n/localized';
import { CertificateCard } from './certificates/CertificateCard';
import { SyncChip } from './certificates/SyncChip';

const NOTE_TONE = {
  provisional: 'warn',
  valid: 'ok',
  expiring: 'warn',
  expired: 'critical',
  revoked: 'critical',
} as const;

/** One certificate, full screen, with its QR code for supervisors and inspectors to scan. */
export function CertificateScreen({ certificateId }: { certificateId: string }) {
  const { t } = useTranslation(['certificates', 'common']);
  const localize = useLocalized();
  const certificate = useCertificate(certificateId);
  const trust = useTrust();

  if (certificate === undefined) return null;
  if (certificate === null) {
    // Replaced by the signed certificate after a sync: go back to the list.
    return (
      <main className="screen">
        <LowPolyBackdrop />
        <div className="screen-scroll">
          <IconButton
            label={t('common:actions.back')}
            onClick={() => useNavigation.getState().back()}
          >
            <ArrowLeft size={22} />
          </IconButton>
        </div>
      </main>
    );
  }
  const state = stateOf(certificate, trust);
  const module = findModuleContent(certificate.moduleId);
  const share =
    typeof navigator.share === 'function'
      ? () =>
          void navigator
            .share({
              title: `${certificate.id} · ${module != null ? localize(module.title).text : ''}`,
              text: `${certificate.workerName} · ${certificate.id}`,
              url: encodeCertificateQr(certificate),
            })
            .catch(() => undefined)
      : null;

  return (
    <main className="screen">
      <LowPolyBackdrop />
      <div className="screen-scroll">
        <div className="row-between">
          <IconButton
            label={t('common:actions.back')}
            onClick={() => useNavigation.getState().back()}
          >
            <ArrowLeft size={22} />
          </IconButton>
          <SyncChip />
        </div>
        <CertificateCard certificate={certificate} state={state} />
        <Notice tone={NOTE_TONE[state]}>{t(`note.${state}`)}</Notice>
        {certificate.status !== 'provisional' && (
          <div className="glass card cert-anchor">
            <Link2 size={18} />
            <span className="grow t-small">
              {certificate.anchor.status === 'anchored'
                ? t('anchor.anchored')
                : certificate.anchor.status === 'pending'
                  ? t('anchor.pending')
                  : t('anchor.none')}
            </span>
            {certificate.anchor.explorerUrl != null && (
              <a
                className="cert-anchor-link"
                href={certificate.anchor.explorerUrl}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={16} />
              </a>
            )}
          </div>
        )}
      </div>
      {share != null && (
        <footer className="screen-footer">
          <Button variant="secondary" block icon={<Share2 size={20} />} onClick={share}>
            {t('common:actions.share')}
          </Button>
        </footer>
      )}
    </main>
  );
}
