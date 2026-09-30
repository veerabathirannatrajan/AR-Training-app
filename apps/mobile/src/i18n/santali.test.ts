import { describe, expect, it } from 'vitest';
import { englishResources, NAMESPACES, santaliReviewed } from './resources';
import { listReviewFlags, toPlainResource, type ReviewedTree } from './santali';

function hasKey(tree: unknown, path: string): boolean {
  let node: unknown = tree;
  for (const part of path.split('.')) {
    if (node == null || typeof node !== 'object') return false;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === 'string';
}

describe('Santali resources', () => {
  it.each(NAMESPACES)(
    '%s: every string is flagged for review unless a native speaker signed it off',
    (ns) => {
      for (const flag of listReviewFlags(santaliReviewed[ns])) {
        const signedOff = flag.source.startsWith('native-speaker');
        expect(flag.needsReview || signedOff, `${ns}:${flag.key}`).toBe(true);
      }
    },
  );

  it.each(NAMESPACES)('%s: every Santali key exists in English (no orphaned strings)', (ns) => {
    for (const flag of listReviewFlags(santaliReviewed[ns])) {
      expect(hasKey(englishResources[ns], flag.key), `${ns}:${flag.key}`).toBe(true);
    }
  });
});

describe('toPlainResource', () => {
  it('strips review metadata and drops empty drafts', () => {
    const tree: ReviewedTree = {
      title: { text: 'ᱯᱟᱹᱨᱥᱤ', needsReview: true, source: 'machine-draft' },
      nested: {
        empty: { text: ' ', needsReview: true, source: 'machine-draft' },
        start: { text: 'ᱮᱛᱦᱚᱵ', needsReview: true, source: 'machine-draft' },
      },
      onlyEmpty: { none: { text: '', needsReview: true, source: 'machine-draft' } },
    };
    expect(toPlainResource(tree)).toEqual({ title: 'ᱯᱟᱹᱨᱥᱤ', nested: { start: 'ᱮᱛᱦᱚᱵ' } });
  });
});
