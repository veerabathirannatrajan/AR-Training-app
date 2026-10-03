import { findModuleContent, formatCertDate } from '@ar-training/shared';
import {
  ArrowLeft,
  CircleCheck,
  CircleHelp,
  CircleX,
  Clock,
  ExternalLink,
  KeyRound,
  ScanLine,
  ShieldCheck,
  ShieldX,
  VideoOff,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '../app/navigation';
import { useOnline } from '../app/platform';
import { getTrust, saveTrust } from '../data/certificates';
import { Button, IconButton, Notice } from '../design/components';
import { cx } from '../design/cx';
import { LowPolyBackdrop } from '../design/LowPolyBackdrop';
import { XR_UI_PROPS } from '../engine/xr/xrUi';
import { useLocalized } from '../i18n/localized';
import { fetchTrustBundle } from '../lib/api';
import { QrScanner, type ScanError } from './certificates/QrScanner';
import {
  verifyId,
  verifyQrText,
  type VerifyFailure,
  type VerifyOutcome,
} from './certificates/verify';

const GOOD = new Set(['valid']);
const WARN = new Set(['provisional', 'unknown-key', 'expired']);

function VerdictIcon({ verdict }: { verdict: VerifyOutcome['verdict'] }) {
  if (verdict === 'valid') return <ShieldCheck size={44} />;
  if (verdict === 'provisional') return <Clock size={44} />;
  if (verdict === 'unknown-key') return <KeyRound size={44} />;
  if (verdict === 'not-found') return <CircleHelp size={44} />;
  return <ShieldX size={44} />;
}

function Check({ ok, label }: { ok: boolean | null; label: string }) {
  return (
    <li className={cx('verify-check', ok === true && 'is-ok', ok === false && 'is-bad')}>
      {ok === true ? (
        <CircleCheck size={18} />
      ) : ok === false ? (
        <CircleX size={18} />
      ) : (
        <CircleHelp size={18} />
      )}
      <span>{label}</span>
    </li>
  );
}

function Result({ outcome }: { outcome: VerifyOutcome }) {
  const { t } = useTranslation('certificates');
  const localize = useLocalized();
  const { verdict, payload, checks } = outcome;
  const module = payload != null ? findModuleContent(payload.moduleId) : undefined;
  const title = module != null ? localize(module.title) : null;
  const tone = GOOD.has(verdict) ? 'is-ok' : WARN.has(verdict) ? 'is-warn' : 'is-bad';

  return (
    <section className={cx('glass card-lg verify-result', tone)} aria-live="polite">
      <div className="verify-verdict">
        <VerdictIcon verdict={verdict} />
        <div>
          <h2 className="t-title">{t(`verify.verdict.${verdict}`)}</h2>
          <p className="t-small">
            {t(`verify.verdictBody.${verdict}`, {
              date: payload != null ? formatCertDate(payload.expiresOn) : '',
            })}
          </p>
        </div>
      </div>
      {payload != null && (
        <dl className="verify-details">
          <div>
            <dt>{t('id')}</dt>
            <dd className="t-num">{payload.id}</dd>
          </div>
          <div>
            <dt>{t('worker')}</dt>
            <dd>
              {payload.workerName} · <span className="t-num">{payload.workerId}</span>
            </dd>
          </div>
          <div>
            <dt>{t('module')}</dt>
            <dd lang={title?.lang}>{title?.text ?? payload.moduleId}</dd>
          </div>
          <div>
            <dt>{t('score')}</dt>
            <dd className="t-num">{payload.score}%</dd>
          </div>
          <div>
            <dt>{t('validity')}</dt>
            <dd className="t-num">
              {formatCertDate(payload.issuedOn)} → {formatCertDate(payload.expiresOn)}
            </dd>
          </div>
        </dl>
      )}
      {checks != null && (
        <ul className="verify-checks">
          <Check ok={checks.hashMatches} label={t('verify.checks.hash')} />
          <Check ok={checks.signatureValid} label={t('verify.checks.signature')} />
          <Check ok={!checks.expired} label={t('verify.checks.expiry')} />
          <Check
            ok={checks.revoked == null ? null : !checks.revoked}
            label={
              checks.revoked == null ? t('verify.revocationUnknown') : t('verify.checks.revocation')
            }
          />
        </ul>
      )}
      <p className="row t-small t-muted">
        {outcome.serverConfirmed ? <Wifi size={16} /> : <WifiOff size={16} />}
        {outcome.serverConfirmed ? t('verify.checkedOnline') : t('verify.checkedOffline')}
      </p>
      {outcome.anchor?.status === 'anchored' && outcome.anchor.explorerUrl != null && (
        <a
          className="verify-anchor"
          href={outcome.anchor.explorerUrl}
          target="_blank"
          rel="noreferrer"
        >
          {t('anchor.anchored')} <ExternalLink size={14} />
        </a>
      )}
    </section>
  );
}

/**
 * Verify a certificate by scanning its QR code (offline: hash + Ed25519 signature with the
 * cached public key) or typing its ID (online). Open to anyone, also before logging in.
 */
export function VerifyScreen({ payload }: { payload?: string }) {
  const { t } = useTranslation(['certificates', 'common']);
  const online = useOnline();
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<ScanError | null>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<VerifyOutcome | null>(null);
  const [failure, setFailure] = useState<VerifyFailure | null>(null);

  // Keep the public key and revocation list fresh whenever we can reach the API.
  useEffect(() => {
    if (!online) return;
    fetchTrustBundle()
      .then((bundle) => saveTrust(bundle.signingKeys, bundle.revokedCertificateIds))
      .catch(() => undefined);
  }, [online]);

  const run = useCallback(async (check: () => Promise<VerifyOutcome | VerifyFailure>) => {
    setBusy(true);
    setFailure(null);
    setOutcome(null);
    try {
      const result = await check();
      if (typeof result === 'string') setFailure(result);
      else setOutcome(result);
    } finally {
      setBusy(false);
    }
  }, []);

  const onScan = useCallback(
    (text: string) => {
      setScanning(false);
      void run(async () => verifyQrText(text, await getTrust(), navigator.onLine));
    },
    [run],
  );

  // A scanned link that opened the app: verify it once the screen is up.
  useEffect(() => {
    if (payload == null) return;
    const timer = window.setTimeout(() => onScan(payload), 0);
    return () => window.clearTimeout(timer);
  }, [payload, onScan]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (typed.trim() === '') return;
    void run(async () => verifyId(typed, await getTrust(), navigator.onLine));
  };

  const failureText: Record<VerifyFailure, string> = {
    'not-certificate': t('verify.notCertificate'),
    'invalid-id': t('verify.invalidId'),
    'needs-online': t('verify.needsOnline'),
  };

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
          <span className={cx('chip', online ? 'chip-ok' : 'chip-warn')}>
            {online ? <Wifi size={16} /> : <WifiOff size={16} />}
            {online ? t('common:status.online') : t('common:status.offline')}
          </span>
        </div>
        <div className="stack-1">
          <h1 className="t-title">{t('verify.title')}</h1>
          <p className="t-muted">{t('verify.intro')}</p>
        </div>

        {scanning ? (
          <section className="glass card-lg stack-2">
            <QrScanner
              onResult={onScan}
              onError={(error) => {
                setScanning(false);
                setScanError(error);
              }}
            />
            <p className="t-small t-muted verify-scan-hint">{t('verify.scanning')}</p>
            <Button
              variant="secondary"
              block
              icon={<VideoOff size={20} />}
              onClick={() => setScanning(false)}
            >
              {t('verify.stopScan')}
            </Button>
          </section>
        ) : (
          <Button
            size="lg"
            block
            icon={<ScanLine size={22} />}
            onClick={() => {
              setScanError(null);
              setOutcome(null);
              setFailure(null);
              setScanning(true);
            }}
          >
            {t('verify.scan')}
          </Button>
        )}
        {scanError != null && (
          <Notice tone="warn">
            {scanError === 'blocked' ? t('verify.cameraBlocked') : t('verify.cameraUnavailable')}
          </Notice>
        )}

        <form className="glass card stack-1" onSubmit={onSubmit} {...XR_UI_PROPS}>
          <label className="t-small t-strong" htmlFor="cert-id">
            {t('verify.orEnter')}
          </label>
          <div className="row">
            <input
              id="cert-id"
              className="text-input grow"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder={t('verify.placeholder')}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
            />
            <Button type="submit" disabled={busy || typed.trim() === ''}>
              {busy ? t('verify.checking') : t('verify.check')}
            </Button>
          </div>
        </form>

        {failure != null && (
          <Notice tone={failure === 'needs-online' ? 'info' : 'warn'}>
            {failureText[failure]}
          </Notice>
        )}
        {outcome != null && <Result outcome={outcome} />}
      </div>
    </main>
  );
}
