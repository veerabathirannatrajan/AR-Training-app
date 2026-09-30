import { LANGUAGES } from '@ar-training/shared';
import { Clock, Star, Volume2, VolumeX, Wifi, WifiOff, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useOnline } from '../../app/platform';
import { ChipButton, IconButton, ProgressBar } from '../../design/components';
import { useLanguage } from '../../i18n';
import { useNarratorStore } from '../../voice/narrator';

const SHORT_LANGUAGE_LABEL = { en: 'EN', hi: 'हि', sat: 'ᱥᱟ' } as const;

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function Timer({ startedAt, stopped }: { startedAt: number; stopped: boolean }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (stopped) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [stopped]);
  // startedAt is 0 until the attempt has been created.
  return <span className="t-num">{formatElapsed(startedAt === 0 ? 0 : now - startedAt)}</span>;
}

interface TopBarProps {
  title: string;
  stepCurrent: number;
  stepTotal: number;
  startedAt: number;
  finished: boolean;
  score: number;
  onExit: () => void;
  onVoice: () => void;
  onLanguage: () => void;
}

/** Training top bar: exit, title with step progress, voice; timer, score, language, offline. */
export function TopBar({
  title,
  stepCurrent,
  stepTotal,
  startedAt,
  finished,
  score,
  onExit,
  onVoice,
  onLanguage,
}: TopBarProps) {
  const { t } = useTranslation(['training', 'common']);
  const online = useOnline();
  const lang = useLanguage();
  const speaking = useNarratorStore((state) => state.speaking);
  const muted = useNarratorStore((state) => state.muted);

  return (
    <header className="top-bar">
      <div className="top-bar-row">
        <IconButton label={t('topBar.exit')} onClick={onExit}>
          <X size={22} />
        </IconButton>
        <div className="glass title-pill grow">
          <div className="row-between">
            <span className="t-strong title-pill-text">{title}</span>
            <span className="t-small t-muted t-num">
              {t('topBar.step', { current: stepCurrent, total: stepTotal })}
            </span>
          </div>
          <ProgressBar
            value={stepTotal === 0 ? 0 : (stepCurrent - (finished ? 0 : 1)) / stepTotal}
          />
        </div>
        <IconButton
          label={t('common:voice.replay')}
          onClick={onVoice}
          active={speaking}
          className={speaking ? 'is-speaking' : undefined}
        >
          {muted ? <VolumeX size={22} /> : <Volume2 size={22} />}
        </IconButton>
      </div>
      <div className="top-bar-row">
        <span className="chip glass" aria-label={t('topBar.elapsed')}>
          <Clock size={16} />
          <Timer startedAt={startedAt} stopped={finished} />
        </span>
        <span className="chip glass">
          <Star size={16} className="icon-score" />
          <span className="t-num">{t('topBar.points', { score })}</span>
        </span>
        <span className="grow" />
        <ChipButton className="glass" onClick={onLanguage} aria-label={t('common:language.change')}>
          <span lang={LANGUAGES[lang].bcp47}>{SHORT_LANGUAGE_LABEL[lang]}</span>
        </ChipButton>
        <span className={online ? 'chip glass' : 'chip chip-warn glass'}>
          {online ? <Wifi size={16} /> : <WifiOff size={16} />}
          {online ? t('common:status.online') : t('common:status.offline')}
        </span>
      </div>
    </header>
  );
}
