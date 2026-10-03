import { findModuleContent } from '@ar-training/shared';
import {
  CircleCheck,
  CircleHelp,
  CircleX,
  ExternalLink,
  ImageUp,
  Loader2,
  QrCode,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/misc';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/overlays';
import { useText } from '@/i18n';
import { useTrustBundle } from '@/lib/queries';
import { cn, formatDate, shortHash } from '@/lib/utils';
import { decodeQrImage, QrScanner, type ScanError } from './QrScanner';
import { verifyInput, type VerifyFailure, type VerifyOutcome } from './verify';

const TONE: Record<VerifyOutcome['verdict'], 'ok' | 'warn' | 'bad'> = {
  valid: 'ok',
  expired: 'warn',
  provisional: 'warn',
  'unknown-key': 'warn',
  revoked: 'bad',
  invalid: 'bad',
  'not-found': 'bad',
};

function Check({ ok, label }: { ok: boolean | null; label: string }) {
  return (
    <li className="flex items-center gap-2">
      {ok === true ? (
        <CircleCheck className="size-3.5 text-green-600" />
      ) : ok === false ? (
        <CircleX className="size-3.5 text-red-600" />
      ) : (
        <CircleHelp className="size-3.5 text-zinc-400" />
      )}
      {label}
    </li>
  );
}

export function VerifyResult({ outcome, detailed }: { outcome: VerifyOutcome; detailed: boolean }) {
  const { t } = useTranslation();
  const text = useText();
  const { payload, checks, anchor } = outcome;
  const tone = TONE[outcome.verdict];
  const moduleTitle =
    outcome.moduleTitle ?? (payload != null ? findModuleContent(payload.moduleId)?.title : null);
  return (
    <div
      className={cn(
        'rounded-lg border p-4 text-sm',
        tone === 'ok' && 'border-green-200 bg-green-50/70',
        tone === 'warn' && 'border-amber-200 bg-amber-50/70',
        tone === 'bad' && 'border-red-200 bg-red-50/70',
      )}
      aria-live="polite"
    >
      <p className="flex items-center gap-2 text-base font-semibold">
        <span
          className={cn(
            'size-3 rounded-full',
            tone === 'ok' && 'bg-green-600',
            tone === 'warn' && 'bg-amber-500',
            tone === 'bad' && 'bg-red-600',
          )}
        />
        {t(`verify.verdict.${outcome.verdict}`)}
      </p>
      {payload != null && (
        <div className="mt-2 space-y-1 text-zinc-700">
          <p>
            {payload.id} · {payload.workerName} ·{' '}
            {moduleTitle != null ? text(moduleTitle) : payload.moduleId}
          </p>
          <p>
            {outcome.verdict === 'expired'
              ? t('verify.expiredOn', { date: formatDate(payload.expiresOn) })
              : t('verify.validTill', { date: formatDate(payload.expiresOn) })}
            {' · '}
            {payload.score}%
          </p>
          {anchor?.status === 'anchored' && anchor.explorerUrl != null ? (
            <a
              href={anchor.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-blue-700 underline underline-offset-2"
            >
              {t('verify.txLink', { tx: shortHash(anchor.txHash) })}
              <ExternalLink className="size-3.5" />
            </a>
          ) : (
            outcome.serverConfirmed && (
              <p className="text-muted-foreground">{t('verify.notAnchored')}</p>
            )
          )}
        </div>
      )}
      {detailed && checks != null && (
        <ul className="mt-3 space-y-1 border-t pt-3 text-xs text-zinc-700">
          <Check ok={checks.hashMatches} label={t('verify.checks.hash')} />
          <Check ok={checks.signatureValid} label={t('verify.checks.signature')} />
          <Check ok={!checks.expired} label={t('verify.checks.expiry')} />
          <Check
            ok={checks.revoked == null ? null : !checks.revoked}
            label={t('verify.checks.revocation')}
          />
          <li className="pt-1 text-muted-foreground">
            {outcome.serverConfirmed ? t('verify.checkedOnline') : t('verify.checkedOffline')}
          </li>
        </ul>
      )}
    </div>
  );
}

/** "Enter certificate ID or scan QR" + Verify + Scan QR, with the verdict below. */
export function VerifyWidget({
  initial,
  detailed = false,
}: {
  initial?: string | undefined;
  detailed?: boolean;
}) {
  const { t } = useTranslation();
  const trust = useTrustBundle();
  const [value, setValue] = useState(initial ?? '');
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<VerifyOutcome | null>(null);
  const [failure, setFailure] = useState<VerifyFailure | ScanError | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [scanning, setScanning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = useCallback(
    async (input: string) => {
      if (input.trim() === '') return;
      setBusy(true);
      setFailure(null);
      setError(null);
      setOutcome(null);
      try {
        const result = await verifyInput(input, trust.data);
        if (typeof result === 'string') setFailure(result);
        else setOutcome(result);
      } catch (caught) {
        setError(caught);
      } finally {
        setBusy(false);
      }
    },
    [trust.data],
  );

  useEffect(() => {
    if (initial == null || initial === '') return;
    const timer = window.setTimeout(() => void run(initial), 0);
    return () => window.clearTimeout(timer);
    // Only for the value the page was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial]);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void run(value);
  };

  const onScanned = (text: string) => {
    setScanning(false);
    setValue(text);
    void run(text);
  };

  const onFile = async (file: File | undefined) => {
    if (file == null) return;
    const text = await decodeQrImage(file).catch(() => null);
    if (text == null) {
      setFailure('not-certificate');
      return;
    }
    onScanned(text);
  };

  const failureText: Record<VerifyFailure | ScanError, string> = {
    'not-certificate': t('verify.notCertificate'),
    'invalid-id': t('verify.invalidId'),
    blocked: t('verify.cameraBlocked'),
    unavailable: t('verify.cameraUnavailable'),
  };

  return (
    <div className="flex flex-col gap-3">
      <form onSubmit={onSubmit} className="flex flex-wrap gap-2">
        <Input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder={t('verify.placeholder')}
          className="h-10 min-w-[140px] flex-1"
          spellCheck={false}
          autoComplete="off"
          aria-label={t('verify.placeholder')}
        />
        <Button type="submit" className="h-10" disabled={busy || value.trim() === ''}>
          {busy && <Loader2 className="animate-spin" />}
          {t('actions.verify')}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-10"
          onClick={() => {
            setFailure(null);
            setScanning(true);
          }}
        >
          <QrCode /> {t('actions.scanQr')}
        </Button>
        {detailed && (
          <>
            <Button
              type="button"
              variant="outline"
              className="h-10"
              onClick={() => fileRef.current?.click()}
              title={t('verify.pasteHint')}
            >
              <ImageUp />
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                void onFile(event.target.files?.[0]);
                event.target.value = '';
              }}
            />
          </>
        )}
      </form>
      {detailed && <p className="text-xs text-muted-foreground">{t('verify.pasteHint')}</p>}
      {failure != null && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {failureText[failure]}
        </p>
      )}
      {error != null && <ErrorState error={error} />}
      {outcome != null && <VerifyResult outcome={outcome} detailed={detailed} />}

      <Dialog open={scanning} onOpenChange={setScanning}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('verify.scanTitle')}</DialogTitle>
            <DialogDescription>{t('verify.scanHint')}</DialogDescription>
          </DialogHeader>
          {scanning && (
            <QrScanner
              onResult={onScanned}
              onError={(scanError) => {
                setScanning(false);
                setFailure(scanError);
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
