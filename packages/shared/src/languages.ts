export const LANGUAGE_CODES = ['en', 'hi', 'sat'] as const;

export type LanguageCode = (typeof LANGUAGE_CODES)[number];

export interface LanguageInfo {
  code: LanguageCode;
  /** Name written in the language itself, shown on the language picker. */
  nativeName: string;
  /** English name, for admin screens and logs. */
  englishName: string;
  /** BCP-47 tag used for Web Speech API voices and Intl formatting. */
  bcp47: string;
  /** Script used, so the UI can pick the right bundled font. */
  script: 'Latin' | 'Devanagari' | 'OlChiki';
}

export const LANGUAGES: Record<LanguageCode, LanguageInfo> = {
  en: {
    code: 'en',
    nativeName: 'English',
    englishName: 'English',
    bcp47: 'en-IN',
    script: 'Latin',
  },
  hi: {
    code: 'hi',
    nativeName: 'हिन्दी',
    englishName: 'Hindi',
    bcp47: 'hi-IN',
    script: 'Devanagari',
  },
  sat: {
    code: 'sat',
    nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ',
    englishName: 'Santali',
    bcp47: 'sat-Olck-IN',
    script: 'OlChiki',
  },
};
