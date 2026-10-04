#!/usr/bin/env node
/**
 * Imports a translator's CSV (from `npm run i18n:export`) back into the app: the Santali column
 * and any Hindi corrections, for both the app UI and the module content.
 *
 *   npm run i18n:import [-- file.csv] [--dry-run]   default: translations/strings.csv
 *
 * Santali workflow: a translator fills the `sat` column; a native speaker who has checked a
 * string sets its `satNeedsReview` to `false` (and `satSource` to who reviewed it). Anything not
 * explicitly reviewed stays `needsReview: true`, so the app keeps showing the draft notice.
 *
 * Rows are rejected (and listed) when their {{placeholders}} differ from the English text, or
 * when the Santali text has no Ol Chiki letters. English is never changed from the CSV.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LOCALES = path.join(ROOT, 'apps', 'mobile', 'src', 'i18n', 'locales');
const MODULES = path.join(ROOT, 'packages', 'shared', 'content', 'modules');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const IN = path.resolve(
  ROOT,
  args.find((arg) => !arg.startsWith('--')) ?? path.join('translations', 'strings.csv'),
);
const OL_CHIKI = /[᱐-᱿]/;

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

// ---- CSV ---------------------------------------------------------------------------------------

/** RFC 4180 CSV (quotes, doubled quotes, CRLF or LF), first row is the header. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(field);
      if (row.some((value) => value !== '')) rows.push(row);
      row = [];
      field = '';
    } else field += char;
  }
  row.push(field);
  if (row.some((value) => value !== '')) rows.push(row);
  const [header, ...body] = rows;
  return body.map((values) => Object.fromEntries(header.map((name, i) => [name, values[i] ?? ''])));
}

// ---- Paths inside JSON -------------------------------------------------------------------------

/** "steps[2].options[0].label" → ["steps", 2, "options", 0, "label"] */
function segments(key) {
  return [...key.matchAll(/([^.[\]]+)|\[(\d+)\]/g)].map((match) =>
    match[2] != null ? Number(match[2]) : match[1],
  );
}

function getAt(tree, key) {
  return segments(key).reduce((node, segment) => (node == null ? undefined : node[segment]), tree);
}

function setAt(tree, key, value) {
  const parts = segments(key);
  let node = tree;
  for (const part of parts.slice(0, -1)) {
    node[part] ??= {};
    node = node[part];
  }
  node[parts.at(-1)] = value;
}

const placeholders = (text) =>
  [...text.matchAll(/\{\{\s*([\w.]+)[^}]*\}\}/g)]
    .map((match) => match[1])
    .sort()
    .join(',');

// ---- Import ------------------------------------------------------------------------------------

if (!existsSync(IN)) {
  console.error(`✖ ${path.relative(ROOT, IN)} not found. Export it first: npm run i18n:export`);
  process.exit(1);
}
// Excel and the exporter write a byte order mark first.
const BOM = String.fromCharCode(0xfeff);
const text = readFileSync(IN, 'utf8');
const rows = parseCsv(text.startsWith(BOM) ? text.slice(1) : text);

const files = new Map(); // path → parsed JSON (loaded on demand, written if changed)
const changed = new Set();
const load = (file) => {
  if (!files.has(file)) files.set(file, existsSync(file) ? readJson(file) : {});
  return files.get(file);
};
const stats = { hi: 0, sat: 0, reviewed: 0 };
const problems = [];

function santaliValue(row, current) {
  const text = row.sat.trim();
  const needsReview = row.satNeedsReview.trim().toLowerCase() !== 'false';
  const source = row.satSource.trim() || current?.source || 'translator';
  return { text, needsReview, source };
}

for (const row of rows) {
  const where = `${row.source} ${row.key}`;
  const [kind, name] = row.source.split('/');
  let english;
  let hindiFile;
  let santaliFile;
  let hindiKey = row.key;
  let santaliKey = row.key;

  if (kind === 'ui') {
    english = getAt(load(path.join(LOCALES, 'en', `${name}.json`)), row.key);
    hindiFile = path.join(LOCALES, 'hi', `${name}.json`);
    santaliFile = path.join(LOCALES, 'sat', `${name}.json`);
  } else if (kind === 'module') {
    const file = path.join(MODULES, `${name}.json`);
    english = existsSync(file) ? getAt(load(file), row.key)?.en : undefined;
    hindiFile = santaliFile = file;
    hindiKey = `${row.key}.hi`;
    santaliKey = `${row.key}.sat`;
  }
  if (typeof english !== 'string') {
    problems.push(`${where}: unknown string (not in the app any more?), skipped`);
    continue;
  }
  if (english !== row.en) {
    problems.push(`${where}: English changed since the export; translate the new text`);
    continue;
  }

  // Hindi corrections
  const hindi = row.hi.trim();
  if (hindi !== '' && hindi !== getAt(load(hindiFile), hindiKey)) {
    if (placeholders(hindi) !== placeholders(english)) {
      problems.push(`${where}: Hindi placeholders differ from English (${placeholders(english)})`);
    } else {
      setAt(load(hindiFile), hindiKey, hindi);
      changed.add(hindiFile);
      stats.hi += 1;
    }
  }

  // Santali
  if (row.sat.trim() === '') continue;
  const current = getAt(load(santaliFile), santaliKey);
  const next = santaliValue(row, current);
  if (placeholders(next.text) !== placeholders(english)) {
    problems.push(`${where}: Santali placeholders differ from English (${placeholders(english)})`);
    continue;
  }
  if (!OL_CHIKI.test(next.text)) {
    problems.push(`${where}: Santali text has no Ol Chiki letters`);
    continue;
  }
  if (
    current?.text === next.text &&
    current?.needsReview === next.needsReview &&
    current?.source === next.source
  ) {
    continue;
  }
  setAt(load(santaliFile), santaliKey, next);
  changed.add(santaliFile);
  stats.sat += 1;
  if (!next.needsReview) stats.reviewed += 1;
}

console.log(
  `${dryRun ? '(dry run) ' : ''}${rows.length} rows: ${stats.sat} Santali strings updated (${stats.reviewed} marked reviewed), ${stats.hi} Hindi corrections.`,
);
for (const problem of problems) console.warn(`! ${problem}`);

if (!dryRun && changed.size > 0) {
  for (const file of changed) {
    writeFileSync(file, `${JSON.stringify(files.get(file), null, 2)}\n`);
    console.log(`• ${path.relative(ROOT, file)}`);
  }
  // Same layout as the rest of the repo (short arrays on one line, etc.).
  const quoted = [...changed].map((file) => `"${file}"`).join(' ');
  spawnSync(`npx prettier --write ${quoted}`, { cwd: ROOT, shell: true, stdio: 'ignore' });
  console.log('Run `npm test` to check the content and the Santali review flags.');
}
