import { resolveText, type LocalizedText, type ResolvedText } from '@ar-training/shared';
import i18next, { type TFunction } from 'i18next';
import { useCallback } from 'react';
import { useLanguage } from './index';
import type { Namespace } from './resources';

/**
 * Builds a LocalizedText from UI strings, for messages that go through the step runner
 * (which stores and narrates LocalizedText). Santali is left out so it falls back to Hindi,
 * matching how module content handles untranslated Santali.
 */
export function localizedFrom<N extends Namespace>(
  ns: N,
  build: (t: TFunction<N>) => string,
): LocalizedText {
  return { en: build(i18next.getFixedT('en', ns)), hi: build(i18next.getFixedT('hi', ns)) };
}

/** Resolves module content text in the current language. */
export function useLocalized(): (text: LocalizedText) => ResolvedText {
  const lang = useLanguage();
  return useCallback((text: LocalizedText) => resolveText(text, lang), [lang]);
}
