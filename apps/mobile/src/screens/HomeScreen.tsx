import {
  Award,
  BellRing,
  ChevronRight,
  CircleCheck,
  CircleX,
  CloudOff,
  Download,
  Globe,
  LogOut,
  Menu,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Wifi,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '../app/navigation';
import { useInstallPrompt, useIsStandalone, useOnline, useServiceWorker } from '../app/platform';
import { useSession } from '../app/session';
import { logout } from '../data/auth';
import { currentCertificate, stateOf, useTrust, useWorkerCertificates } from '../data/certificates';
import type { CertificateRecord } from '../data/db';
import { useDueDrills } from '../data/drills';
import { NO_PROGRESS, useModuleProgress, type ModuleProgress } from '../data/progress';
import {
  Button,
  Chip,
  IconButton,
  Notice,
  ProgressBar,
  Sheet,
  type Tone,
} from '../design/components';
import { LowPolyBackdrop } from '../design/LowPolyBackdrop';
import { XR_UI_PROPS } from '../engine/xr/xrUi';
import { useLocalized } from '../i18n/localized';
import { MODULES, type ModuleDefinition } from '../modules/registry';
import { StateIcon } from './certificates/CertificateCard';
import { STATE_TONE } from './certificates/stateTone';
import { SyncChip } from './certificates/SyncChip';
import { LanguageSheet } from './LanguageSheet';
import { SantaliDraftNotice } from './SantaliDraftNotice';

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

const STATUS_TONE: Record<ModuleProgress['status'], Tone> = {
  'not-started': 'neutral',
  'in-progress': 'accent',
  completed: 'ok',
  passed: 'ok',
  failed: 'critical',
};

const STATUS_PROGRESS: Record<ModuleProgress['status'], number> = {
  'not-started': 0,
  'in-progress': 0.15,
  completed: 1,
  passed: 1,
  failed: 0.6,
};

function ModuleCard({
  definition,
  progress,
  recommended,
  certificate,
}: {
  definition: ModuleDefinition;
  progress: ModuleProgress;
  recommended: boolean;
  certificate: CertificateRecord | undefined;
}) {
  const { t } = useTranslation(['home', 'common', 'certificates']);
  const trust = useTrust();
  const certState = certificate != null ? stateOf(certificate, trust) : null;
  const localize = useLocalized();
  const { content, icon: Icon, accent } = definition;
  const title = localize(content.title);
  const summary = localize(content.summary);

  const statusLabel = {
    'not-started': t('status.notStarted'),
    'in-progress': t('status.inProgress'),
    completed: t('status.completed'),
    passed: t('status.passed'),
    failed: t('status.failed'),
  }[progress.status];
  const done = progress.status === 'completed' || progress.status === 'passed';

  return (
    <button
      type="button"
      className="glass module-card"
      onClick={() =>
        useNavigation.getState().navigate({ name: 'module-intro', moduleId: content.id })
      }
      {...XR_UI_PROPS}
    >
      <div className="module-card-head">
        <span className="module-icon" style={{ background: accent }}>
          <Icon size={28} color="#fff" />
        </span>
        <span className="grow stack-1">
          <span className="t-heading" lang={title.lang}>
            {title.text}
          </span>
          <span className="t-small t-muted module-summary" lang={summary.lang}>
            {summary.text}
          </span>
        </span>
      </div>
      <div className="row wrap">
        {recommended && (
          <Chip tone="ok" icon={<Sparkles size={16} />}>
            {t('recommended')}
          </Chip>
        )}
        <Chip tone="accent">{t(`kind.${content.kind}`)}</Chip>
        <Chip>{t('common:minutes', { count: content.estimatedMinutes })}</Chip>
        <Chip
          tone={STATUS_TONE[progress.status]}
          icon={
            done ? (
              <CircleCheck size={16} />
            ) : progress.status === 'failed' ? (
              <CircleX size={16} />
            ) : undefined
          }
        >
          {statusLabel}
        </Chip>
        {certState != null && (
          <Chip tone={STATE_TONE[certState]} icon={<StateIcon state={certState} />}>
            {t(`certificates:chip.${certState}`)}
          </Chip>
        )}
      </div>
      <ProgressBar value={STATUS_PROGRESS[progress.status]} tone={done ? 'ok' : 'accent'} />
      <div className="row-between t-small t-muted">
        <span>
          {content.kind === 'tutorial' ? t('practiceOnly') : ''}
          {progress.bestPercent != null
            ? ` · ${t('bestScore', { score: progress.bestPercent })}`
            : ''}
        </span>
        <span className="t-num">
          {progress.attempts > 0 ? t('attempts', { count: progress.attempts }) : ''}
        </span>
      </div>
      <span className="module-cta">{done ? t('again') : t('start')}</span>
    </button>
  );
}

export function HomeScreen() {
  const { t } = useTranslation(['home', 'common', 'certificates']);
  const worker = useSession((state) => state.worker);
  const progress = useModuleProgress(worker?.workerId ?? null);
  const online = useOnline();
  const serviceWorker = useServiceWorker();
  const install = useInstallPrompt();
  const standalone = useIsStandalone();
  const dueDrills = useDueDrills(worker?.workerId ?? null);
  const certificates = useWorkerCertificates(worker?.workerId ?? null);
  const localize = useLocalized();
  const [sheet, setSheet] = useState<'menu' | 'language' | null>(null);

  if (worker == null) return null;
  const firstName = worker.name.split(' ')[0] ?? worker.name;

  const onLogout = async () => {
    await logout();
    useSession.getState().setWorker(null);
    useNavigation.getState().reset({ name: 'login' });
  };

  return (
    <main className="screen">
      <LowPolyBackdrop />
      <div className="screen-scroll">
        <header className="glass card home-header">
          <span className="avatar" aria-hidden>
            {initials(worker.name)}
          </span>
          <div className="grow">
            <h1 className="t-title">{t('greeting', { name: firstName })}</h1>
            <p className="t-small t-muted">
              {t('workerMeta', { role: worker.role, site: worker.siteName })} ·{' '}
              <span className="t-num">{worker.workerId}</span>
            </p>
          </div>
          <IconButton label={t('menu.open')} onClick={() => setSheet('menu')}>
            <Menu size={22} />
          </IconButton>
        </header>

        <div className="row wrap">
          <Chip
            tone={online ? 'ok' : 'warn'}
            icon={online ? <Wifi size={16} /> : <CloudOff size={16} />}
          >
            {online ? t('common:status.online') : t('common:status.offline')}
          </Chip>
          {serviceWorker.offlineReady && (
            <Chip tone="ok" icon={<ShieldCheck size={16} />}>
              {t('common:status.offlineReady')}
            </Chip>
          )}
          <SyncChip />
        </div>

        {serviceWorker.updateReady && (
          <Notice tone="info" icon={<RefreshCw size={18} />}>
            <div className="row-between">
              <span>{t('common:pwa.updateReady')}</span>
              <Button variant="secondary" onClick={serviceWorker.applyUpdate}>
                {t('common:actions.update')}
              </Button>
            </div>
          </Notice>
        )}
        <SantaliDraftNotice />

        {!standalone && (
          <section className="glass card install-card">
            <span className="install-icon" aria-hidden>
              <Smartphone size={24} />
            </span>
            <div className="grow stack-1">
              <strong>{t('install.title')}</strong>
              <span className="t-small t-muted">
                {install != null ? t('install.body') : t('install.manual')}
              </span>
            </div>
            {install != null && (
              <Button icon={<Download size={18} />} onClick={() => void install()}>
                {t('install.button')}
              </Button>
            )}
          </section>
        )}

        {dueDrills.slice(0, 1).map((drill) => {
          const module = MODULES.find((definition) => definition.content.id === drill.moduleId);
          if (module == null) return null;
          return (
            <section key={drill.id} className="glass card drill-card">
              <span className="drill-icon" aria-hidden>
                <BellRing size={22} />
              </span>
              <div className="grow stack-1">
                <strong>{t('drill.due')}</strong>
                <span className="t-small t-muted">
                  {t('drill.body', { module: localize(module.content.title).text })}
                </span>
              </div>
              <Button
                onClick={() =>
                  useNavigation.getState().navigate({ name: 'drill', drillId: drill.id })
                }
              >
                {t('drill.start')}
              </Button>
            </section>
          );
        })}

        <div className="home-shortcuts">
          <button
            type="button"
            className="glass home-shortcut"
            onClick={() => useNavigation.getState().navigate({ name: 'certificates' })}
            {...XR_UI_PROPS}
          >
            <span className="home-shortcut-icon">
              <Award size={22} />
            </span>
            <span className="grow stack-1">
              <strong>{t('certificates:open')}</strong>
              <span className="t-small t-muted t-num">{certificates?.length ?? 0}</span>
            </span>
            <ChevronRight size={20} className="t-faint" />
          </button>
          <button
            type="button"
            className="glass home-shortcut"
            onClick={() => useNavigation.getState().navigate({ name: 'verify' })}
            {...XR_UI_PROPS}
          >
            <span className="home-shortcut-icon">
              <ScanLine size={22} />
            </span>
            <span className="grow">
              <strong>{t('certificates:verify.open')}</strong>
            </span>
            <ChevronRight size={20} className="t-faint" />
          </button>
        </div>

        <h2 className="t-heading section-title">{t('modulesTitle')}</h2>
        <div className="stack-2">
          {MODULES.map((definition) => {
            const moduleProgress = progress?.get(definition.content.id) ?? NO_PROGRESS;
            return (
              <ModuleCard
                key={definition.content.id}
                definition={definition}
                progress={moduleProgress}
                recommended={
                  definition.content.kind === 'tutorial' && moduleProgress.status !== 'completed'
                }
                certificate={
                  certificates != null
                    ? (currentCertificate(certificates, definition.content.id) ??
                      certificates.find((cert) => cert.moduleId === definition.content.id))
                    : undefined
                }
              />
            );
          })}
        </div>
      </div>

      {sheet === 'menu' && (
        <Sheet title={t('menu.title')} onClose={() => setSheet(null)}>
          <div className="sheet-actions">
            <Button
              variant="secondary"
              block
              icon={<Award size={20} />}
              onClick={() => {
                setSheet(null);
                useNavigation.getState().navigate({ name: 'certificates' });
              }}
            >
              {t('certificates:open')}
            </Button>
            <Button
              variant="secondary"
              block
              icon={<ScanLine size={20} />}
              onClick={() => {
                setSheet(null);
                useNavigation.getState().navigate({ name: 'verify' });
              }}
            >
              {t('certificates:verify.open')}
            </Button>
            <Button
              variant="secondary"
              block
              icon={<Globe size={20} />}
              onClick={() => setSheet('language')}
            >
              {t('common:language.change')}
            </Button>
            {install != null && (
              <Button
                variant="secondary"
                block
                icon={<Download size={20} />}
                onClick={() => void install()}
              >
                {t('common:actions.installApp')}
              </Button>
            )}
            <Button
              variant="danger"
              block
              icon={<LogOut size={20} />}
              onClick={() => void onLogout()}
            >
              {t('common:actions.logout')}
            </Button>
          </div>
        </Sheet>
      )}
      {sheet === 'language' && <LanguageSheet onClose={() => setSheet(null)} />}
    </main>
  );
}
