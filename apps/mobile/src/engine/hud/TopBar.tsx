import { LANGUAGE_CODES, LANGUAGES } from '@ar-training/shared';
import { CloudOff, Wifi, type LucideIcon } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useOnline } from '../../app/platform';
import { cx } from '../../design/cx';
import { setLanguage, useLanguage } from '../../i18n';
import { useNarratorStore } from '../../voice/narrator';
import { XR_UI_PROPS } from '../xr/xrUi';

const SHORT_LANGUAGE_LABEL = { en: 'EN', hi: 'हि', sat: 'ᱥ' } as const;

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function Timer({ startedAt, stopped }: { startedAt: number; stopped: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (stopped) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [stopped]);
  // startedAt is 0 until the attempt has been created.
  return <>{formatElapsed(startedAt === 0 ? 0 : now - startedAt)}</>;
}

export function VoiceButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const speaking = useNarratorStore((state) => state.speaking);
  const muted = useNarratorStore((state) => state.muted);
  return (
    <button
      type="button"
      className={cx('hud-round hud-glass', speaking && 'is-speaking', muted && 'is-muted')}
      aria-label={t('voice.replay')}
      onClick={onPress}
      {...XR_UI_PROPS}
    >
      <span className="voice-bars" aria-hidden>
        <i />
        <i />
        <i />
        <i />
      </span>
    </button>
  );
}

interface TopBarProps {
  icon: LucideIcon;
  title: string;
  groupCurrent: number;
  groupTotal: number;
  progress: number;
  startedAt: number;
  finished: boolean;
  score: number;
  onVoice: () => void;
  onPause: () => void;
  /** The instruction card, placed beside the status column. */
  children?: ReactNode;
}

/**
 * Training top bar (matches the module mock-ups): voice guidance, timer, module title with
 * step progress (tap for the pause menu) and language switch; online state and score below.
 */
export function TopBar({
  icon: Icon,
  title,
  groupCurrent,
  groupTotal,
  progress,
  startedAt,
  finished,
  score,
  onVoice,
  onPause,
  children,
}: TopBarProps) {
  const { t } = useTranslation(['training', 'common']);
  const online = useOnline();
  const lang = useLanguage();

  return (
    <header className="hud-top">
      <div className="hud-row">
        <VoiceButton onPress={onVoice} />
        <span className="hud-pill hud-glass" aria-label={t('topBar.elapsed')}>
          <Timer startedAt={startedAt} stopped={finished} />
        </span>
        <button
          type="button"
          className="hud-title hud-glass"
          onClick={onPause}
          aria-label={t('topBar.pause')}
          {...XR_UI_PROPS}
        >
          <span className="hud-title-line">
            <Icon size={15} />
            <span>{title}</span>
          </span>
          <span className="hud-title-sub">
            {t('topBar.stepOf', { current: groupCurrent, total: groupTotal })}
          </span>
          <span className="hud-progress" aria-hidden>
            <i style={{ width: `${Math.round(progress * 100)}%` }} />
          </span>
        </button>
        <div
          className="lang-switch hud-glass"
          role="group"
          aria-label={t('common:language.label')}
          {...XR_UI_PROPS}
        >
          {LANGUAGE_CODES.map((code) => (
            <button
              key={code}
              type="button"
              lang={LANGUAGES[code].bcp47}
              className={cx(code === lang && 'is-active')}
              aria-pressed={code === lang}
              onClick={() => void setLanguage(code)}
            >
              {SHORT_LANGUAGE_LABEL[code]}
            </button>
          ))}
        </div>
      </div>
      <div className="hud-row hud-row-2">
        {children}
        <div className="hud-side">
          <span className={cx('hud-pill hud-glass hud-status', !online && 'is-offline')}>
            {online ? <Wifi size={14} /> : <CloudOff size={14} />}
            {online ? t('common:status.online') : t('common:status.offline')}
          </span>
          <span className="hud-score hud-glass">
            {t('topBar.score')} <b>{score}</b>
          </span>
        </div>
      </div>
    </header>
  );
}
