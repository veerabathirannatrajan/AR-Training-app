import { Loader2, Server, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { LanguageToggle } from '@/components/layout/PageHeader';
import { ErrorState } from '@/components/states';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input, Label } from '@/components/ui/misc';
import { ApiError, apiBase, NetworkError, setApiBase } from '@/lib/api';
import { useSession } from '@/lib/session';

export function LoginPage() {
  const { t } = useTranslation();
  const { signIn, restoreError, retryRestore } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [server, setServer] = useState(apiBase());
  const [editServer, setEditServer] = useState(false);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (caught) {
      setError(caught);
    } finally {
      setBusy(false);
    }
  };

  const message =
    error instanceof ApiError
      ? error.code === 'inactive'
        ? t('login.disabled')
        : error.status === 401 || error.status === 422
          ? t('login.invalid')
          : error.message
      : null;

  return (
    <div className="safe-top safe-bottom flex min-h-dvh flex-col items-center justify-center gap-6 bg-background px-4 py-10">
      <div className="flex w-full max-w-sm items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-lg bg-zinc-900 text-white">
            <ShieldCheck className="size-5" />
          </span>
          <div className="leading-tight">
            <p className="font-semibold">{t('app.name')}</p>
            <p className="text-xs text-muted-foreground">{t('app.panel')}</p>
          </div>
        </div>
        <LanguageToggle />
      </div>

      {restoreError instanceof NetworkError && error == null && (
        <ErrorState
          error={restoreError}
          onRetry={retryRestore}
          className="w-full max-w-sm bg-card"
        />
      )}

      <Card className="w-full max-w-sm">
        <CardContent>
          <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4">
            <div>
              <h1 className="text-xl font-semibold">{t('login.title')}</h1>
              <p className="text-sm text-muted-foreground">{t('login.subtitle')}</p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">{t('login.email')}</Label>
              <Input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">{t('login.password')}</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>
            {message != null && (
              <p
                className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                role="alert"
              >
                {message}
              </p>
            )}
            {error instanceof NetworkError && <ErrorState error={error} />}
            <Button type="submit" className="h-10" disabled={busy}>
              {busy && <Loader2 className="animate-spin" />}
              {busy ? t('login.signingIn') : t('login.submit')}
            </Button>
            <p className="text-center text-xs text-muted-foreground">{t('login.demo')}</p>
          </form>
        </CardContent>
      </Card>

      <div className="w-full max-w-sm text-xs text-muted-foreground">
        {editServer ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              setApiBase(server);
              setServer(apiBase());
              setEditServer(false);
            }}
          >
            <Label htmlFor="server">{t('login.server')}</Label>
            <div className="flex gap-2">
              <Input
                id="server"
                value={server}
                onChange={(event) => setServer(event.target.value)}
              />
              <Button type="submit" variant="outline">
                {t('actions.save')}
              </Button>
            </div>
            <p>{t('login.serverHint')}</p>
          </form>
        ) : (
          <button
            type="button"
            className="mx-auto flex items-center gap-1.5 hover:text-foreground"
            onClick={() => setEditServer(true)}
          >
            <Server className="size-3.5" />
            {t('login.server')}: {apiBase()}
          </button>
        )}
      </div>
    </div>
  );
}
