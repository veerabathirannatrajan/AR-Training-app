import {
  CircleCheck,
  CloudOff,
  Download,
  Globe,
  LogOut,
  Menu,
  RefreshCw,
  ShieldCheck,
  Wifi,
} from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '../app/navigation';
import { useInstallPrompt, useOnline, useServiceWorker } from '../app/platform';
import { useSession } from '../app/session';
import { logout } from '../data/auth';
import { NO_PROGRESS, useModuleProgress, type ModuleProgress } from '../data/progress';
import { Button, Chip, IconButton, Notice, ProgressBar, Sheet } from '../design/components';
import { LowPolyBackdrop } from '../design/LowPolyBackdrop';
import { XR_UI_PROPS } from '../engine/xr/xrUi';
import { useLocalized } from '../i18n/localized';
import { MODULES, type ModuleDefinition } from '../modules/registry';
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

function ModuleCard({
  definition,
  progress,
}: {
  definition: ModuleDefinition;
  progress: ModuleProgress;
}) {
  const { t } = useTranslation(['home', 'common']);
  const localize = useLocalized();
  const { content, icon: Icon, accent } = definition;
  const title = localize(content.title);
  const summary = localize(content.summary);

  const statusTone =
    progress.status === 'completed'
      ? 'ok'
      : progress.status === 'in-progress'
        ? 'accent'
        : 'neutral';
  const statusLabel =
    progress.status === 'completed'
      ? t('status.completed')
      : progress.status === 'in-progress'
        ? t('status.inProgress')
        : t('status.notStarted');

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
        <Chip tone="accent">{t(`kind.${content.kind}`)}</Chip>
        <Chip>{t('common:minutes', { count: content.estimatedMinutes })}</Chip>
        <Chip
          tone={statusTone}
          icon={progress.status === 'completed' ? <CircleCheck size={16} /> : undefined}
        >
          {statusLabel}
        </Chip>
      </div>
      <ProgressBar
        value={progress.status === 'completed' ? 1 : progress.status === 'in-progress' ? 0.15 : 0}
        tone={progress.status === 'completed' ? 'ok' : 'accent'}
      />
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
      <span className="module-cta">
        {progress.status === 'completed' ? t('again') : t('start')}
      </span>
    </button>
  );
}

export function HomeScreen() {
  const { t } = useTranslation(['home', 'common']);
  const worker = useSession((state) => state.worker);
  const progress = useModuleProgress(worker?.workerId ?? null);
  const online = useOnline();
  const serviceWorker = useServiceWorker();
  const install = useInstallPrompt();
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

        <h2 className="t-heading section-title">{t('modulesTitle')}</h2>
        <div className="stack-2">
          {MODULES.map((definition) => (
            <ModuleCard
              key={definition.content.id}
              definition={definition}
              progress={progress?.get(definition.content.id) ?? NO_PROGRESS}
            />
          ))}
        </div>
      </div>

      {sheet === 'menu' && (
        <Sheet title={t('menu.title')} onClose={() => setSheet(null)}>
          <div className="sheet-actions">
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
