import { LANGUAGE_CODES, LANGUAGES, type LanguageCode } from '@ar-training/shared';
import { Check, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '../app/navigation';
import { useInstallPrompt } from '../app/platform';
import { AppMark } from '../design/AppMark';
import { Button, Chip } from '../design/components';
import { cx } from '../design/cx';
import { LowPolyBackdrop } from '../design/LowPolyBackdrop';
import { XR_UI_PROPS } from '../engine/xr/xrUi';
import { setLanguage, storedLanguage } from '../i18n';

/** Large glyph per script so the choice is recognisable before reading anything. */
const SCRIPT_GLYPH: Record<LanguageCode, string> = { en: 'Aa', hi: 'अ', sat: 'ᱚ' };

/**
 * First screen after install. The heading is shown in every language, since the worker
 * has not chosen one yet.
 */
export function LanguageScreen({ next }: { next: 'login' | 'back' }) {
  const { t } = useTranslation(['auth', 'common']);
  const install = useInstallPrompt();
  const chosen = storedLanguage();

  const choose = async (lang: LanguageCode) => {
    await setLanguage(lang);
    const navigation = useNavigation.getState();
    if (next === 'back') navigation.back();
    else navigation.reset({ name: 'login' });
  };

  return (
    <main className="screen">
      <LowPolyBackdrop />
      <div className="screen-scroll">
        <header className="stack-1 language-header">
          <AppMark size={56} />
          {LANGUAGE_CODES.map((lang) => (
            <h1
              key={lang}
              className={lang === 'en' ? 't-title' : 't-heading t-muted'}
              lang={LANGUAGES[lang].bcp47}
            >
              {t('language.title', { lng: lang })}
            </h1>
          ))}
        </header>

        <div className="stack-2">
          {LANGUAGE_CODES.map((lang) => (
            <button
              key={lang}
              type="button"
              className={cx('glass language-card', chosen === lang && 'is-selected')}
              onClick={() => void choose(lang)}
              {...XR_UI_PROPS}
            >
              <span className="language-glyph" lang={LANGUAGES[lang].bcp47} aria-hidden>
                {SCRIPT_GLYPH[lang]}
              </span>
              <span className="grow stack-1">
                <span className="language-native" lang={LANGUAGES[lang].bcp47}>
                  {LANGUAGES[lang].nativeName}
                </span>
                <span className="t-small t-muted">{LANGUAGES[lang].englishName}</span>
              </span>
              {lang === 'sat' && (
                <Chip tone="warn">{t('common:language.draft', { lng: 'en' })}</Chip>
              )}
              {chosen === lang && <Check size={24} className="icon-accent" />}
            </button>
          ))}
        </div>

        {install != null && (
          <div className="glass card stack-1">
            <p className="t-small t-muted">{t('common:pwa.installHint')}</p>
            <Button
              variant="secondary"
              icon={<Download size={20} />}
              onClick={() => void install()}
            >
              {t('common:actions.installApp')}
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}
