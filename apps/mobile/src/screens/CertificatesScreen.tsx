import { findModuleContent, formatCertDate } from '@ar-training/shared';
import { ArrowLeft, ChevronRight, ScanLine, ShieldCheck } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '../app/navigation';
import { useSession } from '../app/session';
import { stateOf, useTrust, useWorkerCertificates } from '../data/certificates';
import { Button, Chip, IconButton } from '../design/components';
import { LowPolyBackdrop } from '../design/LowPolyBackdrop';
import { XR_UI_PROPS } from '../engine/xr/xrUi';
import { useLocalized } from '../i18n/localized';
import { findModule } from '../modules/registry';
import { StateIcon } from './certificates/CertificateCard';
import { STATE_TONE } from './certificates/stateTone';
import { SyncChip } from './certificates/SyncChip';

/** The worker's certificates on this phone (provisional ones included). */
export function CertificatesScreen() {
  const { t } = useTranslation(['certificates', 'common']);
  const localize = useLocalized();
  const worker = useSession((state) => state.worker);
  const certificates = useWorkerCertificates(worker?.workerId ?? null);
  const trust = useTrust();
  const { navigate, back } = useNavigation.getState();

  return (
    <main className="screen">
      <LowPolyBackdrop />
      <div className="screen-scroll">
        <div className="row-between">
          <IconButton label={t('common:actions.back')} onClick={() => back()}>
            <ArrowLeft size={22} />
          </IconButton>
          <SyncChip />
        </div>
        <h1 className="t-title">{t('title')}</h1>

        {certificates != null && certificates.length === 0 && (
          <section className="glass card-lg cert-empty">
            <ShieldCheck size={40} className="icon-accent" />
            <p className="t-muted">{t('empty')}</p>
          </section>
        )}

        <ul className="stack-2">
          {certificates?.map((certificate) => {
            const definition = findModule(certificate.moduleId);
            const content = definition?.content ?? findModuleContent(certificate.moduleId);
            const title = content != null ? localize(content.title) : null;
            const state = stateOf(certificate, trust);
            const Icon = definition?.icon ?? ShieldCheck;
            return (
              <li key={certificate.id}>
                <button
                  type="button"
                  className="glass cert-row"
                  onClick={() => navigate({ name: 'certificate', certificateId: certificate.id })}
                  {...XR_UI_PROPS}
                >
                  <span
                    className="module-icon"
                    style={{ background: definition?.accent ?? '#475467' }}
                  >
                    <Icon size={26} color="#fff" />
                  </span>
                  <span className="grow stack-1">
                    <span className="t-heading" lang={title?.lang}>
                      {title?.text ?? certificate.moduleId}
                    </span>
                    <span className="t-small t-muted t-num">
                      {certificate.id} ·{' '}
                      {t('validUntilDate', { date: formatCertDate(certificate.expiresOn) })}
                    </span>
                    <span>
                      <Chip tone={STATE_TONE[state]} icon={<StateIcon state={state} />}>
                        {t(`state.${state}`)} · {certificate.score}%
                      </Chip>
                    </span>
                  </span>
                  <ChevronRight size={22} className="t-faint" />
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <footer className="screen-footer">
        <Button
          variant="secondary"
          block
          icon={<ScanLine size={20} />}
          onClick={() => navigate({ name: 'verify' })}
        >
          {t('verify.open')}
        </Button>
      </footer>
    </main>
  );
}
