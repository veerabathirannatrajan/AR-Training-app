import { LANGUAGE_CODES, LANGUAGES, type LanguageCode } from '@ar-training/shared';
import i18next from 'i18next';
import { initReactI18next, useTranslation } from 'react-i18next';
import { readLocal, writeLocal } from '../lib/localStore';
import { NAMESPACES, resources } from './resources';

const LANGUAGE_KEY = 'armt.language';

export function isLanguageCode(value: unknown): value is LanguageCode {
  return typeof value === 'string' && (LANGUAGE_CODES as readonly string[]).includes(value);
}

/** The language the worker picked on this phone, or null before the first choice. */
export function storedLanguage(): LanguageCode | null {
  const value = readLocal(LANGUAGE_KEY);
  return isLanguageCode(value) ? value : null;
}

function applyDocumentLanguage(lang: LanguageCode) {
  document.documentElement.lang = LANGUAGES[lang].bcp47;
}

void i18next.use(initReactI18next).init({
  resources,
  lng: storedLanguage() ?? 'en',
  // Santali speakers in Jharkhand usually read Hindi, so untranslated Santali shows Hindi.
  fallbackLng: { sat: ['hi', 'en'], hi: ['en'], default: ['en'] },
  ns: [...NAMESPACES],
  defaultNS: 'common',
  interpolation: { escapeValue: false },
  returnNull: false,
  initAsync: false,
});
applyDocumentLanguage(currentLanguage());

export function currentLanguage(): LanguageCode {
  const lang = i18next.language;
  return isLanguageCode(lang) ? lang : 'en';
}

export async function setLanguage(lang: LanguageCode): Promise<void> {
  writeLocal(LANGUAGE_KEY, lang);
  applyDocumentLanguage(lang);
  await i18next.changeLanguage(lang);
}

/** Current app language as a typed code; re-renders on change. */
export function useLanguage(): LanguageCode {
  const { i18n } = useTranslation();
  return isLanguageCode(i18n.language) ? i18n.language : 'en';
}

export { i18next };
