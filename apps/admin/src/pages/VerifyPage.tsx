import { Fingerprint, KeyRound, ShieldCheck, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { VerifyWidget } from '@/components/verify/VerifyWidget';
import { useTrustBundle } from '@/lib/queries';

/** Public: also reachable without signing in (…/verify?id=CERT-0017). */
export function VerifyPage() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const trust = useTrustBundle();
  const initial =
    params.get('id') ?? (window.location.hash.startsWith('#c=') ? window.location.hash : undefined);
  const key = trust.data?.signingKeys[0];

  return (
    <>
      <PageHeader title={t('verify.title')} subtitle={t('verify.subtitle')} />
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <Card className="xl:col-span-7">
          <CardHeader>
            <CardTitle>{t('nav.verify')}</CardTitle>
          </CardHeader>
          <CardContent>
            <VerifyWidget key={initial ?? ''} initial={initial ?? undefined} detailed />
          </CardContent>
        </Card>
        <Card className="xl:col-span-5">
          <CardContent className="flex flex-col gap-4 text-sm">
            {[
              { icon: Fingerprint, text: t('verify.checks.hash') },
              { icon: ShieldCheck, text: t('verify.checks.signature') },
              { icon: WifiOff, text: t('verify.checkedOffline') },
            ].map(({ icon: Icon, text }) => (
              <p key={text} className="flex items-start gap-3">
                <Icon className="mt-0.5 size-4 shrink-0 text-zinc-500" />
                {text}
              </p>
            ))}
            {key != null && (
              <p className="flex items-start gap-3 rounded-md bg-muted px-3 py-2 font-mono text-xs break-all text-muted-foreground">
                <KeyRound className="mt-0.5 size-4 shrink-0" />
                Ed25519 · {key.keyId} · {key.publicKey}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
