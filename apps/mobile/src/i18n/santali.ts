/**
 * Santali resource files keep review metadata next to every string:
 *   { "title": { "text": "…", "needsReview": true, "source": "machine-draft" } }
 * i18next needs plain strings, so this module strips the metadata at load time and keeps
 * a list of which keys are unreviewed drafts.
 */

export interface ReviewedString {
  text: string;
  needsReview: boolean;
  source: string;
}

export interface ReviewedTree {
  [key: string]: ReviewedString | ReviewedTree;
}

export interface PlainTree {
  [key: string]: string | PlainTree;
}

export function isReviewedString(value: unknown): value is ReviewedString {
  return (
    value != null &&
    typeof value === 'object' &&
    typeof (value as ReviewedString).text === 'string' &&
    typeof (value as ReviewedString).needsReview === 'boolean' &&
    typeof (value as ReviewedString).source === 'string'
  );
}

/** Converts a reviewed tree to the plain nested strings i18next expects. Empty drafts are dropped. */
export function toPlainResource(tree: ReviewedTree): PlainTree {
  const out: PlainTree = {};
  for (const [key, value] of Object.entries(tree)) {
    if (isReviewedString(value)) {
      if (value.text.trim() !== '') out[key] = value.text;
    } else {
      const child = toPlainResource(value);
      if (Object.keys(child).length > 0) out[key] = child;
    }
  }
  return out;
}

export interface ReviewFlag extends ReviewedString {
  /** Dotted key path inside the namespace, e.g. "language.title". */
  key: string;
}

export function listReviewFlags(tree: ReviewedTree, prefix = ''): ReviewFlag[] {
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    return isReviewedString(value) ? [{ key: path, ...value }] : listReviewFlags(value, path);
  });
}
