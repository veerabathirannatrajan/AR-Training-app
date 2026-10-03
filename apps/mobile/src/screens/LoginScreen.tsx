import { LANGUAGES, PIN_LENGTH } from '@ar-training/shared';
import { Delete, Globe, Info, LoaderCircle, ScanLine, UserRound, WifiOff } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '../app/navigation';
import { useOnline } from '../app/platform';
import { useSession } from '../app/session';
import { login, type LoginError } from '../data/auth';
import { AppMark } from '../design/AppMark';
import { Button, ChipButton, Notice } from '../design/components';
import { cx } from '../design/cx';
import { LowPolyBackdrop } from '../design/LowPolyBackdrop';
import { XR_UI_PROPS } from '../engine/xr/xrUi';
import { useLanguage } from '../i18n';
import { SantaliDraftNotice } from './SantaliDraftNotice';

const WORKER_ID_LENGTH = 5;
const SHOW_DEMO_HINT = import.meta.env.VITE_DEMO_MODE !== 'false';

function PinPad({
  onDigit,
  onDelete,
  disabled,
  deleteLabel,
}: {
  onDigit: (digit: string) => void;
  onDelete: () => void;
  disabled: boolean;
  deleteLabel: string;
}) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];
  return (
    <div className="pin-pad" role="group">
      {keys.map((key, index) =>
        key === '' ? (
          <span key={`blank-${index}`} />
        ) : key === 'del' ? (
          <button
            key={key}
            type="button"
            className="pin-key pin-key-action"
            aria-label={deleteLabel}
            onClick={onDelete}
            disabled={disabled}
            {...XR_UI_PROPS}
          >
            <Delete size={26} />
          </button>
        ) : (
          <button
            key={key}
            type="button"
            className="pin-key"
            onClick={() => onDigit(key)}
            disabled={disabled}
            {...XR_UI_PROPS}
          >
            {key}
          </button>
        ),
      )}
    </div>
  );
}

export function LoginScreen() {
  const { t } = useTranslation(['auth', 'certificates']);
  const online = useOnline();
  const lang = useLanguage();
  const [stage, setStage] = useState<'worker-id' | 'pin'>('worker-id');
  const [workerId, setWorkerId] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ code: LoginError; minutes: number } | null>(null);

  const submit = async (id: string, enteredPin: string) => {
    setBusy(true);
    setError(null);
    const outcome = await login(id, enteredPin);
    setBusy(false);
    if (outcome.ok) {
      useSession.getState().setWorker(outcome.worker);
      useNavigation.getState().reset({ name: 'home' });
      return;
    }
    setPin('');
    setError({ code: outcome.error, minutes: Math.ceil((outcome.retryAfterSeconds ?? 0) / 60) });
  };

  // Auto-advance: the 5th ID digit moves on to the PIN; the 4th PIN digit logs in.
  const onDigit = (digit: string) => {
    if (busy) return;
    setError(null);
    if (stage === 'worker-id') {
      const next = (workerId + digit).slice(0, WORKER_ID_LENGTH);
      setWorkerId(next);
      if (next.length === WORKER_ID_LENGTH) setStage('pin');
      return;
    }
    const next = (pin + digit).slice(0, PIN_LENGTH);
    setPin(next);
    if (next.length === PIN_LENGTH) void submit(workerId, next);
  };
  const onDelete = () => {
    if (stage === 'worker-id') setWorkerId((value) => value.slice(0, -1));
    else setPin((value) => value.slice(0, -1));
  };
  const changeWorkerId = () => {
    setStage('worker-id');
    setPin('');
    setError(null);
  };

  return (
    <main className="screen">
      <LowPolyBackdrop />
      <div className="screen-scroll login">
        <div className="row-between">
          <AppMark size={44} />
          <ChipButton
            className="glass"
            icon={<Globe size={18} />}
            onClick={() => useNavigation.getState().navigate({ name: 'language', next: 'back' })}
          >
            <span lang={LANGUAGES[lang].bcp47}>{LANGUAGES[lang].nativeName}</span>
          </ChipButton>
        </div>

        <header className="stack-1">
          <h1 className="t-display">{t('login.title')}</h1>
          <p className="t-muted">{t('login.subtitle')}</p>
        </header>

        <SantaliDraftNotice />
        {!online && (
          <Notice tone="warn" icon={<WifiOff size={18} />}>
            {t('login.offlineNotice')}
          </Notice>
        )}

        <section className="glass card-lg stack-2">
          {stage === 'worker-id' ? (
            <div className="stack-1">
              <span className="t-strong">{t('login.workerId')}</span>
              <div className="digit-boxes" aria-label={t('login.workerId')} aria-live="polite">
                {Array.from({ length: WORKER_ID_LENGTH }, (_, index) => (
                  <span
                    key={index}
                    className={cx('digit-box', index === workerId.length && 'is-next')}
                  >
                    {workerId[index] ?? ''}
                  </span>
                ))}
              </div>
              <span className="t-small t-muted">{t('login.workerIdHint')}</span>
            </div>
          ) : (
            <div className="stack-1">
              <div className="row-between">
                <span className="chip chip-neutral">
                  <UserRound size={16} />
                  <span className="t-num">{workerId}</span>
                </span>
                <button
                  type="button"
                  className="link-button"
                  onClick={changeWorkerId}
                  {...XR_UI_PROPS}
                >
                  {t('login.changeWorkerId')}
                </button>
              </div>
              <span className="t-strong">{t('login.pin')}</span>
              <div className="pin-dots" aria-label={t('login.pinHint')} aria-live="polite">
                {Array.from({ length: PIN_LENGTH }, (_, index) => (
                  <span key={index} className={cx('pin-dot', index < pin.length && 'is-filled')} />
                ))}
              </div>
              <span className="t-small t-muted">{t('login.pinHint')}</span>
            </div>
          )}

          {error != null && (
            <Notice tone="critical">
              {t(`login.errors.${error.code}`, { minutes: error.minutes })}
            </Notice>
          )}
          {busy && (
            <p className="row t-muted" role="status">
              <LoaderCircle size={18} className="spin" />
              {t('login.checking')}
            </p>
          )}

          <PinPad
            onDigit={onDigit}
            onDelete={onDelete}
            disabled={busy}
            deleteLabel={t('pinPad.delete')}
          />

          {stage === 'pin' && pin.length === PIN_LENGTH && error != null && (
            <Button block onClick={() => void submit(workerId, pin)} disabled={busy}>
              {t('login.submit')}
            </Button>
          )}
        </section>

        {SHOW_DEMO_HINT && (
          <p className="row t-small t-muted demo-hint">
            <Info size={16} />
            {t('login.demoHint')}
          </p>
        )}
        <button
          type="button"
          className="link-button row verify-link"
          onClick={() => useNavigation.getState().navigate({ name: 'verify' })}
          {...XR_UI_PROPS}
        >
          <ScanLine size={18} />
          {t('certificates:verify.open')}
        </button>
      </div>
    </main>
  );
}
