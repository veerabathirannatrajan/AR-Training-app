import {
  CloudOff,
  CloudUpload,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
  UserRound,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useOnline } from '../../app/platform';
import { useSession } from '../../app/session';
import { requestSync, usePendingCount, useSyncStore } from '../../data/sync';
import { ChipButton, type Tone } from '../../design/components';

/** Sync status for the logged-in worker; tap to sync now. */
export function SyncChip() {
  const { t } = useTranslation('certificates');
  const online = useOnline();
  const phase = useSyncStore((state) => state.phase);
  const worker = useSession((state) => state.worker);
  const pending = usePendingCount(worker?.workerId ?? null);

  let tone: Tone = 'ok';
  let icon = <CloudUpload size={16} />;
  let label = t('sync.synced');
  if (phase === 'syncing') {
    tone = 'accent';
    icon = <LoaderCircle size={16} className="spin" />;
    label = t('sync.syncing');
  } else if (!online) {
    tone = pending > 0 ? 'warn' : 'neutral';
    icon = <CloudOff size={16} />;
    label = pending > 0 ? t('sync.pending', { count: pending }) : t('sync.offline');
  } else if (phase === 'needs-login' && pending > 0) {
    tone = 'warn';
    icon = <UserRound size={16} />;
    label = t('sync.needsLogin');
  } else if (phase === 'error' || (phase === 'offline' && pending > 0)) {
    tone = 'warn';
    icon = <TriangleAlert size={16} />;
    label = t('sync.error');
  } else if (pending > 0) {
    tone = 'warn';
    icon = <RefreshCw size={16} />;
    label = t('sync.pending', { count: pending });
  }

  return (
    <ChipButton
      tone={tone}
      icon={icon}
      title={t('sync.tap')}
      onClick={() => void requestSync({ pull: true, retryNow: true })}
    >
      {label}
    </ChipButton>
  );
}
