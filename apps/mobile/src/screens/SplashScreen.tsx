import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { takeCertificateLink, takeLaunchShortcut, useNavigation } from '../app/navigation';
import { useSession } from '../app/session';
import { currentWorker } from '../data/auth';
import { AppMark } from '../design/AppMark';
import { LowPolyBackdrop } from '../design/LowPolyBackdrop';
import { storedLanguage } from '../i18n';

const MIN_SPLASH_MS = 900;

export function SplashScreen() {
  const { t } = useTranslation();

  useEffect(() => {
    let cancelled = false;
    const minimum = new Promise((resolve) => setTimeout(resolve, MIN_SPLASH_MS));
    void (async () => {
      const [worker] = await Promise.all([
        currentWorker().catch((error: unknown) => {
          console.error('[splash] could not read the saved session', error);
          return null;
        }),
        minimum,
      ]);
      if (cancelled) return;
      const { reset, navigate } = useNavigation.getState();
      const shortcut = takeLaunchShortcut();
      if (storedLanguage() == null) {
        reset({ name: 'language', next: 'login' });
      } else if (worker == null) {
        reset({ name: 'login' });
        // Anyone can verify a certificate without logging in (e.g. a supervisor at the gate).
        if (shortcut === 'verify') navigate({ name: 'verify' });
      } else {
        useSession.getState().setWorker(worker);
        reset({ name: 'home' });
        if (shortcut != null) navigate({ name: shortcut });
      }
      const certificateLink = takeCertificateLink();
      if (certificateLink != null) navigate({ name: 'verify', payload: certificateLink });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="screen splash">
      <LowPolyBackdrop />
      <div className="splash-center">
        <AppMark size={112} />
        <h1 className="t-display">{t('appName')}</h1>
        <p className="t-muted">{t('tagline')}</p>
        <span className="spinner" role="progressbar" aria-label={t('loading')} />
      </div>
    </main>
  );
}
