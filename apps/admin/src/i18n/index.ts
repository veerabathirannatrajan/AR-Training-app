import type { LocalizedText } from '@ar-training/shared';
import i18next from 'i18next';
import { useCallback } from 'react';
import { initReactI18next, useTranslation } from 'react-i18next';
import { en } from './en';
import { hi } from './hi';

export type PortalLanguage = 'en' | 'hi';
const KEY = 'armt-admin-language';

function stored(): PortalLanguage {
  try {
    return window.localStorage.getItem(KEY) === 'hi' ? 'hi' : 'en';
  } catch {
    return 'en';
  }
}

void i18next.use(initReactI18next).init({
  resources: { en: { translation: en }, hi: { translation: hi } },
  lng: stored(),
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
  returnNull: false,
  initAsync: false,
});
document.documentElement.lang = i18next.language;

export async function setPortalLanguage(lang: PortalLanguage): Promise<void> {
  try {
    window.localStorage.setItem(KEY, lang);
  } catch {
    // not remembered
  }
  document.documentElement.lang = lang;
  await i18next.changeLanguage(lang);
}

export function usePortalLanguage(): PortalLanguage {
  const { i18n } = useTranslation();
  return i18n.language === 'hi' ? 'hi' : 'en';
}

/** Module and step titles come from the shared content in English and Hindi. */
export function useText(): (
  text: LocalizedText | Record<string, unknown> | null | undefined,
) => string {
  const lang = usePortalLanguage();
  return useCallback(
    (text) => {
      if (text == null) return '';
      const value = (text as Record<string, unknown>)[lang] ?? (text as Record<string, unknown>).en;
      return typeof value === 'string' ? value : '';
    },
    [lang],
  );
}

/** Indian number and date formatting in the portal language. */
export function useLocale(): string {
  return usePortalLanguage() === 'hi' ? 'hi-IN' : 'en-IN';
}

export { i18next };
