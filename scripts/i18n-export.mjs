#!/usr/bin/env node
/**
 * Exports every translatable string (app UI + module content) to one CSV for translators and
 * reviewers: English, Hindi and Santali side by side, with the Santali review flags.
 *
 *   npm run i18n:export [-- out.csv]      default: translations/strings.csv
 *
 * The file is UTF-8 with a BOM so Excel / LibreOffice show Devanagari and Ol Chiki correctly.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES = path.join(ROOT, 'apps', 'mobile', 'src', 'i18n', 'locales');
const MODULES = path.join(ROOT, 'packages', 'shared', 'content', 'modules');
const OUT = path.resolve(ROOT, process.argv[2] ?? path.join('translations', 'strings.csv'));

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

function isReviewed(value) {
  return (
    value != null &&
    typeof value === 'object' &&
    typeof value.text === 'string' &&
    'needsReview' in value
  );
}

/** Flattens nested strings to { "a.b.c": value }, keeping Santali review objects whole. */
function flatten(tree, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(tree)) {
    const pathKey = prefix === '' ? key : `${prefix}.${key}`;
    if (typeof value === 'string' || isReviewed(value)) out[pathKey] = value;
    else if (value != null && typeof value === 'object') flatten(value, pathKey, out);
  }
  return out;
}

const rows = [];

// ---- App UI (i18next namespaces) ----
for (const file of readdirSync(path.join(LOCALES, 'en')).filter((name) => name.endsWith('.json'))) {
  const namespace = file.replace(/\.json$/, '');
  const load = (lang) => {
    try {
      return flatten(readJson(path.join(LOCALES, lang, file)));
    } catch {
      return {};
    }
  };
  const [en, hi, sat] = [load('en'), load('hi'), load('sat')];
  for (const key of Object.keys(en)) {
    const santali = sat[key];
    rows.push({
      source: `ui/${namespace}`,
      key,
      en: en[key],
      hi: hi[key] ?? '',
      sat: santali?.text ?? '',
      satNeedsReview: santali == null ? '' : String(santali.needsReview),
      satSource: santali?.source ?? '',
      notes: '',
    });
  }
}

// ---- Module content (LocalizedText objects) ----
function collectLocalized(value, pathKey, visit) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectLocalized(item, `${pathKey}[${index}]`, visit));
  } else if (value != null && typeof value === 'object') {
    if (typeof value.en === 'string' && typeof value.hi === 'string') {
      visit(pathKey, value);
      return;
    }
    for (const [key, child] of Object.entries(value)) {
      collectLocalized(child, pathKey === '' ? key : `${pathKey}.${key}`, visit);
    }
  }
}

for (const file of readdirSync(MODULES).filter((name) => name.endsWith('.json'))) {
  const module = readJson(path.join(MODULES, file));
  const stepNotes = new Map(
    (module.steps ?? []).map((step, index) => [`steps[${index}]`, step.notes ?? '']),
  );
  collectLocalized(module, '', (key, text) => {
    const stepPrefix = key.match(/^steps\[\d+\]/)?.[0];
    rows.push({
      source: `module/${module.id}`,
      key,
      en: text.en,
      hi: text.hi,
      sat: text.sat?.text ?? '',
      satNeedsReview: text.sat == null ? '' : String(text.sat.needsReview),
      satSource: text.sat?.source ?? '',
      notes: stepPrefix != null ? (stepNotes.get(stepPrefix) ?? '') : '',
    });
  });
}

const columns = ['source', 'key', 'en', 'hi', 'sat', 'satNeedsReview', 'satSource', 'notes'];
const escape = (value) => {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const csv = [
  columns.join(','),
  ...rows.map((row) => columns.map((column) => escape(row[column])).join(',')),
].join('\r\n');

mkdirSync(path.dirname(OUT), { recursive: true });
const BOM = String.fromCharCode(0xfeff);
writeFileSync(OUT, `${BOM}${csv}\r\n`, 'utf8');

const santali = rows.filter((row) => row.sat !== '');
const flagged = santali.filter((row) => row.satNeedsReview === 'true');
console.log(`✔ Wrote ${rows.length} strings to ${path.relative(ROOT, OUT)}`);
console.log(
  `  Santali: ${santali.length} translated (${flagged.length} flagged for review), ${rows.length - santali.length} not yet translated.`,
);
