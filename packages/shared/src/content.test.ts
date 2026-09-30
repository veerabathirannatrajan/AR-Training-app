import { describe, expect, it } from 'vitest';
import type { LocalizedText } from './content';
import { resolveText, totalPoints } from './content';
import { trainingModuleSchema } from './content.schema';
import { MODULE_CONTENT } from './modules';

/** Every LocalizedText in a module, with a readable path for failure messages. */
function collectTexts(value: unknown, path: string, out: Array<[string, LocalizedText]>) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectTexts(item, `${path}[${index}]`, out));
  } else if (value != null && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.en === 'string' && typeof record.hi === 'string') {
      out.push([path, record as unknown as LocalizedText]);
      return;
    }
    for (const [key, child] of Object.entries(record)) collectTexts(child, `${path}.${key}`, out);
  }
}

describe.each(MODULE_CONTENT.map((module) => [module.id, module] as const))(
  'module content %s',
  (_id, module) => {
    it('matches the content schema', () => {
      const result = trainingModuleSchema.safeParse(module);
      expect(result.success, JSON.stringify(result.error?.issues, null, 2)).toBe(true);
    });

    it('flags every unreviewed Santali string with needsReview', () => {
      const texts: Array<[string, LocalizedText]> = [];
      collectTexts(module, module.id, texts);
      for (const [path, text] of texts) {
        if (text.sat == null) continue;
        const reviewedByNativeSpeaker = text.sat.source.startsWith('native-speaker');
        expect(text.sat.needsReview || reviewedByNativeSpeaker, path).toBe(true);
      }
    });

    it('awards points on every step', () => {
      expect(totalPoints(module)).toBeGreaterThan(0);
    });
  },
);

describe('resolveText', () => {
  const text: LocalizedText = { en: 'Start', hi: 'शुरू करें' };

  it('returns the requested language', () => {
    expect(resolveText(text, 'hi')).toEqual({ text: 'शुरू करें', lang: 'hi', needsReview: false });
  });

  it('falls back from Santali to Hindi when there is no Santali text', () => {
    expect(resolveText(text, 'sat')).toEqual({ text: 'शुरू करें', lang: 'hi', needsReview: false });
  });

  it('reports unreviewed Santali drafts', () => {
    const withDraft: LocalizedText = {
      ...text,
      sat: { text: 'ᱮᱛᱦᱚᱵ', needsReview: true, source: 'machine-draft' },
    };
    expect(resolveText(withDraft, 'sat')).toEqual({
      text: 'ᱮᱛᱦᱚᱵ',
      lang: 'sat',
      needsReview: true,
    });
  });
});
