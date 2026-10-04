#!/usr/bin/env node
/**
 * Deploys the API to Vercel with a Neon Postgres database, so the phone apps work anywhere with
 * internet (no laptop, no USB cable):
 *
 *   npm run deploy:api              bundle → Vercel project → database → secrets → seed → deploy
 *   npm run deploy:api -- --no-seed skip seeding the database (it only ever adds missing rows)
 *
 * - Vercel project `ar-mining-training-api` (created on first run), functions in Singapore
 *   (sin1), next to the database.
 * - Database: Neon Postgres (free plan, Singapore) through the Vercel Marketplace. The first time,
 *   Neon's terms must be accepted once in an interactive terminal:
 *   `npx vercel integration accept-terms neon` (the script tells you when).
 * - Secrets (in services/api/keys/hosted.json, gitignored; back it up): the JWT secret and the
 *   portal admin password are generated on first run. Certificates are signed with this laptop's
 *   key (services/api/keys/cert_signing_ed25519.key), so certificates issued here and there
 *   verify with the same public key that is built into the app.
 * - The database gets the same demo data as the laptop (48 workers, PIN 1234, a year of demo
 *   history). The portal admin is admin@test.com with the generated password (printed at the end).
 *
 * Writes the production address to services/api/vercel/deployment.json (commit it): the phone
 * builds (`npm run android`, `npm run android:admin`) point at it.
 */
import { createHash, randomBytes } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fail } from './lib/adb.mjs';
import { ROOT, step } from './lib/android-build.mjs';
import { API_DIR, VENV_PYTHON, venvExists } from './python-env.mjs';
import {
  deployProduction,
  ensureVercelLogin,
  HOSTED_API_FILE,
  hostedApiUrl,
  productionHost,
  vercel,
  writeHostedApiUrl,
} from './lib/vercel.mjs';

const PROJECT = 'ar-mining-training-api';
const BUNDLE = path.join(API_DIR, '.deploy');
const SECRETS = path.join(API_DIR, 'keys', 'hosted.json');
const SIGNING_KEY = path.join(API_DIR, 'keys', 'cert_signing_ed25519.key');
const CONTENT = path.join(ROOT, 'packages', 'shared', 'content', 'modules');
const ADMIN_EMAIL = 'admin@test.com';
const DEMO_WORKER = { workerId: '11001', pin: '1234' };
// The deployed worker app; its requests to the API must pass CORS.
const WORKER_APP_ORIGIN = 'https://ar-mining-training.vercel.app';

const seedDatabase = !process.argv.includes('--no-seed');

// ---- Bundle ------------------------------------------------------------------------------------

/** services/api/.deploy: the app package, the Vercel entry point and a copy of the content. */
function stageBundle() {
  mkdirSync(BUNDLE, { recursive: true });
  for (const entry of readdirSync(BUNDLE)) {
    if (entry !== '.vercel') rmSync(path.join(BUNDLE, entry), { recursive: true, force: true });
  }
  const skipCache = (source) => !/__pycache__|\.pyc$/.test(source);
  cpSync(path.join(API_DIR, 'app'), path.join(BUNDLE, 'app'), {
    recursive: true,
    filter: skipCache,
  });
  cpSync(path.join(API_DIR, 'vercel', 'api'), path.join(BUNDLE, 'api'), {
    recursive: true,
    filter: skipCache,
  });
  cpSync(path.join(API_DIR, 'vercel', 'vercel.json'), path.join(BUNDLE, 'vercel.json'));
  cpSync(path.join(API_DIR, 'requirements.txt'), path.join(BUNDLE, 'requirements.txt'));
  cpSync(CONTENT, path.join(BUNDLE, 'content', 'modules'), { recursive: true });
  writeFileSync(path.join(BUNDLE, '.python-version'), '3.12\n');
  writeFileSync(path.join(BUNDLE, '.vercelignore'), '.env*\n');
}

function linkProject() {
  if (existsSync(path.join(BUNDLE, '.vercel', 'project.json'))) return;
  step(`Creating / linking the Vercel project "${PROJECT}"`);
  // Fails harmlessly when the project already exists.
  vercel(['project', 'add', PROJECT], { cwd: BUNDLE, allowFail: true });
  vercel(['link', '--yes', '--project', PROJECT], { cwd: BUNDLE });
}

// ---- Database ----------------------------------------------------------------------------------

function envNames() {
  const { output } = vercel(['env', 'ls', 'production'], { cwd: BUNDLE, allowFail: true });
  return new Set([...output.matchAll(/^\s*([A-Z][A-Z0-9_]+)\s/gm)].map((match) => match[1]));
}

function ensureDatabase() {
  if (envNames().has('DATABASE_URL')) {
    console.log('• Database: DATABASE_URL is set on the project');
    return;
  }
  step('Creating the Neon Postgres database (free plan, Singapore)');
  const result = vercel(
    [
      'integration',
      'add',
      'neon',
      '--plan',
      'free_v3',
      '-m',
      'region=sin1',
      '-m',
      'auth=false',
      '--name',
      `${PROJECT}-db`,
      '--no-env-pull',
    ],
    { cwd: BUNDLE, allowFail: true },
  );
  if (result.ok && envNames().has('DATABASE_URL')) {
    console.log('• Database created and connected (DATABASE_URL)');
    return;
  }
  // First time only: a person has to accept Neon's marketplace terms, which the CLI cannot do
  // non-interactively. Creating the database in the dashboard accepts them in the same step.
  if (/terms_acceptance_required/.test(result.output)) {
    fail(
      'The database has to be created once in the Vercel dashboard (Neon needs a person to accept its terms).',
      [
        `Vercel dashboard → project ${PROJECT} → Storage → Create Database → Neon (Serverless Postgres).`,
        'Accept the terms; Region: Singapore; Plan: Free; Create, then Connect it to the project (all environments).',
        `(Or, in an interactive terminal: cd services/api/.deploy && npx vercel integration accept-terms neon)`,
        'Run `npm run deploy:api` again.',
      ],
    );
  }
  fail('Could not create the database.', [result.output.trim()]);
}

/** The database URL, from the project's environment variables. */
function pullDatabaseUrl() {
  const file = path.join(BUNDLE, '.env.deploy');
  for (const environment of ['production', 'development']) {
    vercel(['env', 'pull', file, '--environment', environment, '--yes'], {
      cwd: BUNDLE,
      allowFail: true,
    });
    const env = existsSync(file) ? readFileSync(file, 'utf8') : '';
    rmSync(file, { force: true });
    const url = /^DATABASE_URL="?([^"\n]+)"?$/m.exec(env)?.[1];
    if (url) return url;
  }
  return fail('Could not read DATABASE_URL from the Vercel project.', [
    `Vercel dashboard → ${PROJECT} → Storage: check that the Neon database is connected.`,
  ]);
}

// ---- Secrets -----------------------------------------------------------------------------------

function loadSecrets() {
  if (existsSync(SECRETS)) return JSON.parse(readFileSync(SECRETS, 'utf8'));
  const secrets = {
    adminEmail: ADMIN_EMAIL,
    adminPassword: randomBytes(9).toString('base64url'),
    jwtSecret: randomBytes(48).toString('base64url'),
    envHash: null,
  };
  saveSecrets(secrets);
  console.log(`• Created ${path.relative(ROOT, SECRETS)} (gitignored). Back it up.`);
  return secrets;
}

function saveSecrets(secrets) {
  mkdirSync(path.dirname(SECRETS), { recursive: true });
  writeFileSync(SECRETS, `${JSON.stringify(secrets, null, 2)}\n`);
}

function signingKeySeed() {
  if (!existsSync(SIGNING_KEY)) {
    fail('The certificate signing key does not exist yet.', [
      'Start the API once on this laptop (`npm run dev:api`): it creates services/api/keys/.',
      'Run `npm run deploy:api` again.',
    ]);
  }
  const seed = readFileSync(SIGNING_KEY, 'utf8').trim();
  if (!/^[0-9a-f]{64}$/.test(seed)) fail(`${SIGNING_KEY} is not a 32-byte hex key.`);
  return seed;
}

function hostedEnv(secrets) {
  return {
    ARMT_JWT_SECRET: secrets.jwtSecret,
    ARMT_CERT_SIGNING_KEY: signingKeySeed(),
    ARMT_ADMIN_EMAIL: secrets.adminEmail,
    ARMT_ADMIN_PASSWORD: secrets.adminPassword,
    // Seeding runs from this script, not on a cold start.
    ARMT_SEED_DEMO: '0',
  };
}

function syncEnv(secrets) {
  const env = hostedEnv(secrets);
  const projectId = JSON.parse(
    readFileSync(path.join(BUNDLE, '.vercel', 'project.json'), 'utf8'),
  ).projectId;
  const hash = createHash('sha256').update(JSON.stringify({ projectId, env })).digest('hex');
  if (secrets.envHash === hash) {
    console.log('• Secrets: unchanged on the project');
    return;
  }
  step('Setting the API secrets on the Vercel project (production)');
  for (const [name, value] of Object.entries(env)) {
    vercel(['env', 'add', name, 'production', '--force', '--sensitive', '--yes'], {
      cwd: BUNDLE,
      input: value,
      capture: true,
    });
    console.log(`• ${name}`);
  }
  saveSecrets({ ...secrets, envHash: hash });
}

// ---- Seed --------------------------------------------------------------------------------------

function seed(secrets, databaseUrl) {
  if (!venvExists()) fail('API virtualenv not found. Run `npm run setup:api` first.');
  step('Seeding the database (adds only what is missing; the first run takes a minute)');
  const result = spawnSync(VENV_PYTHON, ['-m', 'app.seed'], {
    cwd: API_DIR,
    stdio: 'inherit',
    env: {
      ...process.env,
      ...hostedEnv(secrets),
      ARMT_DATABASE_URL: databaseUrl,
    },
  });
  if (result.status !== 0) fail('Seeding the hosted database failed.');
}

// ---- Smoke test --------------------------------------------------------------------------------

async function call(url, init = {}) {
  // Generous timeout: the first request after a deploy is a cold start, and Neon may be waking.
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(30000) });
  const body = await response.text();
  let json = null;
  try {
    json = JSON.parse(body);
  } catch {
    // not JSON
  }
  return { status: response.status, json, body, headers: response.headers };
}

async function smokeTest(base, secrets) {
  step(`Checking ${base}`);
  const checks = [];
  const health = await call(`${base}/api/health`);
  checks.push(['health', health.status === 200 && health.json?.status === 'ok', health.body]);

  const login = await call(`${base}/api/auth/worker/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: WORKER_APP_ORIGIN },
    body: JSON.stringify(DEMO_WORKER),
  });
  checks.push([
    `worker login ${DEMO_WORKER.workerId}`,
    login.status === 200 && typeof login.json?.token === 'string',
    login.body.slice(0, 300),
  ]);
  checks.push([
    'CORS for the worker app',
    login.headers.get('access-control-allow-origin') === WORKER_APP_ORIGIN,
    `access-control-allow-origin: ${login.headers.get('access-control-allow-origin')}`,
  ]);

  const keys = await call(`${base}/api/certificates/keys`);
  const localPublic = existsSync(path.join(API_DIR, 'keys', 'cert_signing_ed25519.pub'))
    ? readFileSync(path.join(API_DIR, 'keys', 'cert_signing_ed25519.pub'), 'utf8').trim()
    : null;
  checks.push([
    'certificate key matches the app build',
    keys.json?.signingKeys?.some((key) => key.publicKey === localPublic) === true,
    keys.body.slice(0, 300),
  ]);

  const admin = await call(`${base}/api/auth/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: secrets.adminEmail, password: secrets.adminPassword }),
  });
  checks.push(['portal admin login', admin.status === 200, admin.body.slice(0, 300)]);

  for (const [name, ok] of checks) console.log(`${ok ? '•' : '✖'} ${name}`);
  const failed = checks.filter(([, ok]) => !ok);
  if (failed.length > 0) {
    fail(
      'The hosted API did not pass its checks.',
      failed.map(([name, , detail]) => `${name}: ${detail}`),
    );
  }
}

// ---- Main --------------------------------------------------------------------------------------

ensureVercelLogin(API_DIR, 'npm run deploy:api');
step('Bundling the API');
stageBundle();
linkProject();
ensureDatabase();
const secrets = loadSecrets();
syncEnv(secrets);
if (seedDatabase) seed(secrets, pullDatabaseUrl());

step('Deploying to Vercel (production)');
const host = productionHost(deployProduction(BUNDLE), PROJECT);
const url = `https://${host}`;
if (hostedApiUrl() !== url) {
  writeHostedApiUrl(url);
  console.log(`• Updated ${path.relative(ROOT, HOSTED_API_FILE)} → ${url} (commit it)`);
}
await smokeTest(url, secrets);

console.log(`
✔ API live at ${url}
  Portal admin: ${secrets.adminEmail} / ${secrets.adminPassword}  (also in ${path.relative(ROOT, SECRETS)})
  Demo workers: 11001–11012, 12001–12012, 13001–13012, 14001–14012, PIN 1234
  Next: \`npm run android\` builds the phone app against it.
`);
